import { notFound } from 'next/navigation';
import { requirePageRole } from '@/lib/admin/guard';
import {
  readResourceForEdit,
  readPartnerNames,
  readSubmissionForReview,
} from '@/lib/admin/readers';
import ResourceForm from '@/components/admin/ResourceForm';
import SubmissionAside from '@/components/admin/SubmissionAside';
import { t } from '@/lib/i18n';

/**
 * requirePageRole runs here too, not only inside updateResource/deleteResource:
 * a page check is UX, the action's own requireRole is the actual gate (PRD
 * 14.4, src/lib/actions/README.md) — this route can be reached directly,
 * with no proxy in front of it, exactly like the actions can. A viewer gets
 * `notFound()`, as on Review and Settings, rather than a FORBIDDEN error.
 *
 * `?submission=<id>` is the Review Queue's "Open resource to edit": the
 * update suggestion is shown beside the form, and saving marks it approved.
 * Only a suggestion that targets this very resource is honoured.
 */
export default async function EditResourcePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageRole(['admin', 'editor']);
  const { id } = await params;
  const resource = await readResourceForEdit(id);
  if (!resource) notFound();
  // Read after the notFound check: a missing resource needs no partner list.
  // `resources.partner` is a foreign key to partners(name), so the form picks
  // from this list rather than accepting free text.
  const partners = await readPartnerNames();

  const { submission: submissionParam } = await searchParams;
  const submission =
    typeof submissionParam === 'string' && /^[0-9a-f-]{36}$/i.test(submissionParam)
      ? await readSubmissionForReview(submissionParam)
      : null;
  const suggestion = submission?.targetResourceId === id ? submission : null;

  return (
    <main data-route="/admin/resources/[id]" className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-navy">{t('admin.resources.form.headingEdit')}</h1>
      {suggestion ? <SubmissionAside submission={suggestion} /> : null}
      <ResourceForm initial={{ ...resource, id }} partners={partners} submissionId={suggestion?.id} />
    </main>
  );
}
