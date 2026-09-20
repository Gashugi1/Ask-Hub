import { deadlineInfo } from '@/lib/deadline';
import { NEED_KEYS } from '@/lib/reference';
import type { AdminResource, ResourceStatus } from './types';

export type ResourceTab = 'all' | 'expiring' | 'closed';

export interface ResourceQuery {
  tab: ResourceTab;
  search: string;
  status: ResourceStatus | 'all';
  need: string | 'all';
}

export const TABS: readonly ResourceTab[] = ['all', 'expiring', 'closed'];
export const STATUSES: readonly ResourceStatus[] = ['live', 'pipeline', 'reference'];

/**
 * The URL is the single source of filter state, as on the public directory.
 * Anything unrecognised falls back to the default rather than throwing: a
 * hand-edited query string should show an unfiltered table, not an error page.
 */
export function parseResourceQuery(params: URLSearchParams): ResourceQuery {
  const tab = params.get('tab');
  const status = params.get('status');
  const need = params.get('need');
  return {
    tab: TABS.includes(tab as ResourceTab) ? (tab as ResourceTab) : 'all',
    search: (params.get('q') ?? '').trim(),
    status: STATUSES.includes(status as ResourceStatus) ? (status as ResourceStatus) : 'all',
    need: (NEED_KEYS as readonly string[]).includes(need ?? '') ? need! : 'all',
  };
}

/**
 * Tabs are deadline state, filters are stored state, and the two are
 * independent — a resource can be `live` and Closed at once, which is exactly
 * the case the Closed tab exists to surface (CLAUDE.md: a past deadline
 * displays as Closed and is flagged in admin; its status does not change).
 */
export function filterAdminResources(rows: AdminResource[], query: ResourceQuery): AdminResource[] {
  const term = query.search.toLowerCase();
  return rows.filter((row) => {
    // 'rolling' | 'open' | 'expiring' | 'closed' — the states deadline.ts
    // already defines. EXPIRING_SOON_DAYS lives there too; nothing here
    // re-derives the 14-day boundary.
    const { state } = deadlineInfo(row.deadline);
    if (query.tab === 'expiring' && state !== 'expiring') return false;
    if (query.tab === 'closed' && state !== 'closed') return false;
    if (query.status !== 'all' && row.status !== query.status) return false;
    if (query.need !== 'all' && row.needPrimary !== query.need && row.needSecondary !== query.need) {
      return false;
    }
    if (term && !`${row.name} ${row.partner}`.toLowerCase().includes(term)) return false;
    return true;
  });
}

/**
 * How many resources each tab would list, counted over the whole table
 * before search, status and need narrow it -- the prototype's
 * `All (59) · Expiring soon (3) · Closed (2)`. The number on a pill is the
 * size of the view it switches to, not of the current filtered view, so
 * the reader can tell at a glance whether a tab is worth opening.
 */
export function tabCounts(rows: readonly AdminResource[]): Record<ResourceTab, number> {
  const counts = { all: rows.length, expiring: 0, closed: 0 };
  for (const row of rows) {
    const { state } = deadlineInfo(row.deadline);
    if (state === 'expiring') counts.expiring += 1;
    else if (state === 'closed') counts.closed += 1;
  }
  return counts;
}
