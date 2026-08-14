import { describe, it, expect } from 'vitest';
import { deadlineLabel } from '@/lib/public/deadline-label';

describe('deadlineLabel', () => {
  it('says rolling when there is no deadline', () => {
    expect(deadlineLabel({ deadline: null, isClosed: false, daysLeft: null })).toBe('Rolling');
  });

  it('says closed when SQL says it is closed', () => {
    expect(deadlineLabel({ deadline: '2026-07-01', isClosed: true, daysLeft: -29 })).toBe(
      'Closed',
    );
  });

  it('says closes today at zero days left', () => {
    expect(deadlineLabel({ deadline: '2026-07-30', isClosed: false, daysLeft: 0 })).toBe(
      'Closes today',
    );
  });

  it('singularises one day', () => {
    // "1 days left" is the kind of slip nobody notices in review and every
    // visitor notices on the page.
    expect(deadlineLabel({ deadline: '2026-07-31', isClosed: false, daysLeft: 1 })).toBe(
      '1 day left',
    );
  });

  it('counts remaining days for anything further out', () => {
    expect(deadlineLabel({ deadline: '2026-09-01', isClosed: false, daysLeft: 33 })).toBe(
      '33 days left',
    );
  });

  it('trusts isClosed over daysLeft when they disagree', () => {
    // They come from the same SQL row and cannot actually disagree. If they
    // ever do, the closed state is the safe one to show: telling someone an
    // opportunity is open when it is not wastes their application.
    expect(deadlineLabel({ deadline: '2026-07-01', isClosed: true, daysLeft: 5 })).toBe(
      'Closed',
    );
  });

  it('falls back to rolling when a deadline exists but SQL supplied no day count', () => {
    expect(deadlineLabel({ deadline: '2026-09-01', isClosed: false, daysLeft: null })).toBe(
      'Rolling',
    );
  });
});
