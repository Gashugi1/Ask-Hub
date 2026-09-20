import { ADMIN_SUB } from '@/components/admin/chrome';
import { t } from '@/lib/i18n';

/**
 * Shown inside the admin shell while a screen's server render is in flight.
 * Every admin route is dynamic and reads the database per request, so a
 * click on the sidebar had nothing to show until the whole page arrived --
 * which reads as the click not having worked. With a loading boundary Next
 * swaps the content area to this the moment the link is clicked and streams
 * the page in behind it; the sidebar stays put.
 */
export default function AdminLoading() {
  return (
    <div role="status" aria-live="polite" style={{ ...ADMIN_SUB, marginTop: 0 }}>
      {t('admin.loading')}
    </div>
  );
}
