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
 * The mailto that used to sit here is gone, matching the prototype: the
 * footer now links to /contact, which is where the address lives. There is
 * still exactly one mailbox in the product, as CLAUDE.md requires.
 *
 * Hover states arrive as `style-hover` attributes, which are not real HTML.
 * This is a server component, so they land as global classes in globals.css.
 */
const COLUMN_LABEL = {
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#A9B8E0',
} as const;

const COLUMN_LINK = {
  color: '#fff',
  fontSize: 13.5,
  fontWeight: 600,
  textAlign: 'left',
} as const;

const BADGE = {
  border: '1px solid rgba(255,255,255,0.3)',
  padding: '6px 12px',
  borderRadius: 6,
  color: '#C6D2F2',
  textDecoration: 'none',
} as const;

const PARTNER_LINKS = [
  { href: 'https://aihubfordevelopment.org', key: 'footer.linkAiHub' },
  { href: 'https://www.mimit.gov.it', key: 'footer.linkMimit' },
  { href: 'https://www.undp.org', key: 'footer.linkUndp' },
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em' }}>
              {t('site.wordmark')}
            </span>
            <span
              aria-hidden="true"
              style={{
                width: 7,
                height: 7,
                borderRadius: 99,
                background: 'var(--acc, #F06428)',
              }}
            />
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
                {t(link.key)}
              </a>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={COLUMN_LABEL}>{t('footer.explore')}</div>
          <div
            style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 9 }}
          >
            <Link href="/#directory" className="proto-footer-link" style={COLUMN_LINK}>
              {t('nav.directory')}
            </Link>
            <Link href="/about" className="proto-footer-link" style={COLUMN_LINK}>
              {t('nav.about')}
            </Link>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={COLUMN_LABEL}>{t('nav.contact')}</div>
          <div
            style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 9 }}
          >
            <Link href="/contact" className="proto-footer-link" style={COLUMN_LINK}>
              {t('footer.contactHub')}
            </Link>
            <Link href="/privacy" className="proto-footer-link" style={COLUMN_LINK}>
              {t('footer.privacy')}
            </Link>
            <Link href="/terms" className="proto-footer-link" style={COLUMN_LINK}>
              {t('footer.terms')}
            </Link>
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
