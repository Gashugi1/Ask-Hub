import { describe, it, expect } from 'vitest';
import { resourceJsonLd, serialiseJsonLd } from '@/lib/public/jsonld';
import { RESOURCE_VIEW_COLUMNS, type PublicResource } from '@/lib/public/types';

function resource(overrides: Partial<PublicResource> = {}): PublicResource {
  return {
    id: 'r1',
    name: 'Cloud credits programme',
    partnerName: 'Amazon Web Services',
    partnerLogoUrl: null,
    partnerWebsiteUrl: 'https://aws.amazon.com',
    partnerTier: 'strategic',
    resourceType: 'Credits',
    needPrimary: 'compute',
    needSecondary: null,
    subCategory: 'Cloud credits',
    description: 'Credits for early-stage teams.',
    actionLabel: null,
    externalUrl: 'https://example.org/apply',
    bannerImageUrl: 'https://example.org/banner.png',
    countriesEligible: ['Kenya', 'Ghana'],
    sectorsEligible: [],
    stagesEligible: ['Building'],
    geoScope: 'specific',
    deadline: '2026-09-01',
    isFeatured: false,
    exclusivity: null,
    sortOrder: 0,
    addedDate: '2026-01-01',
    isClosed: false,
    daysLeft: 33,
    ...overrides,
  };
}

const CANONICAL = 'https://example.test/resources/r1';

describe('resourceJsonLd', () => {
  it('emits an Offer with the schema.org context', () => {
    const ld = resourceJsonLd(resource(), CANONICAL);
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('Offer');
  });

  it('maps every populated field to its schema.org property', () => {
    expect(resourceJsonLd(resource(), CANONICAL)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Offer',
      name: 'Cloud credits programme',
      description: 'Credits for early-stage teams.',
      url: 'https://example.org/apply',
      image: 'https://example.org/banner.png',
      availabilityEnds: '2026-09-01',
      eligibleRegion: ['Kenya', 'Ghana'],
      availability: 'https://schema.org/InStock',
      offeredBy: {
        '@type': 'Organization',
        name: 'Amazon Web Services',
        url: 'https://aws.amazon.com',
      },
    });
  });

  it('omits an absent optional property rather than emitting null or a placeholder', () => {
    const ld = resourceJsonLd(
      resource({
        description: null,
        externalUrl: null,
        bannerImageUrl: null,
        deadline: null,
        countriesEligible: [],
        partnerWebsiteUrl: null,
      }),
      CANONICAL,
    );
    for (const absent of ['description', 'image', 'availabilityEnds', 'eligibleRegion']) {
      expect(Object.keys(ld), `${absent} should be omitted, not emitted empty`).not.toContain(
        absent,
      );
    }
    // url falls back to the canonical page URL: a resource with no external
    // link still has a page, and an Offer with no url at all is less useful
    // than one pointing at where a reader can actually read about it.
    expect(ld.url).toBe(CANONICAL);
    expect(ld.offeredBy).toEqual({ '@type': 'Organization', name: 'Amazon Web Services' });
  });

  it('marks a closed resource Discontinued', () => {
    expect(resourceJsonLd(resource({ isClosed: true }), CANONICAL).availability).toBe(
      'https://schema.org/Discontinued',
    );
  });

  it('emits only properties derived from public view columns', () => {
    // The exclusion is structural -- resources_public projects no views,
    // clicks, ctr, submitter email or internal note, so none can reach here.
    // This asserts it rather than establishing it, and fails the day someone
    // widens either the view or this builder.
    const ld = resourceJsonLd(resource(), CANONICAL);
    const serialised = JSON.stringify(ld).toLowerCase();
    for (const forbidden of ['click', 'ctr', 'internal', 'submitter', 'notified', 'match_weight', 'status']) {
      expect(serialised, `${forbidden} reached the structured data`).not.toContain(forbidden);
    }
  });

  it('escapes a description that tries to close the script element', () => {
    // JSON.stringify escapes quotes and backslashes but never `<`. Inside a
    // <script> element the HTML parser is still hunting for the closing tag,
    // so an unescaped `</script>` in partner-supplied copy ends the JSON-LD
    // block and starts an executable one. This is the whole reason
    // serialiseJsonLd exists.
    const hostile = resource({ description: '</script><script>alert(1)</script>' });
    const html = serialiseJsonLd(resourceJsonLd(hostile, CANONICAL));
    expect(html).not.toContain('</script>');
    expect(html).not.toContain('<');
    expect(html).toContain('\\u003c');
    // Still valid JSON, and still the original text once parsed.
    expect(JSON.parse(html).description).toBe('</script><script>alert(1)</script>');
  });

  it('escapes ampersands so an HTML entity in copy survives round-trip', () => {
    const html = serialiseJsonLd(
      resourceJsonLd(resource({ name: 'Energy & Water programme' }), CANONICAL),
    );
    expect(html).toContain('\\u0026');
    expect(JSON.parse(html).name).toBe('Energy & Water programme');
  });

  it('draws every field it uses from a real resources_public column', () => {
    for (const field of ['name', 'description', 'externalUrl', 'bannerImageUrl', 'deadline', 'countriesEligible', 'partnerName', 'partnerWebsiteUrl', 'isClosed'] as const) {
      expect(RESOURCE_VIEW_COLUMNS[field], `${field} is not a public view column`).toBeDefined();
    }
  });
});
