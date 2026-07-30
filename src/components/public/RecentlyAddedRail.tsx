import { t } from '@/lib/i18n';
import ResourceCard from './ResourceCard';
import { sortResources } from '@/lib/public/filters';
import type { PublicResource } from '@/lib/public/types';

const RECENT_LIMIT = 6;

/** PRD 5.1 item 7. */
export default function RecentlyAddedRail({ resources }: { resources: PublicResource[] }) {
  const recent = sortResources(resources, 'recent').slice(0, RECENT_LIMIT);
  if (recent.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h2 className="text-xl font-semibold text-navy">{t('home.recentHeading')}</h2>
      <ul className="mt-6 flex snap-x gap-6 overflow-x-auto pb-4">
        {recent.map((resource) => (
          <li key={resource.id} className="w-80 shrink-0 snap-start">
            <ResourceCard resource={resource} />
          </li>
        ))}
      </ul>
    </section>
  );
}
