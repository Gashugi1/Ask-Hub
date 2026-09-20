import 'server-only';
import type { Database } from '@/lib/supabase/database.types';
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
  REVIEW_SUBMISSION_COLUMNS,
  toReviewSubmission,
  type ReviewSubmission,
} from './types';
import { AUDIT_PAGE_SIZE, type AuditFilters } from './audit-view';
import type { CoverageRow } from './dashboard-view';
import { rowToResourceInput, type ResourceInput } from '@/lib/schemas/resource';
import { CONTENT_KEYS, type ContentKey } from '@/lib/schemas/content';
import { SETTING_KEYS, type SettingKey } from '@/lib/schemas/settings';
import type { Role } from '@/lib/auth';

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
 * The five columns `computeCoverage` reads, for every live resource whose
 * deadline has not passed -- the same rows the public site counts, so the
 * dashboard's by-need bars and the public browse menu agree. The date
 * boundary is `deadlineInfo`'s, the one every other surface uses; a
 * deadline of today is still open.
 */
export async function readLiveCoverage(): Promise<CoverageRow[]> {
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('resources')
    .select('need_primary, need_secondary, geo_scope, countries_eligible, sectors_eligible, deadline')
    .eq('status', 'live');
  if (error) throw new Error(`admin read failed (resources): ${error.message}`);
  return (data ?? [])
    .filter((row) => deadlineInfo(row.deadline).state !== 'closed')
    .map((row) => ({
      needPrimary: row.need_primary,
      needSecondary: row.need_secondary,
      geoScope: row.geo_scope,
      countriesEligible: row.countries_eligible,
      sectorsEligible: row.sectors_eligible,
    }));
}

/**
 * How many submissions await a reviewer. A head request with an exact
 * count: the dashboard shows the number and nothing else about the rows, so
 * none of their columns -- several of them `@sensitive` -- are fetched.
 */
export async function readPendingSubmissionCount(): Promise<number> {
  const supabase = await createAdminReadClient();
  const { count, error } = await supabase
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) throw new Error(`admin read failed (submissions): ${error.message}`);
  return count ?? 0;
}

/**
 * The review queue, oldest first so the longest wait is at the top.
 *
 * An explicit column list, never `*`: `rejection_reason` and
 * `source_ip_hash` are `@sensitive` and the screen has no use for either.
 * The target resource's current name is embedded for update suggestions,
 * so the card can say which resource the visitor meant.
 */
export async function readPendingSubmissions(): Promise<ReviewSubmission[]> {
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('submissions')
    .select(REVIEW_SUBMISSION_COLUMNS)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw new Error(`admin read failed (submissions): ${error.message}`);
  return (data ?? []).map(toReviewSubmission);
}

/**
 * One submission by id, in any status -- the actions that read it check the
 * status themselves, so a suggestion approved a moment ago from another tab
 * is refused by them with a reason rather than by this reader with nothing.
 * `null` when there is no such row.
 */
export async function readSubmissionForReview(id: string): Promise<ReviewSubmission | null> {
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('submissions')
    .select(REVIEW_SUBMISSION_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`admin read failed (submissions): ${error.message}`);
  return data ? toReviewSubmission(data) : null;
}

/**
 * Every column this screen shows, from the base table — not the *_public
 * view, which drops `status` and the other columns this screen exists to
 * surface. Sorted by `sort_order` first (nulls last) so a curator's manual
 * ordering is visible here too, then by name for a stable tie-break.
 */
export async function readAdminResources(): Promise<AdminResource[]> {
  return (await readAdminResourceRows()).map(toAdminResource);
}

type ResourceRow = Database['public']['Tables']['resources']['Row'];

/**
 * The same query, unnarrowed: every column of every resource in the table's
 * order. The resources screen reads this once and derives both the table
 * rows (`toAdminResource`) and, for a writer, the full editable input each
 * row's Edit action opens the modal with (`rowToResourceInput`) -- one query
 * rather than one per edit.
 */
export async function readAdminResourceRows(): Promise<ResourceRow[]> {
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });
  if (error) throw new Error(`admin read failed (resources): ${error.message}`);
  return data ?? [];
}

/**
 * One full resource row, for the edit modal -- the Review Queue reads the
 * target of an update suggestion through this. Unlike `readAdminResources`,
 * this is not narrowed through `toAdminResource`: the form needs every
 * editable column (`description`, `action_label`, `external_url`,
 * `banner_image_url`, `exclusivity`), which `AdminResource` deliberately
 * omits because the table view never shows them. `null` means no row with
 * that id, which the caller turns into an absent control rather than an
 * empty form.
 */
export async function readResourceForEdit(id: string): Promise<ResourceInput | null> {
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase.from('resources').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`admin read failed (resources): ${error.message}`);
  return data ? rowToResourceInput(data) : null;
}

/**
 * The partner names the resource form's `partner` select offers.
 *
 * `resources.partner` is a foreign key to `partners(name)`
 * (0014_partner_logos.sql), and `partners` has no id column — `name` is the
 * primary key. So the string this list supplies is the exact value the
 * constraint checks; there is nothing to map through.
 *
 * Only `name` is selected. The form's provider field shows nothing else, and
 * `logo_url` / `website_url` have no reason to travel to a form that cannot
 * edit them — the same explicit-column discipline as `readAuditPage`.
 *
 * Ordered by `name`, which is the primary key and therefore unique, so this
 * order is total: the same list on every render, with no tie-break needed.
 * Deliberately not by `sort_order` like the other list readers in this file:
 * that column orders the public projection (`listPublicPartners`), and
 * applying it here would scatter the names a curator is scanning for; it is
 * nullable and non-unique, so it could not order this list on its own anyway.
 *
 * Uncached, like every reader in this file: a provider created moments ago
 * must be offered on the next page load.
 */
export async function readPartnerNames(): Promise<string[]> {
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('partners')
    .select('name')
    .order('name', { ascending: true });
  if (error) throw new Error(`admin read failed (partners): ${error.message}`);
  return (data ?? []).map((row) => row.name);
}

/**
 * Every resource's title and partner, for the bulk import's duplicate check.
 *
 * Two columns and no filter: the import has to compare against everything,
 * including `pipeline` and `reference` rows, because re-importing a row that
 * is already staged would collide with `unique (partner, name)` just the same.
 *
 * Uncached, like every reader here. It is also the snapshot the *preview*
 * compares against, so the commit reads it again — the two can be minutes
 * apart, and the database is the only authority on what already exists.
 */
export async function readResourceDedupeIndex(): Promise<
  { name: string; partner: string }[]
> {
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase.from('resources').select('name, partner');
  if (error) throw new Error(`admin read failed (resources): ${error.message}`);
  return data ?? [];
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

/** The two feature-flag keys default to `false` when missing; everything else here is a string. */
const SETTING_DEFAULTS: Record<SettingKey, string | boolean> = {
  ga4_measurement_id: '',
  ga4_property_id: '',
  contact_email: '',
  feature_innovator_profiles: false,
  feature_public_impact_page: false,
};

/**
 * The five `settings` rows this screen edits. `value` is jsonb — PostgREST
 * decodes it to the matching native JS type, so a GA4 id or the mailbox
 * arrives as a `string` and a feature flag as a `boolean` with no manual
 * parsing here.
 *
 * Missing keys fall back to `SETTING_DEFAULTS` rather than throwing, same
 * as `readSiteContent`: a screen render must not crash if a row is
 * momentarily absent. In steady state all five are always present —
 * migration 0006_site.sql seeds them and no action here deletes a row.
 *
 * Uncached, like every reader in this file: an admin who has just flipped a
 * flag must see their own write on their very next page load.
 */
export async function readSettings(): Promise<Record<string, string | boolean>> {
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', SETTING_KEYS);
  if (error) throw new Error(`admin read failed (settings): ${error.message}`);

  const map: Record<string, string | boolean> = { ...SETTING_DEFAULTS };
  for (const row of data ?? []) {
    if ((SETTING_KEYS as readonly string[]).includes(row.key)) {
      map[row.key] = row.value as string | boolean;
    }
  }
  return map;
}

/**
 * One row of the Team access card on Settings (PRD 4.1). `invited_by` and `user_id` have no
 * field here and are never selected: the screen shows neither, and a
 * `select('*')` would carry the auth-side identifier into the render layer
 * for no reason — same discipline as `readAuditPage`'s explicit column list.
 *
 * `lastSignInAt` is `string | null` and is rendered exactly as stored.
 * Nothing in SP3 writes that column yet, so it is null for every account
 * today; the screen says so rather than inferring a status from it. An
 * "active now" derived from a timestamp nobody maintains would be a
 * fabricated figure on a leadership surface (CLAUDE.md).
 */
export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  displayLabel: string;
  role: Role;
  isActive: boolean;
  /** When the profile row was created -- the Team access card's Added column. */
  createdAt: string;
  lastSignInAt: string | null;
}

/**
 * Every account, active and deactivated alike — a deactivated one has to stay
 * visible or it could never be reactivated, and its absence would read as a
 * deleted account, which this screen never does.
 *
 * Uncached like every reader in this file. Ordered by name then email so the
 * list is stable across renders; `full_name` is `not null default ''`, so an
 * account invited but not yet named sorts first rather than nowhere.
 *
 * Read on the caller's client, under `profiles_select_authenticated`. Never
 * the service_role client: the whole point of the one exception in
 * `src/lib/actions/users.ts` is that it stays one.
 */
export async function readUsers(): Promise<AdminUser[]> {
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, display_label, role, is_active, created_at, last_sign_in_at')
    .order('full_name', { ascending: true })
    .order('email', { ascending: true });
  if (error) throw new Error(`admin read failed (profiles): ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    displayLabel: row.display_label,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    lastSignInAt: row.last_sign_in_at,
  }));
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
