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
 * `EXPORT_COLUMNS` is then `readonly (keyof PublicResource)[]`, which makes
 * "the export is a subset of the public view" a type-level fact rather than
 * something a reviewer has to check by eye (PRD 5.2, CLAUDE.md).
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

/** Narrow a column the base table declares NOT NULL, or say which one broke. */
function required<T>(value: T | null | undefined, column: string): T {
  if (value === null || value === undefined) {
    throw new Error(
      `resources_public.${column} was null; the base column is NOT NULL, so the view or the migration has changed`,
    );
  }
  return value;
}

export function toPublicResource(row: ResourceRow): PublicResource {
  return {
    id: required(row.id, 'id'),
    name: required(row.name, 'name'),
    partnerName: required(row.partner_name, 'partner_name'),
    partnerLogoUrl: row.partner_logo_url,
    partnerWebsiteUrl: row.partner_website_url,
    partnerTier: required(row.partner_tier, 'partner_tier'),
    resourceType: row.resource_type,
    needPrimary: required(row.need_primary, 'need_primary'),
    needSecondary: row.need_secondary,
    subCategory: row.sub_category,
    description: row.description,
    actionLabel: row.action_label,
    externalUrl: row.external_url,
    bannerImageUrl: row.banner_image_url,
    countriesEligible: row.countries_eligible ?? [],
    sectorsEligible: row.sectors_eligible ?? [],
    stagesEligible: row.stages_eligible ?? [],
    geoScope: required(row.geo_scope, 'geo_scope'),
    deadline: row.deadline,
    isFeatured: row.is_featured ?? false,
    exclusivity: row.exclusivity,
    sortOrder: row.sort_order ?? 0,
    addedDate: row.added_date,
    isClosed: row.is_closed ?? false,
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
    name: required(row.name, 'name'),
    logoUrl: row.logo_url,
    websiteUrl: row.website_url,
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
    id: required(row.id, 'id'),
    value: required(row.value, 'value'),
    label: required(row.label, 'label'),
    isHero: row.is_hero ?? false,
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
    id: required(row.id, 'id'),
    organisation: required(row.organisation, 'organisation'),
    country: row.country,
    description: row.description,
    sortOrder: row.sort_order ?? 0,
  };
}

export interface NeedCount {
  need: NeedKey;
  liveCount: number;
}

export function toNeedCount(row: NeedCountRow): NeedCount {
  return {
    need: required(row.need_primary, 'need_primary'),
    liveCount: row.live_count ?? 0,
  };
}
