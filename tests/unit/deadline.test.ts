import { describe, it, expect } from 'vitest';
import { deadlineInfo, EXPIRING_SOON_DAYS } from '@/lib/deadline';

const TODAY = new Date('2026-07-26T12:00:00Z');

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
