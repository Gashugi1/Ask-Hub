'use client';

import { useState } from 'react';
import { t } from '@/lib/i18n';
import type { PublicResource } from '@/lib/public/types';

/**
 * Both writers are dynamically imported inside the click handler, so neither
 * the Excel writer nor its zip dependency is in the initial bundle. PRD 5.2
 * requires both formats; PRD 12.3 requires the page not to pay for them.
 *
 * The exported rows are the filtered rows the visitor is looking at, not the
 * full dataset -- exporting something other than what is on screen is the
 * kind of surprise that makes people distrust the numbers.
 */
export default function ExportButton({ rows }: { rows: readonly PublicResource[] }) {
  const [state, setState] = useState<'idle' | 'pending' | 'failed'>('idle');
  // Disabled while a download is already in flight -- a double-click must not
  // yield two downloads -- and when there is nothing to export: zero visible
  // rows would still produce a header-only file, which is its own kind of
  // silent-nothing-happened surprise.
  const disabled = state === 'pending' || rows.length === 0;

  async function run(format: 'csv' | 'xlsx') {
    if (disabled) return;
    setState('pending');
    try {
      const mod = await import('@/lib/public/export');
      if (format === 'csv') await mod.downloadCsv(rows);
      else await mod.downloadXlsx(rows);
      setState('idle');
    } catch {
      // Never a silent no-op: a button that does nothing reads as a broken
      // page, and the visitor has no way to tell whether the file is coming.
      setState('failed');
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          className="proto-outline-button"
          disabled={disabled}
          aria-busy={state === 'pending'}
          onClick={() => void run('csv')}
          style={{ ...ACTION, border: '1.5px solid #C9D3E8', color: '#1F5FBF', background: '#fff' }}
        >
          {t('export.csv')}
        </button>
        <button
          type="button"
          className="proto-primary-button"
          disabled={disabled}
          aria-busy={state === 'pending'}
          onClick={() => void run('xlsx')}
          style={{ ...ACTION, border: 'none', color: '#fff', background: '#1F5FBF' }}
        >
          {t('export.excel')}
        </button>
      </div>
      <div
        style={{
          fontSize: 11.5,
          color: '#5B6B8C',
          maxWidth: 400,
          textAlign: 'right',
        }}
      >
        {t('export.hint')}
      </div>
      {state === 'failed' ? (
        <p style={{ fontSize: 13.5, color: '#C0392B', margin: 0 }}>{t('export.failed')}</p>
      ) : null}
    </div>
  );
}

/**
 * The prototype's two directory actions (reference lines 183-184): an
 * outlined secondary beside a solid primary, both 13.5px/700 on a 9px radius.
 * Its own pair is "Submit a resource" and "Download this list (Excel)"; the
 * submit half belongs to the write endpoints, which this read-only surface
 * does not have, so the two export formats PRD 5.2 requires take the shape
 * instead -- CSV as the secondary, Excel as the primary.
 */
const ACTION = {
  fontSize: 13.5,
  fontWeight: 700,
  padding: '10px 16px',
  borderRadius: 9,
  cursor: 'pointer',
} as const;
