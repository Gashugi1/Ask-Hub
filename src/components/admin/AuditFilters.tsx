'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n';
import {
  AUDIT_ACTIONS,
  isClearedFilters,
  type AuditAction,
  type AuditFilters as AuditFiltersState,
} from '@/lib/admin/audit-view';

/**
 * PRD 6.9's three combinable filters. Deliberately not a `<form>`: this
 * screen has no write path of any kind, and a `<form method="get">` is the
 * one element shape a later reviewer skimming for "no mutating form on this
 * page" would have to stop and reason about. `router.push` gets the same
 * GET-navigation result — the URL is the only state this ever changes — with
 * no `<form>` element in the tree to reason about at all.
 */
export default function AuditFilters({ filters }: { filters: AuditFiltersState }) {
  const router = useRouter();
  const [actor, setActor] = useState(filters.actor === 'all' ? '' : filters.actor);
  const [action, setAction] = useState<AuditAction | 'all'>(filters.action);
  const [from, setFrom] = useState(filters.from ?? '');
  const [to, setTo] = useState(filters.to ?? '');

  function apply() {
    const params = new URLSearchParams();
    if (actor.trim() !== '') params.set('actor', actor.trim());
    if (action !== 'all') params.set('action', action);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    router.push(qs ? `/admin/audit?${qs}` : '/admin/audit');
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded border border-hairline p-3">
      <label className="flex flex-col gap-1 text-xs text-muted">
        {t('admin.audit.filterActor')}
        <input
          type="text"
          value={actor}
          onChange={(event) => setActor(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') apply();
          }}
          className="rounded border border-hairline px-2 py-1 text-sm text-navy"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        {t('admin.audit.filterAction')}
        <select
          value={action}
          onChange={(event) => setAction(event.target.value as AuditAction | 'all')}
          className="rounded border border-hairline px-2 py-1 text-sm text-navy"
        >
          <option value="all">{t('admin.resources.filterAll')}</option>
          {AUDIT_ACTIONS.map((option) => (
            <option key={option} value={option}>
              {t(`admin.audit.action.${option}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        {t('admin.audit.filterFrom')}
        <input
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          className="rounded border border-hairline px-2 py-1 text-sm text-navy"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        {t('admin.audit.filterTo')}
        <input
          type="date"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          className="rounded border border-hairline px-2 py-1 text-sm text-navy"
        />
      </label>
      <button
        type="button"
        onClick={apply}
        className="rounded bg-primary px-3 py-1.5 text-sm text-surface"
      >
        {t('admin.resources.applyFilters')}
      </button>
      {!isClearedFilters(filters) ? (
        <Link href="/admin/audit" className="text-sm text-muted underline">
          {t('filter.clear')}
        </Link>
      ) : null}
    </div>
  );
}
