'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { t } from '@/lib/i18n';
import ResourceGrid, { DIRECTORY_SECTION, DIRECTORY_HEADING } from './ResourceGrid';
import Pagination from './Pagination';
import FilterControls from './FilterControls';
import ExportButton from './ExportButton';
import {
  parseFilters,
  paginate,
  resetPageOnFilterChange,
  directoryHref,
  filterResources,
  sortResources,
  type FilterCriteria,
} from '@/lib/public/filters';
import type { PublicResource } from '@/lib/public/types';

/**
 * The directory's interactive layer. This is the `Suspense` child in
 * `page.tsx`: calling `useSearchParams()` opts this subtree, and only this
 * subtree, into client-side rendering during static generation. It replaces
 * `ResourceDirectoryStatic` (the `Suspense` fallback) once the browser
 * hydrates, at which point `useSearchParams()` can read the real URL.
 *
 * Filtering happens here, in the browser, over the full set of live
 * resources the server already sent: one cache entry to invalidate instead
 * of one per filter combination, and no round trip per click.
 *
 * The URL is the single source of filter state. This component holds no
 * `useState` for it and runs no effect syncing state to the URL -- a second
 * copy is what makes the back button and a shared link disagree about what is
 * selected. `router.replace` with `scroll: false` keeps the visitor's place;
 * a filter click that jumps to the top of the page loses their position in a
 * long list.
 *
 * A filtered URL loaded fresh briefly shows the unfiltered
 * `ResourceDirectoryStatic` list before this component takes over -- that is
 * the accepted cost of server-rendering the directory rather than a bug.
 *
 * If the live dataset ever grows into the low thousands of substantial rows,
 * shipping every row for browser filtering stops being appropriate and this
 * moves server-side. That threshold is recorded so the decision stays
 * deliberate rather than defaulted.
 */
export default function ResourceDirectoryClient({
  resources,
}: {
  resources: PublicResource[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const criteria = parseFilters(searchParams);

  // Depend on the individual primitive fields, not on `criteria` itself:
  // `parseFilters` returns a fresh object on every render, so memoising on
  // the object reference would recompute on every render anyway -- an inert
  // memo that implies a guarantee it does not provide. `criteria` itself is
  // deliberately left out of the dependency array for that reason.
  const visible = useMemo(
    () => sortResources(filterResources(resources, criteria), criteria.sort),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      resources,
      criteria.need,
      criteria.sector,
      criteria.country,
      criteria.stage,
      criteria.query,
      criteria.sort,
    ],
  );

  const shown = paginate(visible, criteria.page);

  function apply(next: FilterCriteria) {
    // Changing a facet returns to the first page. Narrowing the results while
    // reading page five would otherwise land on page five of a two-page
    // result: an empty grid that reads as "no matches" for a filter that
    // matched. The rule lives in filters.ts so it is testable without
    // rendering, and it deliberately leaves a page change alone.
    const reset = resetPageOnFilterChange(next, criteria);
    // Same serialiser as the browse menu's links, so a chip and a sidebar
    // entry expressing the same selection produce the same URL.
    const href = directoryHref(reset, new URLSearchParams(searchParams.toString()));
    router.replace(href, { scroll: false });
  }

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
        <ExportButton rows={visible} />
      </div>

      <div style={{ marginTop: 24 }}>
        <FilterControls criteria={criteria} resultCount={visible.length} onChange={apply} />
      </div>

      <ResourceGrid resources={shown.rows} allCount={resources.length} />
      <Pagination criteria={criteria} page={shown.page} pageCount={shown.pageCount} />
    </section>
  );
}
