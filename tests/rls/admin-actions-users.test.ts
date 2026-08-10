import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { type SupabaseClient } from '@supabase/supabase-js';
import { anonClient, ensureTestUsers, roleClient, serviceClient } from '../helpers/clients';

/**
 * The database boundary behind `/admin/users`.
 *
 * The server actions themselves cannot be invoked here — each opens with
 * `requireRole`, which resolves the caller from `next/headers`'s `cookies()`,
 * and there is no request-scoped cookie jar outside a real Next.js request
 * (the same limitation `tests/rls/admin-actions-resources.test.ts` records).
 * That is the point rather than a shortfall: this suite asserts the layer
 * that holds even if `requireRole` were wrong, which is the layer PRD §14.4
 * says is the actual boundary. The action-level guards that are pure logic
 * are pinned separately in `tests/unit/user-actions.test.ts`.
 *
 * **Fixture hygiene** (house rule, `tests/rls/site.test.ts:33-45`). This
 * suite creates auth users, so it is the most destructive one in the
 * repository if it is careless. Two rules it follows without exception:
 *
 *  - It never deletes, deactivates or leaves a changed role on the three
 *    shared fixture users (`rls-admin@`, `rls-editor@`, `rls-viewer@`). Every
 *    other RLS suite depends on them, there is no `db:reset` between suite
 *    runs, and the one case that must sign in as a deactivated user
 *    deactivates a throwaway account of its own instead.
 *  - Every auth user it creates is deleted in `afterAll` via
 *    `auth.admin.deleteUser`, which cascades to `profiles`. Ids are captured
 *    into the module-level list at creation time, before any assertion that
 *    could throw, so a mid-test failure still cleans up.
 */

const stamp = Date.now();
const password = 'Users-Boundary-Passw0rd!';
const createdUserIds: string[] = [];

/**
 * A `site_content` row this suite owns, so the "a deactivated account's
 * writes are refused" case never touches a migration-authored key. Following
 * `tests/rls/site.test.ts`'s throwaway-key approach: it proves the same
 * permission boundary, and cleanup is an unconditional delete rather than a
 * captured value to put back correctly.
 */
const probeContentKey = `users_boundary_probe_${stamp}`;
const probeContentValue = 'probe';

/** A client signed in as a throwaway account created by this suite. */
async function signedInClient(email: string): Promise<SupabaseClient> {
  // Via anonClient() rather than createClient(process.env...) directly: that
  // module asserts a loopback target at load, and building a client here from
  // the raw env would step around it.
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

/**
 * A throwaway account with its own auth user and profile. Returns both ids:
 * `profiles.id` is what the screen's actions address, `auth.users.id` is what
 * cleanup needs.
 */
async function makeUser(
  svc: SupabaseClient,
  slug: string,
): Promise<{ email: string; userId: string; profileId: string }> {
  const email = `users-boundary-${slug}-${stamp}@askhub.test`;
  const created = await svc.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw new Error(`createUser failed for ${email}: ${created.error.message}`);
  const userId = created.data.user!.id;
  // Captured before anything that can throw, so afterAll can always clean up.
  createdUserIds.push(userId);

  const { data, error } = await svc
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return { email, userId, profileId: data!.id as string };
}

describe('profiles writes are admin-only at the database boundary', () => {
  beforeAll(async () => {
    await ensureTestUsers();
    const { error } = await serviceClient()
      .from('site_content')
      .insert({ key: probeContentKey, value: probeContentValue, locale: 'en' });
    if (error) throw error;
  });

  afterAll(async () => {
    const svc = serviceClient();
    for (const userId of createdUserIds) {
      // Cascades to profiles via the FK in 0003_profiles.sql. audit_log has
      // no FK by design, so the history of what these tests did survives.
      await svc.auth.admin.deleteUser(userId);
    }
    await svc.from('site_content').delete().eq('key', probeContentKey);
  });

  it('lets an admin change a role, and the trigger records it as role_changed against that admin', async () => {
    const svc = serviceClient();
    const target = await makeUser(svc, 'role');

    const admin = await roleClient('admin');
    const { error } = await admin
      .from('profiles')
      .update({ role: 'editor' })
      .eq('id', target.profileId);
    expect(error).toBeNull();

    // Read back through service_role rather than trusting a null error: an
    // UPDATE that matched zero rows returns exactly the same null error.
    const { data: after } = await svc
      .from('profiles')
      .select('role')
      .eq('id', target.profileId)
      .single();
    expect(after!.role).toBe('editor');

    const { data: audit } = await svc
      .from('audit_log')
      .select('action, actor_name, entity_type, change_summary')
      .eq('entity_type', 'user')
      .eq('entity_id', target.profileId)
      .order('occurred_at', { ascending: false })
      .limit(1);
    // Red if the profiles_audit trigger is dropped, or if audit_row_change's
    // `v_entity_type = 'user' and v_diff ? 'role'` branch stops firing.
    expect(audit![0]!.action).toBe('role_changed');
    // Red if the actor stopped being resolved from auth.uid() — a role change
    // attributed to 'system' is an unattributable privilege change.
    expect(audit![0]!.actor_name).not.toBe('system');
    expect(audit![0]!.change_summary).toBe('Role Viewer to Editor');
  });

  it('refuses an editor a role change — the prototype bug where an editor could promote themselves', async () => {
    const svc = serviceClient();
    const target = await makeUser(svc, 'editor-attempt');

    const editor = await roleClient('editor');
    const { error } = await editor
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', target.profileId);

    // PostgREST reports a policy-denied UPDATE as zero rows and no error, so
    // the assertion that carries the weight is the unchanged row below, not
    // the error object. Red if profiles_update_admin is widened to
    // `current_app_role() is not null`, or if any editor-writable policy is
    // added to this table.
    const { data: after } = await svc
      .from('profiles')
      .select('role')
      .eq('id', target.profileId)
      .single();
    expect(after!.role, 'an editor changed a role').toBe('viewer');
    if (error) expect(error.code).toBe('42501');
  });

  it('refuses an editor promoting their own account', async () => {
    // The precise shape of the prototype's defect: its Settings tab admitted
    // editors and offered role changes, so the account making the request was
    // also the target. Uses the shared editor fixture deliberately — that is
    // the account whose self-promotion matters — and asserts it is unchanged,
    // which also proves the fixture was left as every other suite expects.
    const editor = await roleClient('editor');
    await editor
      .from('profiles')
      .update({ role: 'admin' })
      .eq('email', 'rls-editor@askhub.test');

    const { data } = await serviceClient()
      .from('profiles')
      .select('role')
      .eq('email', 'rls-editor@askhub.test')
      .single();
    expect(data!.role, 'an editor promoted themselves to admin').toBe('editor');
  });

  it('refuses a viewer any write to profiles at all', async () => {
    const svc = serviceClient();
    const target = await makeUser(svc, 'viewer-attempt');

    const viewer = await roleClient('viewer');
    await viewer
      .from('profiles')
      .update({ display_label: 'Leadership', is_active: false })
      .eq('id', target.profileId);

    const { data: after } = await svc
      .from('profiles')
      .select('display_label, is_active')
      .eq('id', target.profileId)
      .single();
    expect(after!.display_label).toBe('');
    expect(after!.is_active).toBe(true);
  });

  it('lets an admin deactivate an account, and that alone ends the account\'s access', async () => {
    const svc = serviceClient();
    const target = await makeUser(svc, 'deactivate');

    // Give it a role that can write something, so the refusal after
    // deactivation is a change in behaviour rather than a role that never
    // could. site_content is editor-writable (0006_site.sql).
    const admin = await roleClient('admin');
    const { error: promoteError } = await admin
      .from('profiles')
      .update({ role: 'editor' })
      .eq('id', target.profileId);
    expect(promoteError).toBeNull();

    const before = await signedInClient(target.email);
    const { error: allowedError } = await before
      .from('site_content')
      .update({ value: `${probeContentValue} while active` })
      .eq('key', probeContentKey)
      .eq('locale', 'en');
    expect(allowedError, 'the account could not write even before deactivation').toBeNull();

    const { data: writtenWhileActive } = await svc
      .from('site_content')
      .select('value')
      .eq('key', probeContentKey)
      .single();
    // The before/after pair is what makes the refusal below mean something:
    // without this, a policy that never let the account write would produce
    // the same "unchanged" result and the test would pass vacuously.
    expect(writtenWhileActive!.value).toBe(`${probeContentValue} while active`);

    // The deactivation itself: an ordinary admin UPDATE, no Auth Admin API
    // call, no ban, no delete.
    const { error: deactivateError } = await admin
      .from('profiles')
      .update({ is_active: false })
      .eq('id', target.profileId);
    expect(deactivateError).toBeNull();

    // current_app_role() returns null for an inactive profile, so every
    // policy in the schema stops passing — including the SELECT policy the
    // account was reading through a moment ago. Red if `and p.is_active` is
    // dropped from current_app_role(), which is the single line the whole
    // deactivation story rests on.
    const after = await signedInClient(target.email);
    const { data: readAfter } = await after.from('profiles').select('id');
    expect(readAfter ?? [], 'a deactivated account can still read profiles').toHaveLength(0);

    await after
      .from('site_content')
      .update({ value: `${probeContentValue} after deactivation` })
      .eq('key', probeContentKey)
      .eq('locale', 'en');
    const { data: contentAfter } = await svc
      .from('site_content')
      .select('value')
      .eq('key', probeContentKey)
      .single();
    expect(contentAfter!.value, 'a deactivated account wrote site content').toBe(
      `${probeContentValue} while active`,
    );

    // Reactivation restores it, which is why there is no delete control.
    const { error: reactivateError } = await admin
      .from('profiles')
      .update({ is_active: true })
      .eq('id', target.profileId);
    expect(reactivateError).toBeNull();
    const restored = await signedInClient(target.email);
    const { data: readRestored } = await restored.from('profiles').select('id');
    expect((readRestored ?? []).length).toBeGreaterThan(0);
  });

  it('records the invite seam as two rows: the account appearing, then the admin naming it', async () => {
    const svc = serviceClient();
    // Step 1 of the seam (design spec §4.6): a service-key auth call creates
    // the user, handle_new_user() inserts a viewer profile in that call's own
    // transaction, and the audit trigger records it with no auth.uid() to
    // resolve. 'system' is accurate there — at that instant no authenticated
    // user made the write — and must not be dressed up as the inviting admin.
    const target = await makeUser(svc, 'invite-seam');

    const { data: creation } = await svc
      .from('audit_log')
      .select('action, actor_name')
      .eq('entity_type', 'user')
      .eq('entity_id', target.profileId)
      .order('occurred_at', { ascending: true })
      .limit(1);
    expect(creation![0]!.action).toBe('created');
    expect(creation![0]!.actor_name).toBe('system');

    // Step 2: the admin's own attributed UPDATE, which is what the action
    // does on the caller's client.
    const admin = await roleClient('admin');
    const { error } = await admin
      .from('profiles')
      .update({ role: 'editor', full_name: 'Invite Seam Target', display_label: 'Leadership' })
      .eq('id', target.profileId);
    expect(error).toBeNull();

    const { data: rows } = await svc
      .from('audit_log')
      .select('action, actor_name')
      .eq('entity_type', 'user')
      .eq('entity_id', target.profileId)
      .order('occurred_at', { ascending: true });
    // Exactly two rows, each atomic with its own mutation and neither
    // fabricated. Red if anything starts writing a third, synthetic row.
    expect(rows).toHaveLength(2);
    expect(rows![1]!.action).toBe('role_changed');
    expect(rows![1]!.actor_name).not.toBe('system');
  });

  it('accepts a display label that says anything, on any role', async () => {
    // PRD §3: display_label is free text and independent of role. "Leadership"
    // on a viewer is legitimate; no check anywhere may reject it or infer a
    // role from it. Red if a CHECK constraint or a trigger is added that ties
    // the two together.
    const svc = serviceClient();
    const target = await makeUser(svc, 'label');
    const admin = await roleClient('admin');
    const { error } = await admin
      .from('profiles')
      .update({ display_label: 'Leadership', role: 'viewer' })
      .eq('id', target.profileId);
    expect(error).toBeNull();

    const { data: after } = await svc
      .from('profiles')
      .select('display_label, role')
      .eq('id', target.profileId)
      .single();
    expect(after!.display_label).toBe('Leadership');
    expect(after!.role).toBe('viewer');
  });
});

