/**
 * Flattens a parsed spreadsheet into the plain string grid the tracker reader
 * works in.
 *
 * A CSV arrives as text and is entirely strings; a `.xlsx` arrives already
 * typed, because the format stores what a cell *is* rather than how it looked.
 * `read-excel-file` therefore hands back `Date`, `number`, `boolean` and
 * `null` alongside strings, and every one of those would fail a reader
 * expecting text -- a closing date would reach the `YYYY-MM-DD` check as
 * "Mon Dec 01 2026 ..." and be rejected for a formatting problem the operator
 * cannot see in their spreadsheet.
 */

/**
 * One cell, as text.
 *
 * A date becomes `YYYY-MM-DD` from its UTC parts, which is both what the
 * tracker's own date column carries and what `resourceInput.deadline`
 * requires. UTC specifically: Excel stores a date as a timezone-naive day
 * number, `read-excel-file` materialises it at UTC midnight, and reading it
 * back with local getters would shift it to the previous day for anyone west
 * of Greenwich -- a deadline silently a day early.
 *
 * A boolean becomes Yes/No because the columns that arrive boolean are the
 * tracker's yes/no ones (Evergreen, All Gates Passed), and those are what the
 * gates match on.
 */
export function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value).trim();
}

/** The whole sheet as text, with rows that are entirely blank dropped. */
export function sheetToTable(rows: readonly (readonly unknown[])[]): string[][] {
  return rows
    .map((row) => row.map(cellToString))
    .filter((row) => row.some((cell) => cell !== ''));
}

/**
 * The sheet the tracker's data is actually on.
 *
 * A workbook is rarely one sheet. The tracker's export carries its notes, its
 * lookup lists and its data side by side, and the data is not reliably first,
 * so taking sheet one would read whichever tab the author last happened to
 * leave selected. The right sheet is the one whose grid names the title
 * column; the first sheet is the fallback, so that a workbook with no
 * recognisable header still reaches the reader and gets the
 * missing-columns message rather than an empty one.
 *
 * `headerNames` is passed in rather than imported so this module stays about
 * spreadsheets and knows nothing about the tracker's column vocabulary.
 */
export function pickSheetTable(
  sheets: readonly { readonly data: readonly (readonly unknown[])[] }[],
  headerNames: readonly string[],
): string[][] {
  const wanted = headerNames.map((name) => name.toLowerCase());
  const tables = sheets.map((sheet) => sheetToTable(sheet.data));
  const named = tables.find((table) =>
    table.some((row) => row.some((cell) => wanted.includes(cell.toLowerCase()))),
  );
  return named ?? tables[0] ?? [];
}
