import Link from 'next/link';
import { t } from '@/lib/i18n';
import {
  AUDIT_ACTIONS,
  isClearedFilters,
  type AuditFilters as AuditFiltersState,
} from '@/lib/admin/audit-view';

/**
 * PRD 6.9's three combinable filters, all `GET` navigation — this is the one
 * `<form>` on the screen and it mutates nothing, it only changes the URL.
 * Same shape as the Resources screen's filter form
 * (`src/app/(admin)/admin/resources/page.tsx`): a plain `<form method="get">`
 * with zero client JavaScript. No hidden fields are needed here, unlike that
 * form's hidden `tab` field, since audit has no sibling tab state to carry
 * across a filter change.
 */
export default function AuditFilters({ filters }: { filters: AuditFiltersState }) {
  return (
    <form
      method="get"
      action="/admin/audit"
      className="flex flex-wrap items-end gap-3 rounded border border-hairline p-3"
    >
      <label className="flex flex-col gap-1 text-xs text-muted">
        {t('admin.audit.filterActor')}
        <input
          type="text"
          name="actor"
          defaultValue={filters.actor === 'all' ? '' : filters.actor}
          className="rounded border border-hairline px-2 py-1 text-sm text-navy"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        {t('admin.audit.filterAction')}
        <select
          name="action"
          defaultValue={filters.action}
          className="rounded border border-hairline px-2 py-1 text-sm text-navy"
        >
          <option value="all">{t('admin.resources.filterAll')}</option>
          {AUDIT_ACTIONS.map((action) => (
            <option key={action} value={action}>
              {t(`admin.audit.action.${action}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        {t('admin.audit.filterFrom')}
        <input
          type="date"
          name="from"
          defaultValue={filters.from ?? ''}
          className="rounded border border-hairline px-2 py-1 text-sm text-navy"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        {t('admin.audit.filterTo')}
        <input
          type="date"
          name="to"
          defaultValue={filters.to ?? ''}
          className="rounded border border-hairline px-2 py-1 text-sm text-navy"
        />
      </label>
      <button type="submit" className="rounded bg-primary px-3 py-1.5 text-sm text-surface">
        {t('admin.resources.applyFilters')}
      </button>
      {!isClearedFilters(filters) ? (
        <Link href="/admin/audit" className="text-sm text-muted underline">
          {t('filter.clear')}
        </Link>
      ) : null}
    </form>
  );
}
