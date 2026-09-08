'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n';
import ConfirmDeleteButton from './ConfirmDeleteButton';
import { ADMIN_FIELD, ADMIN_PRIMARY, ADMIN_TH, ADMIN_TD, ADMIN_TABLE, ADMIN_TABLE_PANEL, ADMIN_TR, ADMIN_ERROR, ADMIN_HELP } from './chrome';

/**
 * The generic list-editor for `programmes` (PRD 6.7 panel 7) and
 * `impact_stories` (panel 8) — unlike `StatRows`, neither table carries
 * provenance columns: a programme or a story is curated copy, not a
 * reported figure, so 0015_stat_provenance.sql's constraints do not apply
 * here. `fields` describes the two or three business columns each entity
 * has; `sortOrder` is always present and handled separately, the same way
 * every other admin form turns an empty string into `null`.
 */
export interface EntityField {
  key: string;
  label: string;
  multiline?: boolean;
}

export type EntityRowValue = Record<string, string>;

export interface EntityRow extends EntityRowValue {
  id: string;
  sortOrder: string;
}

function toPayload(fields: readonly EntityField[], row: EntityRowValue & { sortOrder: string }): unknown {
  const payload: Record<string, unknown> = {
    sortOrder: row.sortOrder.trim() === '' ? null : Number(row.sortOrder),
  };
  for (const field of fields) {
    payload[field.key] = row[field.key] ?? '';
  }
  return payload;
}

function emptyRow(fields: readonly EntityField[]): EntityRowValue & { sortOrder: string } {
  const row: EntityRowValue & { sortOrder: string } = { sortOrder: '' };
  for (const field of fields) row[field.key] = '';
  return row;
}

interface Actions {
  create: (input: unknown) => Promise<{ id: string }>;
  save: (id: unknown, input: unknown) => Promise<void>;
  delete: (id: unknown) => Promise<void>;
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: EntityField;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.multiline) {
    return (
      <textarea
        aria-label={field.label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        style={{ ...ADMIN_FIELD, width: 230 }}
      />
    );
  }
  return (
    <input
      aria-label={field.label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...ADMIN_FIELD, width: 170 }}
    />
  );
}

function EditableRow({
  fields,
  row,
  actions,
}: {
  fields: readonly EntityField[];
  row: EntityRow;
  actions: Actions;
}) {
  const [draft, setDraft] = useState<EntityRowValue & { sortOrder: string }>(row);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function set(key: string, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await actions.save(row.id, toPayload(fields, draft));
        router.refresh();
      } catch {
        setError(t('admin.error.generic'));
      }
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await actions.delete(row.id);
        router.refresh();
      } catch {
        setError(t('admin.error.generic'));
      }
    });
  }

  return (
    <tr style={ADMIN_TR}>
      {fields.map((field) => (
        <td key={field.key} style={ADMIN_TD}>
          <FieldInput field={field} value={draft[field.key] ?? ''} onChange={(v) => set(field.key, v)} />
        </td>
      ))}
      <td style={ADMIN_TD}>
        <input
          type="number"
          min={0}
          aria-label={t('admin.content.stat.sortOrder')}
          value={draft.sortOrder}
          onChange={(e) => set('sortOrder', e.target.value)}
          style={{ ...ADMIN_FIELD, width: 72 }}
        />
      </td>
      <td style={{ ...ADMIN_TD, display: "flex", flexDirection: "column", gap: 6 }}>
        <button
          type="button"
          disabled={pending}
          onClick={handleSave}
          className="proto-primary-button" style={{ ...ADMIN_PRIMARY, display: "block", width: "100%", fontSize: 12, padding: "7px 12px" }}
        >
          {t('admin.content.save')}
        </button>
        <ConfirmDeleteButton onConfirm={handleDelete} disabled={pending} label={t('admin.content.delete')} />
        {error ? <span style={{ ...ADMIN_ERROR, display: "block" }}>{error}</span> : null}
      </td>
    </tr>
  );
}

function NewRow({ fields, actions }: { fields: readonly EntityField[]; actions: Actions }) {
  const [draft, setDraft] = useState<EntityRowValue & { sortOrder: string }>(() => emptyRow(fields));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function set(key: string, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      try {
        await actions.create(toPayload(fields, draft));
        setDraft(emptyRow(fields));
        router.refresh();
      } catch {
        setError(t('admin.error.generic'));
      }
    });
  }

  return (
    <tr style={{ verticalAlign: "top" }}>
      {fields.map((field) => (
        <td key={field.key} style={ADMIN_TD}>
          <FieldInput field={field} value={draft[field.key] ?? ''} onChange={(v) => set(field.key, v)} />
        </td>
      ))}
      <td style={ADMIN_TD}>
        <input
          type="number"
          min={0}
          aria-label={t('admin.content.stat.sortOrder')}
          value={draft.sortOrder}
          onChange={(e) => set('sortOrder', e.target.value)}
          style={{ ...ADMIN_FIELD, width: 72 }}
        />
      </td>
      <td style={ADMIN_TD}>
        <button
          type="button"
          disabled={pending}
          onClick={handleCreate}
          className="proto-primary-button" style={{ ...ADMIN_PRIMARY, fontSize: 12, padding: "7px 12px" }}
        >
          {t('admin.content.add')}
        </button>
        {error ? <span style={{ ...ADMIN_ERROR, display: "block" }}>{error}</span> : null}
      </td>
    </tr>
  );
}

/**
 * `canWrite` gates the entire editable table: when false, rows render
 * inside a plain read-only table with no `<input>`, no `<form>` and no
 * Save/Delete/Add control anywhere. CLAUDE.md: a viewer sees no write
 * affordance at all, not a disabled one.
 */
export default function EntityRows({
  fields,
  rows,
  canWrite,
  actions,
}: {
  fields: readonly EntityField[];
  rows: EntityRow[];
  canWrite: boolean;
  actions: Actions;
}) {
  const headers = [...fields.map((f) => f.label), t('admin.content.stat.sortOrder')];

  if (!canWrite) {
    if (rows.length === 0) {
      return <p style={ADMIN_HELP}>{t('admin.empty.noRows')}</p>;
    }
    return (
      <div style={ADMIN_TABLE_PANEL}>
        <table style={ADMIN_TABLE}>
          <thead>
            <tr style={{ ...ADMIN_TR, ...ADMIN_HELP }}>
              {headers.map((h) => (
                <th key={h} style={ADMIN_TH}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} style={ADMIN_TR}>
                {fields.map((field) => (
                  <td key={field.key} style={ADMIN_TD}>
                    {row[field.key]}
                  </td>
                ))}
                <td style={ADMIN_TD}>{row.sortOrder}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div style={ADMIN_TABLE_PANEL}>
      <table style={ADMIN_TABLE}>
        <thead>
          <tr style={{ ...ADMIN_TR, ...ADMIN_HELP }}>
            {headers.map((h) => (
              <th key={h} style={ADMIN_TH}>
                {h}
              </th>
            ))}
            <th style={ADMIN_TH}>{t('admin.content.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <EditableRow key={row.id} fields={fields} row={row} actions={actions} />
          ))}
          <NewRow fields={fields} actions={actions} />
        </tbody>
      </table>
    </div>
  );
}
