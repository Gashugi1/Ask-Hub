import { t } from '@/lib/i18n';
import { deadlineInfo } from '@/lib/deadline';
import type { AdminResource } from '@/lib/admin/types';
import EmptyState from './EmptyState';

/**
 * One row's worth of eligibility, labelled by which array it came from —
 * countries, sectors and stages are independent lists, so joining them
 * without a label would blur three different questions into one string.
 * Only the non-empty lists are shown; a resource open to everyone shows none.
 */
function eligibilitySummary(row: AdminResource): string {
  const parts: string[] = [];
  if (row.countriesEligible.length > 0) {
    parts.push(`${t('column.countriesEligible')}: ${row.countriesEligible.join(', ')}`);
  }
  if (row.sectorsEligible.length > 0) {
    parts.push(`${t('column.sectorsEligible')}: ${row.sectorsEligible.join(', ')}`);
  }
  if (row.stagesEligible.length > 0) {
    parts.push(`${t('column.stagesEligible')}: ${row.stagesEligible.join(', ')}`);
  }
  return parts.length > 0 ? parts.join(' · ') : '—';
}

/** The deadline cell's text and colour, from the one function that owns the rule. */
function DeadlineCell({ deadline }: { deadline: string | null }) {
  const info = deadlineInfo(deadline);
  // deadline.autoClosed is the admin wording (PRD 6.2); deadlineInfo's own
  // label for the closed state carries the shorter public-facing
  // deadline.closed instead, so the closed case is the one state this
  // overrides rather than reads straight off `info.label`.
  const label = info.state === 'closed' ? t('deadline.autoClosed') : info.label;
  const tone =
    info.state === 'closed' ? 'text-danger' : info.state === 'expiring' ? 'text-orange' : 'text-muted';
  return <span className={tone}>{label}</span>;
}

/**
 * A row per resource, presentational only: Task 3 reads, Task 4 writes.
 * `canWrite` is accepted now so the prop shape does not change under Task 4,
 * but it gates nothing yet — there is no status dropdown or star toggle to
 * show or hide, so rendering an "Actions" column here, for any role, would be
 * an empty column kept only to reserve layout. The status cell is always
 * text in this task; a viewer in Task 4 must see that same text with no
 * dropdown around it, which this already satisfies.
 */
export default function ResourceTable({
  rows,
  canWrite,
}: {
  rows: AdminResource[];
  canWrite: boolean;
}) {
  if (rows.length === 0) {
    return <EmptyState heading={t('admin.resources.empty')} />;
  }

  return (
    // data-can-write carries no UI difference in this task — Task 3 has no
    // status dropdown or star toggle to gate — but it keeps `canWrite` a real
    // prop of this component rather than a placeholder Task 4 has to thread
    // in from scratch, and gives Task 4 an anchor to build the Actions
    // column against.
    <div className="overflow-x-auto rounded border border-hairline" data-can-write={canWrite}>
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-tint-1 text-muted">
          <tr>
            <th className="px-4 py-2 font-medium">{t('admin.resources.col.resource')}</th>
            <th className="px-4 py-2 font-medium">{t('admin.resources.col.need')}</th>
            <th className="px-4 py-2 font-medium">{t('admin.resources.col.eligibility')}</th>
            <th className="px-4 py-2 font-medium">{t('admin.resources.col.deadline')}</th>
            <th className="px-4 py-2 font-medium">{t('admin.resources.col.status')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-hairline align-top">
              <td className="px-4 py-3">
                <p className="font-medium text-navy">{row.name}</p>
                <p className="text-muted-light">
                  {row.partner} · {row.resourceType}
                  {row.subCategory ? ` · ${row.subCategory}` : ''}
                </p>
              </td>
              <td className="px-4 py-3">
                <p>{t(`need.${row.needPrimary}`)}</p>
                {row.needSecondary ? (
                  <p className="text-muted-light">{t(`need.${row.needSecondary}`)}</p>
                ) : null}
              </td>
              <td className="px-4 py-3 text-muted">{eligibilitySummary(row)}</td>
              <td className="px-4 py-3">
                <DeadlineCell deadline={row.deadline} />
              </td>
              <td className="px-4 py-3 text-navy">{t(`status.${row.status}`)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
