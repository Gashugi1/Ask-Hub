import ts from 'typescript';
import { calleeName, walk } from './ts-source';

/**
 * Every `t()` key `src/` asks for, resolved statically.
 *
 * **Why this guard exists.** `t()` returns the key itself when the lookup
 * misses (see `src/lib/i18n.ts`), which is the right runtime behaviour -- a
 * visible token beats blank space -- but it means a key that was never added
 * to `en.json` ships silently. It happened: `EXPORT_COLUMNS` and the
 * `column.*` block are two lists that must stay in step, and adding a column
 * without its label would have put the literal text `column.partnerTier` in
 * an XLSX header with the whole suite green. Nothing in the repository looked
 * at the two together.
 *
 * **Why the compiler API rather than a regex.** `tests/structure/
 * jsx-literals.ts` sets out the general argument: a pattern over source text
 * cannot tell a call from a mention, so a grep for `t('...')` is satisfied by
 * this very docstring. Here the parser earns its place twice over, because
 * most call sites are not literals at all:
 *
 * - 22 of them are templates -- `` t(`need.${key}`) `` -- where the key is
 *   only knowable from the *type* of the substitution. A `TypeChecker` knows
 *   that `key` is `'compute' | 'training' | ...` and can enumerate all five
 *   real keys; a regex sees `need.${key}` and can check nothing.
 * - three pass a variable (`t(card.key)`, `t(item.labelKey)`,
 *   `t(eligibility.key)`), where the type has widened to `string` and only the
 *   literals assigned to that property can answer the question.
 *
 * Resolving those 25 sites rather than skipping them is the point: they cover
 * `column.*`, `need.*`, `status.*`, `geo.*`, `admin.nav.*` and the role, tier,
 * scope and audit-action families -- the parts of `en.json` most likely to
 * drift, because each one mirrors a list that lives somewhere else.
 *
 * **What it resolves today**, measured on this branch and stated as a
 * snapshot, not as a promise: 441 key-uses across 329 call sites in 55 files,
 * 283 distinct keys, nothing unresolvable. "Key-use" and "call site" are not
 * the same count and the gap is the whole point of the template branch -- one
 * `` t(`need.${key}`) `` is one call site and five key-uses. Only two of these
 * numbers are asserted anywhere: `unresolved` must be empty, and
 * `locale-keys.test.ts` holds a floor under the file count. The rest are here
 * to be re-measured, not trusted.
 *
 * `via: 'type'` is the exception: it resolves zero call sites in `src/`. It is
 * kept, and covered by a fixture in `tests/structure/fixtures/locale-keys/`
 * rather than by anything in the app, because without it a `t(key)` whose
 * parameter is typed as a union of string literals -- the narrowest, most
 * checkable shape a caller could write -- would fall through to `unresolved`
 * and fail the suite. The branch is what keeps the guard from punishing the
 * good case.
 *
 * **Nothing is skipped silently.** A call this module cannot resolve is
 * returned in `unresolved`, and the test fails on a non-empty list. A guard
 * that quietly ignores what it cannot parse is how a guard stops guarding.
 */
export interface KeyUse {
  file: string;
  line: number;
  key: string;
  /** How the key was recovered, so a failure says which mechanism found it. */
  via: 'literal' | 'template' | 'type' | 'property';
}

export interface UnresolvedCall {
  file: string;
  line: number;
  /** Source text of the call's first argument. */
  text: string;
  reason: string;
}

export interface KeyScan {
  uses: KeyUse[];
  unresolved: UnresolvedCall[];
  /** Files that contained at least one call to the i18n `t`. */
  files: string[];
}

const I18N_MODULE = 'src/lib/i18n.ts';

/** The tsconfig the app is built with, so `@/` and `strict` resolve identically. */
function compilerOptions(): ts.CompilerOptions {
  const configPath = ts.findConfigFile('.', ts.sys.fileExists, 'tsconfig.json');
  if (!configPath) throw new Error('tsconfig.json not found');
  const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile);
  if (error) {
    throw new Error(`tsconfig.json unreadable: ${ts.flattenDiagnosticMessageText(error.messageText, ' ')}`);
  }
  return ts.parseJsonConfigFileContent(config, ts.sys, '.').options;
}

/**
 * Every string literal assigned to an object property of the given name, per
 * file and across the scanned tree as a whole.
 *
 * This is what resolves `t(item.labelKey)`: `labelKey` is declared `string` on
 * an interface, so the checker has nothing narrower to offer, but the six
 * literals in `src/lib/admin/guard.ts` are right there in the source.
 *
 * File-scoped first, tree-wide only as a fallback, and the order matters:
 * `key` is used for locale keys in `admin/page.tsx` and `lib/public/geo.ts`
 * and for *field* names ('title', 'timeframe') in `admin/content/page.tsx`.
 * Taking the file's own literals when it has any keeps those apart; the
 * fallback exists for the case where the objects are defined in one module and
 * read in another, which is exactly the sidebar.
 */
function propertyLiterals(sources: readonly ts.SourceFile[]): {
  byFile: Map<string, Map<string, string[]>>;
  byName: Map<string, string[]>;
} {
  const byFile = new Map<string, Map<string, string[]>>();
  const byName = new Map<string, string[]>();

  for (const source of sources) {
    const perFile = new Map<string, string[]>();
    const visit = (node: ts.Node): void => {
      if (
        ts.isPropertyAssignment(node) &&
        (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
        ts.isStringLiteralLike(node.initializer)
      ) {
        const name = node.name.text;
        const value = node.initializer.text;
        perFile.set(name, [...(perFile.get(name) ?? []), value]);
        byName.set(name, [...(byName.get(name) ?? []), value]);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    byFile.set(source.fileName, perFile);
  }

  return { byFile, byName };
}

/**
 * The string values a type can take, or `undefined` when it is not a finite
 * union of string literals. `string` itself returns `undefined` rather than
 * an empty list: "could be anything" and "can be nothing" must not collapse
 * into the same answer, because one of them is a guard that checks nothing.
 */
function literalValues(type: ts.Type): string[] | undefined {
  const parts = type.isUnion() ? type.types : [type];
  const values: string[] = [];
  for (const part of parts) {
    if (part.isStringLiteral()) values.push(part.value);
    else return undefined;
  }
  return values.length > 0 ? values : undefined;
}

/** Path relative to the repository root, for a message a reader can act on. */
function relative(fileName: string): string {
  const cwd = process.cwd();
  return fileName.startsWith(cwd) ? fileName.slice(cwd.length + 1) : fileName;
}

/** Whether a declaration is the `t` function `src/lib/i18n.ts` exports. */
function isI18nT(declaration: ts.Declaration): boolean {
  return (
    ts.isFunctionDeclaration(declaration) &&
    declaration.name?.text === 't' &&
    relative(declaration.getSourceFile().fileName) === I18N_MODULE
  );
}

/**
 * What a call actually calls: the declaration of the signature the checker
 * resolves it to, or `undefined` when it could not bind the callee at all.
 *
 * `getResolvedSignature` rather than `getSymbolAtLocation` on the callee, and
 * the difference is the point. Resolving the *symbol* answers "what does this
 * name refer to here", which needs `getAliasedSymbol` to see through
 * `import { t as translate }` and still stops at the variable declaration for
 * `const translate = t`. Resolving the *signature* answers "what is being
 * called", which reaches i18n.ts through an alias, a namespace import and a
 * local rebinding alike. Both mechanisms were written; the symbol half was
 * then deleted after removing it changed no result in `src/` and failed no
 * fixture -- unexercised resolution logic in a guard is how the guard's
 * behaviour stops matching what its comments say.
 *
 * `undefined` is deliberately distinct from "bound, and not ours": the caller
 * turns only the first into a name-gated fallback.
 */
function calleeDeclaration(
  checker: ts.TypeChecker,
  call: ts.CallExpression,
): ts.Declaration | undefined {
  return checker.getResolvedSignature(call)?.declaration;
}

/**
 * @param root The directory to scan. `src` is the guard; the only other caller
 *   is `locale-keys.test.ts`, which points this at
 *   `tests/structure/fixtures/locale-keys` to assert the scanner still sees
 *   the call shapes it claims to. Those shapes cannot be asserted from `src/`
 *   without writing deliberately-broken code into the app -- and an aliased
 *   import was invisible to this scanner until it was.
 */
export function scanTranslationKeys(root = 'src'): KeyScan {
  const files = walk(root, /\.tsx?$/);
  const program = ts.createProgram(files, compilerOptions());
  const checker = program.getTypeChecker();

  const sources = program
    .getSourceFiles()
    .filter((source) => !source.isDeclarationFile && files.includes(relative(source.fileName)));

  const literals = propertyLiterals(sources);

  const uses: KeyUse[] = [];
  const unresolved: UnresolvedCall[] = [];
  const filesWithCalls = new Set<string>();

  for (const source of sources) {
    const file = relative(source.fileName);
    const perFile = literals.byFile.get(source.fileName) ?? new Map<string, string[]>();

    const lineOf = (node: ts.Node) =>
      source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

    /**
     * Whether this call's callee is the `t` exported by src/lib/i18n.ts.
     *
     * Resolved from what is called, never from what it is called. The gate
     * this replaced (`call.expression.text !== 't'`) resolved the symbol only
     * *after* deciding the callee was spelled `t`, so it prevented false
     * positives and no false negatives at all: a reviewer added
     *
     *     import { t as translate } from '@/lib/i18n';
     *     export function probe() { return translate('no.such.key'); }
     *
     * to `src/` and all seven tests in locale-keys.test.ts passed. An aliased
     * import is a one-line, entirely idiomatic way to make this guard stop
     * seeing a call site, and nothing would have reported it. The shapes now
     * covered are pinned by fixtures in
     * `tests/structure/fixtures/locale-keys/`, including a local helper also
     * named `t` that must NOT be scanned -- resolving the callee has to stay a
     * different thing from matching its name in both directions.
     */
    const isTranslationCall = (call: ts.CallExpression): boolean => {
      const declaration = calleeDeclaration(checker, call);
      // Nothing bound at all: the checker could not resolve the callee. Gated
      // on the name here and only here, so a `t(...)` the compiler cannot bind
      // surfaces as an unresolved call rather than disappearing. Silence is
      // the one response that is certainly wrong.
      if (!declaration) return calleeName(call) === 't';
      return isI18nT(declaration);
    };

    const record = (node: ts.Node, key: string, via: KeyUse['via']) => {
      uses.push({ file, line: lineOf(node), key, via });
    };

    const fail = (node: ts.Node, text: string, reason: string) => {
      unresolved.push({ file, line: lineOf(node), text, reason });
    };

    /** Resolve a call's first argument to the set of keys it can produce. */
    const resolve = (argument: ts.Expression, call: ts.CallExpression): void => {
      if (ts.isStringLiteralLike(argument) && !ts.isTemplateExpression(argument)) {
        record(call, argument.text, 'literal');
        return;
      }

      if (ts.isTemplateExpression(argument)) {
        let prefixes = [argument.head.text];
        for (const span of argument.templateSpans) {
          const values = literalValues(checker.getTypeAtLocation(span.expression));
          if (!values) {
            fail(
              call,
              argument.getText(source),
              `\`${span.expression.getText(source)}\` is typed ` +
                `\`${checker.typeToString(checker.getTypeAtLocation(span.expression))}\`, not a ` +
                `union of string literals, so the key cannot be enumerated. Narrow the type ` +
                `(a \`readonly [...] as const\` or an enum member) or call t() with literals.`,
            );
            return;
          }
          prefixes = prefixes.flatMap((prefix) =>
            values.map((value) => `${prefix}${value}${span.literal.text}`),
          );
        }
        for (const key of prefixes) record(call, key, 'template');
        return;
      }

      const typed = literalValues(checker.getTypeAtLocation(argument));
      if (typed) {
        for (const key of typed) record(call, key, 'type');
        return;
      }

      if (ts.isPropertyAccessExpression(argument)) {
        const name = argument.name.text;
        const values = perFile.get(name) ?? literals.byName.get(name);
        if (values && values.length > 0) {
          for (const key of new Set(values)) record(call, key, 'property');
          return;
        }
        fail(
          call,
          argument.getText(source),
          `no string literal is assigned to a \`${name}\` property in ${file} or anywhere ` +
            `under ${root}/, so the possible keys are unknown.`,
        );
        return;
      }

      fail(
        call,
        argument.getText(source),
        'the argument is neither a literal, a template over string-literal types, nor a ' +
          'property whose literals can be found. Nothing static can be checked about it.',
      );
    };

    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && isTranslationCall(node)) {
        filesWithCalls.add(file);
        const argument = node.arguments[0];
        if (!argument) fail(node, node.getText(source), 't() was called with no key at all');
        else resolve(argument, node);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  return { uses, unresolved, files: [...filesWithCalls].sort() };
}
