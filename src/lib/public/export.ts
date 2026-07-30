import { t } from '@/lib/i18n';
import type { PublicResource } from './types';

/**
 * The public export's columns.
 *
 * Typed `readonly (keyof PublicResource)[]`, and every `keyof PublicResource`
 * is mapped by `RESOURCE_VIEW_COLUMNS` to a real `resources_public` column.
 * That makes "the export is a subset of the public view" a fact the compiler
 * checks rather than something a reviewer has to verify by eye -- which is
 * what PRD 5.2 and CLAUDE.md require ("exclude views, clicks, CTR, internal
 * notes, submitter emails, and every other internal or analytics field...
 * implement via a dedicated public-safe database view").
 *
 * id, sortOrder, isFeatured, daysLeft and the two image URLs are omitted --
 * not because they are sensitive, but because they are ours, not the
 * reader's, and a narrower export is easier to keep honest.
 */
export const EXPORT_COLUMNS = [
  'name',
  'partnerName',
  'resourceType',
  'needPrimary',
  'needSecondary',
  'subCategory',
  'description',
  'externalUrl',
  'countriesEligible',
  'sectorsEligible',
  'stagesEligible',
  'geoScope',
  'deadline',
  'addedDate',
] as const satisfies readonly (keyof PublicResource)[];

export type ExportColumn = (typeof EXPORT_COLUMNS)[number];

/**
 * A cell beginning with `=`, `+`, `-` or `@` is evaluated as a formula when
 * the file is opened in Excel or Sheets. Resource copy is partner-supplied
 * text on a UN surface, so a downloaded export must not be able to execute
 * anything. Prefixing with an apostrophe is the standard neutralisation and
 * is invisible in the rendered cell.
 */
function neutralise(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function cell(row: PublicResource, column: ExportColumn): string {
  const value = row[column];
  if (value === null || value === undefined) return '';
  // Semicolon, not comma: an array joined with commas is indistinguishable
  // from separate columns once a reader opens the CSV in a spreadsheet that
  // guesses at delimiters.
  if (Array.isArray(value)) return neutralise(value.join('; '));
  return neutralise(String(value));
}

function quote(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** `headers` maps each export column to its localised label. */
export function toCsvText(
  rows: readonly PublicResource[],
  headers: Record<string, string>,
): string {
  const head = EXPORT_COLUMNS.map((c) => quote(headers[c] ?? c)).join(',');
  const body = rows.map((row) =>
    EXPORT_COLUMNS.map((column) => quote(cell(row, column))).join(','),
  );
  // CRLF: the line ending Excel expects on every platform.
  return [head, ...body].join('\r\n');
}

/** Header row plus one row per resource, for the Excel writer. */
export function toExportRows(rows: readonly PublicResource[]): string[][] {
  return [
    EXPORT_COLUMNS.map((c) => t(`column.${c}`)),
    ...rows.map((row) => EXPORT_COLUMNS.map((column) => cell(row, column))),
  ];
}

function save(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function filename(extension: string): string {
  // Date only, no clock time: the file name is a label, not a timestamp, and
  // a name that changes every second makes repeated exports impossible to
  // tell apart in a downloads folder.
  return `askhub-resources-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

export async function downloadCsv(rows: readonly PublicResource[]): Promise<void> {
  const headers = Object.fromEntries(EXPORT_COLUMNS.map((c) => [c, t(`column.${c}`)]));
  // The BOM is what makes Excel read the file as UTF-8 rather than as the
  // system code page, which is the difference between "Côte d'Ivoire" and
  // mojibake for every reader on Windows.
  const blob = new Blob(['﻿', toCsvText(rows, headers)], {
    type: 'text/csv;charset=utf-8',
  });
  save(blob, filename('csv'));
}

export async function downloadXlsx(rows: readonly PublicResource[]): Promise<void> {
  // Dynamically imported so the writer and its zip dependency stay out of the
  // initial bundle: nobody pays for the export until they click it.
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  await writeXlsxFile(toExportRows(rows)).toFile(filename('xlsx'));
}
