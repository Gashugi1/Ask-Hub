import 'server-only';
import { createAdminReadClient } from './client';
import { deadlineInfo } from '@/lib/deadline';
import {
  toAdminResource,
  toStat,
  toComputeMetric,
  toProgramme,
  toImpactStory,
  type AdminResource,
  type AuditEntry,
  type SiteContentMap,
  type Stat,
  type ComputeMetric,
  type Programme,
  type ImpactStory,
} from './types';
import { AUDIT_PAGE_SIZE, type AuditFilters } from './audit-view';
import { rowToResourceInput, type ResourceInput } from '@/lib/schemas/resource';
import { CONTENT_KEYS, type ContentKey } from '@/lib/schemas/content';

export interface ResourceCounts {
  live: number;
  pipeline: number;
  reference: number;
  expiringSoon: number;
}

/**
 * Uncached, deliberately. Admin reads are per-request: an editor who has just
 * saved must see their own write, and `unstable_cache` here would serve them
 * the row they just replaced. Caching belongs to the public surface, which is
 * the same read for every visitor.
 *
 * These four numbers are counted from `resources` and are therefore real.
 * Nothing on the Dashboard may show a figure that is not (CLAUDE.md).
 */
export async function readResourceCounts(): Promise<ResourceCounts> {
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase.from('resources').select('status, deadline');
  if (error) throw new Error(`admin read failed (resources): ${error.message}`);

  const rows = data ?? [];
  return {
    live: rows.filter((r) => r.status === 'live').length,
    pipeline: rows.filter((r) => r.status === 'pipeline').length,
    reference: rows.filter((r) => r.status === 'reference').length,
    // deadlineInfo returns a four-value `state`, not booleans:
    // 'rolling' | 'open' | 'expiring' | 'closed', with EXPIRING_SOON_DAYS = 14.
    // Use it; do not re-implement the 14-day rule here.
    expiringSoon: rows.filter((r) => deadlineInfo(r.deadline).state === 'expiring').length,
  };
}

/**
 * Every column this screen shows, from the base table — not the *_public
 * view, which drops `status` and the other columns this screen exists to
 * surface. Sorted by `sort_order` first (nulls last) so a curator's manual
 * ordering is visible here too, then by name for a stable tie-break.
 */
export async function readAdminResources(): Promise<AdminResource[]> {
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });
  if (error) throw new Error(`admin read failed (resources): ${error.message}`);
  return (data ?? []).map(toAdminResource);
}

/**
 * One full resource row, for the edit form. Unlike `readAdminResources`,
 * this is not narrowed through `toAdminResource` — the edit form needs every
 * editable column (`description`, `action_label`, `external_url`,
 * `banner_image_url`, `exclusivity`), which `AdminResource` deliberately
 * omits because the table view never shows them. `null` means no row with
 * that id, which the route turns into `notFound()` rather than an error.
 */
export async function readResourceForEdit(id: string): Promise<ResourceInput | null> {
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase.from('resources').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`admin read failed (resources): ${error.message}`);
  return data ? rowToResourceInput(data) : null;
}

/**
 * PRD 6.9's audit table, one page at a time. `diff`, `ip_hash` and
 * `user_agent` are `@sensitive` and this screen never displays them, so the
 * select list below is exactly the five columns the table shows plus `id` —
 * never `select('*')`, which would carry the sensitive columns to the render
 * layer even though nothing ever reads them back off the object.
 *
 * `{ count: 'exact' }` asks PostgREST for the true total matching the
 * filters (not just the page), which is what the header's entry count and
 * the pager both need — an estimated count would be a fabricated figure
 * (CLAUDE.md).
 */
export async function readAuditPage(
  filters: AuditFilters,
): Promise<{ rows: AuditEntry[]; total: number }> {
  const supabase = await createAdminReadClient();
  let query = supabase
    .from('audit_log')
    .select('id, occurred_at, actor_name, action, entity_label, change_summary', {
      count: 'exact',
    })
    .order('occurred_at', { ascending: false });

  if (filters.actor !== 'all') {
    query = query.ilike('actor_name', `%${filters.actor}%`);
  }
  if (filters.action !== 'all') {
    query = query.eq('action', filters.action);
  }
  if (filters.from) {
    query = query.gte('occurred_at', `${filters.from}T00:00:00.000Z`);
  }
  if (filters.to) {
    query = query.lte('occurred_at', `${filters.to}T23:59:59.999Z`);
  }

  const start = (filters.page - 1) * AUDIT_PAGE_SIZE;
  const end = start + AUDIT_PAGE_SIZE - 1;
  const { data, error, count } = await query.range(start, end);
  if (error) throw new Error(`admin read failed (audit_log): ${error.message}`);

  return {
    rows: (data ?? []).map((row) => ({
      id: row.id,
      occurredAt: row.occurred_at,
      actorName: row.actor_name,
      action: row.action,
      entityLabel: row.entity_label,
      changeSummary: row.change_summary,
    })),
    total: count ?? 0,
  };
}

/**
 * The five `site_content` rows this screen edits, `locale = 'en'` only —
 * the other three locales have no rows yet (PRD 12.4 ships them as stubs).
 * Missing keys default to `''`, the same "not set" spelling the column's own
 * `not null default ''` already uses, rather than throwing: a screen render
 * must not crash if a row is momentarily absent.
 *
 * Uncached, like every reader in this file: an editor who has just saved
 * must see their own write on their very next page load.
 */
export async function readSiteContent(): Promise<SiteContentMap> {
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('site_content')
    .select('key, value')
    .eq('locale', 'en')
    .in('key', CONTENT_KEYS);
  if (error) throw new Error(`admin read failed (site_content): ${error.message}`);

  const map = Object.fromEntries(CONTENT_KEYS.map((key) => [key, ''])) as SiteContentMap;
  for (const row of data ?? []) {
    if ((CONTENT_KEYS as readonly string[]).includes(row.key)) {
      map[row.key as ContentKey] = row.value;
    }
  }
  return map;
}

/** PRD 6.7 panel 5: headline reach numbers, sorted so a curator's manual ordering is visible here too. */
export async function readStats(): Promise<Stat[]> {
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('headline_stats')
    .select('*')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('label', { ascending: true });
  if (error) throw new Error(`admin read failed (headline_stats): ${error.message}`);
  return (data ?? []).map(toStat);
}

/** PRD 6.7 panel 6: the compute snapshot. */
export async function readComputeMetrics(): Promise<ComputeMetric[]> {
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('compute_metrics')
    .select('*')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('label', { ascending: true });
  if (error) throw new Error(`admin read failed (compute_metrics): ${error.message}`);
  return (data ?? []).map(toComputeMetric);
}

/** PRD 6.7 panel 7. */
export async function readProgrammes(): Promise<Programme[]> {
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('programmes')
    .select('*')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('title', { ascending: true });
  if (error) throw new Error(`admin read failed (programmes): ${error.message}`);
  return (data ?? []).map(toProgramme);
}

/** PRD 6.7 panel 8. */
export async function readImpactStories(): Promise<ImpactStory[]> {
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('impact_stories')
    .select('*')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('organisation', { ascending: true });
  if (error) throw new Error(`admin read failed (impact_stories): ${error.message}`);
  return (data ?? []).map(toImpactStory);
}
