import Link from 'next/link';
import { t } from '@/lib/i18n';
import { directoryHref, type FilterCriteria } from '@/lib/public/filters';

/**
 * The directory's pager.
 *
 * Every control is a `<Link>` built through `directoryHref`, not a button, for
 * the same reason the filters are in the URL: a page is a place. It can be
 * shared, bookmarked, opened in a new tab, walked with the back button and
 * followed by a crawler, none of which a click handler over local state
 * offers. It also means this renders identically on the server.
 *
 * Nothing renders for a single page. A pager reading "1 of 1" is furniture.
 */
export default function Pagination({
  criteria,
  page,
  pageCount,
}: {
  criteria: FilterCriteria;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;

  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);

  return (
    <nav
      aria-label={t('directory.pagination')}
      style={{
        marginTop: 28,
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
      }}
    >
      {page > 1 ? (
        <Link
          href={directoryHref({ ...criteria, page: page - 1 })}
          rel="prev"
          className="proto-page-link"
          style={STEP}
        >
          {t('directory.previous')}
        </Link>
      ) : null}

      {pages.map((n) => {
        const current = n === page;
        return (
          <Link
            key={n}
            href={directoryHref({ ...criteria, page: n })}
            // `aria-current="page"` is what tells a screen reader which page
            // it is on; the colour alone would not.
            aria-current={current ? 'page' : undefined}
            className={current ? undefined : 'proto-page-link'}
            style={{
              ...STEP,
              background: current ? '#1F5FBF' : '#fff',
              color: current ? '#fff' : '#42506E',
              borderColor: current ? '#1F5FBF' : '#C9D3E8',
            }}
          >
            {n}
          </Link>
        );
      })}

      {page < pageCount ? (
        <Link
          href={directoryHref({ ...criteria, page: page + 1 })}
          rel="next"
          className="proto-page-link"
          style={STEP}
        >
          {t('directory.next')}
        </Link>
      ) : null}
    </nav>
  );
}

const STEP = {
  border: '1px solid #C9D3E8',
  background: '#fff',
  color: '#42506E',
  borderRadius: 8,
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 700,
  minWidth: 38,
  textAlign: 'center',
} as const;
