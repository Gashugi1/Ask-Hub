import { t } from '@/lib/i18n';
import ResourceCard from './ResourceCard';
import type { PublicResource } from '@/lib/public/types';

/**
 * The card grid and its two data-driven empty states. Shared by the
 * server-rendered fallback (always unfiltered, so `resources` and `allCount`
 * are the same length) and the client directory (filtered, so they can
 * differ) -- one place for the grid markup and the empty-state copy so the
 * two renderers cannot drift apart.
 *
 * Deliberately has no `'use client'` directive and no hooks: it is plain
 * presentation over props, so it is equally valid to render from a Server
 * Component and from a Client Component.
 */
export default function ResourceGrid({
  resources,
  allCount,
}: {
  resources: readonly PublicResource[];
  allCount: number;
}) {
  // Three empty cases exist across the two callers, deliberately distinct.
  // Telling someone to remove a filter when they have not set one is worse
  // than saying nothing -- so "nothing live at all" and "nothing after
  // filtering" stay two different messages, never collapsed into one.
  if (allCount === 0) {
    return <p className="mt-10 text-muted">{t('directory.emptyAll')}</p>;
  }

  if (resources.length === 0) {
    return (
      <div className="mt-10 flex flex-col items-start gap-3">
        <p className="text-muted">{t('directory.emptyFiltered')}</p>
        <p className="text-sm text-muted-light">{t('directory.emptyFilteredAction')}</p>
      </div>
    );
  }

  return (
    <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {resources.map((resource) => (
        <li key={resource.id} className="flex">
          <ResourceCard resource={resource} />
        </li>
      ))}
    </ul>
  );
}
