import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { readResourceForEdit, readPartnerNames } from '@/lib/admin/readers';
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
  // Read after the notFound check: a missing resource needs no partner list.
  // `resources.partner` is a foreign key to partners(name), so the form picks
  // from this list rather than accepting free text.
  const partners = await readPartnerNames();

  return (
    <main data-route="/admin/resources/[id]" className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-navy">{t('admin.resources.form.headingEdit')}</h1>
      <ResourceForm initial={{ ...resource, id }} partners={partners} />
    </main>
  );
}
