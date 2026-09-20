import { describe, it, expect } from 'vitest';
import { computeCoverage, type CoverageRow } from '@/lib/admin/dashboard-view';
import { COUNTRIES, SECTORS, NEED_KEYS } from '@/lib/reference';

function row(partial: Partial<CoverageRow>): CoverageRow {
  return {
    needPrimary: 'funding',
    needSecondary: null,
    geoScope: 'specific',
    countriesEligible: [],
    sectorsEligible: ['Health'],
    ...partial,
  };
}

describe('computeCoverage', () => {
  it('lists every need in canonical order, with zero for the empty ones', () => {
    const coverage = computeCoverage([row({ needPrimary: 'compute' })]);
    expect(coverage.byNeed.map((entry) => entry.need)).toEqual([...NEED_KEYS]);
    expect(coverage.byNeed.find((entry) => entry.need === 'compute')?.count).toBe(1);
    expect(coverage.byNeed.find((entry) => entry.need === 'funding')?.count).toBe(0);
  });

  it('counts a resource once per need it names, primary or secondary', () => {
    const coverage = computeCoverage([
      row({ needPrimary: 'compute', needSecondary: 'training' }),
      row({ needPrimary: 'training', needSecondary: null }),
    ]);
    expect(coverage.byNeed.find((entry) => entry.need === 'compute')?.count).toBe(1);
    expect(coverage.byNeed.find((entry) => entry.need === 'training')?.count).toBe(2);
  });

  it('counts the countries named by specific-scope resources, once each', () => {
    const coverage = computeCoverage([
      row({ countriesEligible: ['Kenya', 'Rwanda'] }),
      row({ countriesEligible: ['Rwanda', 'Ghana'] }),
    ]);
    expect(coverage.countriesCovered).toBe(3);
  });

  it('treats any non-specific scope as covering every programme country', () => {
    // The public filter's own rule: global, all_africa and partner_countries
    // match every country selection, so one such resource reaches all 18.
    const coverage = computeCoverage([row({ geoScope: 'all_africa' })]);
    expect(coverage.countriesCovered).toBe(COUNTRIES.length);
  });

  it('ignores a country name that is not a programme country', () => {
    const coverage = computeCoverage([row({ countriesEligible: ['Atlantis'] })]);
    expect(coverage.countriesCovered).toBe(0);
  });

  it('treats an empty sector list as open to every sector', () => {
    const coverage = computeCoverage([row({ sectorsEligible: [] })]);
    expect(coverage.sectorsCovered).toBe(SECTORS.length);
    expect(coverage.sectorsTotal).toBe(SECTORS.length);
  });

  it('otherwise counts the distinct sectors named', () => {
    const coverage = computeCoverage([
      row({ sectorsEligible: ['Health', 'Water'] }),
      row({ sectorsEligible: ['Water'] }),
    ]);
    expect(coverage.sectorsCovered).toBe(2);
  });

  it('reports zeros, not a fabricated floor, for an empty directory', () => {
    const coverage = computeCoverage([]);
    expect(coverage.countriesCovered).toBe(0);
    expect(coverage.sectorsCovered).toBe(0);
    expect(coverage.byNeed.every((entry) => entry.count === 0)).toBe(true);
  });
});
