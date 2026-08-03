'use server';

import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { createAdminReadClient } from '@/lib/admin/client';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { inviteInput, roleChange, profileId as profileIdSchema } from '@/lib/schemas/user';
import { assertRowAffected } from './resource-mutation-guards';
import { assertNotSelfDemotion, assertNotSelfDeactivation } from './user-mutation-guards';

/**
 * The only place in the product that uses the service_role key, and the
 * reason it is needed at all: creating a Supabase Auth user is a GoTrue Admin
 * API call, not a table write, and no RLS policy can grant it — there is no
 * public sign-up route for a user to take instead (PRD §3, §14.3).
 * `tests/structure/service-role-containment.test.ts` pins the production
 * caller list to this file alone.
 *
 * Everything else on this screen — the role, the name, the display label,
 * deactivation — is an ordinary admin UPDATE on `profiles` made on the
 * caller's own client, so RLS evaluates it as that admin and the audit
 * trigger attributes it to them. Reaching for the admin client for any of
 * those would remove the database's permission model from the write path for
 * no gain (`src/lib/actions/README.md`).
 *
 * **The seam that cannot be transactional** (design spec §4.6). No database
 * transaction can span an HTTP call to another service, so the invite is two
 * steps:
 *
 *  1. `inviteUserByEmail` creates the auth user. That fires the existing
 *     `on_auth_user_created` trigger, which runs `handle_new_user()`, which
 *     inserts a `profiles` row with role `viewer` — least privilege, in that
 *     call's own transaction. The audit trigger fires there too and records
 *     `created` with `actor_name = 'system'`, because a service-key call
 *     carries no `auth.uid()`. That row is honest: at that instant no
 *     authenticated user made the write.
 *  2. On the caller's client, an admin-only UPDATE sets the intended role,
 *     name, label and `invited_by`, subject to `profiles_update_admin`, with
 *     its audit row carrying the real admin as actor.
 *
 * So an invitation produces two audit rows — the account appearing, and the
 * admin assigning its role — each atomic with its own mutation, neither
 * fabricated. If step 2 fails the failure direction is safe: the account
 * exists as a `viewer`, which is read access the whole client team has
 * anyway, and the thrown error names the stranded account so an admin can
 * finish it or deactivate it. There is deliberately no attempt to "roll back"
 * the auth user by deleting it — a delete that itself failed would leave a
 * worse state, and the audit row from step 1 already proves the account
 * appeared.
 */
export async function inviteUser(input: unknown): Promise<void> {
  const actor = await requireRole(['admin']);
  const parsed = inviteInput.parse(input);

  const auth = createAdminSupabase();
  const invited = await auth.auth.admin.inviteUserByEmail(parsed.email);
  if (invited.error) {
    throw new Error(`inviteUser failed at the auth step: ${invited.error.message}`);
  }
  const userId = invited.data.user?.id;
  if (!userId) throw new Error('inviteUser: the auth API returned no user id');

  // On the caller's client, so profiles_update_admin applies and the audit
  // row is attributed to this admin rather than to the service key. Matched
  // on `user_id`, which is the only key this step holds — `profiles.id` was
  // generated inside the trigger's transaction and never came back over the
  // Auth API.
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('profiles')
    .update({
      role: parsed.role,
      full_name: parsed.fullName,
      display_label: parsed.displayLabel,
      invited_by: actor.profileId,
    })
    .eq('user_id', userId)
    .select('id');
  if (error) throw stranded(parsed.email, error.message);
  try {
    // A zero-row UPDATE here is not a missing account — step 1 just created
    // it — but a refusal, or a `handle_new_user()` that did not run. Either
    // way the account is stranded as a viewer and an admin has to finish it,
    // so it reports the same repair instruction rather than a success.
    assertRowAffected('inviteUser', data);
  } catch (cause) {
    throw stranded(parsed.email, (cause as Error).message);
  }
  // no-revalidate: `profiles` feeds no public page and no CACHE_TAGS entry.
  // Nothing anonymous reads it — the public views in 0009 do not join it —
  // so there is no cached surface an invitation could make stale.
}

/**
 * The error for a half-completed invitation. Names the address, because an
 * admin reading this has to find one specific account among the rest and
 * either give it the role it was invited for or deactivate it. English in a
 * thrown server error, like every other message in this folder: it is a
 * diagnostic for an operator and a log line, not rendered copy — the screen
 * shows a localised message of its own.
 */
function stranded(email: string, detail: string): Error {
  return new Error(
    `inviteUser: ${email} was invited but its role was not set (${detail}). ` +
      'The account exists as a viewer; set its role or deactivate it.',
  );
}

/**
 * Admin only, re-checked here rather than trusted from the page: PRD §3's
 * capability table gives Users to admin alone, and `requirePageRole` on the
 * route is UX. This is the exact action the prototype got wrong — its
 * Settings tab admitted editors and offered role changes, so an editor could
 * promote themselves — and `profiles_update_admin` (0003_profiles.sql)
 * refuses it at the database regardless of what this function does.
 *
 * No audit row is written here. The `profiles_audit` trigger records the
 * change as `role_changed` automatically (0018_audit_triggers.sql), resolving
 * the actor from `auth.uid()`, inside this statement's own transaction.
 */
export async function changeUserRole(input: unknown): Promise<void> {
  const actor = await requireRole(['admin']);
  const parsed = roleChange.parse(input);
  assertNotSelfDemotion(actor.profileId, parsed.profileId, parsed.role);

  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('profiles')
    .update({ role: parsed.role })
    .eq('id', parsed.profileId)
    .select('id');
  if (error) throw new Error(`changeUserRole failed: ${error.message}`);
  assertRowAffected('changeUserRole', data);
  // no-revalidate: see inviteUser. A role change alters what one operator may
  // do inside /admin, which is uncached per-request rendering already.
}

/**
 * Deactivation, and its reverse. No auth-side call and no delete: setting
 * `is_active = false` is fully effective at the database layer, because
 * `public.current_app_role()` (0003_profiles.sql) returns null for an
 * inactive profile, so every policy in the schema stops passing for that
 * user, and `getCurrentUser()` returns null so their session cannot render an
 * admin page at all.
 *
 * There is no delete control anywhere on this screen (design spec §7
 * decision 4): deactivation is complete, and it keeps the audit trail
 * readable, whereas a hard delete of the `auth.users` row cascades to
 * `profiles` and takes the account's identity out of the record.
 *
 * Two arguments rather than one object because this is called from a table
 * row control that already holds both values separately; each is parsed on
 * arrival, and the parsed values are what the query uses.
 */
export async function setUserActive(rawId: unknown, rawActive: unknown): Promise<void> {
  const actor = await requireRole(['admin']);
  const profileId = profileIdSchema.parse(rawId);
  const isActive = z.boolean().parse(rawActive);
  assertNotSelfDeactivation(actor.profileId, profileId, isActive);

  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', profileId)
    .select('id');
  if (error) throw new Error(`setUserActive failed: ${error.message}`);
  assertRowAffected('setUserActive', data);
  // no-revalidate: see inviteUser. Nothing on the public site depends on
  // whether an operator account is active.
}
