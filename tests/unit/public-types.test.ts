import { describe, it, expect } from 'vitest';
import {
  toPublicResource,
  RESOURCE_VIEW_COLUMNS,
  type PublicResource,
} from '@/lib/public/types';
import type { Database } from '@/lib/supabase/database.types';

type ResourceRow = Database['public']['Views']['resources_public']['Row'];

/** A row with every NOT NULL base column populated. */
function row(overrides: Partial<ResourceRow> = {}): ResourceRow {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'GPU allocation programme',
    partner_name: 'CINECA / AI Hub',
    partner_logo_url: null,
    partner_website_url: null,
    partner_tier: 'strategic',
    resource_type: 'Credits',
    need_primary: 'compute',
    need_secondary: null,
    sub_category: 'HPC allocation',
    description: 'Leonardo GPU hours for African AI teams.',
    description_fr: null,
    description_pt: null,
    description_ar: null,
    action_label: 'Apply',
    external_url: 'https://example.org/apply',
    banner_image_url: null,
    countries_eligible: ['Kenya'],
    sectors_eligible: [],
    stages_eligible: ['Building'],
    geo_scope: 'partner_countries',
    deadline: '2026-09-01',
    is_featured: true,
    exclusivity: 'exclusive',
    sort_order: 10,
    added_date: '2026-07-01',
    is_closed: false,
    days_left: 33,
    ...overrides,
  };
}

describe('toPublicResource', () => {
  it('maps every field of a complete row', () => {
    const mapped = toPublicResource(row());
    expect(mapped).toEqual<PublicResource>({
      id: '00000000-0000-0000-0000-000000000001',
      name: 'GPU allocation programme',
      partnerName: 'CINECA / AI Hub',
      partnerLogoUrl: null,
      partnerWebsiteUrl: null,
      partnerTier: 'strategic',
      resourceType: 'Credits',
      needPrimary: 'compute',
      needSecondary: null,
      subCategory: 'HPC allocation',
      description: 'Leonardo GPU hours for African AI teams.',
      actionLabel: 'Apply',
      externalUrl: 'https://example.org/apply',
      bannerImageUrl: null,
      countriesEligible: ['Kenya'],
      sectorsEligible: [],
      stagesEligible: ['Building'],
      geoScope: 'partner_countries',
      deadline: '2026-09-01',
      isFeatured: true,
      exclusivity: 'exclusive',
      sortOrder: 10,
      addedDate: '2026-07-01',
      isClosed: false,
      daysLeft: 33,
    });
  });

  it('defaults absent array columns to empty arrays, not null', () => {
    const mapped = toPublicResource(
      row({ countries_eligible: null, sectors_eligible: null, stages_eligible: null }),
    );
    expect(mapped.countriesEligible).toEqual([]);
    expect(mapped.sectorsEligible).toEqual([]);
    expect(mapped.stagesEligible).toEqual([]);
  });

  it('throws rather than dropping a row whose NOT NULL column arrived null', () => {
    // The view types are all-nullable because Postgres views lose NOT NULL,
    // but `resources.name` IS NOT NULL, so this cannot happen. If it ever
    // does, one fewer row in the directory with no error is the worst
    // available failure -- nothing looks broken. Fail loudly instead.
    expect(() => toPublicResource(row({ name: null }))).toThrow(/name/);
    expect(() => toPublicResource(row({ id: null }))).toThrow(/id/);
    expect(() => toPublicResource(row({ partner_name: null }))).toThrow(/partner_name/);
  });
});

describe('RESOURCE_VIEW_COLUMNS', () => {
  it('names a real resources_public column for every domain field', () => {
    // The Record type already forces the values to be `keyof ResourceRow`,
    // so this asserts the pairing is exhaustive at runtime too: a domain
    // field added without a column mapping fails typecheck, and a mapping
    // left behind after a field is removed fails here.
    const domainFields = Object.keys(toPublicResource(row())).sort();
    expect(Object.keys(RESOURCE_VIEW_COLUMNS).sort()).toEqual(domainFields);
  });

  it('maps to no analytics or internal column', () => {
    // CLAUDE.md: anonymous reads exclude views, clicks, CTR, submitter
    // emails and internal notes. resources_public projects none of them, so
    // this cannot fail today -- it fails the day someone widens the view.
    const columns = Object.values(RESOURCE_VIEW_COLUMNS).join(' ');
    for (const forbidden of ['views', 'clicks', 'ctr', 'internal_note', 'submitter', 'status']) {
      expect(columns, `${forbidden} reached the public domain type`).not.toContain(forbidden);
    }
  });
});
