import { notFound } from 'next/navigation';
import { t } from '@/lib/i18n';
import { isFeatureEnabled, listImpactStories } from '@/lib/public/readers';

/**
 * PRD 5.7. Built now, dark until the flag flips.
 *
 * CLAUDE.md: build the flag, not the feature -- but this page IS the feature
 * the flag gates, and the PRD says explicitly it is built and returns 404
 * while off. That is different from the innovator profiles, which are not
 * built at all.
 *
 * The gate short-circuits before any read: a 404 that still queried would
 * leak load and timing for a page nobody is supposed to reach. There is also
 * deliberately no `generateMetadata` here -- metadata for a 404 is metadata
 * for a page that does not exist.
 */
export default async function ImpactPage() {
  if (!(await isFeatureEnabled('feature_public_impact_page'))) notFound();

  const stories = await listImpactStories();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold text-navy">{t('impact.title')}</h1>
      {stories.length === 0 ? (
        <p className="mt-6 text-muted">{t('impact.empty')}</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-8">
          {stories.map((story) => (
            <li key={story.id}>
              <h2 className="text-lg font-semibold text-navy">{story.organisation}</h2>
              {story.country ? <p className="text-sm text-muted-light">{story.country}</p> : null}
              {story.description ? <p className="mt-2 text-muted">{story.description}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
