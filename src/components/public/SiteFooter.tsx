import Image from 'next/image';
import Link from 'next/link';
import { t } from '@/lib/i18n';

/**
 * Transcribed from the approved prototype, docs/prototype/prototype.html
 * lines 595-631: a dark #1A2332 footer, 1180px wide, three columns over a
 * hairline rule, with a thin copyright bar beneath.
 *
 * The attribution line is PRD content rule 10.1 verbatim, and
 * tests/unit/i18n.test.ts pins the exact string of `site.footer`. It reads
 * from the locale file rather than being written here so that pinning means
 * something. The prototype states the same sentence, so the port keeps the
 * pinned key rather than transcribing a second copy of the wording.
 *
 * The three outlined badges (AI HUB, MIMIT, UNDP) are the prototype's, and
 * they are the reason the attribution can stay a plain sentence: the
 * programme's partners are named as links rather than folded into prose that
 * might drift from "co-led by MIMIT and UNDP".
 *
 * **The year is interpolated, not written.** The prototype hardcodes "2026".
 * `t()` supports `{var}` substitution, so the copyright resolves the year at
 * render, and this page is statically generated -- a rebuild refreshes it.
 * A literal would have been correct for a few months and quietly wrong after.
 *
 * The Contact column links to /contact and also lists the mailbox as a
 * `mailto:` link, reading from `site.contactEmail` -- the same key
 * /privacy and /terms use, so there is still exactly one mailbox in the
 * product, as CLAUDE.md requires. Below that sit the AI Hub's own social
 * links (LinkedIn, X, YouTube) as white glyph-only icons, matching
 * PARTNER_LINKS' white-on-dark treatment.
 *
 * Hover states arrive as `style-hover` attributes, which are not real HTML.
 * This is a server component, so they land as global classes in globals.css.
 */
const COLUMN_LINK = {
  color: '#fff',
  fontSize: 13.5,
  fontWeight: 600,
  textAlign: 'left',
} as const;

/**
 * Each co-lead's mark, unboxed.
 *
 * The marks sit directly on the #1A2332 footer with no tile behind them, so
 * each file has to carry its own contrast. AI Hub and MIMIT are the
 * white-on-transparent variants and UNDP is the blue lockup, so all three read
 * on the dark ground without a tile.
 */
const BADGE = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
} as const;

/**
 * The three marks do not share an aspect ratio -- AI Hub and MIMIT are wide
 * lockups, UNDP is a tall one. Constraining height alone shrank UNDP to a
 * sliver beside the other two, so each is bounded on both axes and left to
 * fit whichever it meets first.
 */
const BADGE_IMAGE = {
  maxHeight: 40,
  maxWidth: 132,
  width: 'auto',
  height: 'auto',
  objectFit: 'contain',
  display: 'block',
} as const;

/**
 * The three marks, linked as the AI Hub website links them
 * (aihubfordevelopment.org, mimit.gov.it/en/, undp.org).
 *
 * Each width/height pair is the file's own pixel size, trimmed of its
 * transparent margin, so next/image reserves the right box before the asset
 * loads. BADGE_IMAGE below is what actually sizes them on the page.
 */
const PARTNER_LINKS = [
  {
    href: 'https://aihubfordevelopment.org',
    key: 'footer.linkAiHub',
    src: '/logos/ai-hub-white.png',
    width: 900,
    height: 313,
  },
  {
    href: 'https://www.mimit.gov.it/en/',
    key: 'footer.linkMimit',
    src: '/logos/mimit-white.png',
    width: 489,
    height: 141,
  },
  {
    href: 'https://www.undp.org',
    key: 'footer.linkUndp',
    src: '/logos/undp-blue.png',
    width: 77,
    height: 156,
  },
] as const;

/**
 * The AI Hub's own social accounts, in the Contact column. White glyphs on
 * transparent background, like PARTNER_LINKS above, so they read on the same
 * dark ground with no tile behind them.
 */
const SOCIAL_LINKS = [
  {
    href: 'https://www.linkedin.com/company/ai-hub-for-sustainable-development/',
    key: 'footer.socialLinkedin',
    src: '/logos/social-linkedin.png',
    width: 50,
    height: 50,
    displaySize: 40,
  },
  {
    href: 'https://x.com/AIHub4SD',
    key: 'footer.socialX',
    src: '/logos/social-x.png',
    width: 48,
    height: 48,
    // The X glyph's diagonal strokes reach into all four corners of its
    // canvas, unlike LinkedIn's rounded-square tile or YouTube's rounded
    // rect, both of which keep visible margin on every side. At an equal
    // pixel box the X reads larger regardless of which X asset is used, so
    // it renders at a smaller box than the other two to match apparent size.
    displaySize: 32,
  },
  {
    href: 'https://www.youtube.com/@AIHubforSustainableDevelopment',
    key: 'footer.socialYoutube',
    src: '/logos/social-youtube.png',
    width: 50,
    height: 50,
    displaySize: 40,
  },
] as const;


export default function SiteFooter() {
  return (
    <footer style={{ background: '#1A2332', color: '#fff', marginTop: 0 }}>
      <div
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '44px 32px',
          display: 'flex',
          gap: 48,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 2, minWidth: 280 }}>
          {/* The prototype sets a 7px accent bead beside the wordmark here
              (reference line 596). It is removed with the rest of the dot
              device -- see WelcomeBand, which holds the note for every
              surface that carried one. The flex row goes with it: with the
              bead gone it wrapped a single span and aligned nothing.

              That bead was also this component's last `var(--acc)`
              reference, a custom property the prototype sets on its own root
              from a settings value and that nothing in this app defines, so
              it had been resolving to its literal fallback. */}
          {/* Mark and name together. `alt` is empty because the name sits
              beside it in the same block -- describing the image too would
              make a screen reader announce the product twice. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Image
              src="/partners/askhub-wordmark.png"
              alt=""
              width={165}
              height={165}
              style={{ height: 40, width: 40, objectFit: 'contain', display: 'block' }}
            />
            <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em' }}>
              {t('site.wordmark')}
            </span>
          </div>

          <div
            style={{
              fontSize: 13,
              color: '#A9B8E0',
              marginTop: 10,
              lineHeight: 1.6,
              maxWidth: 380,
            }}
          >
            {/* The AI Hub website's own tagline, in full -- including the
                closing "Italy-Africa Mattei Plan" clause, which CLAUDE.md
                excluded from the product until 2026-09-09. That exclusion is
                gone now: the clause is back in `footer.tagline`, and
                tests/unit/i18n.test.ts and tests/seed.test.ts no longer
                assert against it.

                `site.footer` beneath it is pinned to an exact string by
                tests/unit/i18n.test.ts and carries the full co-led
                attribution, which is what keeps rule 10.1 satisfied while the
                tagline uses the site's shorter "MIMIT-UNDP co-led" phrasing. */}
            {t('footer.tagline')}
            <br />
            {t('site.footer')}
          </div>

          <div
            style={{
              marginTop: 18,
              display: 'flex',
              gap: 14,
              alignItems: 'center',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.06em',
            }}
          >
            {PARTNER_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener"
                className="proto-footer-badge"
                style={BADGE}
              >
                <Image
                  src={link.src}
                  alt={t(link.key)}
                  width={link.width}
                  height={link.height}
                  style={BADGE_IMAGE}
                />
              </a>
            ))}
          </div>
        </div>


        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Link href="/contact" className="proto-footer-link" style={COLUMN_LINK}>
              {t('footer.contactHub')}
            </Link>
            <a
              href={`mailto:${t('site.contactEmail')}`}
              className="proto-footer-link"
              style={COLUMN_LINK}
            >
              {t('site.contactEmail')}
            </a>
          </div>

          <div style={{ marginTop: 14, display: 'flex', gap: 14, alignItems: 'center' }}>
            {SOCIAL_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener"
                className="proto-footer-badge"
                style={BADGE}
              >
                <Image
                  src={link.src}
                  alt={t(link.key)}
                  width={link.width}
                  height={link.height}
                  style={{
                    maxHeight: link.displaySize,
                    maxWidth: link.displaySize,
                    width: 'auto',
                    height: 'auto',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              </a>
            ))}
          </div>

        </div>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
        <div
          style={{
            maxWidth: 1180,
            margin: '0 auto',
            padding: '16px 32px',
            fontSize: 12,
            color: '#A9B8E0',
          }}
        >
          {t('footer.copyright', { year: new Date().getFullYear() })}
        </div>
      </div>
    </footer>
  );
}
