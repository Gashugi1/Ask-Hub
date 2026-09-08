'use client';

import { useRef } from 'react';
import { t } from '@/lib/i18n';
import { ADMIN_PANEL_COL, ADMIN_PRIMARY, ADMIN_HELP, ADMIN_LINK_ACTION } from './chrome';

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
        style={{ display: "block", width: "100%", border: "1px solid #C0392B", color: "#C0392B", background: "#fff", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
      >
        {label}
      </button>
      <dialog ref={dialogRef} style={{ ...ADMIN_PANEL_COL, gap: 10 }}>
        <p style={{ fontSize: 14, fontWeight: 800 }}>{t('admin.content.deleteConfirmHeading')}</p>
        <p style={{ ...ADMIN_HELP, marginTop: 6, fontSize: 13 }}>{t('admin.content.deleteConfirmBody')}</p>
        <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            style={{ ...ADMIN_LINK_ACTION, color: "#5B6B8C", textDecoration: "underline" }}
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
            style={{ ...ADMIN_PRIMARY, background: "#C0392B" }}
          >
            {t('admin.content.deleteConfirmAction')}
          </button>
        </div>
      </dialog>
    </>
  );
}
