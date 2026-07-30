import ts from 'typescript';
import { parseSource, descendants, calleeName, lineOf } from './ts-source';

/**
 * The two single-file-decidable halves of CLAUDE.md's "`viewer` role ... sees
 * no write affordances in the UI", plus its page-level counterpart.
 *
 * The rule is that a viewer sees no write control *at all*, not a greyed-out
 * one. A disabled Save button is not a smaller version of hiding it: it tells
 * the viewer the product has a capability they are being refused, invites a
 * support conversation about a permission they will not be given, and — the
 * reason it keeps getting re-added — is the tempting fix when someone notices
 * the table layout shifts between roles. Every admin component in this
 * repository already carries a comment saying so; this turns those comments
 * into something that fails.
 *
 * Deliberately *not* implemented as "every component rendering a form is
 * inside a route that calls requireRole, or takes a canWrite prop it guards
 * on". That is a whole-program dataflow question — which route renders which
 * component, and whether a prop is actually branched on rather than merely
 * accepted — and it cannot be decided by inspecting one file. A guard that
 * pretends to answer it would have to guess, and a guard that guesses either
 * blocks correct code or waves through the case it was written for. The two
 * assertions below are each decidable from a single file's syntax tree, and
 * between them they cover the failure modes that have actually occurred:
 * the inert control, and the page that forgot to gate.
 */

/** An identifier or literal in a `disabled=` expression that names a role. */
export interface RoleGatedDisabled {
  file: string;
  line: number;
  /** The role-ish token found, for the failure message. */
  token: string;
  /** The whole attribute, so the message names the code and not just a word. */
  text: string;
}

/**
 * Identifier substrings that mean "this expression is about who the user is".
 *
 * Matched as a case-insensitive substring so `userRole`, `currentRole`,
 * `props.canWrite` and `isViewerSession` are all caught — a rule keyed to
 * exact spellings would be evaded by the first rename. `pending`, `saving`
 * and `busy`, which every control in this tree legitimately disables on, match
 * none of them.
 */
const ROLE_TOKENS = [
  'role',
  'canwrite',
  'canadminister',
  'isadmin',
  'isviewer',
  'permission',
];

/**
 * String literals that mean the same thing when compared against. Catches
 * `disabled={user.appRole !== 'admin'}` written without any role-named local.
 */
const ROLE_LITERALS = new Set(['admin', 'editor', 'viewer']);

function roleTokenIn(name: string): string | undefined {
  const lower = name.toLowerCase();
  return ROLE_TOKENS.find((token) => lower.includes(token));
}

/**
 * Every `disabled=` JSX attribute in `code` whose expression mentions a role
 * or permission. Shorthand `disabled` with no initializer (`<option disabled>`)
 * has no expression and so is never flagged — it is markup, not a permission
 * decision.
 */
export function findRoleGatedDisabled(file: string, code: string): RoleGatedDisabled[] {
  const source = parseSource(file, code);
  const found: RoleGatedDisabled[] = [];

  for (const node of descendants(source)) {
    if (!ts.isJsxAttribute(node)) continue;
    if (node.name.getText(source) !== 'disabled') continue;
    const init = node.initializer;
    if (!init || !ts.isJsxExpression(init) || !init.expression) continue;

    for (const inner of descendants(init.expression)) {
      let token: string | undefined;
      if (ts.isIdentifier(inner)) token = roleTokenIn(inner.text);
      else if (ts.isStringLiteral(inner) && ROLE_LITERALS.has(inner.text)) token = inner.text;
      if (!token) continue;
      found.push({
        file,
        line: lineOf(source, node),
        token,
        text: node.getText(source).replace(/\s+/g, ' '),
      });
      break;
    }
  }

  return found;
}

/**
 * Whether `code` actually *calls* `requireRole` or `requirePageRole`.
 *
 * A call, not a mention: several of these pages explain the rule in prose that
 * quotes the call, so a text search would be satisfied by the comment alone
 * and would stay green for a page that deleted the gate and kept the docstring.
 */
export function callsRoleGate(file: string, code: string): boolean {
  const source = parseSource(file, code);
  return descendants(source).some(
    (node) =>
      ts.isCallExpression(node) &&
      (calleeName(node) === 'requireRole' || calleeName(node) === 'requirePageRole'),
  );
}
