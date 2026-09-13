import { describe, it, expect } from 'vitest';
import { parseResourceQuery, filterAdminResources, tabCounts } from '@/lib/admin/resource-view';
import type { AdminResource } from '@/lib/admin/types';

function res(overrides: Partial<AdminResource> = {}): AdminResource {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'GPU allocation programme',
    partner: 'CINECA Leonardo',
    partnerTier: 'strategic',
    resourceType: 'Credits',
    subCategory: 'HPC allocation',
    needPrimary: 'compute',
    needSecondary: null,
    geoScope: 'partner_countries',
    countriesEligible: ['Kenya'],
    sectorsEligible: [],
    stagesEligible: ['Building'],
    deadline: null,
    status: 'live',
    isFeatured: false,
    sortOrder: 10,
    ...overrides,
  };
}

/** Days from today as an ISO date, so tests do not pin a calendar date. */
function inDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('parseResourceQuery', () => {
  it('defaults to the All tab with no filters', () => {
    expect(parseResourceQuery(new URLSearchParams())).toEqual({
      tab: 'all',
      search: '',
      status: 'all',
      need: 'all',
    });
  });

  it('ignores a tab, status or need it does not recognise', () => {
    const q = parseResourceQuery(new URLSearchParams('tab=nonsense&status=deleted&need=vibes'));
    expect(q).toEqual({ tab: 'all', search: '', status: 'all', need: 'all' });
  });

  it('reads the three real tabs and trims the search term', () => {
    expect(parseResourceQuery(new URLSearchParams('tab=closed&q=  gpu  ')).tab).toBe('closed');
    expect(parseResourceQuery(new URLSearchParams('q=  gpu  ')).search).toBe('gpu');
  });
});

describe('filterAdminResources', () => {
  const all = [
    res({ id: 'a', name: 'Rolling credits', deadline: null }),
    res({ id: 'b', name: 'Closing tomorrow', deadline: inDays(1) }),
    res({ id: 'c', name: 'Closing in a fortnight', deadline: inDays(14) }),
    res({ id: 'd', name: 'Closing later', deadline: inDays(15) }),
    res({ id: 'e', name: 'Already closed', deadline: inDays(-1) }),
    res({ id: 'f', name: 'Pipeline item', status: 'pipeline', partner: 'AWS' }),
  ];

  it('Expiring soon holds 14 days and excludes 15', () => {
    const ids = filterAdminResources(all, parseResourceQuery(new URLSearchParams('tab=expiring'))).map((r) => r.id);
    expect(ids).toEqual(['b', 'c']);
  });

  it('Closed holds only a past deadline, and status is untouched', () => {
    const closed = filterAdminResources(all, parseResourceQuery(new URLSearchParams('tab=closed')));
    expect(closed.map((r) => r.id)).toEqual(['e']);
    // CLAUDE.md: a past deadline displays as Closed and is flagged in admin;
    // its status does not change.
    expect(closed[0]!.status).toBe('live');
  });

  it('searches name and partner, case-insensitively', () => {
    expect(filterAdminResources(all, parseResourceQuery(new URLSearchParams('q=aws'))).map((r) => r.id)).toEqual(['f']);
    expect(filterAdminResources(all, parseResourceQuery(new URLSearchParams('q=ROLLING'))).map((r) => r.id)).toEqual(['a']);
  });

  it('filters by status independently of the tab', () => {
    expect(
      filterAdminResources(all, parseResourceQuery(new URLSearchParams('status=pipeline'))).map((r) => r.id),
    ).toEqual(['f']);
  });
});

describe('tabCounts', () => {
  it('counts every row for All and splits the rest by deadline state', () => {
    const rows = [
      res({ id: 'a', deadline: null }),
      res({ id: 'b', deadline: inDays(60) }),
      res({ id: 'c', deadline: inDays(5) }),
      res({ id: 'd', deadline: inDays(-5) }),
      res({ id: 'e', deadline: inDays(-40), status: 'pipeline' }),
    ];
    expect(tabCounts(rows)).toEqual({ all: 5, expiring: 1, closed: 2 });
  });

  it('is zero everywhere for an empty table', () => {
    expect(tabCounts([])).toEqual({ all: 0, expiring: 0, closed: 0 });
  });
});
