import { describe, it, expect } from 'vitest';
import { resourceInput } from '@/lib/schemas/resource';

function valid(overrides: Record<string, unknown> = {}) {
  return {
    name: 'GPU allocation programme',
    partner: 'CINECA Leonardo',
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
    deadline: null,
    status: 'pipeline',
    isFeatured: false,
    exclusivity: null,
    sortOrder: 10,
    ...overrides,
  };
}

describe('resourceInput', () => {
  it('accepts a complete resource', () => {
    expect(resourceInput.safeParse(valid()).success).toBe(true);
  });

  it('requires the fields the database requires', () => {
    for (const field of ['name', 'partner', 'resourceType', 'description', 'externalUrl', 'needPrimary', 'partnerTier']) {
      expect(resourceInput.safeParse(valid({ [field]: '' })).success, field).toBe(false);
    }
  });

  it('rejects a non-https external URL', () => {
    // The database enforces this too (resources_external_url_https). The
    // schema exists so the operator gets a field-level message instead of a
    // constraint violation.
    expect(resourceInput.safeParse(valid({ externalUrl: 'http://example.org' })).success).toBe(false);
    expect(resourceInput.safeParse(valid({ externalUrl: 'javascript:alert(1)' })).success).toBe(false);
  });

  it('rejects an SVG banner in every shape the constraint catches', () => {
    for (const url of [
      'https://cdn.example.org/logo.svg',
      'https://cdn.example.org/logo.svgz',
      'https://cdn.example.org/logo.svg?v=2',
      'https://cdn.example.org/logo.svg/w_300',
    ]) {
      expect(resourceInput.safeParse(valid({ bannerImageUrl: url })).success, url).toBe(false);
    }
    expect(resourceInput.safeParse(valid({ bannerImageUrl: 'https://cdn.example.org/logo.png' })).success).toBe(true);
  });

  it('rejects an unknown enum value rather than coercing it', () => {
    expect(resourceInput.safeParse(valid({ status: 'deleted' })).success).toBe(false);
    expect(resourceInput.safeParse(valid({ needPrimary: 'vibes' })).success).toBe(false);
    expect(resourceInput.safeParse(valid({ geoScope: 'moon' })).success).toBe(false);
  });

  it('accepts every real partner tier and rejects a value outside the enum', () => {
    // partner_tier drifted from the SP3 design's original four values to
    // the prototype's real five in migration 0013_reconcile_partners.sql.
    // This asserts against the current database enum, not the stale set,
    // so a schema that hand-copied the old list would fail here.
    for (const tier of ['strategic', 'government', 'development_partner', 'academic', 'network']) {
      expect(resourceInput.safeParse(valid({ partnerTier: tier })).success, tier).toBe(true);
    }
    expect(resourceInput.safeParse(valid({ partnerTier: 'institutional' })).success).toBe(false);
  });

  it('rejects a country, sector or stage outside the reference lists', () => {
    expect(resourceInput.safeParse(valid({ countriesEligible: ['Atlantis'] })).success).toBe(false);
    expect(resourceInput.safeParse(valid({ sectorsEligible: ['Cryptocurrency'] })).success).toBe(false);
  });

  it('accepts a null deadline as Rolling and rejects a non-date', () => {
    expect(resourceInput.safeParse(valid({ deadline: null })).success).toBe(true);
    expect(resourceInput.safeParse(valid({ deadline: '2026-09-01' })).success).toBe(true);
    expect(resourceInput.safeParse(valid({ deadline: 'next Tuesday' })).success).toBe(false);
  });
});
