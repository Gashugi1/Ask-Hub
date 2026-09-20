import { describe, it, expect, afterAll, vi } from 'vitest';
import { serviceClient } from '../helpers/clients';
import { fixtureStamp } from '../helpers/fixtures';

/**
 * The public readers' `.order()` clauses, exercised against the real views.
 *
 * Nothing enforced them. Deleting `.order('sort_order', { ascending: true })`
 * from `listHeadlineStats` left the whole suite green, and the PRD is explicit
 * (line 127) that the home strip is "the first four `is_hero` stats in sort
 * order" --
 * `StatsBand` takes `.slice(0, HERO_LIMIT)` of whatever the reader hands it,
 * so the reader's ordering is what decides *which* four figures a visitor
 * sees, not merely the sequence they appear in. An unordered read shows four
 * arbitrary figures on a leadership surface and looks entirely normal.
 *
 * These call the readers themselves rather than reissuing their queries by
 * hand. A hand-built `select().order()` here would pass forever after the
 * reader dropped its own `order()`, which is precisely the failure being
 * closed.
 *
 * **The cache is mocked away, and only the cache.** `unstable_cache` throws
 * `Invariant: incrementalCache missing` outside a Next request context, so
 * every reader in `src/lib/public/readers.ts` is unreachable from Vitest as
 * written -- no existing test touches any of them (the component suites
 * `vi.mock` the whole readers module and hand the bands arrays). Replacing
 * `unstable_cache` with the identity function runs the real reader body,
 * against the real `*_public` views, through the real anon client, uncached.
 * What that does NOT cover is the cache configuration itself -- the tags and
 * the two TTLs. `tests/structure/revalidation-contract.test.ts` covers the
 * write side of that; nothing covers the reader side, and this file does not
 * change that.
 */
vi.mock('next/cache', () => ({
  unstable_cache: (fn: unknown) => fn,
}));

const { listHeadlineStats, listPublicPartners, listImpactStories, listNeedCounts } = await import(
  '@/lib/public/readers'
);
const { NEED_KEYS } = await import('@/lib/reference');

/**
 * Every row this file creates, removed unconditionally at the end.
 *
 * `headline_stats` fixtures are the reason this is an `afterAll` and not a
 * line at the end of each test: the table is anon-readable through
 * `headline_stats_public`, `0015_stat_provenance.sql` is written on the
 * premise that it starts empty, and a leaked row here is a fabricated-looking
 * attested figure on a public page -- CLAUDE.md's first hard rule. The house
 * rule is stated in full in `tests/rls/admin-actions-content.test.ts`. It
 * applies to `impact_stories` for the same reason (`impact_stories_public`),
 * and to `partners` because `partners_public` serves them too.
 *
 * `cleanupFixtures` is now a genuine backstop for all three -- `headline_stats`
 * was added to its table list once this file made the exposure concrete, and
 * `tests/rls/fixture-sweep.test.ts` proves the sweep reclaims a stamped row
 * there. This hook is still the primary mechanism, for a reason the sweep
 * cannot fix: it runs once, after the whole run is over, so a row left to it
 * is visible to every suite that runs in between. The sweep catches what a
 * crash strands; this hook stops the row existing for the rest of the run.
 */
const created: { table: string; column: string; value: string }[] = [];

afterAll(async () => {
  const svc = serviceClient();
  for (const { table, column, value } of created) {
    const { error } = await svc.from(table).delete().eq(column, value);
    if (error) {
      console.warn(`[public-reader-order] could not delete ${table} ${value}: ${error.message}`);
    }
  }
});

describe('listHeadlineStats', () => {
  it('returns hero stats in sort order, whatever order they were written in', async () => {
    const svc = serviceClient();
    const stamp = fixtureStamp();
    // Five, because PRD 127's rule is "the first four", and a test over four
    // rows cannot tell "sorted" from "sorted and truncated at the right
    // place". Written in an order that is not sort order and is not reverse
    // sort order either, so neither a stable no-op nor a reversal passes.
    const positions = [4, 1, 5, 2, 3];
    const label = (position: number) => `Reader order stat ${position} ${stamp}`;

    const { error } = await svc.from('headline_stats').insert(
      positions.map((position) => ({
        value: `${position}`,
        label: label(position),
        is_hero: true,
        sort_order: position,
        source: 'Reader ordering fixture, tests/rls/public-reader-order.test.ts',
        attested_by: 'Test harness',
        attested_on: '2026-01-01',
      })),
    );
    expect(error, 'seeding headline_stats').toBeNull();
    for (const position of positions) {
      created.push({ table: 'headline_stats', column: 'label', value: label(position) });
    }

    const mine = new Set(positions.map(label));
    const stats = (await listHeadlineStats()).filter((stat) => mine.has(stat.label));

    // Narrowed to this file's own rows so a real stat added by the client
    // later cannot break the assertion. `headline_stats` holds zero rows in a
    // seeded database, and `fileParallelism` is off, so nothing else is
    // writing to it while this runs.
    expect(stats.map((stat) => stat.sortOrder)).toEqual([1, 2, 3, 4, 5]);

    // The consumer's rule, spelled out: StatsBand filters to is_hero and
    // takes the first four. Which four that is depends entirely on the
    // reader having sorted them.
    expect(
      stats
        .filter((stat) => stat.isHero)
        .slice(0, 4)
        .map((stat) => stat.value),
    ).toEqual(['1', '2', '3', '4']);
  });
});

describe('listPublicPartners', () => {
  it('returns partners in sort order, then by name', async () => {
    const svc = serviceClient();
    const stamp = fixtureStamp();
    // The second `.order('name')` is not decoration: `partners.sort_order` is
    // nullable and unconstrained, so ties are the normal case, and Postgres
    // returns tied rows in an unspecified order -- the same rows can come back
    // differently from one read to the next, which React reports as a
    // hydration mismatch and a visitor sees as logos moving.
    //
    // Six tied rows rather than two, and written in reverse alphabetical
    // order. With two, deleting `.order('name')` still returned them
    // alphabetically by chance and the mutation was invisible; with six the
    // unordered read comes back in write order, so the assertion has
    // something to catch. Note what that rests on: "unspecified" is exactly
    // what the tie-break exists to handle, so this half of the test is
    // sensitive to how Postgres happens to sort, not to a guarantee.
    const tied = ['F', 'E', 'D', 'C', 'B', 'A'];
    const rows = [
      ...tied.map((letter) => ({
        name: `Reader order partner ${letter} ${stamp}`,
        sort_order: 2,
      })),
      { name: `Reader order partner first ${stamp}`, sort_order: 1 },
    ];
    const { error } = await svc.from('partners').insert(rows);
    expect(error, 'seeding partners').toBeNull();
    for (const row of rows) created.push({ table: 'partners', column: 'name', value: row.name });

    const mine = new Set(rows.map((row) => row.name));
    const partners = (await listPublicPartners()).filter((partner) => mine.has(partner.name));

    expect(partners.map((partner) => partner.name)).toEqual([
      `Reader order partner first ${stamp}`,
      ...[...tied].reverse().map((letter) => `Reader order partner ${letter} ${stamp}`),
    ]);
  });
});

describe('listImpactStories', () => {
  it('returns stories in sort order, whatever order they were written in', async () => {
    const svc = serviceClient();
    const stamp = fixtureStamp();
    const rows = [
      { organisation: `Reader order story second ${stamp}`, sort_order: 2 },
      { organisation: `Reader order story first ${stamp}`, sort_order: 1 },
    ];
    const { error } = await svc.from('impact_stories').insert(rows);
    expect(error, 'seeding impact_stories').toBeNull();
    for (const row of rows) {
      created.push({ table: 'impact_stories', column: 'organisation', value: row.organisation });
    }

    const mine = new Set(rows.map((row) => row.organisation));
    const stories = (await listImpactStories()).filter((story) => mine.has(story.organisation));

    expect(stories.map((story) => story.sortOrder)).toEqual([1, 2]);
  });
});

describe('listNeedCounts', () => {
  /**
   * `need_counts_public` is a GROUP BY aggregate over every live resource, so
   * unlike every other test in this file there is no way to scope it to
   * fixtures this test owns -- the rows it returns are whatever the whole
   * database currently holds. The assertion is written to survive that: it
   * does not pin a fixed sequence (which needs would appear depends on the
   * content) but asserts that whatever needs came back arrived in NEED_KEYS
   * order.
   *
   * That is not vacuous. NEED_KEYS is compute, training, funding, accelerator,
   * partners; the GROUP BY's own order on the seeded database is accelerator,
   * funding, partners, compute, training -- a genuine permutation, so the
   * filter below reorders it and the comparison fails. Removing `.order()`
   * from the reader is the mutation this catches.
   *
   * The reader sorts by the `need_type` enum in Postgres, which sorts by
   * declaration order; tests/unit/reference.test.ts is what pins that
   * declaration order equal to NEED_KEYS, so this test and that one together
   * are what tie the rendered chip order to the canonical list.
   */
  it('returns need counts in NEED_KEYS order, not GROUP BY order', async () => {
    const counts = await listNeedCounts();
    const needs = counts.map((count) => count.need);

    // Guards against the assertion passing because there was nothing to sort.
    expect(needs.length).toBeGreaterThan(1);

    const canonical = NEED_KEYS.filter((key) => (needs as readonly string[]).includes(key));
    expect(needs).toEqual(canonical);
  });
});
