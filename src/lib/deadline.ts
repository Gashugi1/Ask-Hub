import { t } from '@/lib/i18n';

/**
 * Deadline display state for the **admin** surface.
 *
 * Who consumes this, so nobody has to grep for it again:
 *   - src/lib/admin/resource-view.ts — the Expiring soon / Closed tabs on
 *     /admin/resources;
 *   - src/lib/admin/readers.ts — the Dashboard's "Deadlines within 14 days"
 *     card;
 *   - src/components/admin/ResourceTable.tsx — the Deadline cell.
 *
 * The public surface does NOT use this module. It reads `is_closed` and
 * `days_left` off `resources_public`, where Postgres owns the rule, and
 * formats them with src/lib/public/deadline-label.ts. `expiring` has no
 * public meaning: the directory shows Open, Closed or Rolling, and the
 * 14-day flag is an internal curation signal only.
 *
 * Tests: tests/unit/deadline.test.ts covers the arithmetic in isolation;
 * the behaviour that reaches a screen is covered through the consumers, in
 * tests/unit/admin-resource-view.test.ts and
 * tests/rls/admin-dashboard-counts.test.ts.
 */

export const EXPIRING_SOON_DAYS = 14;

export type DeadlineState = 'rolling' | 'open' | 'expiring' | 'closed';

export interface DeadlineInfo {
  state: DeadlineState;
  daysLeft: number | null;
  label: string;
}

/**
 * Whole days between two dates, ignoring time of day.
 * Uses UTC for both dates; does not account for timezone drift.
 * A caller in a large positive UTC offset may observe the previous
 * day's state — this is intentional for SP1, as the deadline column
 * is a calendar date and the server is the authority.
 */
function daysBetween(fromISO: string, to: Date): number {
  const [y, m, d] = fromISO.split('-').map(Number) as [number, number, number];
  const target = Date.UTC(y, m - 1, d);
  const base = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((target - base) / 86_400_000);
}

/**
 * Display state for a resource deadline. Never mutates or implies a
 * status change: PRD 4.2 makes auto-close a display state only.
 */
export function deadlineInfo(
  deadline: string | null,
  today: Date = new Date(),
): DeadlineInfo {
  if (!deadline) {
    return { state: 'rolling', daysLeft: null, label: t('deadline.rolling') };
  }

  const daysLeft = daysBetween(deadline, today);

  if (daysLeft < 0) {
    return { state: 'closed', daysLeft, label: t('deadline.closed') };
  }

  const state: DeadlineState =
    daysLeft <= EXPIRING_SOON_DAYS ? 'expiring' : 'open';

  return { state, daysLeft, label: t('deadline.daysLeft', { count: daysLeft }) };
}
