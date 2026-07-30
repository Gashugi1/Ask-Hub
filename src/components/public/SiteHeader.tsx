import Link from 'next/link';
import { t } from '@/lib/i18n';

/**
 * PRD 5.8: no login link and no admin reference anywhere in public
 * navigation. The route-group split keeps the admin subtree unreachable from
 * here structurally; this component must not reintroduce a link to it.
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
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-4">
        <Link href="/" className="text-lg font-semibold text-navy">
          {t('site.shortName')}
        </Link>
        <ul className="flex items-center gap-6 text-sm text-muted">
          <li>
            <Link href="/#directory">{t('nav.directory')}</Link>
          </li>
          <li>
            <Link href="/about">{t('nav.about')}</Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
