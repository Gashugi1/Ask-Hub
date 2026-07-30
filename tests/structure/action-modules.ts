import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseSource, descendants, calleeName, calledNames } from './ts-source';

/**
 * A syntactic model of `src/lib/actions/*.ts`, shared by the two guards that
 * assert things about server actions: the role check
 * (`action-role-checks.test.ts`) and the cache contract
 * (`revalidation-contract.test.ts`).
 *
 * **Why these guards are static rather than runtime.** A Task 4 review
 * established, and a Task 5 re-review confirmed, that no test in this
 * repository fails if a server action drops its `requireRole` call. The RLS
 * suites exercise the database directly — they never import an action module —
 * and they cannot be made to: `requireRole` resolves the session through
 * `cookies()` from `next/headers`, which has no meaning outside a Next request
 * scope and which a Vitest process cannot provide. So the action layer has no
 * runtime coverage of its own permission check, and static assertion is the
 * only mechanism left. RLS is still the real boundary and would refuse the
 * write; what the missing check would cost is the FORBIDDEN-before-the-request
 * behaviour PRD 14.4 requires, and the clear failure mode when RLS and the
 * application disagree.
 */

export interface ActionFunction {
  /** File name within src/lib/actions, e.g. `resources.ts`. */
  module: string;
  /** Path from the repository root. */
  file: string;
  /** Exported name. */
  name: string;
  /** `<module>#<name>`, the key both allowlists use. */
  key: string;
  /** Whether `await requireRole(...)` is the function's first statement. */
  requireRoleFirst: boolean;
  /** Whether `requireRole` is called anywhere in the body at all. */
  requireRoleAnywhere: boolean;
  /** Whether the body performs an insert / update / upsert / delete. */
  mutates: boolean;
  /** Whether the body reaches `revalidateTag`, directly or via a module helper. */
  revalidates: boolean;
  /** The text after the colon of every `// no-revalidate:` comment in the body. */
  noRevalidateReasons: string[];
  /** Every `CACHE_TAGS.<member>` referenced in the body. */
  cacheTags: string[];
}

const ACTIONS_DIR = 'src/lib/actions';

/** PostgREST's mutating verbs. `deleteUser` and friends do not match. */
const MUTATING_VERBS = new Set(['insert', 'update', 'upsert', 'delete']);

/** An explicit statement that this mutation intentionally invalidates nothing. */
const NO_REVALIDATE = /\/\/\s*no-revalidate:(.*)$/gm;

/** Every `.ts` module directly inside src/lib/actions. */
export function actionModules(): string[] {
  return readdirSync(ACTIONS_DIR)
    .filter((entry) => entry.endsWith('.ts'))
    .sort()
    .map((entry) => join(ACTIONS_DIR, entry));
}

/** The body of an exported async function declaration or arrow, or undefined. */
function exportedAsyncFunctions(
  source: ts.SourceFile,
): { name: string; body: ts.Node; statements: readonly ts.Statement[] }[] {
  const out: { name: string; body: ts.Node; statements: readonly ts.Statement[] }[] = [];

  const has = (node: { modifiers?: ts.NodeArray<ts.ModifierLike> }, kind: ts.SyntaxKind) =>
    node.modifiers?.some((modifier) => modifier.kind === kind) ?? false;

  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement)) {
      const isExported = has(statement, ts.SyntaxKind.ExportKeyword);
      const isAsync = has(statement, ts.SyntaxKind.AsyncKeyword);
      if (!isExported || !isAsync || !statement.name || !statement.body) continue;
      out.push({
        name: statement.name.text,
        body: statement.body,
        statements: statement.body.statements,
      });
      continue;
    }

    // `export const foo = async () => { ... }`. Not used today; covered so the
    // guard does not quietly stop seeing an action written the other way.
    if (ts.isVariableStatement(statement)) {
      if (!has(statement, ts.SyntaxKind.ExportKeyword)) continue;
      for (const declaration of statement.declarationList.declarations) {
        const init = declaration.initializer;
        if (!init) continue;
        if (!ts.isArrowFunction(init) && !ts.isFunctionExpression(init)) continue;
        const isAsync = has(init, ts.SyntaxKind.AsyncKeyword);
        if (!isAsync || !ts.isIdentifier(declaration.name) || !ts.isBlock(init.body)) continue;
        out.push({
          name: declaration.name.text,
          body: init.body,
          statements: init.body.statements,
        });
      }
    }
  }

  return out;
}

/**
 * Whether `statement` is `await requireRole(...)` or
 * `const x = await requireRole(...)` — the two shapes the codebase uses. Both
 * are "the first thing this function does is establish the caller's role";
 * nothing else counts, because "first" is the whole property. A check made
 * after a Zod parse still refuses the write, but it has already done work on
 * behalf of a caller whose right to ask was never established.
 */
function isRequireRoleStatement(statement: ts.Statement): boolean {
  const awaited = (expression: ts.Expression | undefined): boolean => {
    if (!expression || !ts.isAwaitExpression(expression)) return false;
    const call = expression.expression;
    return ts.isCallExpression(call) && calleeName(call) === 'requireRole';
  };

  if (ts.isExpressionStatement(statement)) return awaited(statement.expression);
  if (ts.isVariableStatement(statement)) {
    const declarations = statement.declarationList.declarations;
    return declarations.length === 1 && awaited(declarations[0]!.initializer);
  }
  return false;
}

/**
 * Names of module-level functions that themselves reach `revalidateTag`.
 * `resources.ts` wraps it as `revalidateResources()` and `content.ts` as
 * `revalidate(tag)`, both for documented Next 16 reasons; an action calling
 * the wrapper satisfies the contract exactly as a direct call would.
 */
function revalidationHelpers(source: ts.SourceFile): Set<string> {
  const helpers = new Set<string>();
  for (const statement of source.statements) {
    if (!ts.isFunctionDeclaration(statement) || !statement.name || !statement.body) continue;
    if (calledNames(statement.body).has('revalidateTag')) helpers.add(statement.name.text);
  }
  return helpers;
}

export function readActionFunctions(): ActionFunction[] {
  return actionModules().flatMap((file) => {
    const code = readFileSync(file, 'utf8');
    const source = parseSource(file, code);
    const helpers = revalidationHelpers(source);
    const module = file.slice(ACTIONS_DIR.length + 1);

    return exportedAsyncFunctions(source).map(({ name, body, statements }) => {
      const called = calledNames(body);
      const nodes = descendants(body);

      const mutates = nodes.some(
        (node) =>
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          MUTATING_VERBS.has(node.expression.name.text),
      );

      const cacheTags = nodes
        .filter(
          (node): node is ts.PropertyAccessExpression =>
            ts.isPropertyAccessExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'CACHE_TAGS',
        )
        .map((node) => node.name.text);

      const first = statements[0];

      return {
        module,
        file,
        name,
        key: `${module}#${name}`,
        requireRoleFirst: first !== undefined && isRequireRoleStatement(first),
        requireRoleAnywhere: called.has('requireRole'),
        mutates,
        revalidates:
          called.has('revalidateTag') ||
          called.has('revalidatePath') ||
          [...helpers].some((helper) => called.has(helper)),
        noRevalidateReasons: [...body.getText(source).matchAll(NO_REVALIDATE)].map((match) =>
          (match[1] ?? '').trim(),
        ),
        cacheTags,
      };
    });
  });
}

/** The declared members of CACHE_TAGS, read from its own source of truth. */
export function cacheTagMembers(): Set<string> {
  const file = 'src/lib/public/cache.ts';
  const source = parseSource(file, readFileSync(file, 'utf8'));
  const members = new Set<string>();
  for (const node of descendants(source)) {
    if (!ts.isVariableDeclaration(node)) continue;
    if (!ts.isIdentifier(node.name) || node.name.text !== 'CACHE_TAGS') continue;
    let init = node.initializer;
    if (init && ts.isAsExpression(init)) init = init.expression;
    if (!init || !ts.isObjectLiteralExpression(init)) continue;
    for (const property of init.properties) {
      if (property.name && ts.isIdentifier(property.name)) members.add(property.name.text);
    }
  }
  return members;
}
