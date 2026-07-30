import Link from 'next/link';
import { t } from '@/lib/i18n';

/**
 * The attribution line is PRD content rule 10.1 verbatim, and
 * tests/unit/i18n.test.ts pins the exact string of `site.footer`. It reads
 * from the locale file rather than being written here so that pinning means
 * something.
 */
export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-hairline bg-tint-2">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-muted">
        <p>{t('site.footer')}</p>
        <p>
          {t('footer.contactPrompt')}{' '}
          <a className="text-primary underline" href={`mailto:${t('site.contactEmail')}`}>
            {t('site.contactEmail')}
          </a>
        </p>
        <ul className="flex gap-6">
          <li>
            <Link href="/privacy">{t('footer.privacy')}</Link>
          </li>
          <li>
            <Link href="/terms">{t('footer.terms')}</Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}
