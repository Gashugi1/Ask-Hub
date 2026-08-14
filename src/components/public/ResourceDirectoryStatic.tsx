import { t } from '@/lib/i18n';
import ResourceGrid from './ResourceGrid';
import { DEFAULT_SORT, sortResources } from '@/lib/public/filters';
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
    <section id="directory" className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-h2 font-extrabold text-navy">{t('directory.title')}</h2>
      </div>

      <p className="mt-6 text-sm text-muted">
        {sorted.length === 1
          ? t('directory.countOne')
          : t('directory.count', { count: sorted.length })}
      </p>

      <ResourceGrid resources={sorted} allCount={sorted.length} />
    </section>
  );
}
