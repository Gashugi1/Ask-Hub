import ts from 'typescript';
import { walk } from './ts-source';

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
 * file and across `src/` as a whole.
 *
 * This is what resolves `t(item.labelKey)`: `labelKey` is declared `string` on
 * an interface, so the checker has nothing narrower to offer, but the six
 * literals in `src/lib/admin/guard.ts` are right there in the source.
 *
 * File-scoped first, `src/`-wide only as a fallback, and the order matters:
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

export function scanTranslationKeys(): KeyScan {
  const files = walk('src', /\.tsx?$/);
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

    /** Whether this call's callee is the `t` exported by src/lib/i18n.ts. */
    const isTranslationCall = (call: ts.CallExpression): boolean => {
      if (!ts.isIdentifier(call.expression) || call.expression.text !== 't') return false;
      let symbol = checker.getSymbolAtLocation(call.expression);
      // An imported name is an alias; the declaration that matters is the one
      // it points at. Without this every call site would resolve to its own
      // import statement rather than to the function.
      if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
      const declarations = symbol?.getDeclarations() ?? [];
      // No symbol means the checker could not resolve the identifier at all.
      // Treated as ours so it surfaces as an unresolved call rather than
      // disappearing: a `t(...)` the compiler cannot bind is a defect either
      // way, and silence is the one response that is certainly wrong.
      if (declarations.length === 0) return true;
      return declarations.some((declaration) =>
        relative(declaration.getSourceFile().fileName) === I18N_MODULE,
      );
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
            `under src/, so the possible keys are unknown.`,
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
