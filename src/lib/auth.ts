import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * Why this file exists: PRD §3 and §14.4. The proxy's redirect away from
 * `/admin` for a signed-out or wrong-role visitor is UX only — it improves
 * the experience of hitting the route directly, it does not gate anything.
 * A server action can be invoked directly (a form repost, a stale client, a
 * crafted request) with no proxy in the path at all. `requireRole` is the
 * actual gate: PRD 14.4 and `src/lib/actions/README.md` both require it to be
 * the first statement of every mutating server action.
 *
 * This is defence in depth, not the only barrier. `role` is also enforced at
 * the database layer by RLS policies keyed off `public.current_app_role()`
 * (see supabase/migrations/0003_profiles.sql). If this function and RLS ever
 * disagree, RLS wins — a bug here can make the UI show or hide the wrong
 * affordances, but it cannot by itself make a viewer's write succeed.
 */

export type Role = 'admin' | 'editor' | 'viewer';

export interface CurrentUser {
  userId: string;
  profileId: string;
  email: string;
  fullName: string;
  displayLabel: string;
  role: Role;
}

/**
 * The signed-in user's identity and role, or `null` when there is no
 * authenticated session, no matching `profiles` row, or the row exists but
 * `is_active` is false. A deactivated account must be indistinguishable from
 * no account at all — this is the one function every mutating action relies
 * on to make that true.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, display_label, role, is_active')
    .eq('user_id', user.id)
    .single();

  if (!profile || !profile.is_active) return null;

  return {
    userId: user.id,
    profileId: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    displayLabel: profile.display_label,
    role: profile.role,
  };
}

/**
 * Resolves the current user and asserts their role is one of `allowed`.
 * Throws `UNAUTHENTICATED` when there is no active session, `FORBIDDEN` when
 * there is one but the role does not qualify. Every mutating server action
 * calls this first (see `src/lib/actions/README.md`) — an action reached
 * directly has had no gate applied to it before this call.
 */
export async function requireRole(allowed: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHENTICATED');
  if (!allowed.includes(user.role)) throw new Error('FORBIDDEN');
  return user;
}
