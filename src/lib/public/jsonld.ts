import type { PublicResource } from './types';

/**
 * schema.org structured data for a resource detail page (PRD 12.2).
 *
 * The type is `Offer`. The PRD requires structured data but names no type,
 * so this is where the choice is fixed rather than left to whoever writes
 * the page: `Offer` is the only schema.org type whose standard properties
 * cover every field the detail page carries -- across compute, training,
 * funding, accelerator and partners resources alike -- without inventing
 * anything.
 *
 *   name              <- name
 *   description       <- description
 *   url               <- external_url, falling back to the canonical page
 *   image             <- banner_image_url
 *   availabilityEnds  <- deadline
 *   eligibleRegion    <- countries_eligible, only when geo_scope is 'specific'
 *   availability      <- is_closed
 *   offeredBy         <- partner_name, partner_website_url
 *
 * Two rules hold this honest. Every value comes from `resources_public`,
 * which projects no analytics or internal column, so nothing private can
 * reach a search engine through this object. And an absent value omits its
 * property rather than emitting null, an empty string or a guess -- a
 * fabricated deadline in structured data is a fabricated deadline, whether
 * or not a human ever reads it.
 */
export interface ResourceJsonLd {
  '@context': 'https://schema.org';
  '@type': 'Offer';
  name: string;
  description?: string;
  url: string;
  image?: string;
  availabilityEnds?: string;
  eligibleRegion?: string[];
  availability: string;
  offeredBy: { '@type': 'Organization'; name: string; url?: string };
}

export function resourceJsonLd(
  resource: PublicResource,
  canonicalUrl: string,
): ResourceJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    name: resource.name,
    ...(resource.description ? { description: resource.description } : {}),
    url: resource.externalUrl ?? canonicalUrl,
    ...(resource.bannerImageUrl ? { image: resource.bannerImageUrl } : {}),
    ...(resource.deadline ? { availabilityEnds: resource.deadline } : {}),
    // Gated on geo_scope as well as the list. Nothing in the schema ties the
    // two columns together, so a row with geo_scope 'global' and a leftover
    // country list is representable -- and emitting the list would then tell a
    // crawler "Kenya" while the page tells a human "open worldwide", from the
    // same URL. The visible page treats a country list as authoritative only
    // for 'specific' (see lib/public/geo.ts); this matches it exactly rather
    // than approximating it.
    ...(resource.geoScope === 'specific' && resource.countriesEligible.length > 0
      ? { eligibleRegion: resource.countriesEligible }
      : {}),
    availability: resource.isClosed
      ? 'https://schema.org/Discontinued'
      : 'https://schema.org/InStock',
    offeredBy: {
      '@type': 'Organization',
      name: resource.partnerName,
      ...(resource.partnerWebsiteUrl ? { url: resource.partnerWebsiteUrl } : {}),
    },
  };
}

/**
 * Serialise the object for injection into a `<script type="application/ld+json">`.
 *
 * `JSON.stringify` alone is **not** safe here, and this is the reason this
 * function exists rather than the page calling stringify directly. Inside a
 * `<script>` element the HTML parser is still looking for the closing tag, so
 * a resource description containing `</script><script>...` ends the JSON-LD
 * block and starts an executable one -- `JSON.stringify` escapes quotes and
 * backslashes but never `<`. Resource copy is partner-supplied and
 * admin-entered, so it is user content by CLAUDE.md's definition, and
 * CLAUDE.md forbids dangerouslySetInnerHTML with user content unescaped.
 *
 * Escaping `<`, `>` and `&` to their \\u form keeps the JSON byte-for-byte
 * equivalent -- a JSON parser reads \\u003c as `<` -- while leaving the HTML
 * parser nothing to act on.
 *
 * React's normal text escaping cannot be used instead: it would emit `&quot;`
 * inside the script element, which is not valid JSON.
 */
export function serialiseJsonLd(value: ResourceJsonLd): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
