import { requireRole } from '@/lib/auth';
import { readResourceCounts } from '@/lib/admin/readers';
import EmptyState from '@/components/admin/EmptyState';
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
    <main data-route="/admin" className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-navy">{t('admin.dashboard.heading')}</h1>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <li key={card.key} className="rounded border border-hairline p-4">
            <p className="text-sm text-muted">{t(card.key)}</p>
            <p className="text-2xl font-semibold text-navy">{card.value}</p>
          </li>
        ))}
      </ul>
      <EmptyState
        heading={t('admin.dashboard.reportingUnavailableHeading')}
        body={t('admin.dashboard.reportingUnavailableBody')}
      />
    </main>
  );
}
