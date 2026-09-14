import { requirePageRole } from '@/lib/admin/guard';
import { readPartnerNames, readPendingSubmissions, readResourceForEdit } from '@/lib/admin/readers';
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
  const [submissions, partners] = await Promise.all([readPendingSubmissions(), readPartnerNames()]);
  // "Open resource to edit" opens the target in the modal, so its full input
  // is read here for each update suggestion (a handful of rows at most). A
  // target the reader cannot return -- deleted, or hidden -- leaves the card
  // without that button rather than opening a blank form.
  const targets = Object.fromEntries(
    await Promise.all(
      submissions
        .filter((s) => s.targetResourceId !== null)
        .map(async (s) => {
          const input = await readResourceForEdit(s.targetResourceId!);
          return [s.id, input ? { ...input, id: s.targetResourceId! } : null] as const;
        }),
    ),
  );

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
            <ReviewCard
              key={submission.id}
              submission={submission}
              partners={partners}
              targetInput={targets[submission.id] ?? null}
            />
          ))}
        </div>
      )}
    </main>
  );
}
