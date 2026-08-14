import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { canWrite } from '@/lib/admin/guard';
import { readAdminResources } from '@/lib/admin/readers';
import {
  parseResourceQuery,
  filterAdminResources,
  TABS,
  STATUSES,
  type ResourceQuery,
  type ResourceTab,
} from '@/lib/admin/resource-view';
import { NEED_KEYS } from '@/lib/reference';
import ResourceTable from '@/components/admin/ResourceTable';
import { t } from '@/lib/i18n';

/** A tab link keeps the current search, status and need — switching tabs narrows the deadline view, not the filters. */
function tabHref(query: ResourceQuery, tab: ResourceTab): string {
  const params = new URLSearchParams();
  if (tab !== 'all') params.set('tab', tab);
  if (query.search) params.set('q', query.search);
  if (query.status !== 'all') params.set('status', query.status);
  if (query.need !== 'all') params.set('need', query.need);
  const qs = params.toString();
  return qs ? `/admin/resources?${qs}` : '/admin/resources';
}

export default async function AdminResourcesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(['admin', 'editor', 'viewer']);
  const params = new URLSearchParams(
    Object.entries(await searchParams).flatMap(([k, v]) =>
      typeof v === 'string' ? [[k, v] as [string, string]] : [],
    ),
  );
  const query = parseResourceQuery(params);
  const rows = filterAdminResources(await readAdminResources(), query);
  const userCanWrite = canWrite(user.role);

  return (
    <main data-route="/admin/resources" className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-navy">{t('admin.resources.heading')}</h1>
          <p className="text-sm text-muted">{t('admin.resources.publicNote')}</p>
        </div>
        {userCanWrite ? (
          <Link
            href="/admin/resources/new"
            className="rounded bg-primary px-3 py-1.5 text-sm text-surface"
          >
            {t('admin.resources.addNew')}
          </Link>
        ) : null}
      </div>

      <nav className="flex gap-4 border-b border-hairline" aria-label={t('admin.resources.heading')}>
        {TABS.map((tab) => (
          <Link
            key={tab}
            href={tabHref(query, tab)}
            className={
              query.tab === tab
                ? 'border-b-2 border-primary px-1 pb-2 text-sm font-medium text-navy'
                : 'border-b-2 border-transparent px-1 pb-2 text-sm text-muted'
            }
          >
            {t(`admin.resources.tab.${tab}`)}
          </Link>
        ))}
      </nav>

      <form
        method="get"
        action="/admin/resources"
        className="flex flex-wrap items-end gap-3 rounded border border-hairline p-3"
      >
        <input type="hidden" name="tab" value={query.tab} />
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t('admin.resources.search')}
          <input
            type="text"
            name="q"
            defaultValue={query.search}
            className="rounded border border-hairline px-2 py-1 text-sm text-navy"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t('admin.resources.filterStatus')}
          <select
            name="status"
            defaultValue={query.status}
            className="rounded border border-hairline px-2 py-1 text-sm text-navy"
          >
            <option value="all">{t('admin.resources.filterAll')}</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`status.${status}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t('admin.resources.filterNeed')}
          <select
            name="need"
            defaultValue={query.need}
            className="rounded border border-hairline px-2 py-1 text-sm text-navy"
          >
            <option value="all">{t('admin.resources.filterAll')}</option>
            {NEED_KEYS.map((need) => (
              <option key={need} value={need}>
                {t(`need.${need}`)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded bg-primary px-3 py-1.5 text-sm text-surface">
          {t('admin.resources.applyFilters')}
        </button>
      </form>

      <ResourceTable rows={rows} canWrite={userCanWrite} />
    </main>
  );
}
