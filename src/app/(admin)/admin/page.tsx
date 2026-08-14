import { requireRole } from '@/lib/auth';
import { readResourceCounts } from '@/lib/admin/readers';
import EmptyState from '@/components/admin/EmptyState';
import { ADMIN_H1 } from '@/components/admin/chrome';
import { t } from '@/lib/i18n';

/**
 * The Dashboard, at launch scope (spec 1).
 *
 * Four figures, all counted from `resources` at request time. There is no
 * Total reach card, no Growth this week, and no Most-clicked list, because
 * `engagement_events` is empty until SP2b ships capture and CLAUDE.md makes a
 * plausible fake number on this surface a launch-blocking defect. The absence
 * is stated in words instead — naming a missing dependency is honest, drawing
 * an empty chart is not.
 */
export default async function AdminDashboardPage() {
  await requireRole(['admin', 'editor', 'viewer']);
  const counts = await readResourceCounts();

  const cards = [
    { key: 'admin.dashboard.resourcesLive', value: counts.live },
    { key: 'admin.dashboard.resourcesPipeline', value: counts.pipeline },
    { key: 'admin.dashboard.resourcesReference', value: counts.reference },
    { key: 'admin.dashboard.expiringSoon', value: counts.expiringSoon },
  ];

  return (
    <main data-route="/admin">
      <h1 style={ADMIN_H1}>{t('admin.dashboard.heading')}</h1>

      {/* The prototype's tile row (reference lines 696-703): #fff on a 13px
          radius, a 12px/700 label over a 28px/800 figure in the primary blue.
          auto-fit rather than its fixed four columns, so the row reflows.

          Only the treatment is taken. The prototype's dashboard also carries
          Total reach, Growth this week, a Most-clicked list, a by-need bar
          chart and a coverage strip; every one of those is populated with
          invented numbers, `engagement_events` is empty until capture ships,
          and CLAUDE.md makes a plausible fake figure on this surface a
          launch-blocking defect. Each figure below is counted from `resources`
          at request time, and the absent reporting is named in words beneath
          rather than drawn as an empty chart. */}
      <ul
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
          marginTop: 22,
          listStyle: 'none',
          padding: 0,
        }}
      >
        {cards.map((card) => (
          <li
            key={card.key}
            style={{
              background: '#fff',
              border: '1px solid #DDE5EE',
              borderRadius: 13,
              padding: 20,
            }}
          >
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#5B6B8C' }}>
              {t(card.key)}
            </p>
            <p
              style={{
                margin: '6px 0 0 0',
                fontSize: 28,
                fontWeight: 800,
                color: '#1F5FBF',
              }}
            >
              {card.value}
            </p>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 16 }}>
        <EmptyState
          heading={t('admin.dashboard.reportingUnavailableHeading')}
          body={t('admin.dashboard.reportingUnavailableBody')}
        />
      </div>
    </main>
  );
}
