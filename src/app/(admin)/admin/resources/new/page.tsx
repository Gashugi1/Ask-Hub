import { requireRole } from '@/lib/auth';
import { readPartnerNames, readSubmissionForReview } from '@/lib/admin/readers';
import { submissionResourceDraft } from '@/lib/admin/submission-to-resource';
import ResourceForm from '@/components/admin/ResourceForm';
import SubmissionAside from '@/components/admin/SubmissionAside';
import { t } from '@/lib/i18n';

/**
 * requireRole runs here too, not only inside createResource: a page check is
 * UX (an editor should never see the form flash before a redirect), the
 * action's own requireRole is the actual gate (PRD 14.4, src/lib/actions/
 * README.md) — this route can be reached directly, with no proxy in front of
 * it, exactly like the action can.
 *
 * `?submission=<id>` is the Review Queue's "Edit first": the form starts
 * from the suggestion's draft with the suggestion shown beside it, and
 * saving approves the suggestion. A submission that is not pending, or does
 * not exist, gives the plain blank form -- the link may be stale, and that
 * is not worth a 404.
 */
export default async function NewResourcePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(['admin', 'editor']);
  const { submission: submissionParam } = await searchParams;
  const submission =
    typeof submissionParam === 'string' && /^[0-9a-f-]{36}$/i.test(submissionParam)
      ? await readSubmissionForReview(submissionParam)
      : null;
  const fromSubmission = submission?.type === 'new_resource' ? submission : null;
  // `resources.partner` is a foreign key to partners(name), so the form picks
  // from this list rather than accepting free text.
  const partners = await readPartnerNames();

  return (
    <main data-route="/admin/resources/new" className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-navy">{t('admin.resources.form.headingCreate')}</h1>
      {fromSubmission ? <SubmissionAside submission={fromSubmission} /> : null}
      <ResourceForm
        partners={fromSubmission ? [...partners, fromSubmission.organisation ?? ''] : partners}
        prefill={fromSubmission ? submissionResourceDraft(fromSubmission) : undefined}
        submissionId={fromSubmission?.id}
      />
    </main>
  );
}
