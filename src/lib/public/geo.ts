import { t, type Locale } from '@/lib/i18n';
import type { PublicResource } from './types';

/**
 * How a resource's geographic eligibility is worded on the public surface.
 *
 * This lives in one module, and every public surface that states eligibility
 * reads it from here, so the card and the detail page cannot drift into
 * telling a visitor two different things about the same row.
 *
 * The rule that matters is the `specific`-with-no-countries case. `geo_scope`
 * is `not null default 'specific'` and `countries_eligible` is `not null
 * default '{}'` (0004_resources.sql), so a row the importer never scoped
 * arrives here looking exactly like a deliberately-scoped one whose list is
 * empty -- and on the live database that is the majority of resources. Their
 * eligibility is unknown, not unrestricted. Rendering "open to all countries"
 * over an absent value asserts a fact nobody recorded, which is the same
 * defect class as CLAUDE.md's fabricated-metrics rule, so this case says we do
 * not know and points at the partner site.
 *
 * The other three scopes are explicit statements a curator made, so they get
 * their own wording rather than a shared catch-all: "worldwide", "across
 * Africa" and "the AI Hub partner countries" are three different claims.
 */
export interface GeoEligibility {
  /** en.json key for the wording, or null when the country list is the answer. */
  key: string | null;
  /** The eligible countries, or null when `key` carries the answer. */
  countries: string[] | null;
}

/** The fields the wording depends on -- nothing else about a resource. */
export type GeoEligibilityInput = Pick<PublicResource, 'geoScope' | 'countriesEligible'>;

export function geoScopeLabelKey(resource: GeoEligibilityInput): GeoEligibility {
  switch (resource.geoScope) {
    case 'global':
      return { key: 'geo.global', countries: null };
    case 'all_africa':
      return { key: 'geo.all_africa', countries: null };
    case 'partner_countries':
      return { key: 'geo.partner_countries', countries: null };
    case 'specific':
      // A curated list is the most precise answer there is, so it wins over
      // any phrase. An empty one is not a narrower claim than the others --
      // it is no claim at all.
      return resource.countriesEligible.length > 0
        ? { key: null, countries: resource.countriesEligible }
        : { key: 'geo.unspecified', countries: null };
  }
}

/**
 * The rendered string. Callers use this rather than joining the list
 * themselves: the join is part of the wording decision, not presentation.
 */
export function geoEligibilityLabel(
  resource: GeoEligibilityInput,
  locale?: Locale,
): string {
  const eligibility = geoScopeLabelKey(resource);
  if (eligibility.countries !== null) return eligibility.countries.join(', ');
  return eligibility.key === null ? '' : t(eligibility.key, undefined, locale);
}
