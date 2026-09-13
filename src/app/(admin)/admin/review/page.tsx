import { requirePageRole } from '@/lib/admin/guard';
import { readPendingSubmissions } from '@/lib/admin/readers';
import ReviewCard from '@/components/admin/ReviewCard';
import { ADMIN_H1, ADMIN_SUB } from '@/components/admin/chrome';
import { t } from '@/lib/i18n';

/**
 * The Review Queue: every pending submission, oldest first, as the
 * prototype's cards. Admin and editor, matching the sidebar; a viewer gets
 * `notFound()`.
 *
 * Not the security boundary: each action a card calls re-checks the role
 * as its first statement, and `submissions_update_staff` refuses the write
 * at the database for anyone else.
 */
export default async function AdminReviewPage() {
  await requirePageRole(['admin', 'editor']);
  const submissions = await readPendingSubmissions();

  return (
    <main data-route="/admin/review">
      <h1 style={ADMIN_H1}>{t('admin.review.heading')}</h1>
      <div style={ADMIN_SUB}>{t('admin.review.sub', { count: submissions.length })}</div>

      {submissions.length === 0 ? (
        // The prototype's dashed empty card (its queue screen), verbatim in
        // treatment: an empty queue is the good outcome, and it looks like one.
        <div
          style={{
            marginTop: 22,
            border: '1px dashed #C9D3E8',
            borderRadius: 13,
            padding: 40,
            textAlign: 'center',
            background: '#fff',
          }}
        >
          <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{t('admin.review.emptyHeading')}</p>
          <p style={{ margin: '5px 0 0 0', fontSize: 13, color: '#5B6B8C' }}>
            {t('admin.review.emptyBody')}
          </p>
        </div>
      ) : (
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {submissions.map((submission) => (
            <ReviewCard key={submission.id} submission={submission} />
          ))}
        </div>
      )}
    </main>
  );
}
