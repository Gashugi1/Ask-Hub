'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { t } from '@/lib/i18n';
import { importTrackerResources } from '@/lib/actions/resources';
import { parseCsv } from '@/lib/admin/import-csv';
import { pickSheetTable } from '@/lib/admin/import-sheet';
import {
  validateTracker,
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  TITLE_HEADERS,
  type ImportReport,
  type RowOutcome,
  type TrackerValidation,
} from '@/lib/admin/tracker-import';
import {
  ADMIN_ERROR,
  ADMIN_HELP,
  ADMIN_PRIMARY,
  ADMIN_SECONDARY,
  ADMIN_TABLE,
  ADMIN_TABLE_PANEL,
  ADMIN_TD,
  ADMIN_TH,
  ADMIN_THEAD_ROW,
  ADMIN_TR,
} from './chrome';

/**
 * The tracker CSV import: pick a file, read the verdict on every row, then
 * commit.
 *
 * **The file is parsed here, in the browser.** Nothing is uploaded to produce
 * the preview, so an operator can try a file, read why rows were rejected, fix
 * the tracker and try again without touching the database. The two facts the
 * check needs from the server -- what already exists, and which partners are
 * known -- arrive as props from the page.
 *
 * **The commit sends the file text, not this component's conclusions.** The
 * action re-runs the same pure `validateTrackerCsv` over the same bytes, so
 * the browser decides which file to import and nothing else. It is also why
 * the result panel renders the server's report rather than this preview: the
 * two agree in the ordinary case, and where they differ the server is right.
 *
 * There is no toast anywhere in this product and success here is usually
 * partial, so the report *is* the success surface -- unlike ResourceForm,
 * which signals success by navigating away. Wording all comes from locale keys
 * because a thrown server-action message is an opaque digest in production.
 */
export default function TrackerImport({
  existing,
  partners,
}: {
  existing: { name: string; partner: string }[];
  partners: string[];
}) {
  const [upload, setUpload] = useState<UploadPayload | null>(null);
  const [preview, setPreview] = useState<TrackerValidation | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onPick(file: File | undefined) {
    setFileError(null);
    setFormError(null);
    setReport(null);
    setPreview(null);
    setUpload(null);
    if (file === undefined) return;
    if (file.size > IMPORT_MAX_BYTES) {
      setFileError(t('admin.import.file.tooLarge', { size: formatBytes(IMPORT_MAX_BYTES) }));
      return;
    }
    try {
      // A spreadsheet is read here only to show the preview; what gets sent is
      // the file itself, so the server reads it again rather than trusting a
      // grid this component derived.
      const isSheet = /\.xlsx$/i.test(file.name);
      const { table, payload } = isSheet
        ? { table: await sheetTable(file), payload: { xlsx: await toBase64(file) } }
        : await (async () => {
            const text = await file.text();
            return { table: parseCsv(text), payload: { csv: text } };
          })();
      setUpload(payload);
      setPreview(validateTracker(table, { existing, partners }));
    } catch {
      setFileError(t('admin.import.file.unreadable'));
    }
  }

  function onConfirm() {
    setFormError(null);
    startTransition(async () => {
      if (upload === null) return;
      try {
        setReport(await importTrackerResources(upload));
        setPreview(null);
      } catch {
        setFormError(t('admin.error.generic'));
      }
    });
  }

  const fileProblem = report?.fileProblem ?? preview?.fileProblem ?? null;

  return (
    <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ ...ADMIN_HELP, maxWidth: 640 }}>{t('admin.import.intro')}</p>

      {report === null ? (
        <div>
          {/* A real label wrapping the input, so the whole dashed area is the
              control rather than a div that merely looks like one. */}
          <label style={DROPZONE}>
            {t('admin.import.choose')}
            <input
              type="file"
              accept=".csv,.xlsx,text/csv"
              style={{ display: 'none' }}
              onChange={(event) => void onPick(event.target.files?.[0])}
            />
          </label>
          <p style={{ ...ADMIN_HELP, marginTop: 8 }}>
            {t('admin.import.chooseHint', {
              size: formatBytes(IMPORT_MAX_BYTES),
              rows: IMPORT_MAX_ROWS,
            })}
          </p>
        </div>
      ) : null}

      {fileError !== null ? (
        <p role="alert" style={ADMIN_ERROR}>
          {fileError}
        </p>
      ) : null}

      {fileProblem !== null ? (
        <p role="alert" style={ADMIN_ERROR}>
          {t(`admin.import.file.${fileProblem.code}`, {
            columns: fileProblem.columns.join(', '),
            limit: fileProblem.limit,
          })}
        </p>
      ) : null}

      {preview !== null && preview.fileProblem === null ? (
        <>
          {preview.preApproved ? (
            // A tracker re-exported without its gate columns would otherwise
            // import ungated rows straight to the public directory, with
            // nothing on screen to say the gate had stopped applying.
            //
            // Styled as an error but deliberately not `role="alert"`: this
            // component keeps exactly one alert, the failure slot at the
            // bottom, so that channel stays unambiguous for a screen reader
            // and for the tests. This sits in normal flow immediately above
            // the table it is a warning about, and is read with it.
            <p style={ADMIN_ERROR}>
              {t('admin.import.preApprovedWarning', { count: preview.rows.length })}
            </p>
          ) : null}
          <div role="status" style={{ fontSize: 13, fontWeight: 800, color: '#42506E' }}>
            {t('admin.import.summary', {
              passing: preview.passing,
              total: preview.rows.length,
              rejected: preview.rejected,
            })}
          </div>
          {preview.pipelineCount > 0 ? (
            <p style={ADMIN_HELP}>
              {t('admin.import.pipelineNote', { count: preview.pipelineCount })}
            </p>
          ) : null}
          {preview.newPartners.length > 0 ? (
            <p style={ADMIN_HELP}>
              {t('admin.import.newPartnersNote', {
                count: preview.newPartners.length,
                names: preview.newPartners.join(', '),
              })}
            </p>
          ) : null}

          <OutcomeTable rows={preview.rows} committed={false} />

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link href="/admin/resources" style={ADMIN_SECONDARY}>
              {t('admin.import.cancel')}
            </Link>
            {preview.passing > 0 ? (
              <button type="button" onClick={onConfirm} disabled={pending} style={ADMIN_PRIMARY}>
                {pending
                  ? t('admin.import.pending')
                  : t('admin.import.confirm', { count: preview.passing })}
              </button>
            ) : (
              <span style={ADMIN_HELP}>{t('admin.import.nothingToImport')}</span>
            )}
          </div>
        </>
      ) : null}

      {report !== null && report.fileProblem === null ? (
        <>
          <div role="status" style={{ fontSize: 13, fontWeight: 800, color: '#42506E' }}>
            {t('admin.import.done', {
              imported: report.imported,
              rejected: report.rows.length - report.imported,
            })}
          </div>
          {report.createdPartners.length > 0 ? (
            <p style={ADMIN_HELP}>
              {t('admin.import.donePartners', { count: report.createdPartners.length })}
            </p>
          ) : null}
          <OutcomeTable rows={report.rows} committed />
          <div>
            <Link href="/admin/resources" style={ADMIN_SECONDARY}>
              {t('admin.import.back')}
            </Link>
          </div>
        </>
      ) : null}

      {formError !== null ? (
        <p role="alert" style={ADMIN_ERROR}>
          {formError}
        </p>
      ) : null}
    </div>
  );
}

function OutcomeTable({
  rows,
  committed,
}: {
  rows: RowOutcome[];
  committed: boolean;
}) {
  return (
    <div style={{ ...ADMIN_TABLE_PANEL, marginTop: 0, maxHeight: 420, overflowY: 'auto' }}>
      <table style={ADMIN_TABLE}>
        <thead>
          <tr style={ADMIN_THEAD_ROW}>
            <th style={{ ...ADMIN_TH, padding: '12px 20px' }}>{t('admin.import.col.row')}</th>
            <th style={{ ...ADMIN_TH, padding: '12px 20px' }}>{t('admin.import.col.resource')}</th>
            <th style={{ ...ADMIN_TH, padding: '12px 20px' }}>{t('admin.import.col.provider')}</th>
            <th style={{ ...ADMIN_TH, padding: '12px 20px' }}>{t('admin.import.col.category')}</th>
            <th style={{ ...ADMIN_TH, padding: '12px 20px' }}>{t('admin.import.col.deadline')}</th>
            <th style={{ ...ADMIN_TH, padding: '12px 20px' }}>{t('admin.import.col.result')}</th>
            <th style={{ ...ADMIN_TH, padding: '12px 20px' }}>{t('admin.import.col.detail')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.row} style={ADMIN_TR}>
              <td style={{ ...ADMIN_TD, color: '#5B6B8C', fontWeight: 700 }}>{row.row}</td>
              <td style={{ ...ADMIN_TD, fontWeight: 700 }}>{row.title}</td>
              <td style={ADMIN_TD}>{row.provider}</td>
              <td style={ADMIN_TD}>{row.category}</td>
              <td style={{ ...ADMIN_TD, color: '#5B6B8C' }}>
                {row.deadline === '' ? t('admin.import.rolling') : row.deadline}
              </td>
              <td style={ADMIN_TD}>
                <span style={row.ok ? PASS_PILL : FAIL_PILL}>
                  {row.ok
                    ? committed
                      ? t('admin.import.imported')
                      : t('admin.import.pass')
                    : t('admin.import.fail')}
                </span>
              </td>
              <td style={{ ...ADMIN_TD, color: '#5B6B8C', fontSize: 11.5, lineHeight: 1.4 }}>
                {row.code === null
                  ? `${committed ? '' : t('admin.import.willImport', { status: row.payload?.status ?? '' })}${row.newPartner ? ` ${t('admin.import.newPartner')}` : ''}`.trim()
                  : t(`admin.import.reject.${row.code}`, { detail: row.detail })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** What crosses to the server: CSV as text, a spreadsheet as its own bytes. */
type UploadPayload = { csv: string } | { xlsx: string };

/** The chosen sheet of a workbook, as a grid of strings. */
async function sheetTable(file: File): Promise<string[][]> {
  // Dynamically imported so the reader stays out of the bundle until somebody
  // actually picks a spreadsheet, as the public export does with its writer.
  const { default: readXlsxFile } = await import('read-excel-file/browser');
  return pickSheetTable(await readXlsxFile(file), TITLE_HEADERS);
}

async function toBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  // In chunks: spreading a half-megabyte array into String.fromCharCode at
  // once overflows the call stack.
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

function formatBytes(bytes: number): string {
  // i18n-exempt: a unit symbol, not copy — the number is the message.
  return `${Math.round(bytes / 1024)} KB`;
}

/** The prototype's dashed picker. Local because nothing else in the admin has one. */
const DROPZONE = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
  border: '1.5px dashed #C9D3E8',
  borderRadius: 10,
  padding: '14px 20px',
  cursor: 'pointer',
  fontSize: 13.5,
  fontWeight: 700,
  color: '#1F5FBF',
} as const;

const PASS_PILL = {
  fontSize: 11,
  fontWeight: 800,
  padding: '3px 10px',
  borderRadius: 99,
  background: '#E7F4EE',
  color: '#0E7A54',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
} as const;

const FAIL_PILL = { ...PASS_PILL, background: '#FBEAE8', color: '#C0392B' } as const;
