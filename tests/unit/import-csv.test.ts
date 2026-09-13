import { describe, it, expect } from 'vitest';
import { parseCsv } from '@/lib/admin/import-csv';

/**
 * The parser is the inverse of src/lib/public/export.ts's writer, so the cases
 * that matter are the ones that writer can produce: doubled quotes, quoted
 * commas and newlines, CRLF, a BOM, and the leading apostrophe its
 * injection guard adds.
 */
describe('parseCsv', () => {
  it('splits a plain file', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('keeps a comma inside a quoted cell', () => {
    expect(parseCsv('a,b\n"Kenya, Ghana",2')).toEqual([
      ['a', 'b'],
      ['Kenya, Ghana', '2'],
    ]);
  });

  it('reads a doubled quote as one literal quote', () => {
    expect(parseCsv('a\n"He said ""go"""')).toEqual([['a'], ['He said "go"']]);
  });

  it('keeps a newline inside a quoted cell', () => {
    expect(parseCsv('a,b\n"line one\nline two",2')).toEqual([
      ['a', 'b'],
      ['line one\nline two', '2'],
    ]);
  });

  it('accepts CRLF, bare LF and a lone CR', () => {
    const expected = [
      ['a'],
      ['1'],
      ['2'],
    ];
    expect(parseCsv('a\r\n1\r\n2')).toEqual(expected);
    expect(parseCsv('a\n1\n2')).toEqual(expected);
    expect(parseCsv('a\r1\r2')).toEqual(expected);
  });

  it('strips a leading UTF-8 BOM', () => {
    // downloadCsv writes one so Excel reads the file as UTF-8. Without this
    // the first header is "﻿Resource Title" and no column resolves.
    expect(parseCsv('﻿Resource Title,Provider')).toEqual([
      ['Resource Title', 'Provider'],
    ]);
  });

  it('undoes the export’s injection guard', () => {
    // neutralise() prefixes a value starting = + - @ with an apostrophe.
    expect(parseCsv("a,b\n'=SUM(A1),'-5")).toEqual([
      ['a', 'b'],
      ['=SUM(A1)', '-5'],
    ]);
  });

  it('leaves an apostrophe that is part of the text alone', () => {
    expect(parseCsv("a\n'Tis a name")).toEqual([['a'], ["'Tis a name"]]);
  });

  it('reads the last row with no trailing newline, and drops a trailing one', () => {
    expect(parseCsv('a,b\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('drops rows that are entirely blank', () => {
    // Spreadsheet exports routinely carry runs of empty rows after the data.
    expect(parseCsv('a,b\n1,2\n,\n\n3,4')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('tolerates ragged rows in both directions', () => {
    // Row length is the caller's problem: the header row is what gives a
    // column meaning, so a short row simply has missing values.
    expect(parseCsv('a,b,c\n1\n2,3,4,5')).toEqual([
      ['a', 'b', 'c'],
      ['1'],
      ['2', '3', '4', '5'],
    ]);
  });

  it('keeps empty cells between delimiters', () => {
    expect(parseCsv('a,b,c\n1,,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '', '3'],
    ]);
  });

  it('returns nothing for an empty file', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('\n\n')).toEqual([]);
  });
});
