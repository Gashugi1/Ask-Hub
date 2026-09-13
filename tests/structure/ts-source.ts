import ts from 'typescript';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Shared TypeScript-compiler-API plumbing for the structural guards.
 *
 * `tests/structure/jsx-literals.ts` explains at length why a guard over JSX
 * has to be built on the parser rather than on a regex: a pattern cannot tell
 * a class name from a text node. The same argument applies to every guard in
 * this folder, in two further forms that matter here:
 *
 * - A regex cannot tell a *comment* from code. `src/app/(admin)/admin/
 *   settings/page.tsx` names the role checks its actions perform in its
 *   docstring, in prose. A grep-based "does this page call requireRole" guard would be
 *   satisfied by the prose alone and would therefore stay green for a page
 *   that deleted the call and kept the comment — the exact regression the
 *   guard exists to catch.
 * - A regex cannot tell a call from a mention. `src/lib/actions/users.ts`
 *   names `createAdminSupabase` in a paragraph of its own header.
 *
 * The parser knows which node is which. `typescript` is already a
 * devDependency, so none of this adds a package.
 */

/**
 * `parseDiagnostics` is populated on every SourceFile the parser produces but
 * is not in TypeScript's public .d.ts. Declared optional rather than asserted,
 * for the reason set out in `jsx-literals.ts`: a rename in a future TypeScript
 * release then reads as "cannot tell", never as "no errors".
 */
type MaybeParsed = ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] };

/**
 * Parse `code` as TSX, throwing loudly if it does not parse.
 *
 * `createSourceFile` recovers silently from a syntax error, which would make
 * every guard built on it quietly meaningless for the offending file: it would
 * contribute zero offenders and stay green. A guard that cannot see a file
 * must say so rather than pass.
 */
export function parseSource(file: string, code: string): ts.SourceFile {
  const source = ts.createSourceFile(
    file,
    code,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
  );
  const first = (source as MaybeParsed).parseDiagnostics?.[0];
  if (first) {
    throw new Error(
      `${file} failed to parse, guard result is meaningless: ` +
        ts.flattenDiagnosticMessageText(first.messageText, ' '),
    );
  }
  return source;
}

/** Every descendant of `node`, itself included, in source order. */
export function descendants(node: ts.Node): ts.Node[] {
  const out: ts.Node[] = [node];
  node.forEachChild(function visit(child) {
    out.push(child);
    child.forEachChild(visit);
  });
  return out;
}

/**
 * The name of a call's callee when it is a bare identifier (`requireRole(...)`)
 * or a property access (`supabase.from(...)` -> `from`). `undefined` for
 * anything more exotic, which no call in this codebase currently is.
 */
export function calleeName(call: ts.CallExpression): string | undefined {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return undefined;
}

/** Every name called anywhere inside `node`. */
export function calledNames(node: ts.Node): Set<string> {
  const names = new Set<string>();
  for (const child of descendants(node)) {
    if (ts.isCallExpression(child)) {
      const name = calleeName(child);
      if (name) names.add(name);
    }
  }
  return names;
}

/** 1-indexed line of a node's start position. */
export function lineOf(source: ts.SourceFile, node: ts.Node): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

/** Every file under `dir` matching `match`, recursively. */
export function walk(dir: string, match: RegExp, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, match, out);
    else if (match.test(entry)) out.push(full);
  }
  return out.sort();
}
