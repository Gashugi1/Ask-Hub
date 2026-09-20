import { requireRole } from '@/lib/auth';
import {
  readResourceCounts,
  readLiveCoverage,
  readPendingSubmissionCount,
} from '@/lib/admin/readers';
import { computeCoverage } from '@/lib/admin/dashboard-view';
import { ADMIN_H1, ADMIN_SUB, ADMIN_PANEL, ADMIN_CARD_TITLE } from '@/components/admin/chrome';
import { t } from '@/lib/i18n';

/**
 * The Dashboard, as the approved prototype lays it out minus everything it
 * fabricates.
 *
 * The prototype's tile row is Resources live, Total reach, Growth this week,
 * Pending review, Expiring ≤ 14 days and Coverage, followed by a by-need bar
 * panel beside a Most-clicked list. Total reach, Growth and Most-clicked are
 * computed from `views` and `clicks` figures the prototype invents;
 * `engagement_events` is empty until capture ships, and CLAUDE.md makes a
 * plausible fake number on this surface a launch-blocking defect. Those
 * three are absent, and the Reach & Engagement screen states in words that
 * the reporting is not available yet. The four tiles and the panel that
 * remain are counted from `resources` and `submissions` at request time.
 */
export default async function AdminDashboardPage() {
  await requireRole(['admin', 'editor', 'viewer']);
  const [counts, coverageRows, pending] = await Promise.all([
    readResourceCounts(),
    readLiveCoverage(),
    readPendingSubmissionCount(),
  ]);
  const coverage = computeCoverage(coverageRows);
  const maxNeed = Math.max(1, ...coverage.byNeed.map((entry) => entry.count));

  const tiles = [
    {
      label: t('admin.dashboard.resourcesLive'),
      value: counts.live,
      sub: t('admin.dashboard.resourcesLiveSub', { n: counts.pipeline }),
    },
    {
      label: t('admin.dashboard.pendingReview'),
      value: pending,
      sub: t('admin.dashboard.pendingReviewSub'),
    },
    {
      label: t('admin.dashboard.expiringSoon'),
      value: counts.expiringSoon,
      sub: t('admin.dashboard.expiringSoonSub'),
    },
    {
      label: t('admin.dashboard.coverage'),
      value: coverage.countriesCovered,
      sub: t('admin.dashboard.coverageSub', {
        sectors: coverage.sectorsCovered,
        total: coverage.sectorsTotal,
      }),
    },
  ];

  return (
    <main data-route="/admin">
      <h1 style={ADMIN_H1}>{t('admin.dashboard.heading')}</h1>
      <div style={ADMIN_SUB}>{t('admin.dashboard.sub')}</div>

      {/* The prototype's tile: #fff on a 13px radius, a 12px/700 label over
          a 28px/800 figure in the primary blue, a 12px sub-line beneath.
          auto-fit rather than its fixed three columns, so the row reflows. */}
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
        {tiles.map((tile) => (
          <li key={tile.label} style={{ ...ADMIN_PANEL, padding: 20 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#5B6B8C' }}>
              {tile.label}
            </p>
            <p style={{ margin: '6px 0 0 0', fontSize: 28, fontWeight: 800, color: '#1F5FBF' }}>
              {tile.value}
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#5B6B8C' }}>{tile.sub}</p>
          </li>
        ))}
      </ul>

      {/* The by-need panel: one row per need in canonical order, a 10px bar
          scaled against the largest count so the longest bar is always full,
          coloured with the need's own token. The prototype pairs it with a
          Most-clicked list; that half is absent for the reason above, so the
          panel takes the prototype's 1.2fr column on its own. */}
      <section
        aria-labelledby="dashboard-by-need"
        style={{ ...ADMIN_PANEL, marginTop: 16, maxWidth: 720 }}
      >
        <h2 id="dashboard-by-need" style={ADMIN_CARD_TITLE}>
          {t('admin.dashboard.byNeed')}
        </h2>
        <ul
          style={{
            marginTop: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 11,
            listStyle: 'none',
            padding: 0,
          }}
        >
          {coverage.byNeed.map((entry) => (
            <li
              key={entry.need}
              style={{
                display: 'grid',
                gridTemplateColumns: '96px 1fr 26px',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#42506E' }}>
                {t(`need.${entry.need}`)}
              </span>
              <span
                aria-hidden="true"
                style={{ background: '#EEF2FB', borderRadius: 99, height: 10, overflow: 'hidden' }}
              >
                <span
                  style={{
                    display: 'block',
                    height: 10,
                    borderRadius: 99,
                    background: `var(--color-need-${entry.need})`,
                    width: `${Math.round((entry.count / maxNeed) * 100)}%`,
                  }}
                />
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 800, textAlign: 'right' }}>
                {entry.count}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
