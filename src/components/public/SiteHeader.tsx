import Image from 'next/image';
import Link from 'next/link';
import { t } from '@/lib/i18n';

/**
 * PRD 5.8: no login link and no admin reference anywhere in public
 * navigation. The route-group split keeps the admin subtree unreachable from
 * here structurally; this component must not reintroduce a link to it.
 *
 * **On the "primary action" slot.** PRD §11 specifies the navigation as
 * "logo left, links centre, primary action right", which is why the layout
 * below is a three-column grid rather than a `justify-between` pair — with
 * two flex children the middle group sits wherever the side widths leave it,
 * not on the page's centre line. The prototype fills that right-hand slot
 * with an ADMIN button. It cannot be used: PRD 5.8 forbids exactly that, and
 * tests/structure/routes.test.ts asserts it. Contact is promoted into the
 * slot instead — it is the only other public route that is an action rather
 * than a destination, it already exists, and it needs no new copy key. It is
 * therefore no longer repeated in the centre list.
 *
 * **On the wordmark.** This renders `site.wordmark` ("AskHub"), the product's
 * own name, matching the prototype and the welcome band's "Welcome to
 * AskHub" — the header previously read "AI Hub", so the two disagreed on the
 * same screen. The key is `site.wordmark` rather than the `site.shortName` it
 * replaces because the distinction is load-bearing: AskHub is this directory,
 * whereas the programme is the AI Hub for Sustainable Development, and
 * CLAUDE.md requires that programme to be called "AI Hub" or "AI Hub for
 * Sustainable Development" every time it is named. `site.name` and
 * `site.attribution` still carry the programme's wording for the surfaces
 * that refer to it; a key called "shortName" holding "AskHub" would have
 * invited a future line like "co-led by {shortName}" to break that rule
 * silently.
 *
 * The mark is a local asset, so this uses next/image (which fingerprints and
 * sizes it) rather than the bare <img> PartnerRow needs for arbitrary remote
 * logo hosts. `alt=""` is deliberate: the wordmark text sits immediately
 * beside it in the same link, so announcing the image too would make screen
 * readers read the brand name twice for one control.
 */
export default function SiteHeader() {
  return (
    <header className="border-b border-hairline bg-surface">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:p-4 focus:text-primary"
      >
        {t('nav.skipToContent')}
      </a>
      <nav className="mx-auto grid h-17 max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 justify-self-start">
          <Image
            src="/partners/askhub-wordmark.png"
            alt=""
            width={63}
            height={63}
            className="h-9 w-9"
            priority
          />
          <span className="text-lg font-extrabold text-navy">{t('site.wordmark')}</span>
        </Link>
        <ul className="flex items-center gap-6 text-sm text-muted">
          <li>
            <Link href="/#directory">{t('nav.directory')}</Link>
          </li>
          <li>
            <Link href="/about">{t('nav.about')}</Link>
          </li>
        </ul>
        <Link
          href="/contact"
          className="justify-self-end rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary"
        >
          {t('nav.contact')}
        </Link>
      </nav>
    </header>
  );
}
