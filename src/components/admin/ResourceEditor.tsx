'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { ResourceInput } from '@/lib/schemas/resource';
import { t } from '@/lib/i18n';
import ResourceModal, { type ResourceModalMode } from './ResourceModal';
import { ADMIN_PRIMARY, ADMIN_HELP } from './chrome';

interface Editor {
  /** Open the modal for a create, or for the row whose full input is known. */
  open: (mode: ResourceModalMode) => void;
  /** Every row's full editable input, by id -- what the Edit action opens. */
  inputs: Readonly<Record<string, ResourceInput & { id: string }>>;
  /** True after a save, until the next opening: the "Resource saved" notice. */
  saved: boolean;
}

const EditorContext = createContext<Editor | null>(null);

/**
 * Hosts the one resource modal for the resources screen and hands the table
 * a way to open it. The page renders this inside its `canWrite` branch only,
 * so a viewer has no modal, no Add button and no Edit action -- absent, not
 * disabled (CLAUDE.md).
 *
 * The full input per row travels down from the server page rather than
 * being fetched on Edit: the page already reads every column, and ~60 rows
 * of it is small. If the table ever grows past a few hundred rows this is
 * the place to switch to a per-row read.
 *
 * On a save the router is refreshed so the server-rendered table reflects
 * the write, and the prototype's "Resource saved" shows beside the Add
 * button until the modal is next opened.
 */
export function ResourceEditorProvider({
  inputs,
  partners,
  children,
}: {
  inputs: Readonly<Record<string, ResourceInput & { id: string }>>;
  partners: readonly string[];
  children: ReactNode;
}) {
  const [mode, setMode] = useState<ResourceModalMode | null>(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  return (
    <EditorContext.Provider
      value={{ open: (next) => { setSaved(false); setMode(next); }, inputs, saved }}
    >
      {children}
      <ResourceModal
        mode={mode}
        partners={partners}
        onClose={(result) => {
          setMode(null);
          if (result === 'saved') {
            setSaved(true);
            router.refresh();
          }
        }}
      />
    </EditorContext.Provider>
  );
}

export function useResourceEditor(): Editor {
  const value = useContext(EditorContext);
  if (!value) throw new Error('useResourceEditor needs a ResourceEditorProvider');
  return value;
}

/** The prototype's "+ Add resource", opening the modal blank, with the saved notice beside it. */
export function AddResourceButton() {
  const { open, saved } = useResourceEditor();
  return (
    <>
      <span role="status" aria-live="polite" style={{ ...ADMIN_HELP, color: '#0E7A54', fontWeight: 700 }}>
        {saved ? t('admin.resources.saved') : ''}
      </span>
      <button
        type="button"
        onClick={() => open({ kind: 'create' })}
        className="proto-primary-button"
        style={{ ...ADMIN_PRIMARY, padding: '11px 20px', fontSize: 13.5 }}
      >
        {t('admin.resources.addNew')}
      </button>
    </>
  );
}
