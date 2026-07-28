import { t } from '@/lib/i18n';

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
