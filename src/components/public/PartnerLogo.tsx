import type { CSSProperties } from 'react';

/**
 * The providing organisation's mark, sitting on a resource detail banner.
 *
 * Transcribed from the approved prototype's `logoBits`, docs/prototype/
 * prototype.html line 2508: a white rounded tile with the logo contained
 * inside it. The white tile is not decoration -- the banner behind it is a
 * saturated need colour, and a partner's mark is drawn for white.
 * `objectFit: 'contain'` is what keeps a wordmark from being cropped to a
 * square.
 *
 * **Detail pages only.** The prototype pins the same mark to its directory
 * and rail cards too; those were dropped because `logo_url` is null for most
 * partners, so the tile appeared on a handful of cards in a grid and read as
 * a defect rather than as data the grid did not have. One mark on the page a
 * reader opened deliberately does not have that problem.
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
