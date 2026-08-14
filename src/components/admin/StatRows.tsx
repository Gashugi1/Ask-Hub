'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n';
import ConfirmDeleteButton from './ConfirmDeleteButton';
import { ADMIN_FIELD, ADMIN_PRIMARY, ADMIN_TH, ADMIN_TD, ADMIN_TABLE, ADMIN_TABLE_PANEL, ADMIN_TR, ADMIN_ERROR, ADMIN_HELP } from './chrome';

/**
 * The editable shape shared by `headline_stats` and `compute_metrics` — both
 * are provenance-bearing figures (source, attestedBy, attestedOn required
 * non-blank, mirroring 0015_stat_provenance.sql), differing only in one
 * field: a headline stat carries a Hero toggle, a compute metric carries a
 * sub-note. `kind` selects which of the two is shown; the other is simply
 * absent from the row, not disabled.
 */
export interface StatRowValue {
  value: string;
  label: string;
  sortOrder: string;
  source: string;
  attestedBy: string;
  attestedOn: string;
  isHero: boolean;
  subNote: string;
}

export interface StatRow extends StatRowValue {
  id: string;
}

function toPayload(kind: 'headline' | 'compute', row: StatRowValue): unknown {
  const shared = {
    value: row.value,
    label: row.label,
    sortOrder: row.sortOrder.trim() === '' ? null : Number(row.sortOrder),
    source: row.source,
    attestedBy: row.attestedBy,
    attestedOn: row.attestedOn,
  };
  return kind === 'headline' ? { ...shared, isHero: row.isHero } : { ...shared, subNote: row.subNote === '' ? null : row.subNote };
}

const EMPTY: StatRowValue = {
  value: '',
  label: '',
  sortOrder: '',
  source: '',
  attestedBy: '',
  attestedOn: '',
  isHero: false,
  subNote: '',
};

interface Actions {
  create: (input: unknown) => Promise<{ id: string }>;
  save: (id: unknown, input: unknown) => Promise<void>;
  delete: (id: unknown) => Promise<void>;
}

/** One editable row, tracking its own working copy so editing one row never disturbs another. */
function EditableRow({
  kind,
  row,
  actions,
}: {
  kind: 'headline' | 'compute';
  row: StatRow;
  actions: Actions;
}) {
  const [draft, setDraft] = useState<StatRowValue>(row);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function set<K extends keyof StatRowValue>(key: K, value: StatRowValue[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await actions.save(row.id, toPayload(kind, draft));
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
      <td style={ADMIN_TD}>
        <input
          value={draft.value}
          onChange={(e) => set('value', e.target.value)}
          style={{ ...ADMIN_FIELD, width: 110 }}
        />
      </td>
      <td style={ADMIN_TD}>
        <input
          value={draft.label}
          onChange={(e) => set('label', e.target.value)}
          style={{ ...ADMIN_FIELD, width: 170 }}
        />
      </td>
      <td style={ADMIN_TD}>
        {kind === 'headline' ? (
          <label style={{ display: "flex", alignItems: "center", gap: 6, ...ADMIN_HELP }}>
            <input
              type="checkbox"
              checked={draft.isHero}
              onChange={(e) => set('isHero', e.target.checked)}
            />
            {t('admin.content.stat.hero')}
          </label>
        ) : (
          <input
            value={draft.subNote}
            onChange={(e) => set('subNote', e.target.value)}
            style={{ ...ADMIN_FIELD, width: 170 }}
          />
        )}
      </td>
      <td style={ADMIN_TD}>
        <input
          type="number"
          min={0}
          value={draft.sortOrder}
          onChange={(e) => set('sortOrder', e.target.value)}
          style={{ ...ADMIN_FIELD, width: 72 }}
        />
      </td>
      <td style={ADMIN_TD}>
        <input
          value={draft.source}
          onChange={(e) => set('source', e.target.value)}
          style={{ ...ADMIN_FIELD, width: 200 }}
        />
      </td>
      <td style={ADMIN_TD}>
        <input
          value={draft.attestedBy}
          onChange={(e) => set('attestedBy', e.target.value)}
          style={{ ...ADMIN_FIELD, width: 140 }}
        />
      </td>
      <td style={ADMIN_TD}>
        <input
          type="date"
          value={draft.attestedOn}
          onChange={(e) => set('attestedOn', e.target.value)}
          style={ADMIN_FIELD}
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

/** The blank row at the bottom of the table, for adding a new stat. */
function NewRow({ kind, actions }: { kind: 'headline' | 'compute'; actions: Actions }) {
  const [draft, setDraft] = useState<StatRowValue>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function set<K extends keyof StatRowValue>(key: K, value: StatRowValue[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      try {
        await actions.create(toPayload(kind, draft));
        setDraft(EMPTY);
        router.refresh();
      } catch {
        setError(t('admin.error.generic'));
      }
    });
  }

  return (
    <tr style={{ verticalAlign: "top" }}>
      <td style={ADMIN_TD}>
        <input
          value={draft.value}
          onChange={(e) => set('value', e.target.value)}
          placeholder={t('admin.content.stat.value')}
          style={{ ...ADMIN_FIELD, width: 110 }}
        />
      </td>
      <td style={ADMIN_TD}>
        <input
          value={draft.label}
          onChange={(e) => set('label', e.target.value)}
          placeholder={t('admin.content.stat.label')}
          style={{ ...ADMIN_FIELD, width: 170 }}
        />
      </td>
      <td style={ADMIN_TD}>
        {kind === 'headline' ? (
          <label style={{ display: "flex", alignItems: "center", gap: 6, ...ADMIN_HELP }}>
            <input
              type="checkbox"
              checked={draft.isHero}
              onChange={(e) => set('isHero', e.target.checked)}
            />
            {t('admin.content.stat.hero')}
          </label>
        ) : (
          <input
            value={draft.subNote}
            onChange={(e) => set('subNote', e.target.value)}
            placeholder={t('admin.content.stat.subNote')}
            style={{ ...ADMIN_FIELD, width: 170 }}
          />
        )}
      </td>
      <td style={ADMIN_TD}>
        <input
          type="number"
          min={0}
          value={draft.sortOrder}
          onChange={(e) => set('sortOrder', e.target.value)}
          style={{ ...ADMIN_FIELD, width: 72 }}
        />
      </td>
      <td style={ADMIN_TD}>
        <input
          value={draft.source}
          onChange={(e) => set('source', e.target.value)}
          placeholder={t('admin.content.stat.source')}
          style={{ ...ADMIN_FIELD, width: 200 }}
        />
      </td>
      <td style={ADMIN_TD}>
        <input
          value={draft.attestedBy}
          onChange={(e) => set('attestedBy', e.target.value)}
          placeholder={t('admin.content.stat.attestedBy')}
          style={{ ...ADMIN_FIELD, width: 140 }}
        />
      </td>
      <td style={ADMIN_TD}>
        <input
          type="date"
          value={draft.attestedOn}
          onChange={(e) => set('attestedOn', e.target.value)}
          style={ADMIN_FIELD}
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
 * The provenance-bearing stat tables (`headline_stats`, `compute_metrics`),
 * PRD 6.7 panels 5 and 6. `canWrite` gates the entire editable table: when
 * false, rows render inside a plain read-only table with no `<input>`,
 * no `<form>` and no Save/Delete/Add control anywhere. CLAUDE.md: a viewer
 * sees no write affordance at all, not a disabled one.
 */
export default function StatRows({
  kind,
  rows,
  canWrite,
  actions,
}: {
  kind: 'headline' | 'compute';
  rows: StatRow[];
  canWrite: boolean;
  actions: Actions;
}) {
  const headers =
    kind === 'headline'
      ? [
          t('admin.content.stat.value'),
          t('admin.content.stat.label'),
          t('admin.content.stat.hero'),
          t('admin.content.stat.sortOrder'),
          t('admin.content.stat.source'),
          t('admin.content.stat.attestedBy'),
          t('admin.content.stat.attestedOn'),
        ]
      : [
          t('admin.content.stat.value'),
          t('admin.content.stat.label'),
          t('admin.content.stat.subNote'),
          t('admin.content.stat.sortOrder'),
          t('admin.content.stat.source'),
          t('admin.content.stat.attestedBy'),
          t('admin.content.stat.attestedOn'),
        ];

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
                <td style={ADMIN_TD}>{row.value}</td>
                <td style={ADMIN_TD}>{row.label}</td>
                <td style={ADMIN_TD}>
                  {kind === 'headline'
                    ? row.isHero
                      ? t('admin.content.stat.hero')
                      : ''
                    : row.subNote}
                </td>
                <td style={ADMIN_TD}>{row.sortOrder}</td>
                <td style={ADMIN_TD}>{row.source}</td>
                <td style={ADMIN_TD}>{row.attestedBy}</td>
                <td style={ADMIN_TD}>{row.attestedOn}</td>
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
            <EditableRow key={row.id} kind={kind} row={row} actions={actions} />
          ))}
          <NewRow kind={kind} actions={actions} />
        </tbody>
      </table>
    </div>
  );
}
