import { z } from 'zod';
import { Constants } from '@/lib/supabase/database.types';

/**
 * Taken from the generated database types rather than retyped, exactly as
 * `src/lib/schemas/resource.ts` sources its enums: `Constants.public.Enums`
 * is emitted by `supabase gen types` as a real `as const` array per enum, so
 * a change to `public.app_role` is one `npm run db:types` away from failing
 * this schema instead of silently disagreeing with the column.
 */
const { app_role } = Constants.public.Enums;

export const ROLES = app_role;

/**
 * The invitation form's payload (PRD §3: there is no public sign-up route,
 * users are created by an admin).
 *
 * `fullName` is required, and that is a content requirement rather than a
 * form preference. `audit_row_change()` resolves `actor_name` as
 * `full_name` -> `display_label` -> `email`, and PRD 6.9 says the Audit Log
 * shows the actor's full name; leaving it optional here would put operators'
 * email addresses into an immutable, all-roles-readable log. The fallback
 * exists for accounts that predate this screen, not as a licence to invite
 * anonymous ones.
 *
 * `displayLabel` is free text, may be empty, and is INDEPENDENT of `role`
 * (PRD §3, restated in 0003_profiles.sql's own comment). "Leadership" on a
 * viewer is legitimate; nothing here may reject it, rewrite it, or infer a
 * role from it.
 *
 * The email is trimmed and lowercased before it leaves this boundary.
 * GoTrue matches addresses case-insensitively but `handle_new_user()` copies
 * `new.email` into `profiles.email` verbatim, and this screen, the RLS
 * suites and the audit label all read that column — so normalising once here
 * is what keeps one person from arriving as two rows.
 */
export const inviteInput = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  fullName: z.string().trim().min(1).max(200),
  displayLabel: z.string().trim().max(100),
  role: z.enum(app_role),
});

export type InviteInput = z.infer<typeof inviteInput>;

/**
 * A role change targets `profiles.id`, never `profiles.email` and never
 * `auth.users.id`: `id` is the column `profiles_update_admin` is evaluated
 * against and the one the table's own rows are keyed by, so an id from the
 * rendered table addresses exactly the row the admin was looking at.
 *
 * `.guid()` rather than `.uuid()`: in Zod 4 the latter additionally enforces
 * RFC 9562's version and variant nibbles, so it rejects a well-formed
 * identifier that is not v1-v8 — including the all-but-last-digit-zero ids
 * that fixtures and tests use. Postgres's own `uuid` type accepts any
 * variant, so the question this boundary must answer is "is this the shape
 * of an id this table could hold", not "which uuid algorithm produced it".
 *
 * Exported on its own as well, so `setUserActive`'s bare id argument — which
 * has no object to sit in — is validated by the identical rule rather than by
 * a second, drifting copy of it.
 */
export const profileId = z.string().guid();

export const roleChange = z.object({
  profileId,
  role: z.enum(app_role),
});

export type RoleChange = z.infer<typeof roleChange>;
