import { describe, it, expect, beforeAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  anonClient,
  roleClient,
  serviceClient,
  ensureTestUsers,
  type Role,
} from '../helpers/clients';
import { fixtureStamp } from '../helpers/fixtures';

// ---------------------------------------------------------------------
// Per-role RLS coverage for the seven tables that had none.
//
// An audit of this repository's RLS suites found seven RLS-enabled tables
// with no per-role test at all:
//
//   partners        appeared only as FK fixture support for resources --
//                   not even an anonymous-denial test
//   partnerships    anonymous denial only (tests/rls/community.test.ts)
//   subscribers     anonymous denial only
//   digest_sends    anonymous denial only
//   programmes      viewer-write denial only (tests/rls/site.test.ts, and
//                   one editor-UPDATE test in admin-actions-content.test.ts)
//   impact_stories  the same two, and nothing else
//   updates_log     touched by zero tests of any kind -- it appeared in the
//                   whole test tree exactly once, as a string literal in
//                   schema-guards.test.ts's @sensitive floor list
//
// This file asserts the full grid for each: every role against every verb,
// on both sides of the line. It is written as one declarative matrix rather
// than seven hand-written suites because the interesting property is the
// grid itself -- a missing cell is precisely the defect that let seven
// tables ship with partial coverage, and a hand-written suite hides missing
// cells by construction.
//
// Three mechanics decide how each cell is asserted, and they are NOT
// interchangeable. All three were confirmed directly against this stack
// (supabase-js against local PostgREST) rather than assumed:
//
//   1. anon holds no grant at all on any of these base tables (the
//      `revoke all ... from anon, authenticated` in every table's
//      migration, guarded schema-wide by G2). It is therefore stopped one
//      layer BELOW row-level security, and every verb -- including UPDATE
//      and DELETE -- fails with SQLSTATE 42501, "permission denied for
//      table <x>". This is the only assertion that can catch a leaked
//      grant: a row-count assertion cannot, because RLS would still empty
//      the result of a leaked SELECT and the test would stay green.
//
//   2. `authenticated` DOES hold all four verbs at the grant layer on every
//      one of these tables (required by G4), so a role denied by RLS is
//      denied by a *policy*, not a grant -- and the two failure shapes
//      differ. An INSERT whose WITH CHECK fails raises 42501 ("new row
//      violates row-level security policy"), so it is asserted by SQLSTATE.
//      An UPDATE or DELETE whose USING clause matches no row does NOT
//      error: PostgREST returns success with zero rows affected,
//      indistinguishable from a WHERE clause that matched nothing. So a
//      denied UPDATE/DELETE is asserted two ways -- zero rows returned by
//      the role's own `.select()`, AND a service_role read-back proving the
//      row is byte-for-byte unchanged (or still present, for DELETE).
//      Neither alone is sufficient: the first passes vacuously if the
//      filter is wrong, the second passes if the write silently no-oped for
//      an unrelated reason.
//
//   3. A permitted read is asserted against the exact set of ids just
//      seeded, never `error === null`. Through a table-level SELECT grant,
//      an RLS policy denial surfaces as `data: []` with `error: null` --
//      identical to an empty table. That is how
//      engagement_events_select_authenticated could be dropped outright
//      with its whole suite green (tests/rls/events.test.ts:82). The seed
//      itself carries a length assertion so the comparison cannot go
//      vacuous by seeding nothing.
//
// Every fixture name carries a `fixtureStamp()` so tests/helpers/fixtures.ts
// reclaims it after the run -- including the three tables added to that
// sweep alongside this file (programmes, impact_stories, updates_log),
// which it did not previously cover. programmes and impact_stories feed
// programmes_public and impact_stories_public, both anon-readable, so a
// leaked fixture there is not untidiness: it is invented content on a
// public UN programme page.
// ---------------------------------------------------------------------

type Verb = 'select' | 'insert' | 'update' | 'delete';

const ALL_ROLES = ['admin', 'editor', 'viewer'] as const satisfies readonly Role[];
const STAFF = ['admin', 'editor'] as const satisfies readonly Role[];
const NOBODY: readonly Role[] = [];

interface TableSpec {
  /** Base table under test. */
  table: string;
  /** Primary key column. `partners` is keyed by `name`, not `id`. */
  key: string;
  /**
   * The column that carries the fixture stamp, and that
   * tests/helpers/fixtures.ts sweeps on. Deliberately never the column
   * `mutate` targets: an UPDATE test that overwrote the stamp would make
   * the row permanently unsweepable.
   */
  labelColumn: string;
  labelFor: (token: string) => string;
  /** A valid, complete row -- one that genuinely inserts when permitted. */
  row: (label: string) => Record<string, unknown>;
  /** The column the UPDATE probes move, and the value on each side. */
  mutate: { column: string; before: string; after: string };
  /** Which roles each verb admits. */
  allow: Record<Verb, readonly Role[]>;
  /** The policy that admits them, named in every failure message. */
  policy: Record<Verb, string | null>;
  /** Where the policies live, for the remediation half of a failure. */
  migration: string;
}

const SPECS: readonly TableSpec[] = [
  {
    table: 'partners',
    key: 'name',
    labelColumn: 'name',
    labelFor: (token) => `Role matrix partner ${token}`,
    row: (label) => ({ name: label, website_url: 'https://example.org/matrix-before' }),
    mutate: {
      column: 'website_url',
      before: 'https://example.org/matrix-before',
      after: 'https://example.org/matrix-after',
    },
    allow: { select: ALL_ROLES, insert: STAFF, update: STAFF, delete: STAFF },
    policy: {
      select: 'partners_select_authenticated',
      insert: 'partners_insert_staff',
      update: 'partners_update_staff',
      delete: 'partners_delete_staff',
    },
    migration: 'supabase/migrations/0014_partner_logos.sql',
  },
  {
    table: 'partnerships',
    key: 'id',
    labelColumn: 'organisation',
    labelFor: (token) => `Role matrix org ${token}`,
    row: (label) => ({ organisation: label, summary: 'Role matrix baseline summary.' }),
    mutate: {
      column: 'summary',
      before: 'Role matrix baseline summary.',
      after: 'Role matrix mutated summary.',
    },
    allow: { select: ALL_ROLES, insert: STAFF, update: STAFF, delete: STAFF },
    policy: {
      select: 'partnerships_select_authenticated',
      insert: 'partnerships_insert_staff',
      update: 'partnerships_update_staff',
      delete: 'partnerships_delete_staff',
    },
    migration: 'supabase/migrations/0005_community.sql',
  },
  {
    table: 'subscribers',
    key: 'id',
    labelColumn: 'email',
    // An email-shaped label, because the column is citext with a unique
    // index -- the stamp is what keeps repeated runs from colliding on it,
    // and is also what the sweep matches.
    labelFor: (token) => `role-matrix-${token}@askhub.test`,
    row: (label) => ({
      email: label,
      categories: ['training'],
      consent_text_version: 'v1',
      confirm_token: `confirm-${label}`,
      unsubscribe_token: `unsub-${label}`,
      country: 'Italy',
    }),
    mutate: { column: 'country', before: 'Italy', after: 'Kenya' },
    allow: { select: ALL_ROLES, insert: STAFF, update: STAFF, delete: STAFF },
    policy: {
      select: 'subscribers_select_authenticated',
      insert: 'subscribers_insert_staff',
      update: 'subscribers_update_staff',
      // PRD 14.8 requires a deletion path that genuinely removes the record,
      // which is why this one table's DELETE policy exists at all.
      delete: 'subscribers_delete_staff',
    },
    migration: 'supabase/migrations/0005_community.sql',
  },
  {
    table: 'digest_sends',
    key: 'id',
    labelColumn: 'subject',
    labelFor: (token) => `Role matrix digest ${token}`,
    row: (label) => ({ subject: label, notes: 'Role matrix baseline note.' }),
    mutate: {
      column: 'notes',
      before: 'Role matrix baseline note.',
      after: 'Role matrix mutated note.',
    },
    // No UPDATE or DELETE policy for ANY role, deliberately: 0005_community
    // .sql keeps a set_updated_at trigger on this table but states in a
    // comment that it "is presently unreachable from any authenticated role
    // -- do not read its presence as proof an update path already exists for
    // editor/viewer/admin". A send log that staff can rewrite is not a log.
    allow: { select: ALL_ROLES, insert: STAFF, update: NOBODY, delete: NOBODY },
    policy: {
      select: 'digest_sends_select_authenticated',
      insert: 'digest_sends_insert_staff',
      update: null,
      delete: null,
    },
    migration: 'supabase/migrations/0005_community.sql',
  },
  {
    table: 'programmes',
    key: 'id',
    labelColumn: 'title',
    labelFor: (token) => `Role matrix programme ${token}`,
    row: (label) => ({
      title: label,
      timeframe: '2026',
      description: 'Role matrix baseline description.',
    }),
    mutate: { column: 'timeframe', before: '2026', after: '2027' },
    // One `for all` policy covers insert, update AND delete here, so all
    // three cells share programmes_write_staff as their offender.
    allow: { select: ALL_ROLES, insert: STAFF, update: STAFF, delete: STAFF },
    policy: {
      select: 'programmes_select_authenticated',
      insert: 'programmes_write_staff',
      update: 'programmes_write_staff',
      delete: 'programmes_write_staff',
    },
    migration: 'supabase/migrations/0006_site.sql',
  },
  {
    table: 'impact_stories',
    key: 'id',
    labelColumn: 'organisation',
    labelFor: (token) => `Role matrix story ${token}`,
    row: (label) => ({
      organisation: label,
      country: 'Democratic Republic of the Congo',
      description: 'Role matrix baseline description.',
    }),
    mutate: {
      column: 'description',
      before: 'Role matrix baseline description.',
      after: 'Role matrix mutated description.',
    },
    allow: { select: ALL_ROLES, insert: STAFF, update: STAFF, delete: STAFF },
    policy: {
      select: 'impact_stories_select_authenticated',
      insert: 'impact_stories_write_staff',
      update: 'impact_stories_write_staff',
      delete: 'impact_stories_write_staff',
    },
    migration: 'supabase/migrations/0006_site.sql',
  },
  {
    table: 'updates_log',
    key: 'id',
    labelColumn: 'text',
    labelFor: (token) => `Role matrix update note ${token}`,
    row: (label) => ({ text: label, actor_name: 'Role matrix baseline actor' }),
    // actor_name, not text: `text` carries the stamp the sweep matches on.
    mutate: {
      column: 'actor_name',
      before: 'Role matrix baseline actor',
      after: 'Role matrix mutated actor',
    },
    // Append-only for every authenticated role, same shape as digest_sends
    // and for the same stated reason in 0007_logs.sql.
    allow: { select: ALL_ROLES, insert: STAFF, update: NOBODY, delete: NOBODY },
    policy: {
      select: 'updates_log_select_authenticated',
      insert: 'updates_log_insert_staff',
      update: null,
      delete: null,
    },
    migration: 'supabase/migrations/0007_logs.sql',
  },
];

// One signed-in client per role for the whole file. Signing in is a bcrypt
// verification per call, and this file would otherwise perform 100+ of them;
// the clients are stateless apart from their session, so sharing is correct
// rather than merely faster.
const clients = new Map<Role, SupabaseClient>();
async function client(role: Role): Promise<SupabaseClient> {
  const existing = clients.get(role);
  if (existing) return existing;
  const created = await roleClient(role);
  clients.set(role, created);
  return created;
}

// A monotonic suffix on top of the millisecond stamp: two labels minted in
// the same millisecond would otherwise collide on subscribers.email, which
// is uniquely indexed. The 13-digit stamp is still present and still
// delimited, so the sweep's pattern still matches.
let sequence = 0;
function token(): string {
  sequence += 1;
  return `${fixtureStamp()}-${sequence}`;
}

/**
 * Pull the primary-key column out of a PostgREST result.
 *
 * supabase-js types a `select()` whose column list is not a literal as
 * possibly yielding a per-row parse error, so the rows are not directly
 * indexable -- the same reason tests/helpers/fixtures.ts casts through
 * `unknown`. The shape is known here (the column is `spec.key`, a literal in
 * SPECS above), and the final type guard drops anything that is not a string
 * rather than trusting the cast blindly. Dropping rather than throwing is
 * safe because every assertion downstream compares the result against a
 * known set of seeded keys, so a dropped row shows up as a mismatch.
 */
function keysOf(data: unknown, key: string): string[] {
  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  return rows.map((row) => row[key]).filter((value): value is string => typeof value === 'string');
}

/** Seed `count` rows through service_role, returning their primary keys. */
async function seed(svc: SupabaseClient, spec: TableSpec, count: number): Promise<string[]> {
  const rows = Array.from({ length: count }, () => spec.row(spec.labelFor(token())));
  const { data, error } = await svc.from(spec.table).insert(rows).select(spec.key);
  expect(error, `could not seed ${spec.table}: ${error?.message}`).toBeNull();
  const keys = keysOf(data, spec.key).sort();
  // Guards every comparison below against going vacuous: N seeded rows
  // compared against N returned rows proves nothing if N is zero.
  expect(keys, `the ${spec.table} seed itself inserted no rows`).toHaveLength(count);
  return keys;
}

/** Read one seeded row back through service_role, RLS bypassed. */
async function readBack(
  svc: SupabaseClient,
  spec: TableSpec,
  keyValue: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await svc
    .from(spec.table)
    .select(`${spec.key},${spec.mutate.column}`)
    .eq(spec.key, keyValue)
    .maybeSingle();
  expect(error, `service_role read-back of ${spec.table} failed: ${error?.message}`).toBeNull();
  return (data ?? null) as Record<string, unknown> | null;
}

function denialNote(spec: TableSpec, verb: Verb): string {
  return spec.policy[verb] === null
    ? `no role holds a ${verb.toUpperCase()} policy on public.${spec.table} at all — the table is append-only by design (${spec.migration})`
    : `policy ${spec.policy[verb]} (${spec.migration}) must admit only {${spec.allow[verb].join(', ')}}`;
}

/**
 * The suspect list for a write that should have succeeded and did not.
 *
 * Two policies, not one. Postgres requires SELECT privilege on any row an
 * UPDATE or DELETE *references* — which a `where` clause always does — on
 * top of that command's own USING clause. Confirmed directly against this
 * database by dropping partners_select_authenticated alone: an admin UPDATE
 * filtered by primary key then changed nothing at all, with no error, even
 * though partners_update_staff was untouched. So a failure here names both
 * candidates rather than sending a reader to rewrite a write policy that was
 * never the problem.
 */
function writeSuspects(spec: TableSpec, verb: 'update' | 'delete'): string {
  return (
    `${denialNote(spec, verb)}. If ${spec.policy[verb]} is intact, check ` +
    `${spec.policy.select} too: Postgres also requires SELECT on the rows a filtered ` +
    `${verb.toUpperCase()} references, so losing the read policy silently disables both.`
  );
}

for (const spec of SPECS) {
  describe(`${spec.table} — per-role RLS`, () => {
    beforeAll(async () => {
      await ensureTestUsers();
    });

    it('is unreachable anonymously for all four verbs, each denied with SQLSTATE 42501', async () => {
      const svc = serviceClient();
      // Seed first, so an unguarded anonymous read would genuinely have
      // something to return. Without a row present, a zero-length assertion
      // passes even against a table anon can read in full.
      const [key] = await seed(svc, spec, 1);

      const anon = anonClient();
      const attempts: Array<[Verb, { data: unknown; error: { code?: string; message: string } | null }]> = [
        ['select', await anon.from(spec.table).select(spec.key).eq(spec.key, key!)],
        ['insert', await anon.from(spec.table).insert(spec.row(spec.labelFor(token())) as never)],
        [
          'update',
          await anon
            .from(spec.table)
            .update({ [spec.mutate.column]: spec.mutate.after } as never)
            .eq(spec.key, key!),
        ],
        ['delete', await anon.from(spec.table).delete().eq(spec.key, key!)],
      ];

      for (const [verb, result] of attempts) {
        expect(
          (result.data ?? []) as unknown[],
          `anon ${verb} on ${spec.table} returned rows`,
        ).toHaveLength(0);
        expect(
          result.error?.code,
          `anon ${verb} on public.${spec.table} ${
            result.error
              ? `failed with SQLSTATE ${result.error.code} ("${result.error.message}")`
              : 'returned no error at all'
          }, expected 42501 (permission denied for table). anon must hold NO grant on this base ` +
            `table — reads reach the public site only through a *_public view. A row-count ` +
            `assertion cannot substitute for this: a leaked grant would still be emptied by RLS ` +
            `and read as an empty table. Check the revoke/grant pair in ${spec.migration}.`,
        ).toBe('42501');
      }

      // And nothing anon attempted actually landed.
      const survivor = await readBack(svc, spec, key!);
      expect(survivor, `anon deleted a row from ${spec.table}`).not.toBeNull();
      expect(
        survivor![spec.mutate.column],
        `anon changed ${spec.table}.${spec.mutate.column}`,
      ).toBe(spec.mutate.before);
    });

    it(`is readable by ${spec.allow.select.join(', ')} and returns exactly the seeded rows`, async () => {
      const svc = serviceClient();
      const seeded = await seed(svc, spec, 3);

      for (const role of ALL_ROLES) {
        const permitted = spec.allow.select.includes(role);
        const { data, error } = await (await client(role))
          .from(spec.table)
          .select(spec.key)
          .in(spec.key, seeded);
        const seen = keysOf(data, spec.key).sort();

        if (permitted) {
          expect(error, `${role} could not read ${spec.table}: ${error?.message}`).toBeNull();
          expect(
            seen,
            `${role} saw ${seen.length} of the ${seeded.length} ${spec.table} rows just seeded. ` +
              `An empty result is exactly what an RLS denial looks like through a table-level ` +
              `SELECT grant — it is NOT proof the table is empty, and asserting only ` +
              `error === null would pass here with the policy dropped entirely. ` +
              `${denialNote(spec, 'select')}.`,
          ).toEqual(seeded);
        } else {
          expect(
            seen,
            `${role} read ${seen.length} rows from ${spec.table} but holds no SELECT policy`,
          ).toEqual([]);
        }
      }
    });

    it(`accepts an insert from ${spec.allow.insert.join(', ') || 'no role'}, and refuses one from every other role with 42501`, async () => {
      const svc = serviceClient();

      for (const role of ALL_ROLES) {
        const permitted = spec.allow.insert.includes(role);
        const label = spec.labelFor(token());
        const { error } = await (await client(role))
          .from(spec.table)
          .insert(spec.row(label) as never);

        const { data: landed, error: readError } = await svc
          .from(spec.table)
          .select(spec.labelColumn)
          .eq(spec.labelColumn, label);
        expect(readError, `service_role read-back failed: ${readError?.message}`).toBeNull();

        if (permitted) {
          expect(
            error,
            `${role} could not insert into ${spec.table}: ${error?.message}. ` +
              `${denialNote(spec, 'insert')}.`,
          ).toBeNull();
          // The null error above is already conclusive for INSERT (an RLS
          // refusal raises 42501, it does not silently no-op), but the
          // read-back also proves the payload was complete rather than
          // accepted-and-discarded by some later filter.
          expect(
            (landed ?? []) as unknown[],
            `${role}'s insert into ${spec.table} reported success but no row exists`,
          ).toHaveLength(1);
        } else {
          expect(
            error?.code,
            `${role} inserted into public.${spec.table} — ${
              error ? `error was SQLSTATE ${error.code} ("${error.message}")` : 'no error at all'
            }, expected 42501 (new row violates row-level security policy). ` +
              `CLAUDE.md: "viewer role has no write policy on any table." ` +
              `${denialNote(spec, 'insert')}.`,
          ).toBe('42501');
          expect(
            (landed ?? []) as unknown[],
            `${role} is denied INSERT on ${spec.table} yet a row it sent exists`,
          ).toHaveLength(0);
        }
      }
    });

    it(`lets ${spec.allow.update.join(', ') || 'no role'} update a row, and leaves it byte-for-byte unchanged for every other role`, async () => {
      const svc = serviceClient();

      for (const role of ALL_ROLES) {
        const permitted = spec.allow.update.includes(role);
        // A fresh row per role, so one role's successful write cannot make
        // the next role's denial look like a success (or vice versa).
        const [key] = await seed(svc, spec, 1);
        const { data, error } = await (await client(role))
          .from(spec.table)
          .update({ [spec.mutate.column]: spec.mutate.after } as never)
          .eq(spec.key, key!)
          .select(spec.key);
        const touched = keysOf(data, spec.key);
        const after = await readBack(svc, spec, key!);

        if (permitted) {
          expect(
            error,
            `${role} could not update ${spec.table}: ${error?.message}. ${writeSuspects(spec, 'update')}`,
          ).toBeNull();
          expect(
            touched,
            `${role}'s update of ${spec.table} reported success but changed zero rows — that is ` +
              `what an RLS USING denial looks like on UPDATE, since PostgREST returns success ` +
              `with no error when the policy hides every candidate row. ${writeSuspects(spec, 'update')}`,
          ).toEqual([key]);
          expect(after![spec.mutate.column], `${spec.table}.${spec.mutate.column} did not change`).toBe(
            spec.mutate.after,
          );
        } else {
          // No SQLSTATE is available on this side and none is asserted: an
          // UPDATE whose USING clause matches no row is a zero-row success,
          // byte-identical to a WHERE clause that matched nothing. Both
          // assertions below are needed — the first catches the write being
          // accepted, the second catches it being accepted through some path
          // this query shape does not see.
          expect(
            touched,
            `${role} updated ${touched.length} row(s) in ${spec.table}. ${denialNote(spec, 'update')}.`,
          ).toEqual([]);
          expect(
            after![spec.mutate.column],
            `${role} changed ${spec.table}.${spec.mutate.column} despite holding no UPDATE ` +
              `policy. ${denialNote(spec, 'update')}.`,
          ).toBe(spec.mutate.before);
        }
      }
    });

    it(`lets ${spec.allow.delete.join(', ') || 'no role'} delete a row, and leaves it in place for every other role`, async () => {
      const svc = serviceClient();

      for (const role of ALL_ROLES) {
        const permitted = spec.allow.delete.includes(role);
        const [key] = await seed(svc, spec, 1);
        const { data, error } = await (await client(role))
          .from(spec.table)
          .delete()
          .eq(spec.key, key!)
          .select(spec.key);
        const removed = keysOf(data, spec.key);
        const after = await readBack(svc, spec, key!);

        if (permitted) {
          expect(
            error,
            `${role} could not delete from ${spec.table}: ${error?.message}. ${writeSuspects(spec, 'delete')}`,
          ).toBeNull();
          expect(
            removed,
            `${role}'s delete on ${spec.table} reported success but removed zero rows — the same ` +
              `silent shape an RLS USING denial takes on DELETE. ${writeSuspects(spec, 'delete')}`,
          ).toEqual([key]);
          expect(after, `${spec.table} row survived a permitted delete`).toBeNull();
        } else {
          expect(
            removed,
            `${role} deleted ${removed.length} row(s) from ${spec.table}. ${denialNote(spec, 'delete')}.`,
          ).toEqual([]);
          expect(
            after,
            `${role} deleted a row from ${spec.table} despite holding no DELETE policy. ` +
              `${denialNote(spec, 'delete')}.`,
          ).not.toBeNull();
        }
      }
    });
  });
}
