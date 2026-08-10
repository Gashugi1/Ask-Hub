import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { RemoteDatabaseError } from '../helpers/loopback';

/**
 * Nothing in the test suite may reach a database that is not on this machine.
 *
 * This became load-bearing rather than theoretical when a real cloud project
 * (`askhub-staging`) was created. The suite writes with the `service_role`
 * key, which bypasses RLS entirely, so a run pointed at that project would
 * insert, update and delete against it directly -- and the RLS suites would do
 * so hundreds of times in one run.
 *
 * Two holes existed before this file, both found while preparing that
 * deployment:
 *
 *  1. `tests/helpers/clients.ts` built every client, including the
 *     service_role one, straight from `process.env.SUPABASE_URL` with no
 *     check.
 *  2. `tests/helpers/global-setup.ts` caught the sweep's refusal and only
 *     `console.warn`ed it, so a remote `.env.test` produced one warning above
 *     a green summary and then ran the entire suite against that target.
 *
 * `vitest.config.ts`'s `override: true` stops a shell variable shadowing
 * `.env.test`, which is a real protection and unaffected. What it never
 * covered is the contents of `.env.test` itself.
 */

const CLIENTS_MODULE = 'tests/helpers/clients.ts';

describe('globalSetup refuses a remote target', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('aborts the run rather than warning when the target is not local', async () => {
    // The whole point: this must reject, so vitest never collects a test file.
    const { setup } = await import('../helpers/global-setup');
    vi.stubEnv('SUPABASE_URL', 'https://rfqtbgpfrvpkmmmjokba.supabase.co');
    await expect(setup()).rejects.toBeInstanceOf(RemoteDatabaseError);
    await expect(setup()).rejects.toThrow(/non-loopback host rfqtbgpfrvpkmmmjokba\.supabase\.co/);
  });

  it('still warns and continues for an ordinary housekeeping failure', async () => {
    // The distinction matters. Housekeeping that cannot run must not turn a
    // green suite red -- an unreachable local stack fails the DB suites with a
    // far clearer message than this hook could give. Only "wrong database" is
    // fatal.
    const { setup } = await import('../helpers/global-setup');
    vi.stubEnv('SUPABASE_URL', 'not-a-url');
    await expect(setup()).resolves.toBeUndefined();
  });
});

describe('no suite can build its own client around the guard', () => {
  it('constructs Supabase clients only inside tests/helpers/clients.ts', () => {
    // Matched on the AST, not on file text: a comment naming createClient --
    // and two of them now exist, explaining why those files stopped calling it
    // -- must not register as a call.
    const offenders: string[] = [];

    const walkDir = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
          walkDir(path);
          continue;
        }
        if (!path.endsWith('.ts') && !path.endsWith('.tsx')) continue;
        if (path === CLIENTS_MODULE) continue;

        const source = ts.createSourceFile(
          path,
          readFileSync(path, 'utf8'),
          ts.ScriptTarget.Latest,
          true,
        );
        const visit = (node: ts.Node): void => {
          if (
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'createClient'
          ) {
            const { line } = source.getLineAndCharacterOfPosition(node.getStart());
            offenders.push(`${path}:${line + 1}`);
          }
          ts.forEachChild(node, visit);
        };
        visit(source);
      }
    };
    walkDir('tests');

    expect(
      offenders,
      `a test builds a Supabase client outside ${CLIENTS_MODULE}, which is the only module that ` +
        `asserts a loopback target before constructing one. Building from process.env directly ` +
        `steps around that check, and these clients carry the service_role key. Use anonClient(), ` +
        `serviceClient() or roleClient() from ${CLIENTS_MODULE}. Offenders:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('asserts a loopback target at module scope in clients.ts', () => {
    // At module scope, not inside a factory: the assertion must run on import,
    // before any caller can reach a client. A call nested inside anonClient()
    // would still leave serviceClient() reachable if it were ever refactored.
    const source = ts.createSourceFile(
      CLIENTS_MODULE,
      readFileSync(CLIENTS_MODULE, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const atModuleScope = source.statements.some(
      (statement) =>
        ts.isExpressionStatement(statement) &&
        ts.isCallExpression(statement.expression) &&
        ts.isIdentifier(statement.expression.expression) &&
        statement.expression.expression.text === 'assertLoopbackTarget',
    );

    expect(
      atModuleScope,
      `${CLIENTS_MODULE} must call assertLoopbackTarget() at module scope, so importing it is ` +
        `enough to refuse a remote target. Every DB suite reaches Postgres through this module.`,
    ).toBe(true);
  });
});
