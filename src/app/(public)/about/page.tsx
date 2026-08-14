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
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '56px 32px 80px 32px' }}>
      <h1
        style={{
          margin: 0,
          fontSize: 40,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          lineHeight: 1.12,
          textWrap: 'balance',
        }}
      >
        {t('about.title')}
      </h1>

      {content.identity_lead ? (
        <p style={{ ...BODY, margin: '20px 0 0 0' }}>{content.identity_lead}</p>
      ) : null}
      {content.identity_align ? (
        <p style={{ ...BODY, margin: '16px 0 0 0' }}>{content.identity_align}</p>
      ) : null}

      {stats.length > 0 ? (
        <section style={{ marginTop: 32 }}>
          <h2 className="sr-only">{t('about.statsHeading')}</h2>
          {/* The prototype's tile grid (reference lines 385-391), on auto-fit
              rather than its fixed three columns so a partial set of figures
              still fills the row instead of leaving fixed gaps. */}
          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 14,
              margin: 0,
            }}
          >
            {stats.map((stat) => (
              <div
                key={stat.id}
                style={{ background: '#F4F6F9', borderRadius: 12, padding: 18 }}
              >
                <dt style={{ fontSize: 26, fontWeight: 800, color: '#1F5FBF' }}>
                  {stat.value}
                </dt>
                <dd style={{ fontSize: 12.5, color: '#5B6B8C', marginTop: 2, marginLeft: 0 }}>
                  {stat.label}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <h2 style={SECTION_HEADING}>{t('about.contactHeading')}</h2>
      <p style={{ ...BODY, margin: '12px 0 0 0' }}>
        <a
          href={`mailto:${t('site.contactEmail')}`}
          style={{ color: '#1F5FBF', fontWeight: 700 }}
        >
          {t('site.contactEmail')}
        </a>
      </p>

      <p style={{ marginTop: 36, fontSize: 13, color: '#5B6B8C' }}>{t('site.footer')}</p>
    </div>
  );
}

/** Marketing body copy, prototype line 382: 16.5px on 1.7 in #2B3A5C. */
const BODY = {
  fontSize: 16.5,
  lineHeight: 1.7,
  color: '#2B3A5C',
} as const;

/** Section heading, prototype line 392. */
const SECTION_HEADING = {
  margin: '40px 0 0 0',
  fontSize: 20,
  fontWeight: 800,
} as const;
