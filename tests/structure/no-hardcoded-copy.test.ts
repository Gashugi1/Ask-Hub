import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { findUserFacingLiterals } from './jsx-literals';

/**
 * CLAUDE.md: no hardcoded user-facing strings; everything goes to
 * src/locales/en.json.
 *
 * tests/unit/i18n.test.ts scans every key of en.json for the PRD 10 content
 * rules. A string written straight into a .tsx file never reaches en.json and
 * so escapes every one of those checks -- which is what makes this guard part
 * of the content-rule mechanism rather than a lint preference.
 *
 * Scoped to all of src/, not just the public surface, so SP3's admin screens
 * inherit it as they are written.
 */
function tsxFiles(dir = 'src', out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) tsxFiles(full, out);
    else if (entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

describe('no hardcoded user-facing copy in JSX', () => {
  it('finds no unlocalised text node, string child or user-facing attribute', () => {
    const offenders = tsxFiles()
      .flatMap((file) => findUserFacingLiterals(file, readFileSync(file, 'utf8')))
      .map(
        (l) =>
          `${l.file}:${l.line}: ${l.kind === 'attribute' ? `${l.attribute}=` : ''}"${l.text}"`,
      );

    expect(
      offenders,
      'hardcoded user-facing copy — move it to src/locales/en.json and read it with t(), ' +
        'or add `// i18n-exempt: <reason>` on that line if it genuinely is not copy',
    ).toEqual([]);
  });
});
