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
 */
export interface Literal {
  file: string;
  line: number;
  text: string;
  kind: 'text' | 'child' | 'attribute';
  attribute?: string;
}

/** The attributes a visitor actually reads. Everything else is machinery. */
const USER_FACING_ATTRIBUTES = new Set(['aria-label', 'title', 'placeholder', 'alt']);

const EXEMPT = /\/\/\s*i18n-exempt:\s*\S/;

/**
 * Literals that cannot be user-facing copy. Deliberately narrow: anything
 * containing a bare word is copy until proven otherwise, because the failure
 * mode of a too-permissive rule is a content-rule violation nobody catches.
 */
export function isAllowedLiteral(raw: string): boolean {
  const text = raw.trim();
  if (text === '') return true;
  // Punctuation, symbols and separators only -- no letters, no digits.
  if (/^[^\p{L}\p{N}]+$/u.test(text)) return true;
  // URLs, mail and tel links, and root-relative paths.
  if (/^(?:https?:\/\/|mailto:|tel:|\/)\S*$/.test(text)) return true;
  // Technical identifiers and schema keys: no whitespace, and at least one
  // dot, hyphen, slash, plus or underscore joining alphanumeric parts. This
  // admits `site.footer` and `application/ld+json` but never `Apply`.
  if (/^[A-Za-z0-9]+(?:[.\-_/+][A-Za-z0-9]+)+$/.test(text)) return true;
  return false;
}

export function findUserFacingLiterals(file: string, code: string): Literal[] {
  const source = ts.createSourceFile(
    file,
    code,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
  );
  const lines = code.split('\n');
  const found: Literal[] = [];

  /** 1-indexed line of a node's start position. */
  function lineOf(node: ts.Node): number {
    return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  }

  /**
   * An exemption is per-occurrence and must carry a reason: on the offending
   * line, or on the line immediately above it. There is deliberately no
   * file-level or directory-level escape -- a broad exemption silently
   * un-polices everything added to that file later, and nobody re-reads it.
   */
  function exempt(line: number): boolean {
    const own = lines[line - 1] ?? '';
    const above = lines[line - 2] ?? '';
    return EXEMPT.test(own) || EXEMPT.test(above);
  }

  function record(node: ts.Node, text: string, kind: Literal['kind'], attribute?: string) {
    if (isAllowedLiteral(text)) return;
    const line = lineOf(node);
    if (exempt(line)) return;
    found.push({ file, line, text: text.trim(), kind, ...(attribute ? { attribute } : {}) });
  }

  /** The string a node contributes, if it is a bare string with no interpolation. */
  function staticText(node: ts.Node | undefined): string | undefined {
    if (!node) return undefined;
    if (ts.isStringLiteral(node)) return node.text;
    if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    return undefined;
  }

  function visit(node: ts.Node): void {
    if (ts.isJsxText(node)) {
      record(node, node.text, 'text');
    } else if (ts.isJsxExpression(node) && node.parent && isJsxChildHost(node.parent)) {
      const text = staticText(node.expression);
      if (text !== undefined) record(node, text, 'child');
    } else if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(source);
      if (USER_FACING_ATTRIBUTES.has(name)) {
        const init = node.initializer;
        const text =
          init && ts.isJsxExpression(init) ? staticText(init.expression) : staticText(init);
        if (text !== undefined) record(node, text, 'attribute', name);
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
