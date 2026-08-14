import { describe, it, expect } from 'vitest';
import { deadlineInfo, EXPIRING_SOON_DAYS } from '@/lib/deadline';

const TODAY = new Date('2026-07-26T12:00:00Z');

/**
 * Scope of this file, stated so it is not miscounted as product coverage:
 * these seven cases pin `deadlineInfo`'s arithmetic and its label lookup,
 * with an injected clock. They prove nothing about any screen.
 *
 * The module is not dead code — src/lib/admin/resource-view.ts,
 * src/lib/admin/readers.ts and src/components/admin/ResourceTable.tsx all
 * call it — and the behaviour that reaches a user is covered where those
 * consumers are: tests/unit/admin-resource-view.test.ts for the Expiring
 * soon / Closed tabs, and tests/rls/admin-dashboard-counts.test.ts for the
 * Dashboard's "Deadlines within 14 days" card. If this file is ever the only
 * thing importing `@/lib/deadline` again, that is a finding, not a detail.
 *
 * Note that `'expiring'` is an admin-only state. The public surface does not
 * have one: it reads `is_closed`/`days_left` from `resources_public` and
 * formats them via src/lib/public/deadline-label.ts.
 */
describe('deadlineInfo', () => {
  it('treats a null deadline as rolling', () => {
    const r = deadlineInfo(null, TODAY);
    expect(r.state).toBe('rolling');
    expect(r.daysLeft).toBeNull();
    expect(r.label).toBe('Rolling');
  });

  it('marks a past deadline closed', () => {
    const r = deadlineInfo('2026-07-25', TODAY);
    expect(r.state).toBe('closed');
    expect(r.label).toBe('Closed');
  });

  it('marks today as expiring with zero days left, not closed', () => {
    const r = deadlineInfo('2026-07-26', TODAY);
    expect(r.state).toBe('expiring');
    expect(r.daysLeft).toBe(0);
  });

  it('marks a deadline 14 days out as expiring — the boundary is inclusive', () => {
    const r = deadlineInfo('2026-08-09', TODAY);
    expect(r.daysLeft).toBe(EXPIRING_SOON_DAYS);
    expect(r.state).toBe('expiring');
  });

  it('marks a deadline 15 days out as open', () => {
    const r = deadlineInfo('2026-08-10', TODAY);
    expect(r.daysLeft).toBe(15);
    expect(r.state).toBe('open');
  });

  it('renders the days-left label from the locale file', () => {
    expect(deadlineInfo('2026-08-01', TODAY).label).toBe('6 days left');
  });

  it('is not fooled by a time component on today', () => {
    const lateInDay = new Date('2026-07-26T23:59:59Z');
    expect(deadlineInfo('2026-07-26', lateInDay).state).toBe('expiring');
  });
});
