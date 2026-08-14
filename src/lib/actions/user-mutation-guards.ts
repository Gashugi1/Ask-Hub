import type { Role } from '@/lib/auth';

/**
 * Plain helpers for `src/lib/actions/users.ts`, in a module with no
 * `'use server'` directive for the same reason as
 * `resource-mutation-guards.ts`: a `'use server'` file may export only async
 * functions, so a synchronous check like these cannot live there and still be
 * importable by a unit test.
 *
 * What they encode. PRD §3 requires at least two admin accounts before launch
 * so that a single lockout does not lock out the team, and the ordinary way
 * that requirement gets undone is not an attack — it is an admin demoting or
 * deactivating themselves while testing what the other roles see.
 *
 * These are a floor, not the whole rule, and the difference matters. Counting
 * the remaining admins inside a server action would be a race: two admins
 * demoting each other concurrently each read a count of two, each pass, and
 * the table ends with none. A real "never fewer than two admins" invariant has
 * to be evaluated inside the same transaction as the write — a database
 * constraint trigger on `profiles` — and is recorded as a follow-up rather
 * than approximated here. What is *not* racy is the check below: an admin's
 * own row cannot be demoted or deactivated by their own session, ever, and no
 * amount of concurrency changes that answer.
 */

/** Thrown message, matched by the Users screen so it can explain the refusal. */
export const SELF_DEMOTION = 'LAST_ADMIN_SELF_DEMOTION';

/** Thrown message for the deactivation half of the same rule. */
export const SELF_DEACTIVATION = 'SELF_DEACTIVATION';

/**
 * Refuses an admin's attempt to move their own account off `admin`.
 * Promoting oneself to `admin` is a no-op (the caller already is one, since
 * every action here opens with `requireRole(['admin'])`) and is allowed
 * through rather than special-cased into an error.
 */
export function assertNotSelfDemotion(
  actorProfileId: string,
  targetProfileId: string,
  nextRole: Role,
): void {
  if (targetProfileId === actorProfileId && nextRole !== 'admin') {
    throw new Error(SELF_DEMOTION);
  }
}

/**
 * Refuses an admin's attempt to deactivate their own account. Reactivating
 * one's own account is not reachable — `current_app_role()` returns null for
 * an inactive profile, so a deactivated admin has no session that could call
 * this — and is left permitted rather than guarded against a state that
 * cannot occur.
 */
export function assertNotSelfDeactivation(
  actorProfileId: string,
  targetProfileId: string,
  nextIsActive: boolean,
): void {
  if (targetProfileId === actorProfileId && !nextIsActive) {
    throw new Error(SELF_DEACTIVATION);
  }
}
