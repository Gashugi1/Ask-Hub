/**
 * Locates the real `@theme { ... }` at-rule(s) in a CSS source string, for
 * `tests/structure/app-structure.test.ts`'s colour guard: everywhere except
 * inside this block, a colour literal in `src/app/globals.css` is still the
 * defect CLAUDE.md's "no hardcoded colours, use design tokens" rule exists
 * to catch.
 *
 * Extracted into its own module (rather than inlined in the test) so its
 * boundary logic — the part someone could get subtly wrong under
 * deadline — can be exercised directly with synthetic fixtures, not only
 * indirectly through the real file.
 *
 * Two things a naive implementation gets wrong, both fixed here:
 *
 *  - A bare substring search for "@theme" matches inside a comment that
 *    merely mentions the block (e.g. this very file's own doc comments, or
 *    one in globals.css describing the guard). Anchored instead on the
 *    actual at-rule syntax: `@theme` followed by optional whitespace and
 *    `{`, found in a comment-stripped copy of the source.
 *  - Counting `{`/`}` on raw text treats braces inside comments as real
 *    structure. A comment containing an unmatched brace would then open or
 *    extend the exemption window past the real block's close, silently
 *    covering whatever colour literal comes after it. Comments are
 *    stripped (content replaced with spaces, newlines kept so line numbers
 *    do not shift) before any brace is counted.
 */

/**
 * Replaces the contents of every `/* ... *\/` comment with spaces, keeping
 * newlines intact so the returned string has the same line count and the
 * same character offset-to-line mapping as the input.
 */
function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.replace(/[^\n]/g, ' '),
  );
}

/**
 * Returns one boolean per line of `css`, true where that line falls inside
 * a real `@theme { ... }` at-rule. Supports more than one such block in the
 * same file (each is located independently); a file with none returns an
 * all-false array of the right length.
 */
export function themeBlockLines(css: string): boolean[] {
  const totalLines = css.split('\n').length;
  const inside = new Array<boolean>(totalLines).fill(false);
  const stripped = stripCssComments(css);

  const lineOf = (charIndex: number): number =>
    stripped.slice(0, charIndex).split('\n').length - 1;

  const atRule = /@theme\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = atRule.exec(stripped)) !== null) {
    const openBrace = match.index + match[0].length - 1;
    let depth = 1;
    let pos = openBrace + 1;
    while (pos < stripped.length && depth > 0) {
      if (stripped[pos] === '{') depth++;
      else if (stripped[pos] === '}') depth--;
      pos++;
    }
    // Unclosed block (malformed CSS): treat everything from the at-rule to
    // end of file as inside, rather than throwing or silently exempting
    // nothing.
    const closeIndex = pos;
    const startLine = lineOf(match.index);
    const endLine = lineOf(closeIndex);
    for (let i = startLine; i <= endLine && i < totalLines; i++) inside[i] = true;

    atRule.lastIndex = closeIndex;
  }

  return inside;
}
