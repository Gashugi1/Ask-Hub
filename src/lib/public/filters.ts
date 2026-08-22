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
}

export const EMPTY_CRITERIA: FilterCriteria = {
  need: null,
  sector: null,
  country: null,
  stage: null,
  query: '',
  sort: DEFAULT_SORT,
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
  };
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
  return out;
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

function matchesQuery(row: PublicResource, query: string): boolean {
  if (query === '') return true;
  const needle = query.toLowerCase();
  return [row.name, row.partnerName, row.description, row.subCategory].some(
    (field) => field !== null && field.toLowerCase().includes(needle),
  );
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
