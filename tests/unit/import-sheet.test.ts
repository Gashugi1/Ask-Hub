import { describe, it, expect } from 'vitest';
import writeXlsxFile from 'write-excel-file/node';
import readXlsxFile from 'read-excel-file/node';
import { cellToString, sheetToTable, pickSheetTable } from '@/lib/admin/import-sheet';
import { validateTracker, TITLE_HEADERS } from '@/lib/admin/tracker-import';

/**
 * The spreadsheet half of the importer.
 *
 * A `.xlsx` stores what a cell *is*, not how it looked, so the values arriving
 * here are typed — and the round-trip below is written against a real workbook
 * built by the same library the public export uses, rather than a hand-made
 * array, because the coercion that matters (a date cell) only happens when a
 * real file is read back.
 */
describe('cellToString', () => {
  it('renders a date as YYYY-MM-DD from its UTC parts', () => {
    // Excel stores a timezone-naive day and read-excel-file materialises it at
    // UTC midnight. Local getters would move it a day earlier for any reader
    // west of Greenwich — a deadline silently wrong.
    expect(cellToString(new Date(Date.UTC(2026, 11, 1)))).toBe('2026-12-01');
  });

  it('renders a boolean as the Yes/No the gate columns are matched on', () => {
    expect(cellToString(true)).toBe('Yes');
    expect(cellToString(false)).toBe('No');
  });

  it('renders blanks as empty and numbers as text', () => {
    expect(cellToString(null)).toBe('');
    expect(cellToString(undefined)).toBe('');
    expect(cellToString(2026)).toBe('2026');
    expect(cellToString('  padded  ')).toBe('padded');
  });
});

describe('sheetToTable', () => {
  it('drops rows that are entirely blank', () => {
    expect(sheetToTable([['a'], [null, null], ['', ''], ['b']])).toEqual([['a'], ['b']]);
  });
});

describe('pickSheetTable', () => {
  it('chooses the sheet that names the title column, not the first one', () => {
    // A tracker workbook carries notes and lookup lists beside its data, and
    // the data is not reliably the first tab.
    const table = pickSheetTable(
      [
        { data: [['Notes'], ['Ignore this tab']] },
        { data: [['Resource Title', 'Provider'], ['A programme', 'CINECA']] },
      ],
      TITLE_HEADERS,
    );
    expect(table[0]).toEqual(['Resource Title', 'Provider']);
  });

  it('falls back to the first sheet when no header is recognisable', () => {
    // So the reader still reports which columns are missing rather than
    // reporting an empty file.
    const table = pickSheetTable([{ data: [['Nope']] }, { data: [['Also nope']] }], TITLE_HEADERS);
    expect(table).toEqual([['Nope']]);
  });

  it('returns an empty grid for a workbook with no sheets', () => {
    expect(pickSheetTable([], TITLE_HEADERS)).toEqual([]);
  });
});

describe('a real .xlsx, written and read back', () => {
  it('imports a tracker sheet including its typed date and boolean cells', async () => {
    const rows = [
      [
        { value: 'Resource Title' },
        { value: 'Provider' },
        { value: 'Proposed Category' },
        { value: 'One-Sentence Summary' },
        { value: 'Application / Registration Link' },
        { value: 'Closing Date' },
        { value: 'Status' },
        { value: 'All Gates Passed' },
      ],
      [
        { value: 'Compute Accelerator' },
        { value: 'CINECA' },
        { value: 'Compute' },
        { value: 'GPU hours for African AI teams.' },
        { value: 'https://example.org/apply' },
        // A real date cell, not the string a CSV would carry.
        { value: new Date(Date.UTC(2026, 11, 1)), type: Date, format: 'yyyy-mm-dd' },
        { value: 'Approved' },
        { value: 'Pass' },
      ],
    ];

    const buffer = await writeXlsxFile(rows).toBuffer();
    const table = pickSheetTable(await readXlsxFile(buffer), TITLE_HEADERS);
    const result = validateTracker(table, { existing: [], partners: [] });

    expect(result.fileProblem).toBeNull();
    expect(result.passing).toBe(1);
    expect(result.rows[0]?.payload).toMatchObject({
      name: 'Compute Accelerator',
      partner: 'CINECA',
      needPrimary: 'compute',
      externalUrl: 'https://example.org/apply',
      // The point of the round trip: a date cell reaches the schema as the
      // YYYY-MM-DD it requires, not as "Tue Dec 01 2026 ...".
      deadline: '2026-12-01',
      status: 'live',
    });
  });

  it('reads a sheet whose header sits below a title row', async () => {
    const rows = [
      [{ value: 'Operation 100 tracker — export' }],
      [{ value: 'Resource Title' }, { value: 'Provider' }, { value: 'Proposed Category' },
        { value: 'One-Sentence Summary' }, { value: 'Application / Registration Link' }],
      [{ value: 'Zindi Challenge' }, { value: 'Zindi' }, { value: 'Challenges' },
        { value: 'A competition.' }, { value: 'https://example.org/z' }],
    ];

    const buffer = await writeXlsxFile(rows).toBuffer();
    const table = pickSheetTable(await readXlsxFile(buffer), TITLE_HEADERS);
    const result = validateTracker(table, { existing: [], partners: [] });

    expect(result.fileProblem).toBeNull();
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ ok: true, row: 1, title: 'Zindi Challenge' });
  });
});
