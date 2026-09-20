import { describe, it, expect } from 'vitest';
import {
  validateTrackerCsv,
  normaliseForDedupe,
  IMPORT_MAX_ROWS,
  IMPORT_MAX_NEW_PARTNERS,
} from '@/lib/admin/tracker-import';
import { resourceInput } from '@/lib/schemas/resource';

const HEAD = [
  'Resource Title',
  'Provider',
  'Proposed Category',
  'One-Sentence Summary',
  'Application / Registration Link',
  'Closing Date',
  'Lifecycle State',
  'Status',
  'All Gates Passed',
];

/** Builds a CSV from partial rows, so each test states only what it varies. */
function csv(rows: Partial<Record<string, string>>[], head: string[] = HEAD): string {
  const body = rows.map((row) =>
    head.map((column) => `"${(row[column] ?? '').replace(/"/g, '""')}"`).join(','),
  );
  return [head.join(','), ...body].join('\r\n');
}

const GOOD: Record<string, string> = {
  'Resource Title': 'Compute Accelerator',
  Provider: 'CINECA',
  'Proposed Category': 'Compute',
  'One-Sentence Summary': 'GPU hours for African AI teams.',
  'Application / Registration Link': 'https://example.org/apply',
  'Closing Date': '2026-12-01',
  'Lifecycle State': 'Open',
  Status: 'Approved',
  'All Gates Passed': 'Pass',
};

const EMPTY = { existing: [], partners: [] };

/**
 * The mapper is the whole feature: it decides what reaches the database and
 * what an operator is told about the rest. Its riskiest rules are the ones no
 * screen shows — the gate columns that stop applying when absent, and the
 * dedupe normalisation.
 */
describe('validateTrackerCsv — file-level problems', () => {
  it('refuses a file with no data rows', () => {
    expect(validateTrackerCsv(HEAD.join(','), EMPTY).fileProblem?.code).toBe('noDataRows');
  });

  it('names the required columns it could not find', () => {
    // The row must carry something: an all-blank row is dropped by the
    // parser, which would report noDataRows before the columns are checked.
    const problem = validateTrackerCsv(
      csv([{ Provider: 'CINECA' }], ['Provider', 'Notes']),
      EMPTY,
    ).fileProblem;
    expect(problem?.code).toBe('missingColumns');
    expect(problem?.columns).toEqual(['Resource Title', 'Proposed Category']);
  });

  it('refuses a file with more rows than the cap', () => {
    const rows = Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, i) => ({
      ...GOOD,
      'Resource Title': `Programme ${i}`,
    }));
    const problem = validateTrackerCsv(csv(rows), EMPTY).fileProblem;
    expect(problem?.code).toBe('tooManyRows');
    expect(problem?.limit).toBe(IMPORT_MAX_ROWS);
  });

  it('refuses a file that would create more partners than the cap', () => {
    const rows = Array.from({ length: IMPORT_MAX_NEW_PARTNERS + 1 }, (_, i) => ({
      ...GOOD,
      'Resource Title': `Programme ${i}`,
      Provider: `Provider ${i}`,
    }));
    expect(validateTrackerCsv(csv(rows), EMPTY).fileProblem?.code).toBe('tooManyNewPartners');
  });
});

describe('validateTrackerCsv — the approval gates', () => {
  it('enforces both gates when the columns are present', () => {
    const rows = validateTrackerCsv(
      csv([
        { ...GOOD, Status: 'Draft' },
        { ...GOOD, 'Resource Title': 'Second', 'All Gates Passed': 'No' },
      ]),
      EMPTY,
    ).rows;
    expect(rows[0]).toMatchObject({ ok: false, code: 'notApproved', detail: 'Draft' });
    expect(rows[1]).toMatchObject({ ok: false, code: 'gatesFailed', detail: 'No' });
  });

  it('accepts Published as well as Approved, and Yes as well as Pass', () => {
    const rows = validateTrackerCsv(
      csv([{ ...GOOD, Status: 'Published', 'All Gates Passed': 'Yes' }]),
      EMPTY,
    ).rows;
    expect(rows[0]?.ok).toBe(true);
  });

  it('treats rows as approved only when BOTH gate columns are absent', () => {
    // The tracker's Import tab is already filtered, so a file with no gate
    // columns is pre-approved. This asymmetry is the subtlest rule here: a
    // file carrying just one of the two still has both enforced, which is
    // what stops a partial export importing ungated rows.
    const noGates = HEAD.filter((c) => c !== 'Status' && c !== 'All Gates Passed');
    const both = validateTrackerCsv(csv([GOOD], noGates), EMPTY);
    expect(both.preApproved).toBe(true);
    expect(both.rows[0]?.ok).toBe(true);

    const onlyStatus = HEAD.filter((c) => c !== 'All Gates Passed');
    const one = validateTrackerCsv(csv([{ ...GOOD, Status: 'Approved' }], onlyStatus), EMPTY);
    expect(one.preApproved).toBe(false);
    expect(one.rows[0]).toMatchObject({ ok: false, code: 'gatesFailed' });
  });
});

describe('validateTrackerCsv — per-row rejections', () => {
  const only = (row: Record<string, string>) => validateTrackerCsv(csv([row]), EMPTY).rows[0];

  it('rejects a missing title or provider', () => {
    expect(only({ ...GOOD, 'Resource Title': '' })?.code).toBe('missingTitle');
    expect(only({ ...GOOD, Provider: '' })?.code).toBe('missingProvider');
  });

  it('rejects a category it cannot map, naming what it saw', () => {
    expect(only({ ...GOOD, 'Proposed Category': 'Mentorship' })).toMatchObject({
      code: 'unknownCategory',
      detail: 'Mentorship',
    });
  });

  it('rejects a row with no summary', () => {
    expect(only({ ...GOOD, 'One-Sentence Summary': '' })?.code).toBe('missingSummary');
  });

  it('rejects a row with no link at all', () => {
    expect(only({ ...GOOD, 'Application / Registration Link': '' })?.code).toBe('missingLink');
  });

  it('rejects an http link rather than upgrading it', () => {
    // Rewriting the scheme would assert a TLS endpoint nobody verified and
    // point the public call to action at a URL that may not serve.
    expect(only({ ...GOOD, 'Application / Registration Link': 'http://example.org/x' })).toMatchObject(
      { code: 'insecureLink', detail: 'http://example.org/x' },
    );
  });

  it('rejects a closing date that is not YYYY-MM-DD', () => {
    expect(only({ ...GOOD, 'Closing Date': '01/12/2026' })).toMatchObject({
      code: 'badDeadline',
      detail: '01/12/2026',
    });
  });
});

describe('validateTrackerCsv — duplicates', () => {
  it('rejects a row already in the directory, naming it', () => {
    const context = {
      existing: [{ name: 'The Compute Accelerator (2026)', partner: 'CINECA' }],
      partners: ['CINECA'],
    };
    expect(validateTrackerCsv(csv([GOOD]), context).rows[0]).toMatchObject({
      code: 'duplicateExisting',
      detail: 'The Compute Accelerator (2026)',
    });
  });

  it('flags a title match under a different provider as a possible duplicate', () => {
    const context = {
      existing: [{ name: 'Compute Accelerator', partner: 'Somebody Else' }],
      partners: [],
    };
    expect(validateTrackerCsv(csv([GOOD]), context).rows[0]?.code).toBe('possibleDuplicate');
  });

  it('rejects the second occurrence within one file', () => {
    const rows = validateTrackerCsv(csv([GOOD, GOOD]), EMPTY).rows;
    expect(rows[0]?.ok).toBe(true);
    expect(rows[1]?.code).toBe('duplicateInFile');
  });
});

describe('normaliseForDedupe', () => {
  it('reduces wording variants of one title to the same key', () => {
    const target = normaliseForDedupe('Compute Accelerator');
    expect(normaliseForDedupe('The Compute Accelerator')).toBe(target);
    expect(normaliseForDedupe('compute accelerator (2026 cohort)')).toBe(target);
    expect(normaliseForDedupe('Compute  Accelerator!')).toBe(target);
    expect(normaliseForDedupe('Compute-Accelerator')).toBe(target);
  });

  it('keeps genuinely different titles apart', () => {
    expect(normaliseForDedupe('Compute Accelerator')).not.toBe(
      normaliseForDedupe('Compute Infrastructure'),
    );
  });
});

describe('validateTrackerCsv — the payload', () => {
  it('produces a payload the resource schema accepts, field for field', () => {
    const row = validateTrackerCsv(
      csv([
        {
          ...GOOD,
          'Delivery Format': 'Online',
          'Free / Paid': 'Free',
          'Intended Audience': 'Researchers',
          'Geographic Eligibility': 'All Africa',
        },
      ], [...HEAD, 'Delivery Format', 'Free / Paid', 'Intended Audience', 'Geographic Eligibility']),
      EMPTY,
    ).rows[0];

    expect(row?.ok).toBe(true);
    expect(resourceInput.safeParse(row?.payload).success).toBe(true);
    expect(row?.payload).toMatchObject({
      name: 'Compute Accelerator',
      partner: 'CINECA',
      partnerTier: 'network',
      resourceType: 'Programme',
      needPrimary: 'compute',
      needSecondary: null,
      subCategory: null,
      actionLabel: 'Apply',
      externalUrl: 'https://example.org/apply',
      bannerImageUrl: null,
      countriesEligible: [],
      sectorsEligible: [],
      geoScope: 'all_africa',
      deadline: '2026-12-01',
      status: 'live',
      isFeatured: false,
      exclusivity: null,
      sortOrder: null,
    });
    expect(row?.payload?.description).toBe(
      'GPU hours for African AI teams. Delivery: Online. Cost: Free. Eligibility: Researchers.',
    );
  });

  it('calls a course a Course and everything else a Programme', () => {
    const course = validateTrackerCsv(csv([{ ...GOOD, 'Proposed Category': 'Courses' }]), EMPTY);
    expect(course.rows[0]?.payload).toMatchObject({
      needPrimary: 'training',
      resourceType: 'Course',
    });
  });

  it('maps the category label in both its & and its and spelling', () => {
    for (const label of ['Data & Datasets', 'data and datasets', 'DATASETS']) {
      const result = validateTrackerCsv(csv([{ ...GOOD, 'Proposed Category': label }]), EMPTY);
      expect(result.rows[0]?.payload?.needPrimary, label).toBe('data');
    }
  });

  it('clears the deadline for an evergreen row', () => {
    const head = [...HEAD, 'Evergreen'];
    const rolling = validateTrackerCsv(csv([{ ...GOOD, Evergreen: 'Yes' }], head), EMPTY);
    expect(rolling.rows[0]?.payload?.deadline).toBeNull();

    const lifecycle = validateTrackerCsv(
      csv([{ ...GOOD, 'Lifecycle State': 'Rolling intake' }], head),
      EMPTY,
    );
    expect(lifecycle.rows[0]?.payload?.deadline).toBeNull();
  });

  it('lands a closed row as pipeline rather than live', () => {
    const result = validateTrackerCsv(
      csv([{ ...GOOD, 'Lifecycle State': 'Closed until further notice' }]),
      EMPTY,
    );
    expect(result.rows[0]?.payload?.status).toBe('pipeline');
    expect(result.pipelineCount).toBe(1);
    expect(result.rows[0]?.payload?.description).toContain('Currently closed');
  });

  it('falls back to the official information link', () => {
    const head = [...HEAD, 'Official Information Link'];
    const result = validateTrackerCsv(
      csv([
        {
          ...GOOD,
          'Application / Registration Link': 'http://example.org/insecure',
          'Official Information Link': 'https://example.org/info',
        },
      ], head),
      EMPTY,
    );
    expect(result.rows[0]?.payload?.externalUrl).toBe('https://example.org/info');
  });

  it('accepts the alternative header spellings', () => {
    const head = ['Title', 'Provider', 'Category', 'Summary', 'Registration Link'];
    const result = validateTrackerCsv(
      csv([
        {
          Title: 'Zindi Challenge',
          Provider: 'Zindi',
          Category: 'Challenges',
          Summary: 'A competition.',
          'Registration Link': 'https://example.org/z',
        },
      ], head),
      EMPTY,
    );
    expect(result.rows[0]).toMatchObject({ ok: true });
    expect(result.rows[0]?.payload?.needPrimary).toBe('challenges');
  });
});

describe('validateTrackerCsv — partners', () => {
  it('reports a provider that does not exist yet', () => {
    const result = validateTrackerCsv(csv([GOOD]), { existing: [], partners: ['Other'] });
    expect(result.rows[0]?.newPartner).toBe(true);
    expect(result.newPartners).toEqual(['CINECA']);
  });

  it('reuses an existing partner’s spelling, whatever the file’s casing', () => {
    // partners.name is the primary key, so importing "cineca" beside "CINECA"
    // would create a second partner rather than reuse the first.
    const result = validateTrackerCsv(csv([{ ...GOOD, Provider: 'cineca' }]), {
      existing: [],
      partners: ['CINECA'],
    });
    expect(result.rows[0]?.newPartner).toBe(false);
    expect(result.newPartners).toEqual([]);
    expect(result.rows[0]?.payload?.partner).toBe('CINECA');
  });

  it('counts one new partner once, across several rows', () => {
    const result = validateTrackerCsv(
      csv([GOOD, { ...GOOD, 'Resource Title': 'Second programme' }]),
      EMPTY,
    );
    expect(result.newPartners).toEqual(['CINECA']);
  });
});

describe('validateTrackerCsv — the summary', () => {
  it('counts what passed and what did not', () => {
    const result = validateTrackerCsv(
      csv([GOOD, { ...GOOD, 'Resource Title': 'Bad', 'Proposed Category': 'Nope' }]),
      EMPTY,
    );
    expect(result.passing).toBe(1);
    expect(result.rejected).toBe(1);
    expect(result.rows.map((row) => row.row)).toEqual([1, 2]);
  });
});
