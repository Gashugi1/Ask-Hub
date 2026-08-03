/**
 * PRD 4.15's `audit_action` enum, in the exact order the migration declares
 * it (supabase/migrations/0007_logs.sql). Kept as a single source so the
 * filter dropdown, the reader's validation and the badge colour map cannot
 * drift out of step with one another.
 */
export const AUDIT_ACTIONS = [
  'published',
  'edited',
  'created',
  'deleted',
  'approved',
  'rejected',
  'role_changed',
  'digest_sent',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** PRD 6.9: paginate rather than loading the full table. */
export const AUDIT_PAGE_SIZE = 50;

export interface AuditFilters {
  actor: string | 'all';
  action: AuditAction | 'all';
  from: string | null;
  to: string | null;
  page: number;
}

/**
 * `YYYY-MM-DD` or nothing. `Date.parse` alone would accept `2026-02-30` by
 * rolling it over to March, so the parsed components are checked back
 * against what was typed rather than trusted at face value.
 */
function parseDateFilter(raw: string | null): string | null {
  if (!raw) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const asDate = new Date(Date.UTC(year, month - 1, day));
  const rollover =
    asDate.getUTCFullYear() !== year ||
    asDate.getUTCMonth() !== month - 1 ||
    asDate.getUTCDate() !== day;
  return rollover ? null : raw;
}

/**
 * The URL is the single source of filter state (same convention as
 * `parseResourceQuery`). Anything unrecognised — a stale bookmark, a
 * hand-edited query string, a value from before an enum member existed —
 * falls back to the default rather than throwing.
 */
export function parseAuditFilters(params: URLSearchParams): AuditFilters {
  const actorRaw = (params.get('actor') ?? '').trim();
  const actionRaw = params.get('action');
  const pageRaw = Number.parseInt(params.get('page') ?? '', 10);

  return {
    actor: actorRaw === '' ? 'all' : actorRaw,
    action: (AUDIT_ACTIONS as readonly string[]).includes(actionRaw ?? '')
      ? (actionRaw as AuditAction)
      : 'all',
    from: parseDateFilter(params.get('from')),
    to: parseDateFilter(params.get('to')),
    page: Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1,
  };
}

/**
 * Whether every one of the three PRD 6.9 filters (user, action, date range)
 * is off. Page is pagination, not a filter, so it plays no part here — the
 * Clear action resets filters, not the reader's position in the table.
 */
export function isClearedFilters(filters: AuditFilters): boolean {
  return (
    filters.actor === 'all' &&
    filters.action === 'all' &&
    filters.from === null &&
    filters.to === null
  );
}
