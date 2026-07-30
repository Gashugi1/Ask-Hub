import { requireRole } from '@/lib/auth';
import ResourceForm from '@/components/admin/ResourceForm';
import { t } from '@/lib/i18n';

/**
 * requireRole runs here too, not only inside createResource: a page check is
 * UX (an editor should never see the form flash before a redirect), the
 * action's own requireRole is the actual gate (PRD 14.4, src/lib/actions/
 * README.md) — this route can be reached directly, with no proxy in front of
 * it, exactly like the action can.
 */
export default async function NewResourcePage() {
  await requireRole(['admin', 'editor']);

  return (
    <main data-route="/admin/resources/new" className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-navy">{t('admin.resources.form.headingCreate')}</h1>
      <ResourceForm />
    </main>
  );
}
