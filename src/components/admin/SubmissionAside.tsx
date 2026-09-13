import type { ReviewSubmission } from '@/lib/admin/types';
import { t } from '@/lib/i18n';
import { ADMIN_PANEL, ADMIN_CARD_TITLE, ADMIN_HELP } from './chrome';

/**
 * The suggestion beside the form it prefilled ("Edit first") or the resource
 * it proposes changing ("Open resource to edit"), so the reviewer can see
 * what the visitor wrote while correcting it. Read-only, server-rendered.
 * The personal fields are shown to the reviewer here and are not in the
 * form: nothing on this panel can be saved into a resource.
 */
export default function SubmissionAside({ submission }: { submission: ReviewSubmission }) {
  return (
    <aside style={{ ...ADMIN_PANEL, background: '#F4F6F9' }} aria-labelledby="submission-aside">
      <h2 id="submission-aside" style={ADMIN_CARD_TITLE}>
        {t('admin.resources.form.fromSubmission')}
      </h2>
      <p style={{ ...ADMIN_HELP, margin: '4px 0 0 0' }}>{t('admin.resources.form.submissionNote')}</p>
      <p style={{ fontSize: 13.5, lineHeight: 1.6, color: '#42506E', margin: '12px 0 0 0', whiteSpace: 'pre-line' }}>
        {submission.description}
      </p>
      <p style={{ ...ADMIN_HELP, margin: '8px 0 0 0' }}>
        {t('admin.review.submittedBy', {
          name: submission.submitterName ?? submission.submitterEmail,
          email: submission.submitterEmail,
        })}
        {submission.programmeContactEmail
          ? ` · ${t('admin.review.programmeContact', { email: submission.programmeContactEmail })}`
          : ''}
      </p>
    </aside>
  );
}
