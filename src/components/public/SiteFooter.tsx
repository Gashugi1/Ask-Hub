import Image from 'next/image';
import Link from 'next/link';
import { t } from '@/lib/i18n';

/**
 * The four-column footer of the approved prototype: brand and mission, Quick
 * Links, Programmes, Contact, over a hairline rule with a thin copyright bar
 * beneath.
 *
 * **The marks are this product's own image assets, not the prototype's.** The
 * prototype draws every mark inline -- a conic-gradient circle for the AI Hub,
 * a three-span tricolour for MIMIT, a bordered "UN" circle for UNDP, and the
 * letters `in`, `▶` and `𝕏` for the socials. Those are stand-ins for artwork
 * it did not have. What ships is the client's asset pack, dropped into the
 * prototype's own chrome: the same outlined pills for the co-leads, the same
 * 30px outlined boxes for the socials.
 *
 * **The brand marks stack rather than sitting in one wrapping row.** The
 * prototype writes them as a single `flex-wrap` row that happens to wrap,
 * because its inline AI Hub lockup is wide enough to force the break at every
 * realistic column width. The asset pack's lockup is narrower and would not
 * wrap, so the break is written rather than left to chance -- the left-hand
 * rule beside AskHub reads as a deliberate divider either way.
 *
 * **The co-led sentence is not repeated here.** PRD content rule 10.1 is
 * satisfied by the copyright bar's "Co-led by MIMIT and UNDP", and the full
 * sentence `site.footer` pins is carried by /contact.
 *
 * **The year is interpolated, not written.** The prototype hardcodes "2026".
 * `t()` substitutes `{year}` at render, and this page is statically
 * generated -- a rebuild refreshes it. A literal would have been correct for a
 * few months and quietly wrong after.
 *
 * Hover states arrive as `style-hover` attributes, which are not real HTML.
 * This is a server component, so they land as global classes in globals.css --
 * `proto-footer-badge` is what lights an outline up on hover.
 */
const COLUMN_HEADING = {
  fontSize: 13,
  fontWeight: 800,
  color: '#fff',
} as const;

const COLUMN_LIST = {
  marginTop: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
} as const;

const COLUMN_LINK = {
  color: '#C6D2F2',
  fontSize: 13.5,
  fontWeight: 600,
  textDecoration: 'none',
  textAlign: 'left',
} as const;

/** The co-lead's outlined pill, prototype reference: the MIMIT/UNDP chips. */
const PILL = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid rgba(255,255,255,0.3)',
  borderRadius: 6,
  padding: '6px 11px',
  textDecoration: 'none',
} as const;

/**
 * Each mark reads on the dark ground unaided: AI Hub and MIMIT are the
 * white-on-transparent variants, UNDP the blue lockup. The pill outlines them
 * rather than tiling them, so none of the three needs a white plate behind it.
 *
 * They do not share an aspect ratio -- AI Hub and MIMIT are wide lockups,
 * UNDP is a tall one -- so each is bounded on both axes and left to fit
 * whichever it meets first.
 */
const PILL_IMAGE = {
  maxHeight: 30,
  maxWidth: 120,
  width: 'auto',
  height: 'auto',
  objectFit: 'contain',
  display: 'block',
} as const;

/** The socials' 30px outlined box, prototype reference: the `in`/`▶`/`𝕏` chips. */
const SOCIAL_BOX = {
  width: 30,
  height: 30,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid rgba(255,255,255,0.3)',
  borderRadius: 7,
  textDecoration: 'none',
} as const;

/**
 * The AI Hub's own mark, opening the brand column. Its width/height pair is
 * the file's own pixel size, trimmed of transparent margin, so next/image
 * reserves the right box before the asset loads.
 */
const AI_HUB_MARK = {
  href: 'https://aihubfordevelopment.org',
  src: '/logos/ai-hub-white.png',
  width: 900,
  height: 313,
} as const;

/**
 * The two co-leads, on the row beneath the brand marks and linked to their
 * official sites (PRD content rule 10.10). AI Hub above them, then MIMIT, then
 * UNDP -- the order the official AI Hub website uses, which the same rule
 * requires the footer to match.
 */
const CO_LEAD_LINKS = [
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
 * The AI Hub's programmes, on the AI Hub's own site. These are destinations,
 * not directory entries: the footer names them and leaves the reader on
 * aihubfordevelopment.org, which is why none of them carries a figure. The
 * last has no page of its own yet and lands on the programmes index, exactly
 * as the prototype's own fallback does.
 */
const PROGRAMME_LINKS = [
  {
    href: 'https://www.aihubfordevelopment.org/programmes/compute-accelerator-programme',
    key: 'footer.programmeCompute',
  },
  {
    href: 'https://www.aihubfordevelopment.org/programmes/ai-infrastructure-builder-program',
    key: 'footer.programmeInfrastructure',
  },
  {
    href: 'https://aihubfordevelopment.org/cyber4africa-programme',
    key: 'footer.programmeCyber',
  },
  {
    href: 'https://www.aihubfordevelopment.org/programmes',
    key: 'footer.programmeVoiceAi',
  },
] as const;

/**
 * The AI Hub's own social accounts, at the foot of the Contact column. White
 * glyphs on transparent background, inside the prototype's outlined boxes.
 */
const SOCIAL_LINKS = [
  {
    href: 'https://www.linkedin.com/company/ai-hub-for-sustainable-development/',
    key: 'footer.socialLinkedin',
    src: '/logos/social-linkedin.png',
    width: 50,
    height: 50,
    glyphSize: 17,
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
    // pixel box the X reads larger, so it sits a notch smaller in its box.
    glyphSize: 14,
  },
  {
    href: 'https://www.youtube.com/@AIHubforSustainableDevelopment',
    key: 'footer.socialYoutube',
    src: '/logos/social-youtube.png',
    width: 50,
    height: 50,
    glyphSize: 17,
  },
] as const;

export default function SiteFooter() {
  return (
    <footer style={{ background: '#1A2332', color: '#fff', marginTop: 0 }}>
      <div
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '48px 32px',
          display: 'flex',
          gap: 56,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1.4, minWidth: 280 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14 }}>
            <a
              href={AI_HUB_MARK.href}
              target="_blank"
              rel="noopener"
              style={{ display: 'inline-flex', textDecoration: 'none' }}
            >
              <Image
                src={AI_HUB_MARK.src}
                alt={t('footer.linkAiHub')}
                width={AI_HUB_MARK.width}
                height={AI_HUB_MARK.height}
                style={{
                  maxHeight: 46,
                  maxWidth: 210,
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </a>
            {/* `alt` is empty because the name sits beside it in the same
                block -- describing the image too would make a screen reader
                announce the product twice. */}
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                textDecoration: 'none',
                color: '#fff',
                borderLeft: '1px solid rgba(255,255,255,0.18)',
                paddingLeft: 16,
              }}
            >
              <Image
                src="/partners/askhub-wordmark.png"
                alt=""
                width={165}
                height={165}
                style={{ height: 34, width: 34, objectFit: 'contain', display: 'block' }}
              />
              <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em' }}>
                {t('site.wordmark')}
              </span>
            </Link>
          </div>

          <div
            style={{
              marginTop: 18,
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            {CO_LEAD_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener"
                className="proto-footer-badge"
                style={PILL}
              >
                <Image
                  src={link.src}
                  alt={t(link.key)}
                  width={link.width}
                  height={link.height}
                  style={PILL_IMAGE}
                />
              </a>
            ))}
          </div>

          <div
            style={{
              fontSize: 13,
              color: '#A9B8E0',
              marginTop: 18,
              lineHeight: 1.65,
              maxWidth: 340,
            }}
          >
            {t('footer.tagline')}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={COLUMN_HEADING}>{t('footer.quickLinks')}</div>
          <div style={COLUMN_LIST}>
            {/* One entry, as the prototype has it: the directory itself. Its
                other public routes reach a reader from the header and from
                the Contact column, and the impact page is unreachable by
                design while its feature flag is off. */}
            <Link href="/" className="proto-footer-link" style={COLUMN_LINK}>
              {t('site.wordmark')}
            </Link>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={COLUMN_HEADING}>{t('footer.programmes')}</div>
          <div style={COLUMN_LIST}>
            {PROGRAMME_LINKS.map((link) => (
              <a
                key={link.key}
                href={link.href}
                target="_blank"
                rel="noopener"
                className="proto-footer-link"
                style={COLUMN_LINK}
              >
                {t(link.key)}
              </a>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={COLUMN_HEADING}>{t('nav.contact')}</div>
          <div style={COLUMN_LIST}>
            <a
              href={`mailto:${t('site.contactEmail')}`}
              className="proto-footer-link"
              style={COLUMN_LINK}
            >
              {t('site.contactEmail')}
            </a>
            <Link href="/contact" className="proto-footer-link" style={COLUMN_LINK}>
              {t('contact.suggestAction')}
            </Link>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
              {SOCIAL_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener"
                  className="proto-footer-badge"
                  style={SOCIAL_BOX}
                >
                  <Image
                    src={link.src}
                    alt={t(link.key)}
                    width={link.width}
                    height={link.height}
                    style={{
                      maxHeight: link.glyphSize,
                      maxWidth: link.glyphSize,
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
