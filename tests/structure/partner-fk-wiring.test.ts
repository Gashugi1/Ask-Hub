import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

/**
 * Every server action that writes `resources.partner` must call
 * `assertKnownPartner`.
 *
 * Why this exists, specifically. `resources.partner` is `text NOT NULL`
 * referencing `partners(name)`, and the referential check is the application's
 * own -- Zod validates shape, not membership. The check is implemented in
 * `assertKnownPartner` and that function is unit-tested; the *end-to-end*
 * behaviour is covered too, in `tests/rls/resource-partner-fk.test.ts`. What
 * neither of those pins is the wiring between them.
 *
 * A certifier demonstrated the gap rather than predicting it: deleting the
 * `assertKnownPartner(...)` call from BOTH `createResource` and
 * `updateResource` left the suite at 70 files / 629 tests / 0 failed, because
 * a second layer -- translating Postgres 23503 -- still produced the same
 * user-facing message. Deleting only the translation was equally invisible.
 * The two layers are redundant on purpose, and redundancy is exactly what
 * makes each one individually deletable without a red test. `npm run lint`
 * emitted two unused-symbol warnings and still exited 0; removing the now-dead
 * imports silences even those.
 *
 * So this guard asserts the call site, not the function. It is deliberately
 * shaped like `tests/structure/action-role-checks.test.ts`, which pins
 * `requireRole` for the same reason: a check that is present in the codebase
 * but not reached by the path that needs it is not a check.
 *
 * Matched on the AST, never on the file's text. The repository has been bitten
 * by the other approach twice -- a `server-only` import assertion satisfied by
 * a docstring explaining `import 'server-only'`, and a locale-key guard blind
 * to an aliased import -- so a comment mentioning `assertKnownPartner` must
 * not be able to satisfy this.
 */

const ACTIONS_DIR = 'src/lib/actions';
const GUARD = 'assertKnownPartner';

/** PostgREST's mutating verbs, matching tests/structure/action-modules.ts. */
const MUTATING_VERBS = new Set(['insert', 'update', 'upsert', 'delete']);

interface PartnerWriter {
  file: string;
  name: string;
  callsGuard: boolean;
}

/**
 * An exported async function whose write payload carries `partner`.
 *
 * Not "any function that writes `resources`", which was this guard's first
 * predicate and was wrong: `setResourceStatus` updates `{ status }` and
 * `setResourceFeatured` updates `{ is_featured }`, neither of which touches
 * the FK column, and demanding the check there would be noise that teaches
 * the next reader to widen the exemption list instead of the predicate.
 *
 * A payload counts when it is `toRow(...)` -- the shared builder, which sets
 * `partner` -- or an object literal with a `partner` property, so an action
 * that bypasses the builder is caught too.
 */
function findResourceWriters(): PartnerWriter[] {
  const writers: PartnerWriter[] = [];

  for (const entry of readdirSync(ACTIONS_DIR)) {
    if (!entry.endsWith('.ts')) continue;
    const file = join(ACTIONS_DIR, entry);
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );

    for (const statement of source.statements) {
      if (!ts.isFunctionDeclaration(statement) || !statement.body || !statement.name) continue;
      const exported = statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (!exported) continue;

      let writesPartner = false;
      let callsGuard = false;

      /** Does this argument carry the partner column into the database? */
      const payloadCarriesPartner = (arg: ts.Expression): boolean => {
        if (ts.isCallExpression(arg) && ts.isIdentifier(arg.expression)) {
          return arg.expression.text === 'toRow';
        }
        if (ts.isObjectLiteralExpression(arg)) {
          return arg.properties.some(
            (property) =>
              property.name !== undefined &&
              ts.isIdentifier(property.name) &&
              property.name.text === 'partner',
          );
        }
        return false;
      };

      const walk = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
          if (
            ts.isPropertyAccessExpression(node.expression) &&
            MUTATING_VERBS.has(node.expression.name.text) &&
            node.arguments.some(payloadCarriesPartner)
          ) {
            writesPartner = true;
          }
          // The guard itself, as a call, not as a mention: a comment naming it
          // must not satisfy this.
          if (ts.isIdentifier(node.expression) && node.expression.text === GUARD) {
            callsGuard = true;
          }
        }
        ts.forEachChild(node, walk);
      };
      walk(statement.body);

      if (writesPartner) {
        writers.push({ file, name: statement.name.text, callsGuard });
      }
    }
  }

  return writers;
}

describe('the partner FK check is wired into every path that writes it', () => {
  it('finds the resource-writing actions at all', () => {
    // Without this, renaming src/lib/actions or changing how the client is
    // built would reduce the assertion below to "zero writers had zero
    // problems" and keep it green forever -- the failure mode this whole
    // guard exists to prevent, reproduced in the guard itself.
    const writers = findResourceWriters();
    expect(
      writers.map((w) => w.name).sort(),
      'no exported action was found writing to resources — the guard below would be vacuous',
    ).toEqual(['createResource', 'updateResource']);
  });

  it('calls assertKnownPartner from every action that writes resources', () => {
    const offenders = findResourceWriters()
      .filter((writer) => !writer.callsGuard)
      .map((writer) => `${writer.file}: ${writer.name} writes resources without calling ${GUARD}`);

    expect(
      offenders,
      `an action writes resources.partner without checking the value resolves. That column is ` +
        `text NOT NULL referencing partners(name), and Zod validates shape, not membership, so ` +
        `without this call an unresolvable partner reaches Postgres and surfaces as a raw ` +
        `foreign key violation — the defect fixed in 7b63a43. A second layer translates 23503 ` +
        `into the same message, which is why removing this call alone fails no other test: the ` +
        `layers are redundant by design and each must be pinned separately. Add ` +
        `\`${GUARD}(parsed.partner, await readPartnerNames());\` before the write. Offenders:\n` +
        offenders.join('\n'),
    ).toEqual([]);
  });
});
