import ts from 'typescript';

/**
 * A user-facing string literal found in JSX.
 *
 * Built on the TypeScript compiler API rather than a regex, and that is not
 * fastidiousness: a regex over JSX cannot tell a text node from a class name.
 * `className="text-navy underline"` and `<p>Apply now</p>` are both quoted
 * English-ish text on a line of JSX, and only one of them is a defect. The
 * parser knows which node is which; a pattern never will.
 *
 * `typescript` is already a devDependency, so this adds no package.
 *
 * Two limits worth stating plainly, because a guard whose limits are
 * undocumented gets trusted for things it does not do:
 *
 * - Copy passed as a prop to one of our own components is invisible here.
 *   `<Badge label="Closed" />` is not flagged: `label` is not one of the
 *   user-facing attributes below, and a JSX-level scan has no way to know
 *   that a given component's `label` prop renders as text. The component
 *   itself must call `t()` for its own props.
 * - Only `.tsx` is scanned. Copy living in `.ts` -- Zod validation messages,
 *   route-handler JSON error bodies, server-action thrown errors -- is
 *   outside this guard's reach entirely.
 */
export interface Literal {
  file: string;
  line: number;
  text: string;
  kind: 'text' | 'child' | 'attribute';
  attribute?: string;
}

/** The attributes a visitor actually reads. Everything else is machinery. */
const USER_FACING_ATTRIBUTES = new Set([
  'aria-label',
  'title',
  'placeholder',
  'alt',
  'aria-description',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
]);

/**
 * An exemption is written either as an ordinary comment (`// i18n-exempt:
 * ...`) or, since `//` is not a legal comment inside JSX children, as a JSX
 * comment (`{/* i18n-exempt: ... *\/}`). Both require a stated reason after
 * the colon.
 */
const EXEMPT_SOURCE = String.raw`(?:\/\/|\{?\s*\/\*)\s*i18n-exempt:\s*\S`;

/**
 * Literals that cannot be user-facing copy. Deliberately narrow: anything
 * containing a bare word is copy until proven otherwise, because the failure
 * mode of a too-permissive rule is a content-rule violation nobody catches.
 */
export function isAllowedLiteral(raw: string): boolean {
  const text = raw.trim();
  if (text === '') return true;
  // HTML entities are markup, not user-facing words -- strip them before the
  // punctuation-only check so `&nbsp;` doesn't read as containing a letter.
  const withoutEntities = text.replace(/&#\d+;|&\w+;/g, '');
  // Punctuation, symbols, separators and entities only -- no letters, no digits.
  if (withoutEntities === '' || /^[^\p{L}\p{N}]+$/u.test(withoutEntities)) return true;
  // URLs, mail and tel links, and root-relative paths.
  if (/^(?:https?:\/\/|mailto:|tel:|\/)\S*$/.test(text)) return true;
  // Technical identifiers and schema keys: all-lowercase, no whitespace, and
  // at least one dot, hyphen, slash, plus or underscore joining alphanumeric
  // parts. This admits `site.footer`, `data-route`, `utf-8` and
  // `application/ld+json`, but never an English phrase that happens to be
  // hyphenated, such as `Auto-closed` or `Co-led` -- capitalisation is
  // exactly the signal that separates a machine identifier from a label a
  // person reads, so the rule requires lowercase rather than merely
  // forbidding the literal word `Apply`.
  if (/^[a-z0-9]+(?:[.\-_/+][a-z0-9]+)+$/.test(text)) return true;
  return false;
}

/**
 * `parseDiagnostics` is populated on every SourceFile the parser produces but
 * is not in TypeScript's public .d.ts. Declaring it optional rather than
 * asserting it means a rename in a future TypeScript release makes this read
 * `undefined` -- which the check below treats as "cannot tell", not as "no
 * errors". An `as unknown as` cast would instead keep compiling and silently
 * stop detecting parse failures, leaving the copy guard vacuously green on
 * any file it cannot parse. `ts.SourceFile` is assignable to this type with
 * no cast, because every member this adds is optional.
 */
type MaybeParsed = ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] };

/**
 * The message of the first parse error on `file`, if this TypeScript version
 * exposes `parseDiagnostics` and the file has one. `undefined` covers both
 * "parsed cleanly" and "cannot tell" -- deliberately not distinguished,
 * because either way there is nothing to throw on, and conflating them the
 * other direction (treating "cannot tell" as an error) would fail every file
 * on a TypeScript version that renamed the property.
 */
function parseErrorOf(file: MaybeParsed): string | undefined {
  const first = file.parseDiagnostics?.[0];
  if (!first) return undefined;
  return ts.flattenDiagnosticMessageText(first.messageText, ' ');
}

export function findUserFacingLiterals(file: string, code: string): Literal[] {
  const source = ts.createSourceFile(
    file,
    code,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
  );

  // createSourceFile recovers silently from a syntax error, which would
  // otherwise make this guard's result quietly meaningless for a file that
  // doesn't parse: it would just contribute zero literals and stay green.
  // Surface it as a loud failure instead.
  const parseError = parseErrorOf(source);
  if (parseError) {
    throw new Error(`${file} failed to parse, guard result is meaningless: ${parseError}`);
  }

  const lines = code.split('\n');
  const lineStarts = source.getLineStarts();
  const found: Literal[] = [];

  /** 1-indexed line of a node's start position. */
  function lineOf(node: ts.Node): number {
    return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  }

  /** Absolute character offsets, within `lineText`, of every exemption marker. */
  function exemptionOffsetsOnLine(lineText: string): number[] {
    return [...lineText.matchAll(new RegExp(EXEMPT_SOURCE, 'g'))].map((m) => m.index ?? 0);
  }

  /**
   * An exemption is per-occurrence and must carry a reason: on the offending
   * node's own line, or on the line immediately above it. There is
   * deliberately no file-level or directory-level escape -- a broad
   * exemption silently un-polices everything added to that file later, and
   * nobody re-reads it.
   *
   * A marker on the node's own line only counts if it sits *outside* the
   * node's own span. Without that check, writing the marker text inside a
   * JSX text node -- `AskHub // i18n-exempt: reason` -- would satisfy the
   * regex while shipping the marker itself to visitors as rendered copy,
   * since `//` is not a comment inside JSX text. Comparing positions closes
   * that: a match inside the flagged node's own characters is not an
   * exemption of it.
   */
  function exempt(node: ts.Node, line: number): boolean {
    const ownLineText = lines[line - 1] ?? '';
    const ownLineStart = lineStarts[line - 1] ?? 0;
    const validOnOwnLine = exemptionOffsetsOnLine(ownLineText).some((offset) => {
      const absolute = ownLineStart + offset;
      return absolute < node.getStart(source) || absolute >= node.getEnd();
    });
    if (validOnOwnLine) return true;

    const aboveLineText = lines[line - 2] ?? '';
    return exemptionOffsetsOnLine(aboveLineText).length > 0;
  }

  function record(node: ts.Node, text: string, kind: Literal['kind'], attribute?: string) {
    if (isAllowedLiteral(text)) return;
    const line = lineOf(node);
    if (exempt(node, line)) return;
    found.push({ file, line, text: text.trim(), kind, ...(attribute ? { attribute } : {}) });
  }

  /**
   * Every static string an expression could produce. A bare literal
   * contributes itself; anything built from literals at runtime by a
   * conditional, string concatenation, `&&`/`??` fallback, parentheses or a
   * template still resolves to a fixed, knowable set of strings, and each of
   * those is copy exactly as much as a bare literal would be. `deadline.
   * daysLeft` in en.json is itself an interpolated string, so a developer
   * reaching for `` `${n} results` `` instead of `t()` is the expected
   * failure mode this exists to catch, not an edge case.
   */
  function staticTexts(node: ts.Node | undefined): string[] {
    if (!node) return [];
    if (ts.isParenthesizedExpression(node)) return staticTexts(node.expression);
    if (ts.isStringLiteral(node)) return [node.text];
    if (ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
    if (ts.isConditionalExpression(node)) {
      return [...staticTexts(node.whenTrue), ...staticTexts(node.whenFalse)];
    }
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind;
      const joins =
        op === ts.SyntaxKind.PlusToken ||
        op === ts.SyntaxKind.AmpersandAmpersandToken ||
        op === ts.SyntaxKind.QuestionQuestionToken;
      return joins ? [...staticTexts(node.left), ...staticTexts(node.right)] : [];
    }
    if (ts.isTemplateExpression(node)) {
      // A fragment with no letter -- `/` joining two substitutions, say --
      // is not a candidate on its own; a fragment that does contain a letter
      // is exactly the "Showing {n} results" shape written without t().
      const parts = [node.head.text, ...node.templateSpans.map((span) => span.literal.text)];
      return parts.filter((part) => /\p{L}/u.test(part));
    }
    return [];
  }

  function visit(node: ts.Node): void {
    if (ts.isJsxText(node)) {
      record(node, node.text, 'text');
    } else if (ts.isJsxExpression(node) && node.parent && isJsxChildHost(node.parent)) {
      for (const text of staticTexts(node.expression)) record(node, text, 'child');
    } else if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(source);
      if (USER_FACING_ATTRIBUTES.has(name)) {
        const init = node.initializer;
        const texts =
          init && ts.isJsxExpression(init) ? staticTexts(init.expression) : staticTexts(init);
        for (const text of texts) record(node, text, 'attribute', name);
      }
    }
    ts.forEachChild(node, visit);
  }

  function isJsxChildHost(node: ts.Node): boolean {
    return ts.isJsxElement(node) || ts.isJsxFragment(node);
  }

  visit(source);
  return found;
}
