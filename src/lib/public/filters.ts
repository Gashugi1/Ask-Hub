import { COUNTRIES, SECTORS, STAGES, NEED_KEYS } from '@/lib/reference';
import type { NeedKey, PublicResource } from './types';

export type SortMode = 'featured' | 'recent';

const SORT_MODES: readonly SortMode[] = ['featured', 'recent'];

export const DEFAULT_SORT: SortMode = 'featured';

export interface FilterCriteria {
  need: NeedKey | null;
  sector: string | null;
  country: string | null;
  stage: string | null;
  query: string;
  sort: SortMode;
  /** 1-based. Page state lives in the URL like every other facet. */
  page: number;
}

/** Cards per page: four rows of the directory's three-column grid. */
export const PAGE_SIZE = 12;

export const EMPTY_CRITERIA: FilterCriteria = {
  need: null,
  sector: null,
  country: null,
  stage: null,
  query: '',
  sort: DEFAULT_SORT,
  page: 1,
};

/**
 * The narrowest shape both `URLSearchParams` and Next's
 * `ReadonlyURLSearchParams` satisfy. Declared structurally rather than
 * importing `ReadonlyURLSearchParams`, so this module stays free of a
 * next/navigation import and remains testable with a plain URLSearchParams.
 */
interface ReadableParams {
  get(name: string): string | null;
}

function oneOf<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T | null {
  if (value === null) return null;
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/**
 * Read filter state from the URL, which is the single source of truth.
 *
 * An unrecognised value falls back to the default rather than being honoured.
 * A stale bookmark, a hand-edited link or a filter option removed from
 * reference.ts would otherwise produce an empty directory with nothing on
 * screen explaining why.
 */
export function parseFilters(params: ReadableParams): FilterCriteria {
  return {
    need: oneOf<NeedKey>(params.get('need'), NEED_KEYS),
    sector: oneOf(params.get('sector'), SECTORS),
    country: oneOf(params.get('country'), COUNTRIES),
    stage: oneOf(params.get('stage'), STAGES),
    query: (params.get('q') ?? '').trim(),
    sort: oneOf<SortMode>(params.get('sort'), SORT_MODES) ?? DEFAULT_SORT,
    page: pageFrom(params.get('page')),
  };
}

/**
 * A page number from the URL, or 1.
 *
 * Only plain digits count. Zero, negatives, decimals, exponent notation and
 * outright nonsense all become 1, because every one of them arrives the same
 * way -- a hand-edited link or a stale bookmark -- and would otherwise slice an
 * empty window and render a directory with nothing in it and nothing
 * explaining why.
 *
 * The digit test rather than `Number()`: `Number('1e3')` is 1000, a perfectly
 * valid integer that no visitor ever typed, and `parseInt` reads both `1.5`
 * and `1e3` as 1, which is a different wrong answer. A page parameter is
 * either a run of digits or it is not a page parameter.
 *
 * `Number.MAX_SAFE_INTEGER` bounds it so a very long digit string cannot
 * become `Infinity`; `paginate` then clamps whatever survives to a page that
 * exists.
 */
function pageFrom(raw: string | null): number {
  if (raw === null || !/^\d+$/.test(raw)) return 1;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) return 1;
  return value;
}

/**
 * Write filter state back to the URL.
 *
 * `base` carries anything already in the query string that is not ours --
 * campaign tags, a future locale param -- so a filter click preserves it.
 * Our own keys are always rewritten from `criteria`, so clearing a facet
 * removes the key rather than serialising it empty; `?sector=` in a shared
 * link is noise that survives every subsequent copy of that link.
 */
export function toSearchParams(
  criteria: FilterCriteria,
  base?: URLSearchParams,
): URLSearchParams {
  const out = new URLSearchParams(base?.toString() ?? '');
  const set = (key: string, value: string | null) => {
    if (value === null || value === '') out.delete(key);
    else out.set(key, value);
  };
  set('need', criteria.need);
  set('sector', criteria.sector);
  set('country', criteria.country);
  set('stage', criteria.stage);
  set('q', criteria.query.trim());
  set('sort', criteria.sort === DEFAULT_SORT ? null : criteria.sort);
  // Page 1 is the default, so it is left out: a first-page link should be the
  // bare link, not `?page=1`, or every shared URL carries a parameter that
  // means nothing and survives every later copy of it.
  set('page', criteria.page > 1 ? String(criteria.page) : null);
  return out;
}

/**
 * Return `next`, on the first page if anything other than the page changed.
 *
 * The trap: narrow a sixty-row directory while reading page five, and without
 * this the visitor lands on page five of a two-page result -- an empty grid
 * that reads as "no matches" for a filter that matched plenty. Paging itself
 * is not a filter change, so moving between pages is left alone; resetting
 * there would pin the visitor to page one and make the control inert.
 *
 * A pure function rather than a rule inside the directory component, so both
 * the behaviour and its exception are testable without rendering anything.
 */
export function resetPageOnFilterChange(
  next: FilterCriteria,
  previous: FilterCriteria,
): FilterCriteria {
  const changed =
    next.need !== previous.need ||
    next.sector !== previous.sector ||
    next.country !== previous.country ||
    next.stage !== previous.stage ||
    next.query !== previous.query ||
    next.sort !== previous.sort;
  return changed ? { ...next, page: 1 } : next;
}

export interface PaginatedRows<T> {
  rows: readonly T[];
  /** The page actually shown, which may be lower than the one requested. */
  page: number;
  pageCount: number;
}

/**
 * One page of rows, with the page clamped to what exists.
 *
 * A page past the end returns the first page rather than an empty window: it
 * is reachable from a shared link whose result set has since shrunk, and an
 * empty grid there is indistinguishable from "nothing matched".
 *
 * `pageCount` is never 0 -- an empty directory is one empty page, so "page 1
 * of 1" is what renders, and every range check downstream stays honest.
 *
 * Exported and used by both directory renderers, so the server-rendered
 * fallback and the hydrated client cannot slice differently and shift the page
 * under the reader on hydration.
 */
export function paginate<T>(
  rows: readonly T[],
  page: number,
  size: number = PAGE_SIZE,
): PaginatedRows<T> {
  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * size;
  return { rows: rows.slice(start, start + size), page: safePage, pageCount };
}

/**
 * The URL a filter selection navigates to.
 *
 * The directory is a band on the home page, not a route, so every filtered
 * view is `/` plus a query string plus the `#directory` fragment. Both
 * consumers -- `ResourceDirectoryClient`'s own controls and the browse
 * menu's links -- go through here, so a link in the sidebar and a chip in
 * the directory cannot serialise the same selection two different ways.
 *
 * The empty query string is dropped rather than serialised as `/?`, which a
 * visitor would otherwise copy out of the address bar and share.
 */
export function directoryHref(
  criteria: FilterCriteria,
  base?: URLSearchParams,
): string {
  const query = toSearchParams(criteria, base).toString();
  return query === '' ? '/#directory' : `/?${query}#directory`;
}

/**
 * The same URL as `directoryHref`, without the `#directory` fragment.
 *
 * For the browse menu's category rows. Opening a category is a request to see
 * what is inside it, and the sub-categories appear in the menu itself -- but
 * the fragment scrolled the viewport straight past them to the results, so
 * the sub-categories a click had just revealed were never in view. The
 * filtering still happens; only the jump is dropped.
 *
 * The sub-category rows keep the fragment: choosing one is a request for the
 * matching resources, and there is nothing further to reveal in the menu.
 *
 * Built from the same `toSearchParams`, so a category row and a chip
 * expressing the same selection still serialise identically.
 */
export function browseHref(
  criteria: FilterCriteria,
  base?: URLSearchParams,
): string {
  const query = toSearchParams(criteria, base).toString();
  return query === '' ? '/' : `/?${query}`;
}

/**
 * An empty eligibility array means "no restriction", not "eligible for
 * nothing". The seed maps the prototype's `sectors: 'All'` sentinel to `[]`,
 * so reading an empty array as a filter miss would hide every
 * open-to-everyone resource -- the ones most worth showing.
 */
function matchesList(eligible: readonly string[], selected: string | null): boolean {
  if (selected === null) return true;
  if (eligible.length === 0) return true;
  return eligible.includes(selected);
}

/**
 * Content rule 10.6: the country filter has no catch-all option. A resource
 * whose geo_scope is global, all_africa or partner_countries matches every
 * country selection; only `specific` consults countries_eligible.
 */
function matchesCountry(row: PublicResource, selected: string | null): boolean {
  if (selected === null) return true;
  if (row.geoScope !== 'specific') return true;
  return matchesList(row.countriesEligible, selected);
}

/**
 * Every word has to appear somewhere, rather than the whole string appearing
 * intact in one field -- the prototype's `textMatch`.
 *
 * The searchable text is the four fields joined, so the words may be spread
 * across them: "aws compute" matches a resource named "Activate" from partner
 * "Amazon Web Services" described as compute credits, which a
 * contiguous-phrase match in a single field could never find. A one-word
 * query behaves exactly as it did before.
 *
 * What reaches here is already the *leftover* of `parseQuery` — the words it
 * could not turn into a facet — so this is a search over prose, not a second
 * attempt at classification.
 */
function matchesQuery(row: PublicResource, query: string): boolean {
  if (query === '') return true;
  const haystack = [row.name, row.partnerName, row.description, row.subCategory]
    .filter((field): field is string => field !== null)
    .join(' ')
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== '')
    .every((word) => haystack.includes(word));
}

export function filterResources(
  rows: readonly PublicResource[],
  criteria: FilterCriteria,
): PublicResource[] {
  return rows.filter(
    (row) =>
      (criteria.need === null ||
        row.needPrimary === criteria.need ||
        row.needSecondary === criteria.need) &&
      matchesList(row.sectorsEligible, criteria.sector) &&
      matchesList(row.stagesEligible, criteria.stage) &&
      matchesCountry(row, criteria.country) &&
      matchesQuery(row, criteria.query),
  );
}

/**
 * Both modes end in a comparison on `id`. Without it, two rows with the same
 * sort_order or added_date can come back in a different order from one render
 * to the next, which React reports as a hydration mismatch and a visitor sees
 * as cards jumping.
 */
export function sortResources(
  rows: readonly PublicResource[],
  mode: SortMode,
): PublicResource[] {
  const copy = [...rows];
  if (mode === 'recent') {
    return copy.sort(
      (a, b) =>
        (b.addedDate ?? '').localeCompare(a.addedDate ?? '') || a.id.localeCompare(b.id),
    );
  }
  return copy.sort(
    (a, b) =>
      Number(b.isFeatured) - Number(a.isFeatured) ||
      a.sortOrder - b.sortOrder ||
      a.id.localeCompare(b.id),
  );
}
