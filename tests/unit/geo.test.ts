import { describe, it, expect } from 'vitest';
import { geoScopeLabelKey, geoEligibilityLabel } from '@/lib/public/geo';
import { t } from '@/lib/i18n';
import en from '@/locales/en.json';
import type { GeoScope } from '@/lib/public/types';

const dictionary = en as Record<string, string>;

function input(geoScope: GeoScope, countriesEligible: string[] = []) {
  return { geoScope, countriesEligible };
}

describe('geoScopeLabelKey', () => {
  it('says worldwide for global', () => {
    expect(geoScopeLabelKey(input('global'))).toEqual({ key: 'geo.global', countries: null });
  });

  it('says across Africa for all_africa', () => {
    expect(geoScopeLabelKey(input('all_africa'))).toEqual({
      key: 'geo.all_africa',
      countries: null,
    });
  });

  it('names the partner countries for partner_countries', () => {
    expect(geoScopeLabelKey(input('partner_countries'))).toEqual({
      key: 'geo.partner_countries',
      countries: null,
    });
  });

  it('returns the curated list for specific with countries', () => {
    expect(geoScopeLabelKey(input('specific', ['Kenya', 'Ghana']))).toEqual({
      key: null,
      countries: ['Kenya', 'Ghana'],
    });
  });

  it('says not specified for specific with an empty list, never that it is open', () => {
    // The dominant case on the live database: geo_scope defaults to
    // 'specific' and countries_eligible defaults to '{}', so a row the
    // importer never scoped is indistinguishable from one deliberately
    // scoped to nothing. Either way nobody recorded an eligibility, and
    // claiming the resource is open to everyone would be asserting a fact
    // the database does not hold -- CLAUDE.md's fabricated-data rule.
    const eligibility = geoScopeLabelKey(input('specific', []));
    expect(eligibility).toEqual({ key: 'geo.unspecified', countries: null });
    expect(dictionary['geo.unspecified']).not.toMatch(/\bopen\b|\ball countries\b/i);
  });

  it('gives each scope its own distinct wording', () => {
    // The bug this replaces was one shared string for four different claims.
    const labels = (['global', 'all_africa', 'partner_countries', 'specific'] as const).map(
      (scope) => geoEligibilityLabel(input(scope)),
    );
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('geoEligibilityLabel', () => {
  it('renders the key through t() for a non-specific scope', () => {
    expect(geoEligibilityLabel(input('global'))).toBe(t('geo.global'));
    expect(geoEligibilityLabel(input('global'))).toBe('Open worldwide');
  });

  it('joins the country list for specific', () => {
    expect(geoEligibilityLabel(input('specific', ['Kenya', 'Ghana']))).toBe('Kenya, Ghana');
  });

  it('never claims openness for an unscoped row', () => {
    expect(geoEligibilityLabel(input('specific', []))).toBe(t('geo.unspecified'));
    expect(geoEligibilityLabel(input('specific', []))).not.toMatch(/open/i);
  });

  it('ignores a stray country list on a non-specific scope', () => {
    // Nothing in the schema stops geo_scope 'global' carrying countries. The
    // explicit scope is the curator's statement; the list is then stale.
    expect(geoEligibilityLabel(input('global', ['Kenya']))).toBe(t('geo.global'));
  });

  it('resolves every key it can return from en.json', () => {
    // A missing key would render as the raw token `geo.global` on the page.
    for (const scope of ['global', 'all_africa', 'partner_countries', 'specific'] as const) {
      const { key } = geoScopeLabelKey(input(scope));
      if (key === null) continue;
      expect(dictionary[key], `${key} is missing from en.json`).toBeTruthy();
      expect(t(key)).not.toBe(key);
    }
  });
});
