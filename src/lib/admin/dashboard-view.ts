import { COUNTRIES, SECTORS, NEED_KEYS, type NeedKey } from '@/lib/reference';

/** The five columns the coverage figures are computed from. */
export interface CoverageRow {
  needPrimary: NeedKey;
  needSecondary: NeedKey | null;
  geoScope: string;
  countriesEligible: readonly string[];
  sectorsEligible: readonly string[];
}

export interface Coverage {
  /** Live resources per need, in `NEED_KEYS` order; a resource counts once per need it names. */
  byNeed: readonly { need: NeedKey; count: number }[];
  /** Programme countries at least one live resource is open to. */
  countriesCovered: number;
  /** Sectors at least one live resource is open to. */
  sectorsCovered: number;
  sectorsTotal: number;
}

/**
 * The dashboard's Coverage tile and by-need panel, computed from the live,
 * open resources the caller hands over -- `readLiveCoverage` applies the
 * same exclusion `need_counts_public` uses since 0023, so the by-need
 * figures here agree with the public browse menu.
 *
 * A pure function over already-read rows, so the arithmetic is testable
 * without a database and cannot drift from what the tile shows.
 *
 * "Covered" follows the eligibility semantics the public filters use
 * (`matchesCountry` / `matchesList` in src/lib/public/filters.ts): a
 * resource whose `geo_scope` is anything but `specific` is open to every
 * programme country, and an empty `sectors_eligible` means open to every
 * sector, not eligible for none. One such resource therefore covers the
 * whole list, which is the truthful count -- a visitor from any of the 18
 * countries would find it.
 *
 * Every figure is counted from real rows. Nothing here approximates.
 */
export function computeCoverage(rows: readonly CoverageRow[]): Coverage {
  const byNeed = NEED_KEYS.map((need) => ({
    need,
    count: rows.filter((row) => row.needPrimary === need || row.needSecondary === need).length,
  }));

  const countries = new Set<string>();
  const sectors = new Set<string>();
  let everyCountry = false;
  let everySector = false;
  for (const row of rows) {
    if (row.geoScope !== 'specific') everyCountry = true;
    else for (const country of row.countriesEligible) countries.add(country);
    if (row.sectorsEligible.length === 0) everySector = true;
    else for (const sector of row.sectorsEligible) sectors.add(sector);
  }

  return {
    byNeed,
    countriesCovered: everyCountry
      ? COUNTRIES.length
      : COUNTRIES.filter((country) => countries.has(country)).length,
    sectorsCovered: everySector
      ? SECTORS.length
      : SECTORS.filter((sector) => sectors.has(sector)).length,
    sectorsTotal: SECTORS.length,
  };
}
