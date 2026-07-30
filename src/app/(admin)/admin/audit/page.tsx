import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { readAuditPage } from '@/lib/admin/readers';
import { parseAuditFilters, AUDIT_PAGE_SIZE } from '@/lib/admin/audit-view';
import AuditFilters from '@/components/admin/AuditFilters';
import AuditTable from '@/components/admin/AuditTable';
import { t } from '@/lib/i18n';

/** Preserves every active filter across a page link, changing only `page`. */
function pageHref(searchParams: URLSearchParams, page: number): string {
  const params = new URLSearchParams(searchParams);
  if (page <= 1) params.delete('page');
  else params.set('page', String(page));
  const qs = params.toString();
  return qs ? `/admin/audit?${qs}` : '/admin/audit';
}

/**
 * PRD 6.9: read access for all three roles, identically, because this
 * screen has no write path for any of them to be gated from. Newest first,
 * paginated rather than loading the whole table.
 */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(['admin', 'editor', 'viewer']);

  const params = new URLSearchParams(
    Object.entries(await searchParams).flatMap(([k, v]) =>
      typeof v === 'string' ? [[k, v] as [string, string]] : [],
    ),
  );
  const filters = parseAuditFilters(params);
  const { rows, total } = await readAuditPage(filters);
  const totalPages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const countText = total === 1 ? t('admin.audit.countOne') : t('admin.audit.count', { count: total });

  return (
    <main data-route="/admin/audit" className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-navy">{t('admin.audit.heading')}</h1>
      <p className="text-sm text-muted">{t('admin.audit.intro')}</p>
      <p className="text-sm text-navy">{countText}</p>

      <AuditFilters filters={filters} />
      <AuditTable rows={rows} />

      {total > 0 ? (
        <nav
          className="flex items-center justify-between text-sm text-muted"
          aria-label={t('admin.audit.heading')}
        >
          {filters.page > 1 ? (
            <Link href={pageHref(params, filters.page - 1)} className="text-primary underline">
              {t('admin.audit.pagePrev')}
            </Link>
          ) : (
            <span />
          )}
          <span>{t('admin.audit.pageStatus', { page: filters.page, totalPages })}</span>
          {filters.page < totalPages ? (
            <Link href={pageHref(params, filters.page + 1)} className="text-primary underline">
              {t('admin.audit.pageNext')}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </main>
  );
}
