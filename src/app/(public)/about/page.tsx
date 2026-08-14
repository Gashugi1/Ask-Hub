import { t } from '@/lib/i18n';
import { getSiteContent, listHeadlineStats } from '@/lib/public/readers';

/**
 * PRD 5.6: editable identity copy plus all headline stats, and the single
 * mailbox.
 *
 * Unlike the home strip this renders every attested figure, not the first
 * four heroes -- but the rule is the same: only figures that exist, nothing
 * standing in for the ones that do not, and no band at all when there are
 * none. The client supplies the fifteen figures over time, so the partial
 * state is the normal state, not an error condition.
 *
 * The compute snapshot is not here. PRD 10 places `compute_metrics` on the
 * admin Reach and Engagement screen; the prototype showed it publicly, and
 * the PRD is authoritative over the prototype.
 */
export default async function AboutPage() {
  const [content, stats] = await Promise.all([getSiteContent(), listHeadlineStats()]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold text-navy">{t('about.title')}</h1>

      {content.identity_lead ? (
        <p className="mt-6 text-lg text-muted">{content.identity_lead}</p>
      ) : null}
      {content.identity_align ? (
        <p className="mt-4 text-muted">{content.identity_align}</p>
      ) : null}

      {stats.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-navy">{t('about.statsHeading')}</h2>
          <dl className="mt-6 grid gap-6 sm:grid-cols-2">
            {stats.map((stat) => (
              <div key={stat.id}>
                <dt className="text-2xl font-semibold text-primary">{stat.value}</dt>
                <dd className="mt-1 text-sm text-muted">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-navy">{t('about.contactHeading')}</h2>
        <p className="mt-2 text-muted">
          <a className="text-primary underline" href={`mailto:${t('site.contactEmail')}`}>
            {t('site.contactEmail')}
          </a>
        </p>
      </section>

      <p className="mt-12 text-sm text-muted-light">{t('site.footer')}</p>
    </div>
  );
}
