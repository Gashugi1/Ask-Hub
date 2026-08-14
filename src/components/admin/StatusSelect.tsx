'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setResourceStatus } from '@/lib/actions/resources';
import { STATUSES } from '@/lib/admin/resource-view';
import type { ResourceStatus } from '@/lib/admin/types';
import { t } from '@/lib/i18n';

/**
 * Inline status control for one table row. Rendered only when the caller
 * already knows `canWrite` is true (see ResourceTable) — there is no
 * disabled variant, per CLAUDE.md: a viewer must see no write affordance at
 * all, not a greyed-out one.
 *
 * A status change to 'live' is recorded as 'published' by the audit trigger
 * automatically (0017_audit_triggers.sql); this component does not, and must
 * not, signal that itself.
 */
export default function StatusSelect({ id, status }: { id: string; status: ResourceStatus }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <select
      aria-label={t('admin.resources.col.status')}
      defaultValue={status}
      disabled={pending}
      onChange={(event) => {
        const next = event.target.value as ResourceStatus;
        startTransition(async () => {
          await setResourceStatus(id, next);
          router.refresh();
        });
      }}
      // Prototype line 828: the status control sits in the row as a compact
      // 12px/800 select rather than a full-size field.
      style={{
        padding: '6px 8px',
        borderRadius: 7,
        border: '1px solid #C9D3E8',
        background: '#fff',
        color: '#42506E',
        fontSize: 12,
        fontWeight: 800,
        cursor: 'pointer',
      }}
    >
      {STATUSES.map((value) => (
        <option key={value} value={value}>
          {t(`status.${value}`)}
        </option>
      ))}
    </select>
  );
}
