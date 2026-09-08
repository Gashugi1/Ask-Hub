import { z } from 'zod';

/**
 * The keys `public.site_content` holds, all `locale = 'en'` — confirmed
 * against the database, not against PRD §4.12's names.
 *
 * PRD §4.12 named `welcome_band_heading`, `about_intro`, `privacy_copy`,
 * `terms_copy` and others that were never implemented: `scripts/seed-data.ts`
 * invented its own key names because the prototype rendered
 * `settings.welcome.title` directly with no key/locale structure to inherit,
 * and SP2a's public readers read the invented names. This list follows the
 * seed and the readers, not the PRD — a `privacy_copy` write would match zero
 * rows and appear to succeed while changing nothing (the exact failure the
 * `contentEntry` allow-list exists to prevent).
 *
 * `privacy_body` and `terms_body` back the public /privacy and /terms pages
 * (`src/app/(public)/privacy|terms/page.tsx`), which render `site_content.<key>`
 * and fall back to the `*.pending` locale copy only when the row is absent.
 * `scripts/seed-data.ts` seeds both with that pending copy so a row exists for
 * the Site Content screen to UPDATE — without a seeded row `saveContentEntry`'s
 * `assertRowAffected` correctly rejects the edit as a zero-row write. Legal copy
 * is therefore editor-maintained with no deploy; the deployment checklist gates
 * launch on the reviewed text being stored under these two keys.
 */
export const CONTENT_KEYS = [
  'welcome_title',
  // Added with the welcome band's dark-band restyle: the band renders a
  // tagline between the title and the body, editor-supplied at runtime rather
  // than hardcoded. `scripts/seed-data.ts` seeds it.
  'welcome_tagline',
  'welcome_body',
  'welcome_cta',
  'identity_lead',
  'identity_align',
  // Public /privacy and /terms body copy, editor-maintained via the Site
  // Content screen; seeded with the `*.pending` copy so the row exists to
  // UPDATE. See the docblock above.
  'privacy_body',
  'terms_body',
] as const;

export type ContentKey = (typeof CONTENT_KEYS)[number];

/**
 * A single `site_content` row for the caller's client to UPDATE — never
 * upsert. The key is an allow-list (`z.enum`), not free text: a typo would
 * otherwise attempt a write against a key/locale pair the unique constraint
 * has never seen, which an UPDATE simply fails to match (zero rows) rather
 * than silently creating a new row the public site never reads.
 *
 * `value` allows an empty string: `site_content.value` is `not null default
 * ''`, so blank is a legal stored value and the public band decides for
 * itself whether to render it.
 */
export const contentEntry = z.object({
  key: z.enum(CONTENT_KEYS),
  value: z.string(),
});

export type ContentEntry = z.infer<typeof contentEntry>;

/** The resource deadline's date pattern (src/lib/schemas/resource.ts), reused for attestedOn. */
const isoDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Provenance fields shared by `headline_stats` and `compute_metrics`.
 * `source` and `attestedBy` use `.trim().min(1)` so a whitespace-only value
 * cannot pass — mirroring `headline_stats_source_not_blank` /
 * `headline_stats_attested_by_not_blank` (0015_stat_provenance.sql) in Zod,
 * before the database's own CHECK constraints have to catch it. A figure on
 * this UN leadership-reporting surface with no named source and attester is
 * exactly what that migration exists to prevent.
 */
const provenance = {
  source: z.string().trim().min(1),
  attestedBy: z.string().trim().min(1),
  attestedOn: isoDate,
};

const sortOrder = z.number().int().min(0).max(100000).nullable();

/** One `headline_stats` row (PRD 6.7 panel 5: value, label, Hero toggle). */
export const statInput = z.object({
  value: z.string().trim().min(1),
  label: z.string().trim().min(1),
  isHero: z.boolean(),
  sortOrder,
  ...provenance,
});

export type StatInput = z.infer<typeof statInput>;

/** One `compute_metrics` row (PRD 6.7 panel 6: value, label, sub-note). */
export const computeMetricInput = z.object({
  value: z.string().trim().min(1),
  label: z.string().trim().min(1),
  subNote: z.string().trim().max(500).nullable(),
  sortOrder,
  ...provenance,
});

export type ComputeMetricInput = z.infer<typeof computeMetricInput>;

/** One `programmes` row (PRD 6.7 panel 7: title, timeframe, description). No provenance — programmes are not reported figures. */
export const programmeInput = z.object({
  title: z.string().trim().min(1).max(200),
  timeframe: z.string().trim().max(200),
  description: z.string().trim().max(5000),
  sortOrder,
});

export type ProgrammeInput = z.infer<typeof programmeInput>;

/** One `impact_stories` row (PRD 6.7 panel 8: organisation, country, description). */
export const impactStoryInput = z.object({
  organisation: z.string().trim().min(1).max(200),
  country: z.string().trim().max(200),
  description: z.string().trim().max(5000),
  sortOrder,
});

export type ImpactStoryInput = z.infer<typeof impactStoryInput>;
