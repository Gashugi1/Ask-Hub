'use client';

import { useRef } from 'react';
import { t } from '@/lib/i18n';

/**
 * The two-step delete control from `ResourceForm.tsx`, extracted so
 * `StatRows.tsx` and `EntityRows.tsx` can reuse it for all four
 * provenance-/curation-bearing row editors (headline stats, compute metrics,
 * programmes, impact stories) rather than each wiring its own `<dialog>`.
 *
 * A single click no longer deletes the row: `headline_stats` and
 * `compute_metrics` carry a source, an attester and a date that the schema
 * goes to real lengths to guarantee (0015_stat_provenance.sql), and the
 * audit trigger recording the deleted values is not the same thing as an
 * accidental click being undoable — recovering a deleted figure means an
 * admin reading raw audit JSON and retyping it by hand. Programmes and
 * impact stories are curated copy with the same one-click exposure, so the
 * same confirm step applies to all four, not only the attested two.
 */
export default function ConfirmDeleteButton({
  onConfirm,
  disabled,
  label,
}: {
  onConfirm: () => void;
  disabled: boolean;
  label: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => dialogRef.current?.showModal()}
        className="block rounded border border-danger px-2 py-1 text-xs text-danger"
      >
        {label}
      </button>
      <dialog ref={dialogRef} className="rounded border border-hairline p-4">
        <p className="font-medium text-navy">{t('admin.content.deleteConfirmHeading')}</p>
        <p className="mt-1 text-sm text-muted">{t('admin.content.deleteConfirmBody')}</p>
        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="text-sm text-muted underline"
          >
            {t('admin.content.deleteCancel')}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              dialogRef.current?.close();
              onConfirm();
            }}
            className="rounded bg-danger px-3 py-1.5 text-sm text-surface"
          >
            {t('admin.content.deleteConfirmAction')}
          </button>
        </div>
      </dialog>
    </>
  );
}
