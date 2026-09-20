import type { Database } from '@/lib/supabase/database.types';
import type { AuditAction } from './audit-view';
import type { ContentKey } from '@/lib/schemas/content';

export type ResourceStatus = 'live' | 'pipeline' | 'reference';

/**
 * The `need_type` enum itself, not `string`. `resources.need_primary` is an
 * enum column, so widening it here threw away a fact the database already
 * guarantees — and the loss was not theoretical: `ResourceTable` builds a
 * locale key as `` t(`need.${row.needPrimary}`) ``, which
 * `tests/structure/locale-keys.test.ts` can only check against `en.json` if
 * the set of values is knowable. Widened to `string` it was not, and that one
 * call site was the only unresolvable `t()` in `src/`.
 */
type NeedType = Database['public']['Enums']['need_type'];

export interface AdminResource {
  id: string;
  name: string;
  partner: string;
  partnerTier: string;
  resourceType: string;
  subCategory: string | null;
  needPrimary: NeedType;
  needSecondary: NeedType | null;
  geoScope: string;
  countriesEligible: string[];
  sectorsEligible: string[];
  stagesEligible: string[];
  deadline: string | null;
  status: ResourceStatus;
  isFeatured: boolean;
  sortOrder: number | null;
}

type ResourceRow = Database['public']['Tables']['resources']['Row'];

/**
 * Admin screens read base tables, not the *_public views: the views drop
 * `status`, provenance and internal columns, which are the columns these
 * screens exist to edit. Base-table rows are already correctly typed
 * (NOT NULL survives), so no null-narrowing layer is needed here — unlike
 * SP2a's readers, which narrow view rows.
 */
export function toAdminResource(row: ResourceRow): AdminResource {
  return {
    id: row.id,
    name: row.name,
    partner: row.partner,
    partnerTier: row.partner_tier,
    resourceType: row.resource_type,
    subCategory: row.sub_category,
    needPrimary: row.need_primary,
    needSecondary: row.need_secondary,
    geoScope: row.geo_scope,
    countriesEligible: row.countries_eligible,
    sectorsEligible: row.sectors_eligible,
    stagesEligible: row.stages_eligible,
    deadline: row.deadline,
    status: row.status,
    isFeatured: row.is_featured,
    sortOrder: row.sort_order,
  };
}

/**
 * One row of PRD 6.9's audit table. `diff`, `ip_hash` and `user_agent` are
 * `@sensitive` and this screen never shows them, so they have no field here
 * at all — `readAuditPage` never selects them, and this type gives nowhere
 * for one to arrive by accident.
 */
export interface AuditEntry {
  id: string;
  occurredAt: string;
  actorName: string;
  action: AuditAction;
  entityLabel: string;
  changeSummary: string;
}

/**
 * `public.site_content` narrowed to the five keys this screen edits, keyed
 * by `ContentKey` rather than left as an array of rows. A missing key reads
 * as `''` here (the same "not set" spelling `site_content.value`'s own
 * `not null default ''` already uses) rather than throwing — five rows are
 * expected, but a screen render must not crash if a sixth caller ever
 * deletes one out from under it.
 */
export type SiteContentMap = Record<ContentKey, string>;

/** One `headline_stats` row (PRD 6.7 panel 5), provenance included. */
export interface Stat {
  id: string;
  value: string;
  label: string;
  isHero: boolean;
  sortOrder: number | null;
  source: string;
  attestedBy: string;
  attestedOn: string;
}

/** One `compute_metrics` row (PRD 6.7 panel 6), provenance included. */
export interface ComputeMetric {
  id: string;
  value: string;
  label: string;
  subNote: string | null;
  sortOrder: number | null;
  source: string;
  attestedBy: string;
  attestedOn: string;
}

/** One `programmes` row (PRD 6.7 panel 7). No provenance: not a reported figure. */
export interface Programme {
  id: string;
  title: string;
  timeframe: string;
  description: string;
  sortOrder: number | null;
}

/** One `impact_stories` row (PRD 6.7 panel 8). */
export interface ImpactStory {
  id: string;
  organisation: string;
  country: string;
  description: string;
  sortOrder: number | null;
}

type HeadlineStatsRow = Database['public']['Tables']['headline_stats']['Row'];
type ComputeMetricsRow = Database['public']['Tables']['compute_metrics']['Row'];
type ProgrammesRow = Database['public']['Tables']['programmes']['Row'];
type ImpactStoriesRow = Database['public']['Tables']['impact_stories']['Row'];

export function toStat(row: HeadlineStatsRow): Stat {
  return {
    id: row.id,
    value: row.value,
    label: row.label,
    isHero: row.is_hero,
    sortOrder: row.sort_order,
    source: row.source,
    attestedBy: row.attested_by,
    attestedOn: row.attested_on,
  };
}

export function toComputeMetric(row: ComputeMetricsRow): ComputeMetric {
  return {
    id: row.id,
    value: row.value,
    label: row.label,
    subNote: row.sub_note,
    sortOrder: row.sort_order,
    source: row.source,
    attestedBy: row.attested_by,
    attestedOn: row.attested_on,
  };
}

export function toProgramme(row: ProgrammesRow): Programme {
  return {
    id: row.id,
    title: row.title,
    timeframe: row.timeframe,
    description: row.description,
    sortOrder: row.sort_order,
  };
}

export function toImpactStory(row: ImpactStoriesRow): ImpactStory {
  return {
    id: row.id,
    organisation: row.organisation,
    country: row.country,
    description: row.description,
    sortOrder: row.sort_order,
  };
}

type SubmissionRow = Database['public']['Tables']['submissions']['Row'];

/**
 * One queue entry, in the shape the review screen and the approve action
 * both read. `rejectionReason` and `sourceIpHash` are `@sensitive` and have
 * no field here; the readers select an explicit column list that never
 * fetches them. The three personal fields -- submitter name and email, and
 * the programme contact -- are here for the reviewer to see and for nothing
 * else: `submissionToResourceInput` does not read them.
 */
export interface ReviewSubmission {
  id: string;
  type: SubmissionRow['type'];
  resourceName: string;
  organisation: string | null;
  need: SubmissionRow['need'];
  link: string | null;
  description: string;
  submitterName: string | null;
  submitterEmail: string;
  programmeContactEmail: string | null;
  createdAt: string;
  targetResourceId: string | null;
  /** The target's current name, for an update suggestion; null for a new resource. */
  targetResourceName: string | null;
}

/** The explicit column list the two submission readers select. */
export const REVIEW_SUBMISSION_COLUMNS =
  'id, type, resource_name, organisation, need, link, description, submitter_name, submitter_email, programme_contact_email, created_at, target_resource_id, resources ( name )';

export function toReviewSubmission(
  row: Pick<
    SubmissionRow,
    | 'id'
    | 'type'
    | 'resource_name'
    | 'organisation'
    | 'need'
    | 'link'
    | 'description'
    | 'submitter_name'
    | 'submitter_email'
    | 'programme_contact_email'
    | 'created_at'
    | 'target_resource_id'
  > & { resources: { name: string } | null },
): ReviewSubmission {
  return {
    id: row.id,
    type: row.type,
    resourceName: row.resource_name,
    organisation: row.organisation,
    need: row.need,
    link: row.link,
    description: row.description,
    submitterName: row.submitter_name,
    submitterEmail: row.submitter_email,
    programmeContactEmail: row.programme_contact_email,
    createdAt: row.created_at,
    targetResourceId: row.target_resource_id,
    targetResourceName: row.resources?.name ?? null,
  };
}
