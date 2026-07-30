import { t, type Locale } from '@/lib/i18n';

/**
 * The three deadline fields `resources_public` supplies. `is_closed` is
 * `deadline is not null and deadline < current_date` and `days_left` is
 * `deadline - current_date`, both evaluated in Postgres in UTC.
 */
export interface DeadlineDisplay {
  deadline: string | null;
  isClosed: boolean;
  daysLeft: number | null;
}

/**
 * Format deadline state for display.
 *
 * This function does not read a clock, does not construct a Date, and does
 * not decide whether a deadline has passed. SQL owns that rule -- see the
 * `is_closed` and `days_left` expressions in
 * supabase/migrations/0014_partner_logos.sql -- and a second implementation
 * here would be two answers to one question, drifting the moment either
 * changed. `deadlineInfo()` in src/lib/deadline.ts still computes, because
 * SP3's admin "expiring soon" flag legitimately needs to; it must not be
 * called from the public card path.
 *
 * PRD 4.2: a past deadline changes the display, never the status.
 */
export function deadlineLabel(input: DeadlineDisplay, locale?: Locale): string {
  if (input.isClosed) return t('deadline.closed', undefined, locale);
  if (input.deadline === null || input.daysLeft === null) {
    return t('deadline.rolling', undefined, locale);
  }
  if (input.daysLeft <= 0) return t('deadline.today', undefined, locale);
  if (input.daysLeft === 1) return t('deadline.oneDay', undefined, locale);
  return t('deadline.daysLeft', { count: input.daysLeft }, locale);
}
