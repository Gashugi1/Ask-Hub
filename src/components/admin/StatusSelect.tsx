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
      className="rounded border border-hairline px-2 py-1 text-sm text-navy"
    >
      {STATUSES.map((value) => (
        <option key={value} value={value}>
          {t(`status.${value}`)}
        </option>
      ))}
    </select>
  );
}
