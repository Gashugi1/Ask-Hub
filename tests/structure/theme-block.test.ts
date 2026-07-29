import { describe, it, expect } from 'vitest';
import { themeBlockLines } from './theme-block';

/**
 * Direct tests of the block-locating logic the colour guard in
 * app-structure.test.ts relies on, using synthetic fixtures rather than the
 * real globals.css — so a regression here is caught by this file alone,
 * without needing a colour literal to happen to land in the wrong spot in
 * the real file first.
 */
describe('themeBlockLines', () => {
  it('marks no lines inside when there is no @theme block', () => {
    const css = ['body {', '  color: red;', '}'].join('\n');
    expect(themeBlockLines(css)).toEqual([false, false, false]);
  });

  it('marks exactly the lines of a simple @theme block, inclusive', () => {
    const css = [
      '@import "tailwindcss";', //           0
      '',
      '@theme {', //                        2
      '  --color-primary: #1F5FBF;', //     3
      '}', //                                4
      '',
      'body {', //                          6
      '  color: #000000;', //               7
      '}', //                                8
    ].join('\n');

    expect(themeBlockLines(css)).toEqual([
      false, false, true, true, true, false, false, false, false,
    ]);
  });

  it('is not opened by a comment that merely mentions "@theme"', () => {
    // This is the exact shape found in globals.css: a doc comment on the
    // guard itself says "inside this @theme block" three lines above the
    // real at-rule. A substring match on "@theme" would flip inTheme here;
    // the at-rule-anchored version must not.
    const css = [
      '/*', //                                0
      ' * allow colour literals only inside this @theme block', // 1
      ' */', //                                2
      '#111111', //                            3 -- must NOT be exempted
      '@theme {', //                           4
      '  --color-primary: #1F5FBF;', //        5
      '}', //                                   6
    ].join('\n');

    const inside = themeBlockLines(css);
    expect(inside[3]).toBe(false); // the stray colour before the real block
    expect(inside[4]).toBe(true);
    expect(inside[5]).toBe(true);
    expect(inside[6]).toBe(true);
  });

  it('is not extended by a comment containing an unmatched brace', () => {
    // If braces inside comments were counted, this stray "{" would push
    // depth to 2 inside the block, so the block's own "}" would only bring
    // depth back to 1 -- leaving the exemption window open into the rule
    // that follows and silently covering its colour literal.
    const css = [
      '@theme {', //                                    0
      '  /* a stray { in a comment */', //               1
      '  --color-primary: #1F5FBF;', //                 2
      '}', //                                            3 -- must close here
      'body {', //                                       4
      '  color: #000000;', //                           5 -- must NOT be exempted
      '}', //                                            6
    ].join('\n');

    const inside = themeBlockLines(css);
    expect(inside).toEqual([true, true, true, true, false, false, false]);
  });

  it('locates a second @theme block independently of the first', () => {
    const css = [
      '@theme {', //          0
      '  --a: #111111;', //  1
      '}', //                  2
      'body { color: #222222; }', // 3 -- must NOT be exempted
      '@theme {', //          4
      '  --b: #333333;', //  5
      '}', //                  6
    ].join('\n');

    expect(themeBlockLines(css)).toEqual([
      true, true, true, false, true, true, true,
    ]);
  });
});
