'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n';
import ConfirmDeleteButton from './ConfirmDeleteButton';

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
        className="w-56 rounded border border-hairline px-2 py-1 text-sm"
      />
    );
  }
  return (
    <input
      aria-label={field.label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-40 rounded border border-hairline px-2 py-1 text-sm"
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
    <tr className="border-b border-hairline align-top">
      {fields.map((field) => (
        <td key={field.key} className="p-2">
          <FieldInput field={field} value={draft[field.key] ?? ''} onChange={(v) => set(field.key, v)} />
        </td>
      ))}
      <td className="p-2">
        <input
          type="number"
          min={0}
          aria-label={t('admin.content.stat.sortOrder')}
          value={draft.sortOrder}
          onChange={(e) => set('sortOrder', e.target.value)}
          className="w-16 rounded border border-hairline px-2 py-1 text-sm"
        />
      </td>
      <td className="space-y-1 p-2">
        <button
          type="button"
          disabled={pending}
          onClick={handleSave}
          className="block rounded bg-primary px-2 py-1 text-xs text-surface"
        >
          {t('admin.content.save')}
        </button>
        <ConfirmDeleteButton onConfirm={handleDelete} disabled={pending} label={t('admin.content.delete')} />
        {error ? <span className="block text-xs text-danger">{error}</span> : null}
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
    <tr className="align-top">
      {fields.map((field) => (
        <td key={field.key} className="p-2">
          <FieldInput field={field} value={draft[field.key] ?? ''} onChange={(v) => set(field.key, v)} />
        </td>
      ))}
      <td className="p-2">
        <input
          type="number"
          min={0}
          aria-label={t('admin.content.stat.sortOrder')}
          value={draft.sortOrder}
          onChange={(e) => set('sortOrder', e.target.value)}
          className="w-16 rounded border border-hairline px-2 py-1 text-sm"
        />
      </td>
      <td className="p-2">
        <button
          type="button"
          disabled={pending}
          onClick={handleCreate}
          className="rounded bg-primary px-2 py-1 text-xs text-surface"
        >
          {t('admin.content.add')}
        </button>
        {error ? <span className="block text-xs text-danger">{error}</span> : null}
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
      return <p className="text-sm text-muted">{t('admin.empty.noRows')}</p>;
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-hairline text-xs text-muted">
              {headers.map((h) => (
                <th key={h} className="p-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-hairline">
                {fields.map((field) => (
                  <td key={field.key} className="p-2 text-navy">
                    {row[field.key]}
                  </td>
                ))}
                <td className="p-2 text-navy">{row.sortOrder}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-hairline text-xs text-muted">
            {headers.map((h) => (
              <th key={h} className="p-2 font-medium">
                {h}
              </th>
            ))}
            <th className="p-2 font-medium">{t('admin.content.actions')}</th>
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
