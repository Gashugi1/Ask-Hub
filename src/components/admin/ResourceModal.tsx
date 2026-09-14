'use client';

import { useEffect, useRef } from 'react';
import type { ResourceInput } from '@/lib/schemas/resource';
import { t } from '@/lib/i18n';
import ResourceForm from './ResourceForm';

/**
 * What the modal is opened for. Each opener supplies exactly what its case
 * needs, so the form cannot be handed an `initial` and a `prefill` at once.
 */
export type ResourceModalMode =
  | { kind: 'create' }
  | { kind: 'edit'; initial: ResourceInput & { id: string } }
  /** The Review Queue's "Edit first": a suggestion's draft, approved on save. */
  | { kind: 'fromSubmission'; prefill: ResourceInput; submissionId: string }
  /** The Review Queue's "Open resource to edit": the target, with the suggestion approved on save. */
  | { kind: 'editForSubmission'; initial: ResourceInput & { id: string }; submissionId: string };

/**
 * The prototype's resource form modal: a 720px white box with a 16px radius,
 * top-aligned under 36px of scrim, holding "Add resource" / "Edit resource",
 * a × to close, and the form. A native `<dialog>`, so the scrim is the
 * global `::backdrop`, Escape closes it, and focus stays inside.
 *
 * Rendered only while `mode` is set, and the form is keyed by what it edits,
 * so every opening starts from its own initial values rather than from
 * whatever an earlier, cancelled edit left behind. The opener owns the
 * state: it decides what the modal is for and hears back `saved` or
 * `cancelled`.
 */
export default function ResourceModal({
  mode,
  partners,
  onClose,
}: {
  mode: ResourceModalMode | null;
  partners: readonly string[];
  onClose: (result: 'saved' | 'cancelled') => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (mode && !dialog.open) dialog.showModal();
    if (!mode && dialog.open) dialog.close();
  }, [mode]);

  if (!mode) return null;

  const editing = mode.kind === 'edit' || mode.kind === 'editForSubmission';
  const formKey =
    mode.kind === 'create'
      ? 'create'
      : mode.kind === 'fromSubmission'
        ? `submission:${mode.submissionId}`
        : `resource:${mode.initial.id}`;

  return (
    <dialog
      ref={ref}
      aria-labelledby="resource-modal-title"
      onClose={() => onClose('cancelled')}
      style={DIALOG}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 id="resource-modal-title" style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>
          {t(editing ? 'admin.resources.form.headingEdit' : 'admin.resources.form.headingCreate')}
        </h2>
        <button
          type="button"
          onClick={() => onClose('cancelled')}
          aria-label={t('admin.resources.form.close')}
          style={CLOSE}
        >
          ×
        </button>
      </div>
      {mode.kind === 'fromSubmission' || mode.kind === 'editForSubmission' ? (
        <p style={{ margin: '6px 0 0 0', fontSize: 12, color: '#5B6B8C', lineHeight: 1.5 }}>
          {t('admin.resources.form.submissionNote')}
        </p>
      ) : null}
      <ResourceForm
        key={formKey}
        partners={partners}
        initial={editing ? mode.initial : undefined}
        prefill={mode.kind === 'fromSubmission' ? mode.prefill : undefined}
        submissionId={
          mode.kind === 'fromSubmission' || mode.kind === 'editForSubmission'
            ? mode.submissionId
            : undefined
        }
        onSaved={() => onClose('saved')}
        onCancel={() => onClose('cancelled')}
      />
    </dialog>
  );
}

/**
 * The prototype's modal box, 720px, top-aligned: its overlay is
 * `align-items: flex-start` with 36px of padding, so the dialog's own margin
 * is 36px rather than the global `auto`, and it scrolls within the viewport.
 */
const DIALOG = {
  border: 'none',
  borderRadius: 16,
  width: 720,
  maxWidth: 'calc(100% - 48px)',
  maxHeight: 'calc(100vh - 72px)',
  margin: '36px auto',
  padding: 30,
  overflow: 'auto',
  boxShadow: '0 20px 60px rgba(20,32,60,0.3)',
  color: '#1A2332',
} as const;

/** The prototype's × button. */
const CLOSE = {
  background: 'none',
  border: 'none',
  fontSize: 22,
  color: '#5B6B8C',
  cursor: 'pointer',
  lineHeight: 1,
} as const;
