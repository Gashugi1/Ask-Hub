import type { Database } from '@/lib/supabase/database.types';

type ResourceRow = Database['public']['Views']['resources_public']['Row'];
type PartnerRow = Database['public']['Views']['partners_public']['Row'];
type StatRow = Database['public']['Views']['headline_stats_public']['Row'];
type StoryRow = Database['public']['Views']['impact_stories_public']['Row'];
type NeedCountRow = Database['public']['Views']['need_counts_public']['Row'];

export type NeedKey = Database['public']['Enums']['need_type'];
export type GeoScope = Database['public']['Enums']['geo_scope'];
export type Exclusivity = Database['public']['Enums']['exclusivity'];
export type PartnerTier = Database['public']['Enums']['partner_tier'];

/**
 * The shape the public UI consumes.
 *
 * Postgres discards NOT NULL when a column passes through a view, so every
 * field of the generated `Row` types is `| null`. Narrowing once here, at the
 * boundary, is what keeps `?? ''` out of every component -- and turns the
 * one place the database contract could be violated into one function with
 * its own test, rather than thirty silent coalesces.
 */
export interface PublicResource {
  id: string;
  name: string;
  partnerName: string;
  partnerLogoUrl: string | null;
  partnerWebsiteUrl: string | null;
  partnerTier: PartnerTier;
  resourceType: string | null;
  needPrimary: NeedKey;
  needSecondary: NeedKey | null;
  subCategory: string | null;
  description: string | null;
  actionLabel: string | null;
  externalUrl: string | null;
  bannerImageUrl: string | null;
  countriesEligible: string[];
  sectorsEligible: string[];
  stagesEligible: string[];
  geoScope: GeoScope;
  deadline: string | null;
  isFeatured: boolean;
  exclusivity: Exclusivity | null;
  sortOrder: number;
  addedDate: string | null;
  /** Computed in SQL from current_date. Never recomputed in TypeScript. */
  isClosed: boolean;
  /** Computed in SQL: deadline - current_date. Null when there is no deadline. */
  daysLeft: number | null;
}

/**
 * Which `resources_public` column each domain field came from.
 *
 * Typed `Record<keyof PublicResource, keyof ResourceRow>` so the compiler
 * proves two things the export feature depends on: the mapping is exhaustive,
 * and every value names a column that actually exists on the public view.
 * A later task (Task 4) is expected to derive an `EXPORT_COLUMNS` list of
 * type `readonly (keyof PublicResource)[]` from this map, so "the export is
 * a subset of the public view" becomes a type-level fact rather than
 * something a reviewer has to check by eye (PRD 5.2, CLAUDE.md) -- that list
 * does not exist yet; this map is only the foundation it will read from.
 */
export const RESOURCE_VIEW_COLUMNS: Record<keyof PublicResource, keyof ResourceRow> = {
  id: 'id',
  name: 'name',
  partnerName: 'partner_name',
  partnerLogoUrl: 'partner_logo_url',
  partnerWebsiteUrl: 'partner_website_url',
  partnerTier: 'partner_tier',
  resourceType: 'resource_type',
  needPrimary: 'need_primary',
  needSecondary: 'need_secondary',
  subCategory: 'sub_category',
  description: 'description',
  actionLabel: 'action_label',
  externalUrl: 'external_url',
  bannerImageUrl: 'banner_image_url',
  countriesEligible: 'countries_eligible',
  sectorsEligible: 'sectors_eligible',
  stagesEligible: 'stages_eligible',
  geoScope: 'geo_scope',
  deadline: 'deadline',
  isFeatured: 'is_featured',
  exclusivity: 'exclusivity',
  sortOrder: 'sort_order',
  addedDate: 'added_date',
  isClosed: 'is_closed',
  daysLeft: 'days_left',
};

/**
 * Narrow a value guaranteed non-null -- either a column the base table
 * declares NOT NULL, or a view expression that is structurally incapable of
 * evaluating to null (see the `is_closed`/`live_count` call sites below) --
 * or say which relation and column broke.
 */
function required<T>(value: T | null | undefined, relation: string, column: string): T {
  if (value === null || value === undefined) {
    throw new Error(
      `${relation}.${column} was null; this value is guaranteed non-null, so the view, the migration or the underlying SQL expression has changed`,
    );
  }
  return value;
}

export function toPublicResource(row: ResourceRow): PublicResource {
  return {
    id: required(row.id, 'resources_public', 'id'),
    name: required(row.name, 'resources_public', 'name'),
    partnerName: required(row.partner_name, 'resources_public', 'partner_name'),
    partnerLogoUrl: row.partner_logo_url,
    partnerWebsiteUrl: row.partner_website_url,
    partnerTier: required(row.partner_tier, 'resources_public', 'partner_tier'),
    resourceType: row.resource_type,
    needPrimary: required(row.need_primary, 'resources_public', 'need_primary'),
    needSecondary: row.need_secondary,
    subCategory: row.sub_category,
    description: row.description,
    actionLabel: row.action_label,
    externalUrl: row.external_url,
    bannerImageUrl: row.banner_image_url,
    countriesEligible: row.countries_eligible ?? [],
    sectorsEligible: row.sectors_eligible ?? [],
    stagesEligible: row.stages_eligible ?? [],
    geoScope: required(row.geo_scope, 'resources_public', 'geo_scope'),
    deadline: row.deadline,
    // resources.is_featured is NOT NULL DEFAULT false.
    isFeatured: required(row.is_featured, 'resources_public', 'is_featured'),
    exclusivity: row.exclusivity,
    // resources.sort_order is a genuinely nullable integer column (no NOT
    // NULL, no default) -- an admin-curated resource can have no explicit
    // position yet, so 0 is a real default, not a mask over a broken
    // guarantee. Confirmed against information_schema.columns.
    sortOrder: row.sort_order ?? 0,
    addedDate: row.added_date,
    // is_closed is not a base column: it is 0014_partner_logos.sql's
    // `(deadline is not null and deadline < current_date)` expression, which
    // can only ever evaluate to true or false for a row that exists -- never
    // null. Defaulting a null here to false would render an actually-closed
    // resource as open and inviting applications, which is exactly the
    // failure CLAUDE.md's deadline rule exists to prevent, so this throws
    // rather than coalesces.
    isClosed: required(row.is_closed, 'resources_public', 'is_closed'),
    // days_left is `deadline - current_date`: genuinely null whenever a
    // resource has no deadline (PRD 4.2's "Rolling" case), so it keeps its
    // nullable type with no coalesce and no throw.
    daysLeft: row.days_left,
  };
}

export interface PublicPartner {
  name: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  sortOrder: number;
}

export function toPublicPartner(row: PartnerRow): PublicPartner {
  return {
    name: required(row.name, 'partners_public', 'name'),
    logoUrl: row.logo_url,
    websiteUrl: row.website_url,
    // partners.sort_order is nullable (no NOT NULL, no default), same shape
    // as resources.sort_order above. Confirmed against
    // information_schema.columns.
    sortOrder: row.sort_order ?? 0,
  };
}

export interface PublicStat {
  id: string;
  value: string;
  label: string;
  isHero: boolean;
  sortOrder: number;
}

export function toPublicStat(row: StatRow): PublicStat {
  return {
    id: required(row.id, 'headline_stats_public', 'id'),
    value: required(row.value, 'headline_stats_public', 'value'),
    label: required(row.label, 'headline_stats_public', 'label'),
    // headline_stats.is_hero is NOT NULL DEFAULT false.
    isHero: required(row.is_hero, 'headline_stats_public', 'is_hero'),
    // headline_stats.sort_order is nullable, same shape as the others above.
    sortOrder: row.sort_order ?? 0,
  };
}

export interface PublicStory {
  id: string;
  organisation: string;
  country: string | null;
  description: string | null;
  sortOrder: number;
}

export function toPublicStory(row: StoryRow): PublicStory {
  return {
    id: required(row.id, 'impact_stories_public', 'id'),
    organisation: required(row.organisation, 'impact_stories_public', 'organisation'),
    country: row.country,
    description: row.description,
    // impact_stories.sort_order is nullable, same shape as the others above.
    sortOrder: row.sort_order ?? 0,
  };
}

export interface NeedCount {
  need: NeedKey;
  liveCount: number;
}

export function toNeedCount(row: NeedCountRow): NeedCount {
  return {
    need: required(row.need, 'need_counts_public', 'need'),
    // live_count is `count(*)::integer` from a view that groups by need
    // across both need_primary and need_secondary
    // (0017_need_counts_secondary.sql): not a base column, so information_schema
    // cannot vouch for it, but COUNT(*) is SQL-guaranteed to never return
    // null, and a GROUP BY row only exists when at least one matching
    // resource does. The same reasoning as is_closed above applies: a null
    // here means the aggregate stopped being an aggregate, so throw rather
    // than silently reporting zero live resources for a need that has some.
    liveCount: required(row.live_count, 'need_counts_public', 'live_count'),
  };
}
