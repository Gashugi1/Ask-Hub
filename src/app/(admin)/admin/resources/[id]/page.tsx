import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { readResourceForEdit } from '@/lib/admin/readers';
import ResourceForm from '@/components/admin/ResourceForm';
import { t } from '@/lib/i18n';

/**
 * requireRole runs here too, not only inside updateResource/deleteResource:
 * a page check is UX, the action's own requireRole is the actual gate (PRD
 * 14.4, src/lib/actions/README.md) — this route can be reached directly,
 * with no proxy in front of it, exactly like the actions can.
 */
export default async function EditResourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(['admin', 'editor']);
  const { id } = await params;
  const resource = await readResourceForEdit(id);
  if (!resource) notFound();

  return (
    <main data-route="/admin/resources/[id]" className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-navy">{t('admin.resources.form.headingEdit')}</h1>
      <ResourceForm initial={{ ...resource, id }} />
    </main>
  );
}
