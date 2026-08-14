import { z } from 'zod';

/**
 * The five keys `public.settings` actually holds, confirmed against the
 * database (`select key, value from public.settings order by key`) and
 * against the seed in `supabase/migrations/0006_site.sql`. `settings.value`
 * is jsonb: the two GA4 ids and the mailbox store a JSON string, the two
 * flags store a JSON boolean.
 */
export const SETTING_KEYS = [
  'ga4_measurement_id',
  'ga4_property_id',
  'contact_email',
  'feature_innovator_profiles',
  'feature_public_impact_page',
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

/**
 * CLAUDE.md: one mailbox only. A `settings` row is the one place a second
 * address could enter the product without touching a locale file, so this
 * is the exact literal `contact_email` may ever hold — not a general email
 * format check, which would happily accept any other address.
 */
export const CONTACT_EMAIL = 'aihubfordevelopment@undp.org';

/**
 * A discriminated union on `key`, so each of the five settings carries its
 * own value shape rather than one loose `string | boolean`. An empty string
 * is a legal value for both GA4 ids — clearing either back to "" is what
 * drives the admin screen's and the public site's "Not connected" state
 * (PRD 6.4), so it must stay reachable, not just the format it takes once
 * configured.
 *
 * GA4 formats: a Measurement ID is `G-` followed by 6-12 alphanumerics
 * (Google's current format, distinct from the legacy `UA-...` Universal
 * Analytics id, which this must refuse). A property id for the GA4 Data API
 * is purely numeric, 6-12 digits.
 */
export const settingUpdate = z.discriminatedUnion('key', [
  z.object({
    key: z.literal('ga4_measurement_id'),
    value: z.union([z.literal(''), z.string().regex(/^G-[A-Z0-9]{6,12}$/)]),
  }),
  z.object({
    key: z.literal('ga4_property_id'),
    value: z.union([z.literal(''), z.string().regex(/^\d{6,12}$/)]),
  }),
  z.object({
    key: z.literal('contact_email'),
    value: z.literal(CONTACT_EMAIL),
  }),
  z.object({
    key: z.literal('feature_innovator_profiles'),
    value: z.boolean(),
  }),
  z.object({
    key: z.literal('feature_public_impact_page'),
    value: z.boolean(),
  }),
]);

export type SettingUpdate = z.infer<typeof settingUpdate>;
