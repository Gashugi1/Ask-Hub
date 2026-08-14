import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { serviceClient } from '../helpers/clients';
import {
  cleanupFixtures,
  assertLoopbackTarget,
  isFixtureValue,
  fixtureStamp,
} from '../helpers/fixtures';

/**
 * Tests for the fixture sweep itself.
 *
 * This is the most destructive automation in the repository: it deletes rows
 * across eleven tables using the `service_role` key, which bypasses RLS. Until
 * now the only thing tested was `isFixtureValue`, a pure predicate -- the
 * deletion, the target it deletes from, and the rows it must NOT touch were
 * all unexercised.
 *
 * A real partner used as the preservation control, rather than one this file
 * inserts: a row this test created would prove only that the sweep spares its
 * own fixtures, which is not the property that matters. `African Development
 * Bank` comes from `scripts/seed-data.ts` and is exactly the kind of row a
 * false positive would destroy.
 *
 * Deletion is exercised for five of the eleven tables the sweep touches:
 * `partners` and `resources` below, and `programmes`, `impact_stories` and
 * `updates_log` in the block after them. The other six -- engagement_events,
 * submissions, partnerships, digest_sends, contact_messages, subscribers --
 * are still covered only by `isFixtureValue`, the predicate, not by an
 * end-to-end delete. Stated so nobody reads this file as proving the whole
 * sweep works.
 */
const REAL_PARTNER = 'African Development Bank';
const STABLE_FIXTURES = ['Test Partner', 'Public View Partner'] as const;

describe('assertLoopbackTarget', () => {
  it('accepts every loopback spelling', () => {
    for (const url of [
      'http://127.0.0.1:54321',
      'http://localhost:54321',
      'http://[::1]:54321',
    ]) {
      expect(() => assertLoopbackTarget(url), url).not.toThrow();
    }
  });

  it('refuses a remote host, naming it', () => {
    // The exact scenario a reviewer demonstrated: an exported SUPABASE_URL
    // shadowing .env.test, and the sweep dutifully targeting it.
    //
    // "run against", not "delete rows from": the guard moved to
    // tests/helpers/loopback.ts and now also gates every client in
    // clients.ts, so its refusal is no longer only about deletion. The
    // assertion still pins that the host is named, which is the part that
    // makes the failure actionable.
    expect(() => assertLoopbackTarget('https://abcdefgh.supabase.co')).toThrow(
      /refusing to run against non-loopback host abcdefgh\.supabase\.co/,
    );
  });

  it('refuses a host that merely contains a loopback string', () => {
    // Substring matching would accept these; hostname comparison does not.
    for (const url of [
      'https://localhost.evil.example',
      'https://127.0.0.1.evil.example',
      'https://not-localhost.supabase.co',
    ]) {
      expect(() => assertLoopbackTarget(url), url).toThrow(/non-loopback host/);
    }
  });

  it('refuses an unset or unparseable target rather than guessing', () => {
    // Note the shape: passing `undefined` explicitly triggers the default
    // parameter and reads the (valid, loopback) environment, so the unset case
    // has to be exercised by emptying the environment rather than by passing
    // undefined. Discovered by this test failing when it was written the
    // obvious way.
    vi.stubEnv('SUPABASE_URL', '');
    expect(() => assertLoopbackTarget()).toThrow(/SUPABASE_URL is not set/);
    vi.unstubAllEnvs();

    expect(() => assertLoopbackTarget('')).toThrow(/SUPABASE_URL is not set/);
    expect(() => assertLoopbackTarget('not-a-url')).toThrow(/not a valid URL/);
  });

  it('offers no confirmation escape hatch', () => {
    // scripts/seed.ts accepts SEED_CONFIRM_REMOTE=1 because seeding a remote
    // database is a real intention. Sweeping one from a test run never is, so
    // no environment variable may unlock this.
    vi.stubEnv('SEED_CONFIRM_REMOTE', '1');
    vi.stubEnv('CONFIRM_REMOTE', '1');
    expect(() => assertLoopbackTarget('https://abcdefgh.supabase.co')).toThrow(
      /non-loopback host/,
    );
  });
});

describe('cleanupFixtures target guard', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('throws before touching anything when SUPABASE_URL is remote', async () => {
    // Proves the guard is wired into the real entry point, not merely
    // exported. It throws before any client is constructed, so no request is
    // ever issued at the remote host.
    vi.stubEnv('SUPABASE_URL', 'https://abcdefgh.supabase.co');
    await expect(cleanupFixtures()).rejects.toThrow(/non-loopback host/);
  });
});

describe('isFixtureValue: stable fixtures', () => {
  it('recognises the two fixtures that carry no stamp', () => {
    for (const name of STABLE_FIXTURES) {
      expect(isFixtureValue(name), name).toBe(true);
    }
  });

  it('still spares a real partner whose name merely contains one', () => {
    // Whole-string matching, so this stays a false negative rather than
    // deleting a real row.
    expect(isFixtureValue('Test Partnership Fund')).toBe(false);
    expect(isFixtureValue('Public View Partner Alliance')).toBe(false);
    expect(isFixtureValue(REAL_PARTNER)).toBe(false);
  });
});

describe('cleanupFixtures deletion', () => {
  beforeAll(() => {
    // Fail loudly rather than silently testing nothing if the seed is absent.
    expect(process.env.SUPABASE_URL, 'SUPABASE_URL must be set for this suite').toBeTruthy();
  });

  it('removes the stable fixture partners and preserves real content', async () => {
    const svc = serviceClient();

    // Recreate both, so the test is meaningful on a freshly swept database.
    for (const name of STABLE_FIXTURES) {
      const { error } = await svc
        .from('partners')
        .upsert({ name }, { onConflict: 'name', ignoreDuplicates: true });
      expect(error, `seeding ${name}`).toBeNull();
    }

    // And a stamped resource, to prove the two discriminators work together
    // in one pass rather than only in isolation.
    const stamp = fixtureStamp();
    const doomedResource = `Sweep fixture ${stamp}`;
    const { error: insertError } = await svc.from('resources').insert({
      name: doomedResource,
      partner: 'Test Partner',
      partner_tier: 'network',
      resource_type: 'Credits',
      need_primary: 'compute',
      description: 'created by tests/rls/fixture-sweep.test.ts',
      external_url: 'https://example.org/sweep',
      status: 'live',
    });
    expect(insertError).toBeNull();

    const namesBefore = await partnerNames(svc);
    expect(namesBefore).toEqual(expect.arrayContaining([...STABLE_FIXTURES]));
    expect(namesBefore, 'control row must exist before the sweep').toContain(REAL_PARTNER);

    await cleanupFixtures(svc);

    const namesAfter = await partnerNames(svc);
    for (const name of STABLE_FIXTURES) {
      expect(namesAfter, `${name} should have been swept`).not.toContain(name);
    }
    // The assertion that matters: a false positive here means the sweep is
    // deleting the client's data.
    expect(namesAfter, 'real partner must survive the sweep').toContain(REAL_PARTNER);

    const { data: survivors } = await svc
      .from('resources')
      .select('name')
      .eq('name', doomedResource);
    expect(survivors ?? [], 'stamped resource should have been swept').toHaveLength(0);

    // The sweep must not have emptied the table on its way past.
    const { count } = await svc.from('resources').select('id', { count: 'exact', head: true });
    expect(count ?? 0, 'seeded resources must survive').toBeGreaterThan(0);
  });
});

/**
 * The three tables that joined the sweep with `tests/rls/role-matrix.test.ts`
 * and had no deletion assertion of their own until now.
 *
 * Two of them are anon-readable -- `programmes_public` and
 * `impact_stories_public` are both in `tests/rls/public-views.test.ts`'s
 * registry -- so a sweep that silently stops working for one of them leaves
 * stamped test fixtures rendering as programme and impact content on a public
 * page for a UN programme. That is CLAUDE.md's first hard rule, reached by an
 * unusual route: nobody fabricated anything, the housekeeping just stopped.
 *
 * The sweep keys all three on `id`. `column` below is the one it matches
 * against, which for `updates_log` is `text` -- its only NOT NULL column
 * without a default, and the only one that identifies an entry at all, and a
 * freer-form one than a title or an organisation name, so `FIXTURE_STAMP_RE`'s
 * digit boundaries are what keep a real update note containing a long number
 * out of the sweep's way.
 *
 * `updates_log` is append-only for every authenticated role (0007_logs.sql
 * creates a select policy and an insert policy and no others), so both its
 * fixture and its control are written with the service client -- which
 * bypasses RLS, exactly as the sweep itself does.
 */
const SWEPT_TABLES = [
  {
    table: 'programmes',
    column: 'title',
    control: 'Sweep control programme (tests/rls/fixture-sweep.test.ts)',
    row: (label: string) => ({ title: label }),
  },
  {
    table: 'impact_stories',
    column: 'organisation',
    control: 'Sweep control organisation (tests/rls/fixture-sweep.test.ts)',
    row: (label: string) => ({ organisation: label }),
  },
  {
    table: 'updates_log',
    column: 'text',
    control: 'Sweep control update note (tests/rls/fixture-sweep.test.ts)',
    row: (label: string) => ({ text: label }),
  },
  // These two carry provenance because 0015_stat_provenance.sql makes
  // source/attested_by/attested_on NOT NULL and non-blank, with no defaults --
  // deliberately, so no figure can exist without a named person behind it.
  // That is exactly why they are the worst tables to strand a fixture in: an
  // orphaned row here is not junk, it is an invented statistic carrying a
  // human attestation, on a view anon can read. The unstamped control is the
  // sharper half of each test — the sweep must reclaim the fixture without
  // touching a figure a real person vouched for.
  {
    table: 'headline_stats',
    column: 'label',
    control: 'Sweep control headline stat (tests/rls/fixture-sweep.test.ts)',
    row: (label: string) => ({
      label,
      value: '0',
      source: 'tests/rls/fixture-sweep.test.ts',
      attested_by: 'fixture-sweep test',
      attested_on: '2026-01-01',
    }),
  },
  {
    table: 'compute_metrics',
    column: 'label',
    control: 'Sweep control compute metric (tests/rls/fixture-sweep.test.ts)',
    row: (label: string) => ({
      label,
      value: '0',
      source: 'tests/rls/fixture-sweep.test.ts',
      attested_by: 'fixture-sweep test',
      attested_on: '2026-01-01',
    }),
  },
] as const;

describe('cleanupFixtures deletion, per table', () => {
  // Every id this block creates, deleted unconditionally at the end.
  //
  // The house rule from tests/rls/admin-actions-content.test.ts, and it
  // matters more here than there: the *control* row is by construction one
  // the sweep will never remove -- that is the property being tested -- so
  // nothing else in the repository would ever clean it up. A control stranded
  // in `programmes` is a fixture on an anon-readable view for good. The label
  // names this file for the same reason: if one ever does survive a crash
  // between the insert and this hook, it reads as the test artefact it is
  // rather than as content.
  const created: { table: string; id: string }[] = [];

  afterAll(async () => {
    const svc = serviceClient();
    for (const { table, id } of created) {
      const { error } = await svc.from(table).delete().eq('id', id);
      if (error) console.warn(`[fixture-sweep] could not delete ${table} ${id}: ${error.message}`);
    }
  });

  for (const { table, column, control, row } of SWEPT_TABLES) {
    it(`sweeps a stamped ${table} row and spares an unstamped one`, async () => {
      const svc = serviceClient();
      const fixtureLabel = `Sweep fixture ${table} ${fixtureStamp()}`;

      // A control stranded by an earlier interrupted run would otherwise
      // accumulate a duplicate per run, and this test would pass on the old
      // row rather than the one it just wrote.
      const { error: purgeError } = await svc.from(table).delete().eq(column, control);
      expect(purgeError, `clearing a stale ${table} control`).toBeNull();

      const { data: inserted, error: insertError } = await svc
        .from(table)
        .insert([row(fixtureLabel), row(control)])
        .select('id');
      expect(insertError, `seeding ${table}`).toBeNull();
      for (const { id } of (inserted ?? []) as { id: string }[]) created.push({ table, id });

      const before = await labels(svc, table, column, [fixtureLabel, control]);
      expect(before).toEqual(expect.arrayContaining([fixtureLabel, control]));

      await cleanupFixtures(svc);

      const after = await labels(svc, table, column, [fixtureLabel, control]);
      expect(
        after,
        `${table}: a stamped fixture survived the sweep — it is no longer being cleaned up`,
      ).not.toContain(fixtureLabel);
      // The assertion that matters in the other direction: an unstamped row is
      // what real content looks like, and the sweep must not touch it.
      expect(after, `${table}: the sweep deleted an unstamped row`).toContain(control);
    });
  }
});

async function labels(
  svc: ReturnType<typeof serviceClient>,
  table: string,
  column: string,
  wanted: readonly string[],
): Promise<string[]> {
  const { data, error } = await svc.from(table).select(column).in(column, wanted);
  expect(error, `reading ${table}`).toBeNull();
  return ((data ?? []) as unknown as Record<string, string>[]).map((r) => r[column]!);
}

async function partnerNames(svc: ReturnType<typeof serviceClient>): Promise<string[]> {
  const { data, error } = await svc.from('partners').select('name');
  expect(error, 'reading partners').toBeNull();
  return (data ?? []).map((row) => (row as { name: string }).name);
}
