'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n';
import { deadlineInfo } from '@/lib/deadline';
import { deleteResource } from '@/lib/actions/resources';
import { useResourceSelection } from './ResourceSelection';
import type { AdminResource } from '@/lib/admin/types';
import EmptyState from './EmptyState';
import StatusSelect from './StatusSelect';
import FeaturedToggle from './FeaturedToggle';
import ConfirmDeleteButton from './ConfirmDeleteButton';
import { ADMIN_LINK_DANGER, ADMIN_ERROR } from './chrome';

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
  // Prototype line 823: the note under a deadline is 11px/800 and takes its
  // colour from the state. Expiring uses the funding amber, which is the
  // token deliberately darkened for contrast (spec D9), not the prototype's
  // lighter literal.
  const tone =
    info.state === 'closed'
      ? '#C0392B'
      : info.state === 'expiring'
        ? 'var(--color-need-funding)'
        : '#42506E';
  return (
    <span style={{ fontSize: 12.5, fontWeight: 700, color: tone }}>{label}</span>
  );
}

/**
 * The row's delete, as the prototype's red Delete beside Edit: a two-step
 * control, and a refusal with a remedy when a submission still points at
 * the resource. Rendered only inside the `canWrite` branch.
 */
function DeleteRowButton({ row }: { row: AdminResource }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <>
      <ConfirmDeleteButton
        label={t('admin.resources.actions.delete')}
        disabled={pending}
        buttonStyle={ADMIN_LINK_DANGER}
        onConfirm={() => {
          setError(null);
          startTransition(async () => {
            try {
              const outcome = await deleteResource(row.id);
              if (!outcome.ok) {
                setError(t('admin.resources.deleteBlocked'));
                return;
              }
              router.refresh();
            } catch {
              setError(t('admin.error.generic'));
            }
          });
        }}
      />
      {error ? (
        <p role="alert" style={{ ...ADMIN_ERROR, margin: '6px 0 0 0' }}>
          {error}
        </p>
      ) : null}
    </>
  );
}

/**
 * A row per resource, with the prototype's checkbox column and row delete.
 *
 * The write affordances -- the checkbox column, the Status control, the
 * featured toggle, Edit and Delete -- are all inside the `canWrite` branch,
 * per CLAUDE.md: a viewer sees no write affordance at all, not a disabled
 * one. That is why the checkbox and Actions columns are conditional entries
 * in the header and row rather than always-rendered cells with disabled
 * controls inside.
 *
 * Selection lives in `ResourceSelectionProvider`, above this table, because
 * the prototype's "Publish selected" button is in the page header rather
 * than on the table; `PublishSelectedButton` reads the same context.
 */
export default function ResourceTable({
  rows,
  canWrite,
}: {
  rows: AdminResource[];
  canWrite: boolean;
}) {
  const { selected, toggle, toggleAll } = useResourceSelection();
  const selectAllRef = useRef<HTMLInputElement>(null);

  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));
  const someSelected = selected.size > 0 && !allSelected;

  // `indeterminate` is a DOM property with no attribute, so it is set by hand.
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  if (rows.length === 0) {
    return <EmptyState heading={t('admin.resources.empty')} />;
  }

  return (
    <>
      {/* The prototype builds this from CSS grid rows (reference lines 803-838).
          A real <table> is kept: the grid would cost row and column semantics
          for assistive technology and buy nothing visually that the table
          cannot do. Everything else -- the 13px-radius white panel, the
          #F4F6F9 header strip, the 11.5px uppercase column labels and the
          hairline row rules -- is the prototype's. */}
      <div
        style={{
          marginTop: 16,
          background: '#fff',
          border: '1px solid #DDE5EE',
          borderRadius: 13,
          overflowX: 'auto',
        }}
      >
        <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
          <thead>
            <tr
              style={{
                background: '#F4F6F9',
                borderBottom: '1px solid #DDE5EE',
              }}
            >
              {canWrite ? (
                <th style={{ ...TH, width: 36, paddingRight: 0 }}>
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    aria-label={t('admin.resources.selectAll')}
                    checked={allSelected}
                    onChange={toggleAll}
                  />
                </th>
              ) : null}
              <th style={TH}>{t('admin.resources.col.resource')}</th>
              <th style={TH}>{t('admin.resources.col.need')}</th>
              <th style={TH}>{t('admin.resources.col.eligibility')}</th>
              <th style={TH}>{t('admin.resources.col.deadline')}</th>
              <th style={TH}>{t('admin.resources.col.status')}</th>
              {canWrite ? <th style={TH}>{t('admin.resources.col.actions')}</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} style={{ borderBottom: '1px solid #F1F4FA' }}>
                {canWrite ? (
                  <td style={{ ...TD, width: 36, paddingRight: 0 }}>
                    <input
                      type="checkbox"
                      aria-label={t('admin.resources.selectRow', { name: row.name })}
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                    />
                  </td>
                ) : null}
                <td style={TD}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, lineHeight: 1.3 }}>
                    {row.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#5B6B8C', marginTop: 2 }}>
                    {row.partner} · {row.resourceType}
                    {row.subCategory ? ` · ${row.subCategory}` : ''}
                  </div>
                </td>
                <td style={{ ...TD, fontSize: 12.5, fontWeight: 700, color: '#42506E' }}>
                  <div>{t(`need.${row.needPrimary}`)}</div>
                  {row.needSecondary ? (
                    <div style={{ color: '#5B6B8C', fontWeight: 600, marginTop: 2 }}>
                      {t(`need.${row.needSecondary}`)}
                    </div>
                  ) : null}
                </td>
                <td style={{ ...TD, fontSize: 12, color: '#5B6B8C', lineHeight: 1.45 }}>
                  {eligibilitySummary(row)}
                </td>
                <td style={TD}>
                  <DeadlineCell deadline={row.deadline} />
                </td>
                <td style={TD}>
                  {canWrite ? (
                    <StatusSelect id={row.id} status={row.status} />
                  ) : (
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: '#42506E' }}>
                      {t(`status.${row.status}`)}
                    </span>
                  )}
                </td>
                {canWrite ? (
                  <td style={TD}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <FeaturedToggle id={row.id} isFeatured={row.isFeatured} />
                      <Link
                        href={`/admin/resources/${row.id}`}
                        className="proto-admin-action"
                        style={{ fontSize: 12.5, fontWeight: 800, color: '#1F5FBF' }}
                      >
                        {t('admin.resources.actions.edit')}
                      </Link>
                      <DeleteRowButton row={row} />
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Prototype line 804: the header strip's column labels. */
const TH = {
  textAlign: 'left',
  padding: '12px 20px',
  fontSize: 11.5,
  fontWeight: 800,
  color: '#5B6B8C',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
} as const;

/** Prototype line 812: a body cell. */
const TD = {
  padding: '14px 20px',
  verticalAlign: 'top',
} as const;
