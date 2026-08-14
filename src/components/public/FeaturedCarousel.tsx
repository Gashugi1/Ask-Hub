import { t } from '@/lib/i18n';
import ResourceCard from './ResourceCard';
import { sortResources } from '@/lib/public/filters';
import type { PublicResource } from '@/lib/public/types';

/**
 * PRD 5.1 item 5. A horizontally scrolling rail rather than an auto-advancing
 * carousel: auto-advance is an accessibility problem (WCAG 2.2.2) and hides
 * content from anyone who does not watch it happen.
 */
export default function FeaturedCarousel({ resources }: { resources: PublicResource[] }) {
  const featured = sortResources(
    resources.filter((r) => r.isFeatured),
    'featured',
  );
  if (featured.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h2 className="text-h2 font-extrabold text-navy">{t('home.featuredHeading')}</h2>
      <ul className="mt-6 flex snap-x gap-6 overflow-x-auto pb-4">
        {featured.map((resource) => (
          <li key={resource.id} className="w-80 shrink-0 snap-start">
            <ResourceCard resource={resource} />
          </li>
        ))}
      </ul>
    </section>
  );
}
