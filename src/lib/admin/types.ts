import type { Database } from '@/lib/supabase/database.types';

export type ResourceStatus = 'live' | 'pipeline' | 'reference';

export interface AdminResource {
  id: string;
  name: string;
  partner: string;
  partnerTier: string;
  resourceType: string;
  subCategory: string | null;
  needPrimary: string;
  needSecondary: string | null;
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
