import { STAGES, type NeedKey } from '@/lib/reference';
import { resourceInput, type ResourceInput } from '@/lib/schemas/resource';
import { parseCsv } from './import-csv';

/**
 * Reads an Operation 100 tracker CSV export into resource payloads, and says
 * why each row it refuses was refused.
 *
 * Pure and synchronous, and deliberately not under src/lib/actions/: the AST
 * guards in tests/structure/action-modules.ts treat any async function there
 * as a server action, and resource-mutation-guards.ts already establishes that
 * helpers stay synchronous. Being pure is also what lets the same code run in
 * the browser for the preview and on the server for the commit, so the two can
 * never disagree about which rows pass.
 *
 * **Rejection reasons are codes, not sentences.** Next replaces a thrown
 * server-action message with an opaque digest in production, and every
 * user-facing string has to be a resolvable `t()` key, so this module emits a
 * code plus interpolation data and the caller renders the wording. Same
 * discipline ResourceForm already follows.
 */

/** Tracker columns this reader understands, each with the headers it accepts. */
const COLUMNS = {
  title: ['Resource Title', 'Title'],
  provider: ['Provider'],
  category: ['Proposed Category', 'Category'],
  summary: ['One-Sentence Summary', 'Main Benefit', 'Summary'],
  audience: ['Intended Audience'],
  profile: ['Participant Profile'],
  requirements: ['Experience/Education Requirements'],
  restrictions: ['Other Restrictions'],
  country: ['Country / Location', 'Country', 'Location'],
  geo: ['Geographic Eligibility'],
  format: ['Delivery Format'],
  closing: ['Closing Date'],
  evergreen: ['Evergreen'],
  free: ['Free / Paid', 'Free/Paid'],
  cost: ['Cost'],
  applyLink: [
    'Application / Registration Link',
    'Application/Registration Link',
    'Application Link',
    'Registration Link',
  ],
  infoLink: ['Official Information Link'],
  route: ['Access Route'],
  how: ['How to Access'],
  lifecycle: ['Lifecycle State'],
  reopen: ['Expected Reopening'],
  sectorTags: ['Sector Tags'],
  language: ['Primary Language'],
  status: ['Status'],
  gates: ['All Gates Passed', 'Gates Passed'],
} as const satisfies Record<string, readonly string[]>;

type TrackerField = keyof typeof COLUMNS;

/** The headers that identify the tracker's data, used to find its sheet and its header row. */
export const TITLE_HEADERS: readonly string[] = COLUMNS.title;

/** Columns without which the file cannot be read at all. */
const REQUIRED_COLUMNS: readonly TrackerField[] = ['title', 'provider', 'category'];

/**
 * The tracker's category labels, mapped onto need keys. Both the `&` and the
 * spelled-out `and` forms appear in real exports, and the plain forms appear
 * wherever somebody shortened the label by hand.
 */
const CATEGORY_TO_NEED: Readonly<Record<string, NeedKey>> = {
  courses: 'training',
  training: 'training',
  compute: 'compute',
  funding: 'funding',
  accelerator: 'accelerator',
  accelerators: 'accelerator',
  'data & datasets': 'data',
  'data and datasets': 'data',
  data: 'data',
  datasets: 'data',
  'challenges & competitions': 'challenges',
  'challenges and competitions': 'challenges',
  challenges: 'challenges',
  competitions: 'challenges',
  'community & events': 'community',
  'community and events': 'community',
  community: 'community',
  events: 'community',
};

/** Words that carry no identity, so wording variants of one title still collide. */
const DEDUPE_FILLER = /\b(the|a|an|for|of|and)\b/g;

export const IMPORT_MAX_ROWS = 500;
export const IMPORT_MAX_BYTES = 512 * 1024;
export const IMPORT_MAX_NEW_PARTNERS = 50;

export type RejectCode =
  | 'missingTitle'
  | 'missingProvider'
  | 'notApproved'
  | 'gatesFailed'
  | 'unknownCategory'
  | 'missingSummary'
  | 'missingLink'
  | 'insecureLink'
  | 'badDeadline'
  | 'duplicateExisting'
  | 'possibleDuplicate'
  | 'duplicateInFile'
  | 'invalid'
  | 'writeFailed';

export type FileProblemCode =
  | 'noDataRows'
  | 'missingColumns'
  | 'tooManyRows'
  | 'tooManyNewPartners';

export interface FileProblem {
  code: FileProblemCode;
  /** Column names, for `missingColumns`; a count, rendered by the caller, otherwise. */
  columns: string[];
  limit: number;
}

export interface RowOutcome {
  /** 1-based data row, the way an operator counts rows in a spreadsheet. */
  row: number;
  title: string;
  provider: string;
  category: string;
  deadline: string;
  ok: boolean;
  code: RejectCode | null;
  /** Interpolation data for the code's locale key. Never English. */
  detail: string;
  /** True when importing this row also creates its partner. */
  newPartner: boolean;
  payload: ResourceInput | null;
}

export interface TrackerValidation {
  fileProblem: FileProblem | null;
  rows: RowOutcome[];
  passing: number;
  rejected: number;
  /** Partner names this file would create, deduplicated. */
  newPartners: string[];
  /**
   * True when the file carries neither gate column, so every row is treated as
   * approved. Surfaced in the preview: a tracker re-exported without its
   * Status column would otherwise import ungated rows straight to live.
   */
  preApproved: boolean;
  /** Rows that would land unpublished, so a half-visible import is not read as a failure. */
  pipelineCount: number;
}

/**
 * What the commit reports back. The same row outcomes the preview showed, but
 * re-derived on the server and with `payload` stripped -- the client has no
 * use for twenty resolved fields once the rows have landed, and the response
 * travels over the wire.
 */
export interface ImportReport {
  fileProblem: FileProblem | null;
  rows: RowOutcome[];
  /** Rows that actually reached the database. */
  imported: number;
  createdPartners: string[];
  preApproved: boolean;
}

export interface TrackerContext {
  existing: readonly { name: string; partner: string }[];
  partners: readonly string[];
}

/**
 * Strip a title down to its identity: lowercase, parentheticals gone,
 * punctuation gone, filler words gone. "AI Accelerator (2026 cohort)" and
 * "The AI accelerator" both reduce to "ai accelerator", which is what makes a
 * re-upload of the same tracker collide with what it already loaded.
 */
export function normaliseForDedupe(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(DEDUPE_FILLER, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Collapse the whitespace a spreadsheet cell picks up, without touching case. */
function tidy(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function sentence(label: string, value: string): string {
  return value === '' ? '' : ` ${label}: ${value}.`;
}

/**
 * The tracker's prose columns, assembled into one description.
 *
 * The tracker spreads what a reader needs over a dozen narrow columns; the
 * directory shows one description. Each clause is omitted when its source is
 * blank rather than rendering an empty label.
 */
function buildDescription(cell: (field: TrackerField) => string): string {
  const eligibility = [
    cell('audience'),
    cell('profile'),
    cell('requirements'),
    cell('restrictions'),
  ]
    .filter((part) => part !== '')
    .join(' · ');
  const cost = [cell('free'), cell('cost')].filter((part) => part !== '').join(' — ');
  const closed = /^closed/i.test(cell('lifecycle'));
  const reopen = cell('reopen');

  return [
    cell('summary'),
    sentence('Delivery', cell('format')),
    sentence('Cost', cost),
    sentence('Eligibility', eligibility),
    sentence('How to access', cell('how')),
    sentence('Primary language', cell('language')),
    sentence('Sectors', cell('sectorTags')),
    closed ? ` Currently closed${reopen === '' ? '' : `, expected to reopen ${reopen}`}.` : '',
  ]
    .join('')
    .trim()
    .slice(0, 5000);
}

/**
 * Build the payload for one row.
 *
 * Everything the tracker cannot say takes a fixed value. Two of those are
 * load-bearing rather than arbitrary:
 *
 * - `partnerTier: 'network'`. The column is NOT NULL with no database default,
 *   so it has to come from here, and `network` is the only honest answer: a
 *   tracker row asserts nothing about a partnership, while `strategic`,
 *   `government`, `development_partner` and `academic` are all claims.
 * - `countriesEligible` and `sectorsEligible` stay empty. The tracker's
 *   geography and sector columns are free text ("West Africa", "Sub-Saharan
 *   Africa") while ours are 18 and 6 exact names; guessing a mapping would
 *   invent eligibility data on a UN surface, which CLAUDE.md forbids outright.
 *   An empty array already means "no restriction" to `matchesList`, and
 *   `geoScope` carries the geography honestly.
 */
function toPayload(
  cell: (field: TrackerField) => string,
  partner: string,
  need: NeedKey,
  url: string,
  deadline: string | null,
): unknown {
  const geo = `${cell('geo')} ${cell('country')}`;
  return {
    name: cell('title'),
    partner,
    partnerTier: 'network',
    resourceType: need === 'training' ? 'Course' : 'Programme',
    needPrimary: need,
    needSecondary: null,
    subCategory: null,
    description: buildDescription(cell),
    actionLabel: 'Apply',
    externalUrl: url,
    bannerImageUrl: null,
    countriesEligible: [],
    sectorsEligible: [],
    // The tracker says nothing about stage, and every stage is welcome at
    // everything it lists, which is what all four spells out.
    stagesEligible: [...STAGES],
    geoScope: /all africa/i.test(geo) ? 'all_africa' : 'global',
    deadline,
    status: /^closed/i.test(cell('lifecycle')) ? 'pipeline' : 'live',
    isFeatured: false,
    exclusivity: null,
    sortOrder: null,
  };
}

function fileProblem(code: FileProblemCode, columns: string[], limit: number): TrackerValidation {
  return {
    fileProblem: { code, columns, limit },
    rows: [],
    passing: 0,
    rejected: 0,
    newPartners: [],
    preApproved: false,
    pipelineCount: 0,
  };
}

/** Reads the whole file. `text` is the raw CSV, exactly as uploaded. */
export function validateTrackerCsv(
  text: string,
  context: TrackerContext,
): TrackerValidation {
  return validateTracker(parseCsv(text), context);
}

export function validateTracker(
  table: readonly string[][],
  context: TrackerContext,
): TrackerValidation {
  if (table.length < 2) return fileProblem('noDataRows', [], 0);

  // The header is not always the first row. A tracker exported from a
  // spreadsheet routinely carries a title or a note above it, and those rows
  // are not data -- so the header is the first row that actually names the
  // title column. Falling back to row 0 when nothing matches keeps the
  // missing-column message below pointing at the row the operator would
  // expect to be the header.
  const titleNames = COLUMNS.title.map((name) => name.toLowerCase());
  const headerAt = table.findIndex((row) =>
    row.some((cell) => titleNames.includes(tidy(cell).toLowerCase())),
  );
  const headerRow = headerAt >= 0 ? headerAt : 0;

  const header = (table[headerRow] ?? []).map((name) => tidy(name).toLowerCase());
  const index = {} as Record<TrackerField, number>;
  for (const field of Object.keys(COLUMNS) as TrackerField[]) {
    index[field] = COLUMNS[field]
      .map((name) => header.indexOf(name.toLowerCase()))
      .find((position) => position >= 0) ?? -1;
  }

  const missing = REQUIRED_COLUMNS.filter((field) => index[field] < 0).map(
    (field) => COLUMNS[field][0],
  );
  if (missing.length > 0) return fileProblem('missingColumns', missing, 0);

  const body = table.slice(headerRow + 1);
  if (body.length === 0) return fileProblem('noDataRows', [], 0);
  if (body.length > IMPORT_MAX_ROWS) {
    return fileProblem('tooManyRows', [], IMPORT_MAX_ROWS);
  }

  // When neither gate column is present the tracker's Import tab has already
  // filtered to approved rows; when either is present, both are enforced.
  const preApproved = index.status < 0 && index.gates < 0;

  const existingByPair = new Map<string, string>();
  const existingByTitle = new Map<string, string>();
  for (const row of context.existing) {
    existingByPair.set(
      `${normaliseForDedupe(row.name)}|${normaliseForDedupe(row.partner)}`,
      row.name,
    );
    const title = normaliseForDedupe(row.name);
    if (title !== '') existingByTitle.set(title, row.name);
  }
  const knownPartners = new Map(
    context.partners.map((name) => [name.toLowerCase(), name]),
  );

  const seenPairs = new Set<string>();
  const seenTitles = new Set<string>();
  const newPartners = new Set<string>();

  const rows = body.map((raw, position): RowOutcome => {
    const cell = (field: TrackerField): string => {
      const at = index[field];
      return at >= 0 ? tidy(raw[at] ?? '') : '';
    };

    const title = cell('title');
    const provider = cell('provider');
    const categoryRaw = cell('category');
    const need = CATEGORY_TO_NEED[categoryRaw.toLowerCase()];
    const lifecycle = cell('lifecycle');
    const evergreen =
      /^y(es)?$/i.test(cell('evergreen')) || /rolling|always open/i.test(lifecycle);
    const closing = evergreen ? '' : cell('closing');

    // An existing partner's spelling wins: partners.name is the primary key
    // under a deterministic collation, so importing "google" beside "Google"
    // would create a second partner rather than reuse the first.
    const partner = knownPartners.get(provider.toLowerCase()) ?? provider;
    const partnerIsNew = provider !== '' && !knownPartners.has(provider.toLowerCase());

    const pairKey = `${normaliseForDedupe(title)}|${normaliseForDedupe(provider)}`;
    const titleKey = normaliseForDedupe(title);

    const base = {
      row: position + 1,
      title,
      provider,
      category: categoryRaw,
      deadline: evergreen ? '' : closing,
      newPartner: partnerIsNew,
    };

    const reject = (code: RejectCode, detail = ''): RowOutcome => ({
      ...base,
      ok: false,
      code,
      detail,
      payload: null,
    });

    if (title === '') return reject('missingTitle');
    if (provider === '') return reject('missingProvider');

    if (!preApproved) {
      const status = cell('status');
      if (!/^(published|approved)$/i.test(status)) return reject('notApproved', status);
      const gates = cell('gates');
      if (!/^(pass|yes)$/i.test(gates)) return reject('gatesFailed', gates);
    }

    if (need === undefined) return reject('unknownCategory', categoryRaw);
    if (cell('summary') === '') return reject('missingSummary');

    // The apply link first, then the information link: an https information
    // link rescues a row whose application link is http, and the scheme is
    // never rewritten -- asserting a TLS endpoint nobody has checked would turn a
    // partner's working link into a broken public call to action.
    const candidates = [cell('applyLink'), cell('infoLink')].filter((value) => value !== '');
    if (candidates.length === 0) return reject('missingLink');
    const url = candidates.find((value) => /^https:\/\/\S+\.\S+/i.test(value));
    if (url === undefined) return reject('insecureLink', candidates[0] ?? '');

    if (closing !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(closing)) {
      return reject('badDeadline', closing);
    }

    const alreadyThere = existingByPair.get(pairKey);
    if (alreadyThere !== undefined) return reject('duplicateExisting', alreadyThere);
    const sameTitle = existingByTitle.get(titleKey);
    if (sameTitle !== undefined) return reject('possibleDuplicate', sameTitle);
    if (seenPairs.has(pairKey) || seenTitles.has(titleKey)) {
      return reject('duplicateInFile', title);
    }

    const parsed = resourceInput.safeParse(
      toPayload(cell, partner, need, url, closing === '' ? null : closing),
    );
    if (!parsed.success) {
      // The mapping is checked against the one schema createResource uses, so
      // drift between the two cannot reach the database.
      const first = parsed.error.issues[0];
      return reject('invalid', first === undefined ? '' : first.path.join('.'));
    }

    seenPairs.add(pairKey);
    seenTitles.add(titleKey);
    if (partnerIsNew) newPartners.add(partner);

    return { ...base, ok: true, code: null, detail: '', payload: parsed.data };
  });

  if (newPartners.size > IMPORT_MAX_NEW_PARTNERS) {
    return fileProblem('tooManyNewPartners', [], IMPORT_MAX_NEW_PARTNERS);
  }

  const passing = rows.filter((row) => row.ok).length;
  return {
    fileProblem: null,
    rows,
    passing,
    rejected: rows.length - passing,
    newPartners: [...newPartners],
    preApproved,
    pipelineCount: rows.filter((row) => row.payload?.status === 'pipeline').length,
  };
}
