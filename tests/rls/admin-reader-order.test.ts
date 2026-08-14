import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureTestUsers, roleClient, serviceClient } from '../helpers/clients';
import { fixtureStamp } from '../helpers/fixtures';

/**
 * The admin readers' `.order()` clauses, exercised against the real tables.
 *
 * Same gap as `tests/rls/public-reader-order.test.ts` on the other surface:
 * every reader in `src/lib/admin/readers.ts` that returns a list sorts, every
 * screen renders `rows.map(...)` in the order it is handed, and until this
 * file no test called any of those readers at all -- so no amount of sorting
 * removed from them could have failed anything.
 *
 * `sort_order` is an editable column on the Site Content and Resources
 * screens, so a reader that stops ordering does not look broken -- it makes a
 * curator's typed-in position silently do nothing, which is the same shape as
 * the `is_hero` fallback bug recorded in `src/components/public/StatsBand.tsx`.
 *
 * `nullsFirst: false` is asserted too, and is not incidental: `sort_order` is
 * nullable on all five tables and an admin-created row starts with no
 * position. Postgres already defaults `asc` to NULLS LAST, so the flag changes
 * nothing today -- but supabase-js sends it as an explicit `nullslast`, which
 * means it is a real parameter that can be set to the wrong value. Every
 * unpositioned row jumping to the top of the table is what that looks like,
 * and flipping it to `true` is one of this file's mutation proofs.
 *
 * **The client is mocked, and only the client.** `createAdminReadClient()`
 * returns `createServerSupabase()`, which reads `next/headers` cookies that
 * Vitest's node environment cannot provide -- the same limitation
 * `tests/rls/admin-actions-content.test.ts` records for the server actions.
 * Substituting a role-authenticated client runs the real reader body, with its
 * real query, against the real tables, under RLS as that role. What it does
 * NOT cover is the cookie plumbing itself or `requireRole`; nothing here
 * should be read as covering either.
 */
const harness = vi.hoisted(() => ({ client: null as SupabaseClient | null }));

vi.mock('@/lib/admin/client', () => ({
  createAdminReadClient: async () => {
    if (!harness.client) throw new Error('admin reader harness: no client set up');
    return harness.client;
  },
}));

const {
  readStats,
  readComputeMetrics,
  readProgrammes,
  readImpactStories,
  readAdminResources,
  readAuditPage,
  readPartnerNames,
} = await import('@/lib/admin/readers');
const { AUDIT_PAGE_SIZE } = await import('@/lib/admin/audit-view');

/** The partner every resource fixture references; `resources.partner` is a real FK. */
const FIXTURE_PARTNER = 'Test Partner';

/**
 * Every row this file creates, removed unconditionally at the end.
 *
 * The house rule from `tests/rls/admin-actions-content.test.ts`:
 * `headline_stats` and `compute_metrics` are both anon-readable through their
 * `*_public` views -- `headline_stats` renders on the public About page today,
 * `compute_metrics` is reachable but rendered on no public page (PRD 10 puts
 * the compute snapshot on the admin screen) -- and `0015_stat_provenance.sql`
 * is written on the premise that both tables start empty, so a leaked fixture
 * here is a fabricated-looking attested figure sitting on a public read
 * surface (CLAUDE.md). Recorded as it is created, deleted in `afterAll`, never
 * at the end of a test body -- a failing assertion above such a line skips it.
 *
 * Both tables are now in `cleanupFixtures`'s list -- added because this file
 * and its public counterpart made the exposure concrete -- so a run killed
 * between the insert above and the hook below no longer strands an attested
 * figure permanently. `tests/rls/fixture-sweep.test.ts` proves the sweep
 * reclaims a stamped row in each while sparing an unstamped one. The hook
 * remains primary: the sweep runs once at the end of the whole run, so a row
 * left to it is visible to every suite in between.
 *
 * What this cannot clean up is `audit_log`: every write below fires
 * `0018_audit_triggers.sql` and audit_log is append-only for all roles
 * (CLAUDE.md), so the audit rows these fixtures produce stay. That is already
 * true of every write in every DB suite here.
 */
const created: { table: string; column: string; value: string }[] = [];

beforeAll(async () => {
  await ensureTestUsers();
  // Editor, not admin: every read below is one an editor is entitled to, so
  // this exercises the readers under the narrower of the two staff roles.
  harness.client = await roleClient('editor');
  const { error } = await serviceClient()
    .from('partners')
    .upsert({ name: FIXTURE_PARTNER }, { onConflict: 'name', ignoreDuplicates: true });
  expect(error, `seeding ${FIXTURE_PARTNER}`).toBeNull();
});

afterAll(async () => {
  const svc = serviceClient();
  for (const { table, column, value } of created) {
    const { error } = await svc.from(table).delete().eq(column, value);
    if (error) {
      console.warn(`[admin-reader-order] could not delete ${table} ${value}: ${error.message}`);
    }
  }
});

/**
 * Seed three rows whose written order is neither sort order nor its reverse,
 * one of them unpositioned, then assert the reader returns them positioned
 * first and unpositioned last.
 *
 * The labels are `alpha`/`beta`/`gamma` rather than `first`/`second`/`third`
 * for a reason found by mutation: every one of these readers has a *second*
 * `.order()` on its label column as a tie-break, so labels whose alphabetical
 * order matches their sort order make deleting the `sort_order` clause
 * invisible -- all five tests passed with it gone. Here alphabetical order
 * (alpha, beta, gamma) gives sort orders [null, 1, 2], written order gives
 * [2, null, 1], and only the clause under test gives [1, 2, null].
 *
 * Narrowed to this file's own rows: four of the five tables are empty in a
 * seeded database, but `resources` is not, and an assertion over a whole table
 * would be asserting the seed rather than the reader.
 */
async function assertOrdersBySortOrder<T extends { sortOrder: number | null }>(opts: {
  table: string;
  column: string;
  read: () => Promise<T[]>;
  labelOf: (row: T) => string;
  row: (label: string, sortOrder: number | null) => Record<string, unknown>;
}): Promise<void> {
  const stamp = fixtureStamp();
  const written: [string, number | null][] = [
    [`Reader order ${opts.table} gamma ${stamp}`, 2],
    [`Reader order ${opts.table} alpha ${stamp}`, null],
    [`Reader order ${opts.table} beta ${stamp}`, 1],
  ];

  const { error } = await serviceClient()
    .from(opts.table)
    .insert(written.map(([label, sortOrder]) => opts.row(label, sortOrder)));
  expect(error, `seeding ${opts.table}`).toBeNull();
  for (const [label] of written) {
    created.push({ table: opts.table, column: opts.column, value: label });
  }

  const mine = new Set(written.map(([label]) => label));
  const rows = (await opts.read()).filter((row) => mine.has(opts.labelOf(row)));

  expect(rows.map(opts.labelOf), `${opts.table} row count`).toHaveLength(written.length);
  expect(
    rows.map((row) => row.sortOrder),
    `${opts.table}: the reader did not return rows in sort_order, nulls last`,
  ).toEqual([1, 2, null]);
}

/** headline_stats and compute_metrics both carry the three NOT NULL provenance columns. */
const PROVENANCE = {
  source: 'Reader ordering fixture, tests/rls/admin-reader-order.test.ts',
  attested_by: 'Test harness',
  attested_on: '2026-01-01',
};

describe('admin readers order by sort_order, nulls last', () => {
  it('readStats', async () => {
    await assertOrdersBySortOrder({
      table: 'headline_stats',
      column: 'label',
      read: readStats,
      labelOf: (row) => row.label,
      row: (label, sortOrder) => ({ value: '1', label, sort_order: sortOrder, ...PROVENANCE }),
    });
  });

  it('readComputeMetrics', async () => {
    await assertOrdersBySortOrder({
      table: 'compute_metrics',
      column: 'label',
      read: readComputeMetrics,
      labelOf: (row) => row.label,
      row: (label, sortOrder) => ({ value: '1', label, sort_order: sortOrder, ...PROVENANCE }),
    });
  });

  it('readProgrammes', async () => {
    await assertOrdersBySortOrder({
      table: 'programmes',
      column: 'title',
      read: readProgrammes,
      labelOf: (row) => row.title,
      row: (label, sortOrder) => ({ title: label, sort_order: sortOrder }),
    });
  });

  it('readImpactStories', async () => {
    await assertOrdersBySortOrder({
      table: 'impact_stories',
      column: 'organisation',
      read: readImpactStories,
      labelOf: (row) => row.organisation,
      row: (label, sortOrder) => ({ organisation: label, sort_order: sortOrder }),
    });
  });

  it('readAdminResources', async () => {
    await assertOrdersBySortOrder({
      table: 'resources',
      column: 'name',
      read: readAdminResources,
      labelOf: (row) => row.name,
      row: (label, sortOrder) => ({
        name: label,
        sort_order: sortOrder,
        partner: FIXTURE_PARTNER,
        partner_tier: 'network',
        resource_type: 'Credits',
        need_primary: 'compute',
        description: 'created by tests/rls/admin-reader-order.test.ts',
        external_url: 'https://example.org/reader-order',
        status: 'pipeline',
      }),
    });
  });
});

describe('readPartnerNames', () => {
  /**
   * The one reader here that does NOT order by `sort_order`, for the reason
   * recorded on it: on `partners` that column curates the public logo row's
   * sequence, and it is nullable and non-unique besides. It orders by `name`,
   * the primary key, which makes the order total.
   *
   * Ordering is load-bearing rather than cosmetic. This list populates the
   * `partner` `<select>` on the resource form, whose value is the foreign key
   * `resources.partner` -> `partners(name)`; an unordered list is PostgREST's
   * physical row order, which changes as rows are inserted and deleted, so the
   * options would reshuffle between page loads with nothing looking broken.
   *
   * Written in an order that is neither alphabetical nor its reverse, and
   * narrowed to this test's own rows -- `partners` holds 19 seeded rows, so an
   * assertion over the whole table would be asserting the seed.
   */
  it('returns partner names in alphabetical order', async () => {
    const stamp = fixtureStamp();
    const written = [
      `Reader order partner gamma ${stamp}`,
      `Reader order partner alpha ${stamp}`,
      `Reader order partner beta ${stamp}`,
    ];

    const { error } = await serviceClient()
      .from('partners')
      .insert(written.map((name) => ({ name })));
    expect(error, 'seeding partners').toBeNull();
    for (const name of written) {
      created.push({ table: 'partners', column: 'name', value: name });
    }

    const mine = new Set(written);
    const names = (await readPartnerNames()).filter((name) => mine.has(name));

    // The expectation comes from Postgres, not from JavaScript's sort. They
    // genuinely disagree on this table: under the database's en_US.UTF-8
    // collation `African Development Bank` precedes `AfriLabs`, while
    // `[...].sort()` compares UTF-16 code units and puts `AfriLabs` first,
    // because the space is weighted differently. The reader is ordered by
    // Postgres, so a JS-sorted oracle asserts a rule the code does not follow
    // -- it passed here only because these fixture names happen not to expose
    // the difference, and a fixture containing a space would have made it
    // flaky. Ordering the same rows through an explicit query is an
    // independent statement of the expected order: if the reader drops its own
    // `.order('name')` it returns heap order and this still fails.
    const { data: expected, error: expectedError } = await serviceClient()
      .from('partners')
      .select('name')
      .in('name', written)
      .order('name', { ascending: true });
    expect(expectedError, 'reading the expected partner order').toBeNull();

    expect(names, 'partner row count').toHaveLength(written.length);
    expect(names, 'readPartnerNames did not return names in the database’s collation order').toEqual(
      (expected ?? []).map((row) => row.name as string),
    );
  });
});

describe('readAuditPage', () => {
  /**
   * Ordering here is not presentation: `readAuditPage` pages with `.range()`,
   * and `.range()` over an unordered query returns an arbitrary window, so a
   * missing `.order()` means entries silently repeat on one page and never
   * appear on another. PRD 6.9's table would look entirely plausible while
   * omitting rows.
   *
   * Asserted on page 1 only. Page-to-page disjointness -- the sharper property
   * -- would need more than AUDIT_PAGE_SIZE rows written on every run, and
   * `audit_log` is append-only for all roles (CLAUDE.md), so those rows could
   * never be cleaned up again. Not covered here; stated rather than implied.
   */
  it('returns the newest entries first', async () => {
    const { rows, total } = await readAuditPage({
      actor: 'all',
      action: 'all',
      from: null,
      to: null,
      page: 1,
    });

    // Not vacuous: every fixture written above fired an audit trigger, so this
    // file alone has produced more than two entries by the time it runs.
    expect(total, 'no audit entries at all, so this test proves nothing').toBeGreaterThan(1);
    expect(rows.length).toBeLessThanOrEqual(AUDIT_PAGE_SIZE);

    const timestamps = rows.map((row) => row.occurredAt);
    expect(
      [...timestamps].sort((a, b) => b.localeCompare(a)),
      'audit entries were not returned newest first',
    ).toEqual(timestamps);
    // Two entries sharing one timestamp would satisfy the check above with no
    // ordering at all.
    expect(new Set(timestamps).size, 'every entry on this page shares one timestamp').toBeGreaterThan(1);
  });
});
