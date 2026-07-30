'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { t } from '@/lib/i18n';
import ResourceCard from './ResourceCard';
import FilterControls from './FilterControls';
import ExportButton from './ExportButton';
import {
  parseFilters,
  toSearchParams,
  filterResources,
  sortResources,
  type FilterCriteria,
} from '@/lib/public/filters';
import type { PublicResource } from '@/lib/public/types';

/**
 * The directory. Filtering happens here, in the browser, over the full set of
 * live resources the server already sent: one cache entry to invalidate
 * instead of one per filter combination, and no round trip per click.
 *
 * The URL is the single source of filter state. This component holds no
 * `useState` for it and runs no effect syncing state to the URL -- a second
 * copy is what makes the back button and a shared link disagree about what is
 * selected. `router.replace` with `scroll: false` keeps the visitor's place;
 * a filter click that jumps to the top of the page loses their position in a
 * long list.
 *
 * If the live dataset ever grows into the low thousands of substantial rows,
 * shipping every row for browser filtering stops being appropriate and this
 * moves server-side. That threshold is recorded so the decision stays
 * deliberate rather than defaulted.
 */
export default function ResourceDirectory({
  resources,
}: {
  resources: PublicResource[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const criteria = parseFilters(searchParams);

  const visible = useMemo(
    () => sortResources(filterResources(resources, criteria), criteria.sort),
    [resources, criteria],
  );

  function apply(next: FilterCriteria) {
    const params = toSearchParams(next, new URLSearchParams(searchParams.toString()));
    const query = params.toString();
    router.replace(query === '' ? '/#directory' : `/?${query}#directory`, { scroll: false });
  }

  return (
    <section id="directory" className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-2xl font-semibold text-navy">{t('directory.title')}</h2>
        <ExportButton rows={visible} />
      </div>

      <div className="mt-6">
        <FilterControls criteria={criteria} resultCount={visible.length} onChange={apply} />
      </div>

      {/* Three empty cases, deliberately distinct. Telling someone to remove a
          filter when they have not set one is worse than saying nothing. */}
      {resources.length === 0 ? (
        <p className="mt-10 text-muted">{t('directory.emptyAll')}</p>
      ) : visible.length === 0 ? (
        <div className="mt-10 flex flex-col items-start gap-3">
          <p className="text-muted">{t('directory.emptyFiltered')}</p>
          <p className="text-sm text-muted-light">{t('directory.emptyFilteredAction')}</p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((resource) => (
            <li key={resource.id} className="flex">
              <ResourceCard resource={resource} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
