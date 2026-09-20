/**
 * A CSV reader for the admin bulk import.
 *
 * Hand-rolled rather than a dependency: the only spreadsheet package here is
 * `write-excel-file`, which is write-only, so a parser would mean adding one
 * to the tree for a single admin screen.
 *
 * This is the inverse of `quote()` and `neutralise()` in
 * src/lib/public/export.ts, and the two have to stay consistent -- our own
 * export is the most likely thing an operator edits and feeds back in. That is
 * also why the BOM and the leading apostrophe are handled here: `downloadCsv`
 * writes both, so a round-tripped file carries both.
 */

/**
 * Undo the spreadsheet-injection guard the export applies. `neutralise()`
 * prefixes a value beginning `= + - @ tab CR` with an apostrophe, so a cell
 * that begins `'` followed by one of those is a neutralised value rather than
 * someone's actual text, and the apostrophe is not data.
 */
function denormalise(cell: string): string {
  return /^'[=+\-@\t\r]/.test(cell) ? cell.slice(1) : cell;
}

/**
 * Split CSV text into rows of cells.
 *
 * RFC 4180 as the export writes it: doubled `""` for a literal quote inside a
 * quoted cell, quoted cells that may contain commas and newlines, and CRLF
 * line endings. Also tolerated, because real files carry them: bare LF, a lone
 * CR, a missing final newline, a leading UTF-8 BOM, and ragged rows -- row
 * length is the caller's problem, since the header row is what gives a column
 * meaning.
 *
 * Rows whose every cell is blank are dropped. A trailing newline would
 * otherwise produce a final row of one empty cell, and spreadsheet exports
 * routinely carry runs of empty rows after the data.
 */
export function parseCsv(text: string): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  const endCell = () => {
    row.push(denormalise(cell));
    cell = '';
  };
  const endRow = () => {
    endCell();
    if (row.some((value) => value.trim() !== '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (quoted) {
      if (char !== '"') {
        cell += char;
      } else if (source[i + 1] === '"') {
        // A doubled quote inside a quoted cell is one literal quote.
        cell += '"';
        i += 1;
      } else {
        quoted = false;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      endCell();
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      endRow();
    } else {
      cell += char;
    }
  }

  // Whatever is still buffered is the last row, whether or not the file ended
  // with a newline.
  endRow();
  return rows;
}
