import Link from 'next/link';
import { t } from '@/lib/i18n';
import { ADMIN_PANEL_COL, ADMIN_FIELD_ROW, ADMIN_FIELD, ADMIN_PRIMARY, ADMIN_LINK_ACTION } from './chrome';
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
      style={{ ...ADMIN_PANEL_COL, flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}
    >
      <label style={ADMIN_FIELD_ROW}>
        {t('admin.audit.filterActor')}
        <input
          type="text"
          name="actor"
          defaultValue={filters.actor === 'all' ? '' : filters.actor}
          style={ADMIN_FIELD}
        />
      </label>
      <label style={ADMIN_FIELD_ROW}>
        {t('admin.audit.filterAction')}
        <select
          name="action"
          defaultValue={filters.action}
          style={ADMIN_FIELD}
        >
          <option value="all">{t('admin.audit.filterAllActions')}</option>
          {AUDIT_ACTIONS.map((action) => (
            <option key={action} value={action}>
              {t(`admin.audit.action.${action}`)}
            </option>
          ))}
        </select>
      </label>
      <label style={ADMIN_FIELD_ROW}>
        {t('admin.audit.filterFrom')}
        <input
          type="date"
          name="from"
          defaultValue={filters.from ?? ''}
          style={ADMIN_FIELD}
        />
      </label>
      <label style={ADMIN_FIELD_ROW}>
        {t('admin.audit.filterTo')}
        <input
          type="date"
          name="to"
          defaultValue={filters.to ?? ''}
          style={ADMIN_FIELD}
        />
      </label>
      <button type="submit" className="proto-primary-button" style={ADMIN_PRIMARY}>
        {t('admin.resources.applyFilters')}
      </button>
      {!isClearedFilters(filters) ? (
        <Link href="/admin/audit" style={{ ...ADMIN_LINK_ACTION, color: "#5B6B8C", textDecoration: "underline" }}>
          {t('filter.clear')}
        </Link>
      ) : null}
    </form>
  );
}
