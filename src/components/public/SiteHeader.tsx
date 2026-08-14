import Image from 'next/image';
import Link from 'next/link';
import { t } from '@/lib/i18n';
import SearchPill from './SearchPill';

/**
 * Transcribed from the approved prototype, docs/prototype/prototype.html
 * lines 3-28: a sticky white rail with a 1px hairline, 1180px wide, 68px
 * tall, carrying the roundel and wordmark on the left, the search pill in the
 * middle, and the navigation and a single outlined action on the right.
 *
 * **The one thing not transcribed: the ADMIN button.** The prototype fills
 * the right-hand slot with an outlined ADMIN button linking to the portal.
 * PRD 5.8 forbids it in as many words -- "No login link or admin reference
 * anywhere in public navigation" -- and putting an admin entry point in front
 * of every anonymous visitor is not a styling decision. Raised with the
 * client, who ruled that PRD 5.8 governs (spec D11). Contact keeps the slot,
 * wearing the prototype's outlined-button treatment exactly: 1.5px primary
 * border, 12.5px/600, 0.06em uppercase, 9px 16px, 8px radius. So the slot
 * looks like the prototype's and leads somewhere the PRD permits.
 *
 * **On the wordmark.** `site.wordmark` is "AskHub", the product's own name,
 * as against the programme -- the AI Hub for Sustainable Development -- which
 * CLAUDE.md requires be named in full wherever it appears. The prototype
 * hides this word below 640px so the roundel and pill still fit on one row;
 * `.askhub-wordmark` in globals.css is that rule, transcribed with it.
 *
 * The mark is a local asset, so this uses next/image (which fingerprints and
 * sizes it) rather than the bare <img> PartnerRow needs for arbitrary remote
 * logo hosts. `alt=""` is deliberate: the wordmark text sits immediately
 * beside it in the same link, so announcing the image too would make screen
 * readers read the brand name twice for one control.
 *
 * Hover states arrive in the prototype as `style-hover` attributes, which are
 * not real HTML. This is a server component and converting it to a client one
 * for a background colour would be a poor trade, so they are the two global
 * classes `.proto-nav-item` and `.proto-nav-action`.
 */
export default function SiteHeader() {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: '#FFFFFF',
        borderBottom: '1px solid #DDE5EE',
      }}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:p-4 focus:text-primary"
      >
        {t('nav.skipToContent')}
      </a>
      <nav
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '10px 24px',
          minHeight: 68,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <Link
          href="/"
          style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}
        >
          <Image
            src="/partners/askhub-wordmark.png"
            alt=""
            width={165}
            height={165}
            style={{ height: 40, width: 40, objectFit: 'contain', display: 'block' }}
            priority
          />
          <span
            className="askhub-wordmark"
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: '#1A2332',
              letterSpacing: '-0.02em',
            }}
          >
            {t('site.wordmark')}
          </span>
        </Link>

        <div
          style={{
            flex: '1 1 220px',
            display: 'flex',
            justifyContent: 'center',
            minWidth: 0,
          }}
        >
          <SearchPill />
        </div>

        <ul
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexWrap: 'wrap',
            listStyle: 'none',
            margin: 0,
            padding: 0,
          }}
        >
          <li>
            <Link
              href="/"
              className="proto-nav-item"
              style={{
                display: 'inline-block',
                fontSize: 14,
                fontWeight: 600,
                color: '#1A2332',
                padding: '8px 12px',
                borderRadius: 6,
              }}
            >
              {t('nav.home')}
            </Link>
          </li>
          <li>
            <Link
              href="/#directory"
              className="proto-nav-item"
              style={{
                display: 'inline-block',
                fontSize: 14,
                fontWeight: 600,
                color: '#1A2332',
                padding: '8px 12px',
                borderRadius: 6,
              }}
            >
              {t('nav.directory')}
            </Link>
          </li>
          <li>
            <Link
              href="/about"
              className="proto-nav-item"
              style={{
                display: 'inline-block',
                fontSize: 14,
                fontWeight: 600,
                color: '#1A2332',
                padding: '8px 12px',
                borderRadius: 6,
              }}
            >
              {t('nav.about')}
            </Link>
          </li>
        </ul>

        <Link
          href="/contact"
          className="proto-nav-action"
          style={{
            border: '1.5px solid #1F5FBF',
            color: '#1F5FBF',
            background: '#fff',
            fontSize: 12.5,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '9px 16px',
            borderRadius: 8,
            flexShrink: 0,
          }}
        >
          {t('nav.contact')}
        </Link>
      </nav>
    </header>
  );
}
