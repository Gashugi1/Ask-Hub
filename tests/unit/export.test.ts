import { describe, it, expect } from 'vitest';
import { EXPORT_COLUMNS, toCsvText, toExportRows } from '@/lib/public/export';
import { RESOURCE_VIEW_COLUMNS, type PublicResource } from '@/lib/public/types';

function resource(overrides: Partial<PublicResource> = {}): PublicResource {
  return {
    id: 'r1',
    name: 'Cloud credits programme',
    partnerName: 'Amazon Web Services',
    partnerLogoUrl: null,
    partnerWebsiteUrl: null,
    partnerTier: 'strategic',
    resourceType: 'Credits',
    needPrimary: 'compute',
    needSecondary: null,
    subCategory: 'Cloud credits',
    description: 'Credits for early-stage teams.',
    actionLabel: null,
    externalUrl: 'https://example.org',
    bannerImageUrl: null,
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

describe('EXPORT_COLUMNS', () => {
  it('names only real resources_public columns', () => {
    // The subset relation is already a type-level fact: EXPORT_COLUMNS is
    // (keyof PublicResource)[] and RESOURCE_VIEW_COLUMNS maps every one of
    // those to a keyof ResourceRow. This asserts it at runtime too, so a
    // hand-edited literal cannot slip past.
    for (const column of EXPORT_COLUMNS) {
      expect(RESOURCE_VIEW_COLUMNS[column], `${column} is not a public view column`).toBeDefined();
    }
  });

  it('excludes every analytics and internal field', () => {
    // CLAUDE.md and PRD 5.2: the public export must exclude views, clicks,
    // CTR, internal notes and submitter emails. None of them exist on
    // resources_public, so this is a floor that must not be lowered later.
    const columns = EXPORT_COLUMNS.map(String).join(' ').toLowerCase();
    for (const forbidden of ['view', 'click', 'ctr', 'internal', 'note', 'submitter', 'email', 'status']) {
      expect(columns, `${forbidden} reached the public export`).not.toContain(forbidden);
    }
  });

  it('excludes the internal ordering and logo fields nobody exports', () => {
    for (const column of ['id', 'sortOrder', 'partnerLogoUrl', 'bannerImageUrl', 'isFeatured', 'daysLeft']) {
      expect(EXPORT_COLUMNS as readonly string[]).not.toContain(column);
    }
  });
});

describe('toCsvText', () => {
  const headers = Object.fromEntries(EXPORT_COLUMNS.map((c) => [c, String(c)]));

  it('writes a header row followed by one row per resource', () => {
    const lines = toCsvText([resource(), resource({ id: 'r2' })], headers).split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(EXPORT_COLUMNS.join(','));
  });

  it('quotes a field containing a comma', () => {
    const csv = toCsvText([resource({ name: 'Credits, compute and training' })], headers);
    expect(csv).toContain('"Credits, compute and training"');
  });

  it('doubles an embedded quote', () => {
    const csv = toCsvText([resource({ name: 'The "flagship" programme' })], headers);
    expect(csv).toContain('"The ""flagship"" programme"');
  });

  it('quotes a field containing a newline rather than breaking the row', () => {
    const csv = toCsvText([resource({ description: 'Line one\nLine two' })], headers);
    expect(csv).toContain('"Line one\nLine two"');
    // Header + one data row, and the embedded newline did not create a third.
    expect(csv.split('\r\n')).toHaveLength(2);
  });

  it('joins an array field with a semicolon so a comma cannot split it', () => {
    const csv = toCsvText([resource()], headers);
    expect(csv).toContain('Kenya; Ghana');
  });

  it('writes an empty string for a null field, never the word null', () => {
    const csv = toCsvText([resource({ description: null, deadline: null })], headers);
    expect(csv).not.toContain('null');
  });

  it('prefixes a field starting with a formula character', () => {
    // A cell beginning with = + - or @ is executed as a formula by Excel and
    // Sheets. The directory is partner-supplied text on a UN surface; a
    // pasted export must not run anything.
    const csv = toCsvText([resource({ name: '=HYPERLINK("http://x")' })], headers);
    expect(csv).toContain("'=HYPERLINK");
  });
});

describe('toExportRows', () => {
  it('returns a header row plus one row per resource, matching EXPORT_COLUMNS width', () => {
    const rows = toExportRows([resource()]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveLength(EXPORT_COLUMNS.length);
    expect(rows[1]).toHaveLength(EXPORT_COLUMNS.length);
  });

  it('applies the same formula-injection guard as the CSV path', () => {
    const rows = toExportRows([resource({ name: '+1234' })]);
    expect(rows[1]?.[0]).toBe("'+1234");
  });
});
