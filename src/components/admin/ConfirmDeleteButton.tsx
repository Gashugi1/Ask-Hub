'use client';

import { useRef } from 'react';
import { t } from '@/lib/i18n';
import { ADMIN_PANEL, ADMIN_PRIMARY, ADMIN_HELP, ADMIN_LINK_ACTION } from './chrome';

/**
 * A two-step delete control: a button that opens a native `<dialog>` and
 * fires `onConfirm` only from the dialog's own confirm button.
 *
 * A single click never deletes a row. The audit trigger recording the
 * deleted values is not the same thing as an accidental click being
 * undoable -- recovering a deleted row means an admin reading raw audit JSON
 * and retyping it by hand. Extracted from `ResourceForm`'s own dialog so the
 * resources table's row delete wears the same two steps.
 */
export default function ConfirmDeleteButton({
  onConfirm,
  disabled,
  label,
  buttonStyle,
}: {
  onConfirm: () => void;
  disabled: boolean;
  label: string;
  /** Overrides the bordered default -- the resources table wants its inline link treatment. */
  buttonStyle?: React.CSSProperties;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => dialogRef.current?.showModal()}
        style={
          buttonStyle ?? {
            display: 'block',
            width: '100%',
            border: '1px solid #C0392B',
            color: '#C0392B',
            background: '#fff',
            borderRadius: 8,
            padding: '7px 12px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }
        }
      >
        {label}
      </button>
      {/* Layout lives on the inner div, never on the dialog itself: a closed
          dialog is hidden by the browser's own `display: none`, and an inline
          `display: flex` on the element overrides that and renders every
          closed dialog on the page as a visible panel. */}
      <dialog ref={dialogRef} style={DIALOG}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
        </div>
      </dialog>
    </>
  );
}

/** The dialog's own box: the admin panel, with no `display` of its own. */
const DIALOG = { ...ADMIN_PANEL, borderRadius: 12 } as const;
