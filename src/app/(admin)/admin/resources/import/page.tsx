import { requireRole } from '@/lib/auth';
import { readPartnerNames, readResourceDedupeIndex } from '@/lib/admin/readers';
import TrackerImport from '@/components/admin/TrackerImport';
import { t } from '@/lib/i18n';
import { ADMIN_H1 } from '@/components/admin/chrome';

/**
 * A page rather than a modal over the table, for the reason ResourceForm
 * already records for itself: port the prototype's appearance, not its
 * architecture. A route carries its own role gate, survives a refresh while an
 * operator is halfway through reading 200 rejected rows, and lets the server
 * load the two facts the preview needs before anything renders.
 *
 * requireRole runs here as well as inside importTrackerResources: the page
 * check is UX, the action's is the gate (PRD 14.4).
 */
export default async function ImportResourcesPage() {
  await requireRole(['admin', 'editor']);
  // The preview checks every row against what already exists and against the
  // partners that do, so both come down with the page and the check needs no
  // round trip.
  const [existing, partners] = await Promise.all([
    readResourceDedupeIndex(),
    readPartnerNames(),
  ]);

  return (
    <main data-route="/admin/resources/import">
      <h1 style={ADMIN_H1}>{t('admin.import.heading')}</h1>
      <TrackerImport existing={existing} partners={partners} />
    </main>
  );
}
