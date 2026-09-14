import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { canWrite } from '@/lib/admin/guard';
import { readAdminResourceRows, readPartnerNames } from '@/lib/admin/readers';
import { toAdminResource } from '@/lib/admin/types';
import { rowToResourceInput } from '@/lib/schemas/resource';
import {
  parseResourceQuery,
  filterAdminResources,
  TABS,
  STATUSES,
  tabCounts,
  type ResourceQuery,
  type ResourceTab,
} from '@/lib/admin/resource-view';
import { NEED_KEYS } from '@/lib/reference';
import ResourceTable from '@/components/admin/ResourceTable';
import { ResourceEditorProvider, AddResourceButton } from '@/components/admin/ResourceEditor';
import {
  ResourceSelectionProvider,
  PublishSelectedButton,
} from '@/components/admin/ResourceSelection';
import {
  ADMIN_H1,
  ADMIN_SUB,
  ADMIN_PRIMARY,
  ADMIN_SECONDARY,
  ADMIN_FIELD,
} from '@/components/admin/chrome';
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
  const rawRows = await readAdminResourceRows();
  const allRows = rawRows.map(toAdminResource);
  const rows = filterAdminResources(allRows, query);
  const counts = tabCounts(allRows);
  const userCanWrite = canWrite(user.role);
  // Only a writer gets the modal, so only a writer pays for what it needs:
  // the provider list for the field's suggestions, and each row's full
  // editable input for the Edit action.
  const partners = userCanWrite ? await readPartnerNames() : [];
  const inputs = userCanWrite
    ? Object.fromEntries(rawRows.map((row) => [row.id, { ...rowToResourceInput(row), id: row.id }]))
    : {};

  return (
    <ResourceSelectionProvider rows={rows}>
    <ResourceEditorProvider inputs={inputs} partners={partners}>
    <main data-route="/admin/resources">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={ADMIN_H1}>{t('admin.resources.heading')}</h1>
          <div style={ADMIN_SUB}>{t('admin.resources.publicNote')}</div>
        </div>
        {/* CLAUDE.md: a viewer sees no write affordance at all, not a disabled
            one — so this is absent rather than greyed out. */}
        {userCanWrite ? (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* The prototype's bulk publish sits here, first in the action row,
                and only while something in the table is selected. */}
            <PublishSelectedButton />
            <Link
              href="/admin/resources/import"
              style={{ ...ADMIN_SECONDARY, padding: '11px 18px', fontSize: 13.5 }}
            >
              {t('admin.resources.import')}
            </Link>
            {/* The prototype's "+ Add resource" opens its form modal over
                the table; the modal itself is hosted by ResourceEditorProvider. */}
            <AddResourceButton />
          </div>
        ) : null}
      </div>

      {/* The prototype's view switcher is a row of pills rather than underlined
          tabs (reference line 781). These stay links, not buttons: each view is
          a distinct URL, which is what makes one shareable and the back button
          work. */}
      <nav
        aria-label={t('admin.resources.heading')}
        style={{ marginTop: 18, display: 'flex', gap: 8, flexWrap: 'wrap' }}
      >
        {TABS.map((tab) => {
          const on = query.tab === tab;
          return (
            <Link
              key={tab}
              href={tabHref(query, tab)}
              aria-current={on ? 'page' : undefined}
              style={{
                border: `1px solid ${on ? '#1F5FBF' : '#C9D3E8'}`,
                background: on ? '#EEF2FB' : '#fff',
                color: on ? '#1F5FBF' : '#42506E',
                borderRadius: 99,
                padding: '7px 16px',
                fontSize: 12.5,
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              {t('admin.resources.tabWithCount', {
                label: t(`admin.resources.tab.${tab}`),
                count: counts[tab],
              })}
            </Link>
          );
        })}
      </nav>

      {/* A plain GET form, deliberately: the filters live in the URL, so a
          filtered view can be shared and the back button behaves. */}
      <form
        method="get"
        action="/admin/resources"
        style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}
      >
        <input type="hidden" name="tab" value={query.tab} />
        <label style={{ flex: 1, minWidth: 220, display: 'flex' }}>
          <span className="sr-only">{t('admin.resources.search')}</span>
          <input
            type="text"
            name="q"
            defaultValue={query.search}
            placeholder={t('admin.resources.search')}
            style={{ ...ADMIN_FIELD, borderRadius: 9, padding: '10px 14px' }}
          />
        </label>
        <label>
          <span className="sr-only">{t('admin.resources.filterStatus')}</span>
          <select name="status" defaultValue={query.status} style={FILTER_SELECT}>
            <option value="all">{t('admin.resources.filterAllStatuses')}</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`status.${status}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">{t('admin.resources.filterNeed')}</span>
          <select name="need" defaultValue={query.need} style={FILTER_SELECT}>
            <option value="all">{t('admin.resources.filterAllCategories')}</option>
            {NEED_KEYS.map((need) => (
              <option key={need} value={need}>
                {t(`need.${need}`)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="proto-primary-button" style={ADMIN_PRIMARY}>
          {t('admin.resources.applyFilters')}
        </button>
      </form>

      <ResourceTable rows={rows} canWrite={userCanWrite} />
    </main>
    </ResourceEditorProvider>
    </ResourceSelectionProvider>
  );
}

/** Prototype line 786: the two filter selects beside the search field. */
const FILTER_SELECT = {
  padding: '10px 12px',
  borderRadius: 9,
  border: '1px solid #C9D3E8',
  fontSize: 13.5,
  background: '#fff',
  color: '#1A2332',
  cursor: 'pointer',
} as const;
