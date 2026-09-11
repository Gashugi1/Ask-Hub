/**
 * Machine keys and canonical option values for filters and forms. These are
 * not user-facing strings — display copy still goes through `t()` — so they
 * live here rather than in `src/locales/en.json`.
 *
 * `COUNTRIES`, `SECTORS` and `STAGES` have no backing enum: `countries_eligible`,
 * `sectors_eligible` and `stages_eligible` are `text[]` columns, so this file
 * is the canonical list for those three. `NEED_KEYS` mirrors the database's
 * `public.need_type` enum and must match it exactly, in the same order —
 * see tests/unit/reference.test.ts.
 */

export const COUNTRIES = [
  'Algeria', 'Angola', 'Egypt', 'Ethiopia', 'Gabon', 'Ghana',
  "Côte d'Ivoire", 'Democratic Republic of the Congo', 'Kenya',
  'Mauritania', 'Morocco', 'Mozambique', 'Republic of the Congo',
  'Rwanda', 'Senegal', 'Tanzania', 'Tunisia', 'Zambia',
] as const;

export const SECTORS = [
  'Energy', 'Agriculture', 'Health', 'Water',
  'Education & Training', 'Infrastructure',
] as const;

export const STAGES = [
  'New to AI', 'Getting started', 'Building', 'Scaling',
] as const;

export const NEED_KEYS = [
  'compute', 'training', 'funding', 'accelerator', 'partners',
  // Appended in trailing order to match 0022_need_types_expand.sql, which
  // adds these to public.need_type after 'partners'. reference.test.ts asserts
  // this order equals the DB enum element-for-element.
  'data', 'challenges', 'community',
] as const;

export type NeedKey = (typeof NEED_KEYS)[number];

/**
 * The five needs as display strings, kept only so `reference.test.ts` can
 * assert it stays the same length as the enum. **No component reads it** --
 * every label a visitor sees comes from `need.*` in `en.json`, which is what
 * lets the copy be translated and changed without touching code. Updated in
 * step with that file so the two do not disagree; if this array ever gains a
 * consumer, that consumer is the bug.
 */
export const NEEDS = [
  'Compute', 'Courses', 'Funding', 'Accelerators', 'Partners',
  'Data', 'Challenges', 'Community',
] as const;

/**
 * PRD content rule 10.6: the country filter has no catch-all
 * every-country option. geo_scope of global, all_africa or
 * partner_countries matches every country selection instead.
 */
export const COUNTRY_FILTER_OPTIONS = COUNTRIES;
