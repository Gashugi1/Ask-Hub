import type { CSSProperties } from 'react';

/**
 * The providing organisation's mark, sitting on a resource's banner.
 *
 * Transcribed from the approved prototype's `logoBits`, docs/prototype/
 * prototype.html lines 2503-2508: one image at four sizes, each a white
 * rounded tile with the logo contained inside it. The white tile is not
 * decoration -- every banner behind it is a saturated need colour, and a
 * partner's mark is drawn for white. `objectFit: 'contain'` is what keeps a
 * wordmark from being cropped to a square.
 *
 * **Nothing renders when there is no logo.** `partners.logo_url` is null for
 * most partners and will stay null until the client's pack covers them, so a
 * missing logo is the normal case, not an error. There is no placeholder, no
 * initials tile and no grey box: the banner already names the organisation in
 * text directly below, so an absent mark costs a reader nothing, while an
 * invented one would put a shape on a UN programme's page that no partner
 * supplied.
 *
 * **The prototype's own logo source is deliberately not transcribed.** It
 * calls `https://www.google.com/s2/favicons?domain=...` per partner
 * (reference line 2495) -- a third-party request per card that hands Google
 * the visitor's IP and the page they are on, returning a 16-64px favicon
 * rather than the organisation's actual mark. It even misattributes Stanford
 * to coursera.org, which 0013_reconcile_partners.sql already recorded. What
 * ships instead is the client's asset pack, served from this application's
 * own origin; see scripts/seed-data.ts's PARTNER_ASSETS.
 *
 * `alt` is empty on purpose. Every surface that renders this also renders the
 * partner's name as text within the same banner, so a described logo would
 * make a screen reader announce the organisation twice for one card.
 *
 * A bare `<img>` rather than next/image: `logo_url` may be an absolute https
 * URL on an arbitrary remote host (the column still accepts one), and
 * next/image would need every such host allow-listed in next.config.ts.
 * PartnerRow reaches for the same escape hatch for the same reason.
 */
export default function PartnerLogo({
  logoUrl,
  style,
}: {
  logoUrl: string | null;
  style: CSSProperties;
}) {
  if (!logoUrl) return null;
  return (
    // The directive must sit on the line immediately above the <img>, not
    // above this explanation, or it suppresses nothing and reports itself as
    // an unused disable.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt=""
      style={{ background: '#fff', objectFit: 'contain', ...style }}
    />
  );
}

/** Directory card banner, prototype line 2507 (`bnLogoDir`). */
export const LOGO_ON_CARD: CSSProperties = {
  position: 'absolute',
  top: 11,
  right: 14,
  width: 28,
  height: 28,
  borderRadius: 6,
  padding: 3,
};

/** Recently-added rail card, prototype line 2506 (`bnLogoRail`). */
export const LOGO_ON_RAIL: CSSProperties = {
  position: 'absolute',
  top: 10,
  right: 12,
  width: 26,
  height: 26,
  borderRadius: 6,
  padding: 3,
};

/**
 * Featured card, prototype line 2505 (`bnLogoM`). The only one of the four
 * that is not absolutely positioned: the prototype sets it inline in the flex
 * row that opens the featured banner (reference line 34), not pinned to a
 * corner.
 */
export const LOGO_ON_FEATURED: CSSProperties = {
  // Block, unlike the three pinned tiles: an inline <img> would take a
  // baseline-aligned line box and ignore the margin that separates it from
  // the partner name below.
  display: 'block',
  marginBottom: 10,
  width: 34,
  height: 34,
  borderRadius: 8,
  padding: 4,
  flexShrink: 0,
};

/** Resource detail banner, prototype line 2508 (`bnLogoL`). */
export const LOGO_ON_DETAIL: CSSProperties = {
  position: 'absolute',
  top: 20,
  right: 24,
  width: 44,
  height: 44,
  borderRadius: 10,
  padding: 6,
};
