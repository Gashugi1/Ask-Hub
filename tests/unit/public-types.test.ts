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
    // resources.is_featured is NOT NULL DEFAULT false (confirmed against
    // information_schema.columns). A null here must not silently read as
    // "not featured".
    expect(() => toPublicResource(row({ is_featured: null }))).toThrow(/is_featured/);
    // is_closed is not a base column at all -- it's the view's
    // `(deadline is not null and deadline < current_date)` expression, which
    // is SQL-guaranteed to evaluate to true or false and never to null. A
    // null value here would mean the view's expression changed underneath
    // this code, and defaulting it to false would render an actually-closed
    // resource as open and inviting applications -- the one failure mode
    // CLAUDE.md's deadline rule exists to prevent. Throw, do not coalesce.
    expect(() => toPublicResource(row({ is_closed: null }))).toThrow(/is_closed/);
  });

  it('defaults sort_order instead of throwing, because the base column is genuinely nullable', () => {
    // Unlike is_featured/is_closed above, resources.sort_order is declared
    // `integer` with no NOT NULL (confirmed against information_schema.columns,
    // same shape as partners.sort_order, headline_stats.sort_order and
    // impact_stories.sort_order) -- an admin-curated resource can genuinely
    // have no explicit position yet. A coalesce here is a real default, not
    // a mask over a broken guarantee.
    const mapped = toPublicResource(row({ sort_order: null }));
    expect(mapped.sortOrder).toBe(0);
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
    // emails and internal notes. This only guards RESOURCE_VIEW_COLUMNS, a
    // hand-written constant in this file -- it fails if someone hand-adds a
    // forbidden column name to that mapping, not if resources_public itself
    // is widened in SQL to expose one of these names under a column this
    // mapping never references. The general, schema-driven version of this
    // guarantee -- that catches any *_public view exposing a forbidden
    // column regardless of what this file maps -- lives in
    // tests/rls/schema-guards.test.ts's G7.
    const columns = Object.values(RESOURCE_VIEW_COLUMNS).join(' ');
    for (const forbidden of ['views', 'clicks', 'ctr', 'internal_note', 'submitter', 'status']) {
      expect(columns, `${forbidden} reached the public domain type`).not.toContain(forbidden);
    }
  });
});
