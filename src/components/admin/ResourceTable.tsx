import Link from 'next/link';
import { t } from '@/lib/i18n';
import { deadlineInfo } from '@/lib/deadline';
import type { AdminResource } from '@/lib/admin/types';
import EmptyState from './EmptyState';
import StatusSelect from './StatusSelect';
import FeaturedToggle from './FeaturedToggle';

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
 * A row per resource. Task 3 built the read-only version; Task 4 adds the
 * Actions column and turns the Status cell into a live control — both
 * strictly gated on `canWrite`, per CLAUDE.md: a viewer sees no write
 * affordance at all, not a disabled one. That is why the Actions column is
 * a conditional entry in the header/row arrays rather than always-rendered
 * cells with disabled controls inside — an empty column kept only to avoid
 * a layout shift is exactly the thing CLAUDE.md rules out.
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
    <div className="overflow-x-auto rounded border border-hairline">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-tint-1 text-muted">
          <tr>
            <th className="px-4 py-2 font-medium">{t('admin.resources.col.resource')}</th>
            <th className="px-4 py-2 font-medium">{t('admin.resources.col.need')}</th>
            <th className="px-4 py-2 font-medium">{t('admin.resources.col.eligibility')}</th>
            <th className="px-4 py-2 font-medium">{t('admin.resources.col.deadline')}</th>
            <th className="px-4 py-2 font-medium">{t('admin.resources.col.status')}</th>
            {canWrite ? (
              <th className="px-4 py-2 font-medium">{t('admin.resources.col.actions')}</th>
            ) : null}
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
              <td className="px-4 py-3 text-navy">
                {canWrite ? (
                  <StatusSelect id={row.id} status={row.status} />
                ) : (
                  t(`status.${row.status}`)
                )}
              </td>
              {canWrite ? (
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link href={`/admin/resources/${row.id}`} className="text-primary underline">
                      {t('admin.resources.actions.edit')}
                    </Link>
                    <FeaturedToggle id={row.id} isFeatured={row.isFeatured} />
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
