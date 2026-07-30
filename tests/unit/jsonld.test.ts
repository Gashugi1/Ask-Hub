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

/**
 * Property names an anonymous reader must never receive (CLAUDE.md: public
 * reads exclude views, clicks, CTR, submitter emails and internal notes).
 * Compared as whole names, case- and underscore-insensitive, so `views`,
 * `Views` and `submitter_email` are all caught while a description containing
 * the word "electricity" is not.
 */
const FORBIDDEN_PROPERTIES = [
  'views',
  'clicks',
  'ctr',
  'clickthroughrate',
  'submitteremail',
  'internalnotes',
  'notifiedat',
  'matchweight',
  'status',
];

function normalise(key: string): string {
  return key.toLowerCase().replace(/[_-]/g, '');
}

/** Every property name appearing anywhere in the object, however deep. */
function allKeys(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) allKeys(item, out);
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      out.push(key);
      allKeys(child, out);
    }
  }
  return out;
}

function forbiddenKeys(value: unknown): string[] {
  return allKeys(value).filter((key) => FORBIDDEN_PROPERTIES.includes(normalise(key)));
}

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

  it('omits eligibleRegion when the scope is not specific, whatever the country list says', () => {
    // Nothing constrains countries_eligible against geo_scope, so a row with
    // geo_scope 'global' and a leftover country list is representable. The
    // page renders "Open worldwide" for it; emitting eligibleRegion would
    // have the same URL tell a crawler "Kenya" and a human "worldwide".
    for (const geoScope of ['global', 'all_africa', 'partner_countries'] as const) {
      const ld = resourceJsonLd(resource({ geoScope, countriesEligible: ['Kenya'] }), CANONICAL);
      expect(
        Object.keys(ld),
        `eligibleRegion contradicts the visible page for geo_scope ${geoScope}`,
      ).not.toContain('eligibleRegion');
    }
  });

  it('emits eligibleRegion for a specific scope with countries', () => {
    const ld = resourceJsonLd(
      resource({ geoScope: 'specific', countriesEligible: ['Kenya'] }),
      CANONICAL,
    );
    expect(ld.eligibleRegion).toEqual(['Kenya']);
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
    //
    // Matching is on property NAMES, not on a substring scan of the
    // serialised object: bare `ctr` matches "electricity" and bare `views`
    // would match a description mentioning views, so the old form only held
    // because the fixture copy happened to avoid those letters -- it would
    // have started failing on real partner text and, worse, `internal` was
    // the only entry a real leaked column name would have tripped.
    const ld = resourceJsonLd(resource(), CANONICAL);
    expect(forbiddenKeys(ld)).toEqual([]);

    // The detector itself, on a deliberately poisoned object. Without this the
    // assertion above passes for an empty reason -- and `views` is the first
    // field CLAUDE.md's anonymous-read rule names.
    expect(forbiddenKeys({ ...ld, views: 12, offeredBy: { ctr: 0.1 } }).sort()).toEqual([
      'ctr',
      'views',
    ]);
    // ...and it does not fire on ordinary copy that merely contains those
    // letters, which is what makes it usable against real partner text.
    expect(forbiddenKeys({ description: 'Electricity and CTR analytics training' })).toEqual([]);
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
