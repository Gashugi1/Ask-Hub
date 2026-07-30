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
  const [failed, setFailed] = useState(false);

  async function run(format: 'csv' | 'xlsx') {
    setFailed(false);
    try {
      const mod = await import('@/lib/public/export');
      if (format === 'csv') await mod.downloadCsv(rows);
      else await mod.downloadXlsx(rows);
    } catch {
      // Never a silent no-op: a button that does nothing reads as a broken
      // page, and the visitor has no way to tell whether the file is coming.
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-lg border border-hairline px-3 py-2 text-sm text-navy"
          onClick={() => void run('csv')}
        >
          {t('export.csv')}
        </button>
        <button
          type="button"
          className="rounded-lg border border-hairline px-3 py-2 text-sm text-navy"
          onClick={() => void run('xlsx')}
        >
          {t('export.excel')}
        </button>
      </div>
      {failed ? <p className="text-sm text-danger">{t('export.failed')}</p> : null}
    </div>
  );
}
