import { z } from 'zod';
import { COUNTRIES, SECTORS, STAGES, NEED_KEYS } from '@/lib/reference';
import { Constants } from '@/lib/supabase/database.types';
import type { Database } from '@/lib/supabase/database.types';

/**
 * Enum value sets, taken from the generated database types rather than
 * retyped by hand — `Constants.public.Enums` is emitted by `supabase gen
 * types` as a real `as const` runtime array per enum, one call site drift
 * away from every `z.enum(...)` below and the database's own type.
 *
 * `partner_tier` in particular must be sourced this way rather than
 * hand-copied: migration 0013_reconcile_partners.sql replaced the original
 * four-value enum ('strategic' | 'network' | 'institutional' | 'other')
 * with the prototype's real five values ('strategic' | 'government' |
 * 'development_partner' | 'academic' | 'network'). Hand-copying the old set
 * here would build a schema that rejects every valid tier the database
 * actually accepts except 'strategic' and 'network'.
 */
const { geo_scope, resource_status, exclusivity, partner_tier } = Constants.public.Enums;

const httpsUrl = z
  .string()
  .trim()
  .max(2048)
  .regex(/^https:\/\//i, 'must start with https://');

/**
 * Mirrors `resources_banner_not_svg` from 0004_resources.sql (kept current
 * by 0013/0014's rewrite of the same check on the recreated `partners`
 * table), including the `/` and `?`/`#` anchors: some CDN transform URLs
 * put the extension mid-path (.../logo.svg/w_300), and `.svgz` is the
 * gzip-compressed variant. CLAUDE.md rejects SVG uploads and SVG image URLs
 * outright.
 */
const notSvg = (value: string) => !/\.svgz?($|\?|#|\/)/i.test(value);

export const resourceInput = z.object({
  name: z.string().trim().min(1).max(200),
  partner: z.string().trim().min(1).max(200),
  partnerTier: z.enum(partner_tier),
  resourceType: z.string().trim().min(1).max(100),
  needPrimary: z.enum(NEED_KEYS),
  needSecondary: z.enum(NEED_KEYS).nullable(),
  subCategory: z.string().trim().max(200).nullable(),
  description: z.string().trim().min(1).max(5000),
  actionLabel: z.string().trim().min(1).max(60),
  externalUrl: httpsUrl,
  bannerImageUrl: httpsUrl.refine(notSvg, 'SVG images are not accepted').nullable(),
  countriesEligible: z.array(z.enum(COUNTRIES)).max(COUNTRIES.length),
  sectorsEligible: z.array(z.enum(SECTORS)).max(SECTORS.length),
  stagesEligible: z.array(z.enum(STAGES)).max(STAGES.length),
  geoScope: z.enum(geo_scope),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  status: z.enum(resource_status),
  isFeatured: z.boolean(),
  exclusivity: z.enum(exclusivity).nullable(),
  sortOrder: z.number().int().min(0).max(100000).nullable(),
});

export type ResourceInput = z.infer<typeof resourceInput>;

type ResourceRow = Database['public']['Tables']['resources']['Row'];

/**
 * The parsed input as the base-table row the actions insert or update.
 * Lives here rather than in src/lib/actions/resources.ts because a
 * `'use server'` module may export only async functions, and the review
 * queue's actions need the same builder. The name is load-bearing:
 * tests/structure/partner-fk-wiring.test.ts recognises a resource writer by
 * a `toRow(...)` payload, so renaming it would blind that guard.
 */
export function toRow(input: ResourceInput) {
  return {
    name: input.name,
    partner: input.partner,
    partner_tier: input.partnerTier,
    resource_type: input.resourceType,
    need_primary: input.needPrimary,
    need_secondary: input.needSecondary,
    sub_category: input.subCategory,
    description: input.description,
    action_label: input.actionLabel,
    external_url: input.externalUrl,
    banner_image_url: input.bannerImageUrl,
    countries_eligible: input.countriesEligible,
    sectors_eligible: input.sectorsEligible,
    stages_eligible: input.stagesEligible,
    geo_scope: input.geoScope,
    deadline: input.deadline,
    status: input.status,
    is_featured: input.isFeatured,
    exclusivity: input.exclusivity,
    sort_order: input.sortOrder,
  };
}


/**
 * The inverse of `toRow`: a full base-table row, back
 * into the camelCase shape `resourceInput` and `ResourceForm` use. Exists
 * for the edit modal, which needs every editable column — `AdminResource`
 * (src/lib/admin/types.ts) deliberately carries only the table view's
 * columns, not `description`, `action_label`, `external_url`,
 * `banner_image_url` or `exclusivity`, so it is not enough on its own to
 * pre-fill this form.
 */
export function rowToResourceInput(row: ResourceRow): ResourceInput {
  return {
    name: row.name,
    partner: row.partner,
    partnerTier: row.partner_tier,
    resourceType: row.resource_type,
    needPrimary: row.need_primary,
    needSecondary: row.need_secondary,
    subCategory: row.sub_category,
    description: row.description,
    actionLabel: row.action_label,
    externalUrl: row.external_url,
    bannerImageUrl: row.banner_image_url,
    // countries_eligible/sectors_eligible/stages_eligible are plain `text[]`
    // columns (src/lib/reference.ts's doc comment: they have no backing
    // enum), so the database type is `string[]`, wider than `resourceInput`'s
    // `z.enum(COUNTRIES)` element type. A row already in the database is
    // assumed valid — this function reads it back for the edit form, it does
    // not validate it — so the cast is asserting "already checked on the way
    // in," not skipping a check that still needs to happen.
    countriesEligible: row.countries_eligible as ResourceInput['countriesEligible'],
    sectorsEligible: row.sectors_eligible as ResourceInput['sectorsEligible'],
    stagesEligible: row.stages_eligible as ResourceInput['stagesEligible'],
    geoScope: row.geo_scope,
    deadline: row.deadline,
    status: row.status,
    isFeatured: row.is_featured,
    exclusivity: row.exclusivity,
    sortOrder: row.sort_order,
  };
}
