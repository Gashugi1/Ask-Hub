import { describe, it, expect } from 'vitest';
import { parseAuditFilters, isClearedFilters, AUDIT_ACTIONS } from '@/lib/admin/audit-view';

describe('parseAuditFilters', () => {
  it('defaults to everything, page 1', () => {
    expect(parseAuditFilters(new URLSearchParams())).toEqual({
      actor: 'all',
      action: 'all',
      from: null,
      to: null,
      page: 1,
    });
  });

  it('reads each of the eight actions and rejects anything else', () => {
    for (const action of AUDIT_ACTIONS) {
      expect(parseAuditFilters(new URLSearchParams(`action=${action}`)).action).toBe(action);
    }
    expect(parseAuditFilters(new URLSearchParams('action=exfiltrated')).action).toBe('all');
  });

  it('keeps a date only when it is a date', () => {
    expect(parseAuditFilters(new URLSearchParams('from=2026-07-01')).from).toBe('2026-07-01');
    expect(parseAuditFilters(new URLSearchParams('from=yesterday')).from).toBeNull();
  });

  it('clamps a nonsense page to 1', () => {
    expect(parseAuditFilters(new URLSearchParams('page=0')).page).toBe(1);
    expect(parseAuditFilters(new URLSearchParams('page=-3')).page).toBe(1);
    expect(parseAuditFilters(new URLSearchParams('page=abc')).page).toBe(1);
    expect(parseAuditFilters(new URLSearchParams('page=4')).page).toBe(4);
  });
});

describe('isClearedFilters', () => {
  it('is true only when every filter is off', () => {
    // PRD 6.9 requires a Clear action that resets every filter; this is what
    // tells the UI whether to offer it.
    expect(isClearedFilters(parseAuditFilters(new URLSearchParams()))).toBe(true);
    expect(isClearedFilters(parseAuditFilters(new URLSearchParams('action=edited')))).toBe(false);
    expect(isClearedFilters(parseAuditFilters(new URLSearchParams('from=2026-07-01')))).toBe(false);
  });
});
