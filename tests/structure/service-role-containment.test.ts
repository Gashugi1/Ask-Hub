import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { parseSource, descendants, calleeName, walk } from './ts-source';

/**
 * CLAUDE.md: "`service_role` key is server-only. It must never appear in a
 * client bundle."
 *
 * SP3 gave `createAdminSupabase` its first and only production caller — the
 * Supabase Auth Admin invite in `src/lib/actions/users.ts`, which exists
 * because creating an auth user is a GoTrue API call rather than a table
 * write, so no RLS policy can grant it and there is no public sign-up route to
 * take instead. The moment to pin the caller count is therefore now: a second
 * caller is a design change, not a detail, and this test makes it argue for
 * itself in a diff instead of arriving as an import.
 *
 * What a second caller would actually cost: `service_role` bypasses RLS
 * entirely, so it removes the database's permission model from that write
 * path, and it carries no `auth.uid()`, so the audit trigger records the write
 * as `system` rather than as the person who made it. Both properties are load
 * bearing here — the audit log is the launch deliverable — and neither failure
 * is visible in the UI.
 *
 * Every assertion is `expect(offenders, message).toEqual([])`, per
 * tests/rls/schema-guards.test.ts.
 */

const ADMIN_MODULE = 'src/lib/supabase/admin.ts';

/**
 * The whole production caller list. One entry. This is the assertion, not a
 * configuration knob: changing it is the design change described above.
 */
const APPROVED_CALLERS = ['src/lib/actions/users.ts'];

function sourceFiles(): string[] {
  return walk('src', /\.tsx?$/);
}

/**
 * Files that *call* `createAdminSupabase`, as opposed to naming it. The
 * distinction is not pedantry: `src/lib/actions/users.ts` devotes a paragraph
 * of its header to the function, `src/lib/actions/README.md`-adjacent prose
 * appears in several modules, and a text search cannot tell a warning about
 * the admin client from a use of it. It matters in the other direction too — a
 * grep for the identifier alone would report this very file as a caller.
 */
function callers(): string[] {
  return sourceFiles().filter((file) => {
    if (file === ADMIN_MODULE) return false;
    const source = parseSource(file, readFileSync(file, 'utf8'));
    return descendants(source).some(
      (node) => ts.isCallExpression(node) && calleeName(node) === 'createAdminSupabase',
    );
  });
}

describe('service_role containment', () => {
  it('scans a non-empty source tree', () => {
    expect(sourceFiles().length, 'src/ resolved to no .ts/.tsx files').toBeGreaterThan(30);
  });

  it('has exactly one production caller of createAdminSupabase', () => {
    expect(
      callers(),
      'the service_role client bypasses RLS entirely and carries no auth.uid(), so a write ' +
        'made with it is both unpoliced and attributed to `system` in the audit log. Its only ' +
        'legitimate caller in this product is the Auth Admin invite, because creating an auth ' +
        'user is not a table write; ordinary admin writes run as the caller and are audited by ' +
        'a database trigger (design spec §4.1, src/lib/actions/README.md). If a write is being ' +
        'refused, the fix is a policy or an RPC, not this client. Approved: ' +
        `${APPROVED_CALLERS.join(', ')}`,
    ).toEqual(APPROVED_CALLERS);
  });

  it('never imports the admin client into a client component', () => {
    const offenders = sourceFiles().filter((file) => {
      const code = readFileSync(file, 'utf8');
      return /['"]use client['"]/.test(code) && /supabase\/admin/.test(code);
    });
    expect(
      offenders,
      'a "use client" module references the service_role client, which would put the key in a ' +
        `browser bundle. Move the call into a server action. Offenders: ${offenders.join(', ')}`,
    ).toEqual([]);
  });

  it('names no service-role environment variable with a NEXT_PUBLIC_ prefix', () => {
    const offenders = sourceFiles().filter((file) =>
      /NEXT_PUBLIC_[A-Z_]*SERVICE/.test(readFileSync(file, 'utf8')),
    );
    expect(
      offenders,
      'NEXT_PUBLIC_ is Next.js’s instruction to inline a value into the client bundle. A ' +
        'service-role variable with that prefix ships the key to every visitor, whatever the ' +
        `server-only import guard says. Offenders: ${offenders.join(', ')}`,
    ).toEqual([]);
  });

  it('keeps the admin client behind the server-only import marker', () => {
    // The marker is what turns a client import of this module into a build
    // error rather than a leaked secret. vitest.config.ts aliases `server-only`
    // to the package's own no-op shim so server modules stay testable, which
    // means no test would notice the marker's removal — hence this assertion.
    expect(
      readFileSync(ADMIN_MODULE, 'utf8'),
      `${ADMIN_MODULE} must import 'server-only'; without it a client component importing this ` +
        'module compiles, and the service_role key ships to the browser.',
    ).toMatch(/import ['"]server-only['"]/);
  });
});
