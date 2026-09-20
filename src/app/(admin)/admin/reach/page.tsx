import { requireRole } from '@/lib/auth';
import EmptyState from '@/components/admin/EmptyState';
import { ADMIN_H1, ADMIN_SUB } from '@/components/admin/chrome';
import { t } from '@/lib/i18n';

/**
 * Reach & Engagement, which the prototype fills with GA4 figures over three
 * date ranges -- every one of them invented. `engagement_events` is empty
 * until capture ships and no GA4 property is connected, so the screen
 * exists to say so, in words, on the route the sidebar lists. Drawing the
 * prototype's empty charts here would be the dishonest version of the same
 * statement (CLAUDE.md: metric panels show true values or explicit empty
 * states).
 *
 * Every role reaches it, as every role reaches the Dashboard: a viewer's
 * whole purpose is reporting, and this is where the reporting will be.
 */
export default async function AdminReachPage() {
  await requireRole(['admin', 'editor', 'viewer']);

  return (
    <main data-route="/admin/reach">
      <h1 style={ADMIN_H1}>{t('admin.reach.heading')}</h1>
      <div style={ADMIN_SUB}>{t('admin.reach.sub')}</div>
      <div style={{ marginTop: 22 }}>
        <EmptyState
          heading={t('admin.reach.unavailableHeading')}
          body={t('admin.reach.unavailableBody')}
        />
      </div>
    </main>
  );
}
