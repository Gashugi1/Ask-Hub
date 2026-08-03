import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
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
    expect(() => assertLoopbackTarget('https://abcdefgh.supabase.co')).toThrow(
      /refusing to delete rows from non-loopback host abcdefgh\.supabase\.co/,
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

async function partnerNames(svc: ReturnType<typeof serviceClient>): Promise<string[]> {
  const { data, error } = await svc.from('partners').select('name');
  expect(error, 'reading partners').toBeNull();
  return (data ?? []).map((row) => (row as { name: string }).name);
}
