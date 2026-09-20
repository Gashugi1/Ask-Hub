'use client';

import { createContext, useContext, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { publishResources } from '@/lib/actions/resources';
import type { AdminResource } from '@/lib/admin/types';
import { t } from '@/lib/i18n';
import { ADMIN_ERROR, ADMIN_HELP } from './chrome';

interface Selection {
  rows: readonly AdminResource[];
  /** Selected ids that are listed in `rows`; a stale id counts for nothing. */
  selected: ReadonlySet<string>;
  toggle: (id: string) => void;
  toggleAll: () => void;
  clear: () => void;
}

const SelectionContext = createContext<Selection | null>(null);

/**
 * The resources table's working selection, held above both the table and
 * the page header so "Publish selected" can sit where the prototype puts
 * it -- in the header's action row, beside Import and Add -- while the
 * checkboxes stay in the table. Page state, not URL state: it is one
 * operator's working set for one action, not a view anyone would share.
 *
 * Selection is read through the listed rows, never raw: an id ticked before
 * a filter change or a refresh stays in state but counts for nothing until
 * its row is listed again, so a hidden row can never be published.
 */
export function ResourceSelectionProvider({
  rows,
  children,
}: {
  rows: readonly AdminResource[];
  children: ReactNode;
}) {
  const [raw, setRaw] = useState<ReadonlySet<string>>(new Set());
  const listed = new Set(rows.map((row) => row.id));
  const selected = new Set([...raw].filter((id) => listed.has(id)));
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));

  const value: Selection = {
    rows,
    selected,
    toggle: (id) =>
      setRaw((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    toggleAll: () => setRaw(allSelected ? new Set() : new Set(rows.map((row) => row.id))),
    clear: () => setRaw(new Set()),
  };

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useResourceSelection(): Selection {
  const value = useContext(SelectionContext);
  if (!value) throw new Error('useResourceSelection needs a ResourceSelectionProvider');
  return value;
}

/**
 * The prototype's "Publish selected (n)": a green button in the page
 * header's action row, present only while something is selected, counting
 * everything selected. Clicking it publishes the selected rows that are not
 * already live; if none are, the prototype's note says so instead of a
 * write that would change nothing. Rendered only inside the page's
 * `canWrite` branch, beside the other write affordances.
 */
export function PublishSelectedButton() {
  const { rows, selected, clear } = useResourceSelection();
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function publish() {
    const ids = rows.filter((row) => selected.has(row.id) && row.status !== 'live').map((row) => row.id);
    if (ids.length === 0) {
      setNotice({ tone: 'error', text: t('admin.resources.alreadyLive') });
      return;
    }
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await publishResources(ids);
        setNotice({ tone: 'ok', text: t('admin.resources.publishedCount', { count: result.published }) });
        clear();
        router.refresh();
      } catch {
        setNotice({ tone: 'error', text: t('admin.error.generic') });
      }
    });
  }

  return (
    <>
      {selected.size > 0 ? (
        <button
          type="button"
          disabled={pending}
          onClick={publish}
          className="proto-publish-button"
          style={{
            background: '#0E7A54',
            color: '#fff',
            border: 'none',
            borderRadius: 9,
            padding: '11px 18px',
            fontSize: 13.5,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {t('admin.resources.publishSelected', { count: selected.size })}
        </button>
      ) : null}
      <span
        role="status"
        aria-live="polite"
        style={
          notice?.tone === 'error'
            ? ADMIN_ERROR
            : { ...ADMIN_HELP, color: '#0E7A54', fontWeight: 700 }
        }
      >
        {notice?.text ?? ''}
      </span>
    </>
  );
}
