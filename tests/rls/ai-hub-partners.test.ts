import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { anonClient, ensureTestUsers, roleClient, serviceClient } from '../helpers/clients';
import { fixtureStamp } from '../helpers/fixtures';

/**
 * `partners.is_ai_hub_partner` (supabase/migrations/0019_ai_hub_partners.sql)
 * and the split it creates between two readers of the same table.
 *
 * `partners` is both the AI Hub's partner list and the provider registry that
 * `resources.partner` is a foreign key into, so the same 19 rows have to serve
 * two surfaces with different membership:
 *
 *   - the home page partner row must show only the three organisations the
 *     client confirmed as partners of the AI Hub. Showing NVIDIA or the
 *     African Development Bank there asserts a partnership that does not
 *     exist, on a UN programme's public site.
 *   - the admin resource form's partner picker must keep offering every row,
 *     because every one of them is a valid value for `resources.partner`. A
 *     picker narrowed to the flagged three would make 16 providers
 *     unselectable and every resource that names one uneditable.
 *
 * Both are tested here because they are the two halves of one decision, and
 * getting either wrong is silent: an over-wide partner row looks like a
 * partner row, and a narrowed picker looks like a picker.
 *
 * Two mocks, each replacing only a client factory:
 *   - `next/cache`'s `unstable_cache` becomes the identity function, so
 *     `listPublicPartners` is callable outside a Next request context. Same
 *     substitution and same caveat as tests/rls/public-reader-order.test.ts:
 *     it does not cover the cache tags.
 *   - `@/lib/admin/client`'s `createAdminReadClient` returns a
 *     role-authenticated client, because the real one reads `next/headers`
 *     cookies Vitest cannot provide. Same substitution and same caveat as
 *     tests/rls/admin-reader-order.test.ts: it does not cover the cookie
 *     plumbing or `requireRole`.
 * Everything else -- the view, the filter, the RLS policies, the reader
 * bodies -- is real.
 */
vi.mock('next/cache', () => ({
  unstable_cache: (fn: unknown) => fn,
}));

const harness = vi.hoisted(() => ({ client: null as SupabaseClient | null }));

vi.mock('@/lib/admin/client', () => ({
  createAdminReadClient: async () => {
    if (!harness.client) throw new Error('ai-hub-partners harness: no client set up');
    return harness.client;
  },
}));

const { listPublicPartners } = await import('@/lib/public/readers');
const { readPartnerNames } = await import('@/lib/admin/readers');

const stamp = fixtureStamp();
const FLAGGED = `AI Hub partner fixture flagged ${stamp}`;
const UNFLAGGED = `AI Hub partner fixture provider ${stamp}`;
const DEFAULTED = `AI Hub partner fixture defaulted ${stamp}`;

/**
 * Removed unconditionally in `afterAll`, never at the end of a test body: a
 * failing assertion above such a line would skip it. `partners` is
 * anon-readable through `partners_public`, so a leaked flagged fixture is a
 * fabricated partner sitting on the public home page for the rest of the run
 * -- the same house rule tests/rls/public-reader-order.test.ts states in full.
 * Every name carries a `fixtureStamp()`, so tests/helpers/fixtures.ts's sweep
 * is the backstop if a run is killed before this hook.
 */
const created: string[] = [];

/**
 * Resources are deleted before partners, not alongside them: resources.partner
 * is `on delete restrict` (0014_partner_logos.sql), so a partner still named
 * by a resource cannot be removed and would survive the run.
 */
const createdResources: string[] = [];

beforeAll(async () => {
  await ensureTestUsers();
  // Editor, not admin: readPartnerNames is a read an editor is entitled to,
  // so this exercises it under the narrower of the two staff roles.
  harness.client = await roleClient('editor');

  const svc = serviceClient();
  const { error } = await svc.from('partners').insert([
    { name: FLAGGED, is_ai_hub_partner: true },
    { name: UNFLAGGED, is_ai_hub_partner: false },
  ]);
  expect(error, 'seeding partner fixtures').toBeNull();
  created.push(FLAGGED, UNFLAGGED);

  // A separate call, not a third element of the array above, and this is
  // load-bearing. Written as one batch alongside the two rows that do carry
  // the key, `{ name: DEFAULTED }` was rejected with 23502, "null value in
  // column is_ai_hub_partner ... violates not-null constraint" -- observed,
  // not predicted. PostgREST evidently fills a key a row omits from a batch
  // with an explicit NULL rather than leaving it out of the statement, so
  // inside a batch the column default is never reached. On its own the key
  // really is absent, which is what the default-observing test below needs.
  const { error: defaultedError } = await svc.from('partners').insert({ name: DEFAULTED });
  expect(defaultedError, 'seeding defaulted partner fixture').toBeNull();
  created.push(DEFAULTED);
});

afterAll(async () => {
  const svc = serviceClient();
  for (const name of createdResources) {
    const { error } = await svc.from('resources').delete().eq('name', name);
    if (error) {
      console.warn(`[ai-hub-partners] could not delete resource ${name}: ${error.message}`);
    }
  }
  for (const name of created) {
    const { error } = await svc.from('partners').delete().eq('name', name);
    if (error) {
      console.warn(`[ai-hub-partners] could not delete partner ${name}: ${error.message}`);
    }
  }
});

describe('partners.is_ai_hub_partner', () => {
  /**
   * The default is the whole safety property of this column. Every partner
   * row created by a route other than the seed -- an admin adding a provider
   * for a new resource -- must start OFF the public partner row, so that
   * appearing there is always a deliberate act. A default of true, or a
   * nullable column read as truthy, would put each new provider on the home
   * page as a claimed partner the moment it was created.
   */
  it('defaults to false for a partner inserted without it', async () => {
    const { data, error } = await serviceClient()
      .from('partners')
      .select('name, is_ai_hub_partner')
      .eq('name', DEFAULTED)
      .single();
    expect(error).toBeNull();
    expect(data!.is_ai_hub_partner).toBe(false);
  });
});

describe('renaming a partner', () => {
  /**
   * 0019_ai_hub_partners.sql renames `CINECA / AI Hub` to `CINECA` with a
   * single UPDATE and no second statement for the resource that references
   * it, on the strength of resources_partner_fkey being `on update cascade`
   * (0014_partner_logos.sql). That is the assumption this test exists to
   * hold: without the cascade the UPDATE would fail outright on a populated
   * database, and a migration written as if it had succeeded would leave the
   * old name in place.
   *
   * Not exercised by a `db:reset` + `npm run seed`, which is why it needs a
   * test of its own: migrations run before any partner row exists, so that
   * UPDATE matches nothing locally and the resource is simply inserted under
   * the new name. The cascade only ever runs on a database that already
   * holds content -- which is the one this migration will eventually meet.
   */
  it('carries its resources across via the FK cascade', async () => {
    const svc = serviceClient();
    const oldName = `AI Hub partner fixture rename-from ${stamp}`;
    const newName = `AI Hub partner fixture rename-to ${stamp}`;
    const resourceName = `AI Hub partner fixture cascade resource ${stamp}`;

    const { error: partnerError } = await svc.from('partners').insert({ name: oldName });
    expect(partnerError, 'seeding rename fixture').toBeNull();
    created.push(oldName, newName);

    const { error: resourceError } = await svc.from('resources').insert({
      name: resourceName,
      partner: oldName,
      partner_tier: 'strategic',
      resource_type: 'Credits',
      need_primary: 'compute',
      description: 'cascade fixture',
      external_url: 'https://example.org/cascade',
      // `pipeline`, not `live`: this row exists only to be pointed at, and a
      // live one would join the anonymous directory for the rest of the run.
      status: 'pipeline',
    });
    expect(resourceError, 'seeding cascade resource').toBeNull();
    createdResources.push(resourceName);

    const { error: renameError } = await svc
      .from('partners')
      .update({ name: newName })
      .eq('name', oldName);
    expect(renameError, 'renaming the partner').toBeNull();

    const { data, error } = await svc
      .from('resources')
      .select('partner')
      .eq('name', resourceName)
      .single();
    expect(error).toBeNull();
    expect(data!.partner).toBe(newName);

    const { count, error: oldCountError } = await svc
      .from('partners')
      .select('name', { count: 'exact', head: true })
      .eq('name', oldName);
    expect(oldCountError).toBeNull();
    expect(count ?? 0).toBe(0);
  });
});

describe('the home page partner row', () => {
  /**
   * Read anonymously, through the view, rather than through the reader: this
   * is the assertion that the restriction lives in SQL and holds for anyone
   * reading `partners_public`, not just for the one TypeScript caller.
   */
  it('exposes only flagged partners through partners_public anonymously', async () => {
    const { data, error } = await anonClient()
      .from('partners_public')
      .select('name')
      .in('name', [FLAGGED, UNFLAGGED, DEFAULTED]);
    expect(error).toBeNull();
    expect((data ?? []).map((row) => row.name)).toEqual([FLAGGED]);
  });

  /**
   * And again through `listPublicPartners`, the reader the home page actually
   * calls. It does `select('*')` with no filter of its own, so this proves the
   * view's WHERE clause is what reaches `PartnerRow` -- if the filter were
   * dropped from the view, the anonymous read above and this would both fail,
   * which is the point: there is no second place the narrowing could be
   * happening.
   */
  it('reaches PartnerRow with only flagged partners', async () => {
    const names = (await listPublicPartners()).map((partner) => partner.name);
    expect(names).toContain(FLAGGED);
    expect(names).not.toContain(UNFLAGGED);
    expect(names).not.toContain(DEFAULTED);
  });

  /**
   * The three the client confirmed, checked against the seeded database
   * rather than against scripts/seed-data.ts, so this proves what Postgres
   * holds. Scoped to the seed's own names by exclusion of this file's stamped
   * fixtures, since other suites insert partners of their own.
   *
   * UNDP is asserted absent explicitly. It co-leads the AI Hub with MIMIT
   * rather than partnering with it and belongs only in the footer attribution
   * (content rule 10.1); a UNDP logo in the partner row would restate a
   * co-lead as a partner. There is no UNDP row in `partners` at all today, so
   * this is a regression guard rather than a filter that currently does work.
   */
  it('shows the three confirmed AI Hub partners and no co-lead', async () => {
    const { data, error } = await anonClient().from('partners_public').select('name');
    expect(error).toBeNull();
    const names = (data ?? [])
      .map((row) => row.name as string)
      .filter((name) => !name.includes(String(stamp)));
    expect(names.sort()).toEqual(['Amazon Web Services', 'CINECA', 'Microsoft']);
    expect(names).not.toContain('UNDP');
  });
});

describe('the admin resource form partner picker', () => {
  /**
   * The half of this change that is easiest to break by accident: narrowing
   * `partners_public` and then "tidying up" by narrowing readPartnerNames to
   * match. Every row of `partners` is a legal value for `resources.partner`
   * (the FK is against `partners(name)`, all 19 rows of it), so the picker
   * must keep offering all of them regardless of the flag.
   */
  it('still lists partners the AI Hub does not partner with', async () => {
    const names = await readPartnerNames();
    expect(names).toContain(FLAGGED);
    expect(names).toContain(UNFLAGGED);
    expect(names).toContain(DEFAULTED);
  });

  /**
   * Stated as a count as well as a membership check: `toContain` on three
   * names would still pass if the reader had been narrowed to the flagged
   * rows plus those three. The picker must be strictly wider than the public
   * partner row for as long as the registry holds providers that are not
   * partners -- which, on the seeded content, it does (16 of 19).
   */
  it('offers strictly more partners than the public partner row shows', async () => {
    const pickerNames = await readPartnerNames();
    const publicNames = (await listPublicPartners()).map((partner) => partner.name);
    expect(pickerNames.length).toBeGreaterThan(publicNames.length);
    for (const name of publicNames) expect(pickerNames).toContain(name);
  });
});
