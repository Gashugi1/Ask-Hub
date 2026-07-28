import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Pure filesystem, no Supabase stack required — this is the DB-free layer
// of Task 11b's guard suite (tests/rls/schema-guards.test.ts is the other
// half, and it can only run against a database that has actually applied
// these migrations). This layer proves every migration is well-formed
// regardless of which database is reachable, and it runs in CI even
// without a Supabase stack at all.
//
// supabase/migrations/README.md's canonical shape, restated here as the
// four literal lines this test asserts every `create table public.X`
// is followed by, somewhere in the same file:
//
//   alter table public.X enable row level security;
//   revoke all on table public.X from anon, authenticated;
//   grant select, insert, update, delete on public.X to authenticated;
//   grant all on public.X to service_role;
//
// Each line is checked with the table name substituted in (stronger than
// a bare, table-agnostic "enable row level security" substring check):
// a file that enables RLS on table A but only grants for table B would
// otherwise pass a check that didn't tie every line back to the same X,
// and 0006_site.sql alone defines six tables in one file, so an
// un-scoped check could not tell them apart.
const MIGRATIONS_DIR = join('supabase', 'migrations');

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

function tablesCreatedIn(sql: string): string[] {
  const matches = sql.matchAll(/create table public\.(\w+)/g);
  return [...matches].map((m) => m[1]!);
}

function requiredLines(table: string): string[] {
  return [
    `alter table public.${table} enable row level security;`,
    `revoke all on table public.${table} from anon, authenticated;`,
    `grant select, insert, update, delete on public.${table} to authenticated;`,
    `grant all on public.${table} to service_role;`,
  ];
}

describe('every migration table follows supabase/migrations/README.md\'s grants shape', () => {
  const files = migrationFiles();

  it('found at least one migration file to check — otherwise this test is vacuous', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  const offenders: string[] = [];
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    for (const table of tablesCreatedIn(sql)) {
      for (const line of requiredLines(table)) {
        if (!sql.includes(line)) {
          offenders.push(`${file}: missing "${line}" for table public.${table}`);
        }
      }
    }
  }

  it('every created table gets RLS enabled, the Dxtm-residue revoke, the authenticated grant, and the service_role grant', () => {
    expect(
      offenders,
      [
        offenders.length ? offenders.map((o) => `  - ${o}`).join('\n') : '  (no offenders)',
        'RULE: supabase/migrations/README.md: "Every table migration must therefore follow this shape" — the four-line block (enable RLS, revoke the Dxtm residue from anon/authenticated, grant the four DML verbs to authenticated, grant all to service_role).',
        'WHY: Enabling RLS alone grants nothing, and a freshly created table\'s default residue (TRUNCATE, REFERENCES, TRIGGER, MAINTAIN to authenticated) is not governed by any RLS policy — without the explicit revoke/grant pair, every policy on the table is either unreachable or the table remains truncatable by a role with no write policy at all.',
        'FIX: Add the missing line(s), verbatim, to the migration file named above, immediately after `create table public.<X>`.',
        'EXCEPTION: There is no allow-list for this invariant. Do not add one.',
      ].join('\n'),
    ).toEqual([]);
  });

  it('found at least one `create table public.X` across all migrations — otherwise the scan above is vacuous', () => {
    const allTables = files.flatMap((file) =>
      tablesCreatedIn(readFileSync(join(MIGRATIONS_DIR, file), 'utf8')),
    );
    expect(allTables.length).toBeGreaterThan(0);
  });
});
