import { z } from 'zod';

/**
 * The five keys `public.site_content` actually holds, all `locale = 'en'` —
 * confirmed against the database (`select key from public.site_content order
 * by key`), not against PRD §4.12's seven names.
 *
 * PRD §4.12 names `welcome_band_heading`, `welcome_band_body`,
 * `welcome_band_cta_label`, `about_intro`, `about_alignment`, `privacy_copy`
 * and `terms_copy`. None of those were ever implemented:
 * `scripts/seed-data.ts` says in its own header that its key names are the
 * seed's own invention, because the prototype rendered
 * `settings.welcome.title` directly and had no key/locale structure to
 * inherit. SP2a's public readers read these five names, so renaming one
 * here is not in SP3's remit (design spec §5) and would break the public
 * render.
 *
 * `privacy_copy` and `terms_copy` are deliberately absent. `/privacy` and
 * `/terms` do not exist on this branch, `getSiteContent` has no consumer,
 * and `src/locales/en.json` already carries `privacy.pending` /
 * `terms.pending` — the public side intends to render those two pages from
 * locale copy, not from `site_content`. Creating the keys here would add
 * editable rows nothing reads, which is exactly the "save succeeds and
 * changes nothing" failure this allow-list exists to prevent. That naming
 * question belongs to whichever sub-project builds those two public pages,
 * not to this admin screen.
 */
export const CONTENT_KEYS = [
  'welcome_title',
  // Added with the welcome band's dark-band restyle: the band renders a
  // tagline between the title and the body, and every string in it is
  // editor-supplied at runtime rather than hardcoded, so the key has to be
  // writable from the Site Content screen or the line could never be
  // corrected without a deploy. `scripts/seed-data.ts` seeds it.
  'welcome_tagline',
  'welcome_body',
  'welcome_cta',
  'identity_lead',
  'identity_align',
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
