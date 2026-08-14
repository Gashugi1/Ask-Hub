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

/**
 * The columns the download is allowed to contain, written out.
 *
 * Pinned rather than derived, and that is the whole point of the assertion:
 * every other check in this block passed when `'partnerTier'` was added to
 * `EXPORT_COLUMNS`, because a scan for forbidden substrings can only catch a
 * column whose *name* is incriminating and no key of `PublicResource` has
 * one. Widening the export is a decision, so it has to be made twice — once
 * in `src/lib/public/export.ts` and once here, in a test whose failure says
 * what the reviewer is being asked to approve.
 */
const PUBLISHED_COLUMNS = [
  'name',
  'partnerName',
  'resourceType',
  'needPrimary',
  'needSecondary',
  'subCategory',
  'description',
  'externalUrl',
  'countriesEligible',
  'sectorsEligible',
  'stagesEligible',
  'geoScope',
  'deadline',
  'addedDate',
];

describe('EXPORT_COLUMNS', () => {
  it('is exactly the agreed set of columns, in order', () => {
    expect(
      [...EXPORT_COLUMNS],
      'the public export gained or lost a column — PRD 5.2 and CLAUDE.md govern what may ' +
        'leave the site in a download, so update PUBLISHED_COLUMNS deliberately',
    ).toEqual(PUBLISHED_COLUMNS);
  });

  it('names only real resources_public columns', () => {
    // The subset relation is already a type-level fact: EXPORT_COLUMNS is
    // (keyof PublicResource)[] and RESOURCE_VIEW_COLUMNS maps every one of
    // those to a keyof ResourceRow. This asserts it at runtime too, so a
    // hand-edited literal cannot slip past.
    for (const column of EXPORT_COLUMNS) {
      expect(RESOURCE_VIEW_COLUMNS[column], `${column} is not a public view column`).toBeDefined();
    }
  });

  it('reads a public view that carries no analytics or internal field at all', () => {
    // CLAUDE.md and PRD 5.2: anonymous reads go through public-safe views that
    // exclude views, clicks, CTR, submitter emails and internal notes.
    //
    // Asserted against the view mapping rather than against EXPORT_COLUMNS,
    // which is where this check used to point and where it could never fail:
    // EXPORT_COLUMNS is typed `(keyof PublicResource)[]`, and no key of
    // PublicResource contains any of these substrings, so the loop was a
    // tautology dressed as a security floor.
    //
    // What this actually enforces, and nothing more: that the hand-maintained
    // literal RESOURCE_VIEW_COLUMNS (src/lib/public/types.ts) names no
    // forbidden field, in either the camelCase key or the database column
    // behind it. It does NOT observe the SQL view's live column set. The map's
    // value type is `keyof ResourceRow`, which is generated from the view, so
    // there is a link — but only in the removal direction, and only once
    // someone re-runs `npm run db:types`. It is not a completeness link: the
    // view projects 28 columns and this map names 25. So a column ADDED to the
    // view in a migration never reaches this assertion. An earlier version of
    // this comment claimed this test guarded that; a `::text`-cast internal
    // status aliased onto the view was demonstrated to pass the entire suite.
    //
    // G17/G18 in tests/rls/schema-guards.test.ts cover the live column set,
    // pinning every output column of every *_public view against a registry by
    // name, so a cast, an alias or a bare column cannot add one unnoticed.
    // What NOTHING here covers: repointing an already-registered column at
    // internal data. `r.status::text as sub_category` is the same leak wearing
    // a registered name, and it passes this suite entire. That is not a G17
    // limit to be reviewed around — it is a whole-suite limit, and it applies
    // to every registered column whose value no test asserts on.
    const surface = [
      ...Object.keys(RESOURCE_VIEW_COLUMNS),
      ...Object.values(RESOURCE_VIEW_COLUMNS),
    ]
      .join(' ')
      .toLowerCase();
    for (const forbidden of ['view', 'click', 'ctr', 'internal', 'note', 'submitter', 'email', 'status']) {
      expect(surface, `${forbidden} reached the public resource view`).not.toContain(forbidden);
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
  it('writes header labels a reader can read, never a raw locale key', () => {
    // `t()` returns the key itself when en.json has no entry for it, which is
    // right for a screen — a visible token beats blank space — and wrong for a
    // file that leaves the site. `toExportRows` builds every header as
    // t(`column.${c}`), so a column added to EXPORT_COLUMNS without its
    // `column.*` entry ships a spreadsheet whose header row reads literally
    // `column.partnerTier`. That was one line away from happening, with the
    // suite green, because nothing compared the two lists.
    //
    // tests/structure/locale-keys.test.ts now guards the general case across
    // src/. This is the same property asserted where it is actually visible to
    // a user: on the header row itself.
    const [headers = []] = toExportRows([]);
    expect(headers).toHaveLength(EXPORT_COLUMNS.length);
    for (const [index, header] of headers.entries()) {
      expect(header, `header ${index} is empty`).not.toBe('');
      expect(
        header,
        `the header for ${EXPORT_COLUMNS[index]} is the raw locale key "${header}" — add ` +
          `"column.${EXPORT_COLUMNS[index]}" to src/locales/en.json`,
      ).not.toMatch(/^column\./);
    }
  });

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
