import { t } from '@/lib/i18n';
import type { AuditEntry } from '@/lib/admin/types';
import type { AuditAction } from '@/lib/admin/audit-view';
import EmptyState from './EmptyState';

/**
 * PRD 4.15's badge colours, mapped onto the existing design tokens rather
 * than new hex literals: `published`/`approved` share the green already
 * defined for the `partners` need, `edited`/`created` share the blue already
 * defined for the `compute` need, `deleted`/`rejected` reuse the existing
 * `danger` pair, and `role_changed` reuses the amber-brown already defined
 * for the `funding` need. Only `digest_sent`'s "neutral" had no existing
 * token to reuse, so `--color-neutral`/`--color-neutral-bg` were added to
 * `globals.css`'s `@theme` block for it — see the comment there.
 */
const ACTION_CLASSES: Record<AuditAction, string> = {
  published: 'bg-need-partners-bg text-need-partners',
  edited: 'bg-need-compute-bg text-need-compute',
  created: 'bg-need-compute-bg text-need-compute',
  deleted: 'bg-danger-bg text-danger',
  approved: 'bg-need-partners-bg text-need-partners',
  rejected: 'bg-danger-bg text-danger',
  role_changed: 'bg-need-funding-bg text-need-funding',
  digest_sent: 'bg-neutral-bg text-neutral',
};

function ActionBadge({ action }: { action: AuditAction }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${ACTION_CLASSES[action]}`}
    >
      {t(`admin.audit.action.${action}`)}
    </span>
  );
}

/** `occurred_at` to the minute (PRD 6.9), in the reader's local time zone. */
function formatOccurredAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * `actor_name === 'system'` is the sentinel the trigger writes when there is
 * no authenticated caller (a seed script, an ops script, the Auth Admin
 * API's own transaction) — not a person named "system". Routed through a
 * locale key so it renders as an evidently automated actor rather than as if
 * someone called "system" made the change. Every other `actor_name` is
 * rendered exactly as stored: it is denormalised at write time (PRD 4.15)
 * precisely so it stays correct after the person is renamed or deactivated.
 */
function actorDisplayName(actorName: string): string {
  return actorName === 'system' ? t('admin.audit.actorSystem') : actorName;
}

/**
 * Read-only by construction: every cell is text, there is no action column,
 * and nothing here opens a form or a mutation. PRD 6.9 spans every entity
 * type the system logs, not resources alone, so ITEM and CHANGE are
 * rendered as the stored strings with no per-entity-type branching.
 */
export default function AuditTable({ rows }: { rows: AuditEntry[] }) {
  if (rows.length === 0) {
    return <EmptyState heading={t('admin.empty.noRows')} />;
  }

  return (
    <div className="overflow-x-auto rounded border border-hairline">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-tint-1 text-muted">
          <tr>
            <th className="px-4 py-2 font-medium">{t('admin.audit.col.when')}</th>
            <th className="px-4 py-2 font-medium">{t('admin.audit.col.user')}</th>
            <th className="px-4 py-2 font-medium">{t('admin.audit.col.action')}</th>
            <th className="px-4 py-2 font-medium">{t('admin.audit.col.item')}</th>
            <th className="px-4 py-2 font-medium">{t('admin.audit.col.change')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-hairline align-top">
              <td className="whitespace-nowrap px-4 py-3 text-muted">
                {formatOccurredAt(row.occurredAt)}
              </td>
              <td className="px-4 py-3 text-navy">{actorDisplayName(row.actorName)}</td>
              <td className="px-4 py-3">
                <ActionBadge action={row.action} />
              </td>
              <td className="px-4 py-3 text-navy">{row.entityLabel}</td>
              {/*
                change_summary is rendered verbatim, as data, never through
                t(): it is composed in SQL at write time by
                public.audit_change_summary (PRD 4.15) precisely so an entry
                reads later exactly as it read when written. Passing it
                through t() would look up en.json for a key that is never
                there and re-render history in whichever language the
                reader's locale happened to be.
              */}
              <td className="px-4 py-3 text-muted">{row.changeSummary}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
