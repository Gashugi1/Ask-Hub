import { t } from '@/lib/i18n';
import ResourceGrid, { DIRECTORY_SECTION, DIRECTORY_HEADING } from './ResourceGrid';
import { DEFAULT_SORT, paginate, sortResources } from '@/lib/public/filters';
import type { PublicResource } from '@/lib/public/types';

/**
 * The directory's server-rendered content: every live resource, sorted by
 * the default sort, with no dependency on search params.
 *
 * This is what `Suspense`'s `fallback` renders in `page.tsx`. Because it
 * reads no dynamic API, Next can render it fully during static generation --
 * so the `fallback` slot is not a spinner here, it *is* the real content: a
 * crawler and a no-JS visitor never run the client bundle, so this is the
 * only version of the directory either of them ever sees (PRD 12.2:
 * "Server-rendered content, never client-only rendering of directory
 * data."). Once a real browser hydrates, `ResourceDirectoryClient` (the
 * `Suspense` child) takes over and swaps this out for the filtered view.
 *
 * No filter controls and no export button here deliberately: both need
 * `onChange`/URL wiring that only exists once the client component has
 * mounted, so duplicating inert copies of them here would be dead weight,
 * not progressive enhancement.
 */
export default function ResourceDirectoryStatic({
  resources,
}: {
  resources: PublicResource[];
}) {
  const sorted = sortResources(resources, DEFAULT_SORT);

  return (
    <section id="directory" style={DIRECTORY_SECTION}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <h2 style={DIRECTORY_HEADING}>{t('directory.title')}</h2>
      </div>

      <p style={{ marginTop: 22, fontSize: 13.5, color: '#5B6B8C', fontWeight: 600 }}>
        {sorted.length === 1
          ? t('directory.countOne')
          : t('directory.count', { count: sorted.length })}
        {' · '}
        {t('site.curationStatement')}
      </p>

      {/* The first page, sliced by the same function the hydrated directory
          uses, so the two cannot disagree about what a page holds. This
          renderer reads no search params by design, so it always shows page
          one; the client swaps in the requested page on hydration, exactly as
          it already does for a filtered URL. */}
      <ResourceGrid resources={paginate(sorted, 1).rows} allCount={sorted.length} />
    </section>
  );
}
