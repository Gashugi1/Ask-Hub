import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { serviceClient } from './helpers/clients';
import { seed } from '../scripts/seed';
import { PARTNERS, RESOURCES, SITE_CONTENT } from '../scripts/seed-data';

// Every assertion in this suite is scoped to the seed's own rows (by name or
// by key/locale) rather than a global table count: other suites insert
// their own fixture rows into partners/resources/site_content, and there is
// no db:reset between suite runs in normal CI/dev use (see
// tests/rls/site.test.ts's house rule for the same constraint).

async function seededRowCounts() {
  const svc = serviceClient();
  const [partners, resources, siteContent] = await Promise.all([
    svc
      .from('partners')
      .select('name', { count: 'exact', head: true })
      .in('name', [...PARTNERS]),
    svc
      .from('resources')
      .select('id', { count: 'exact', head: true })
      .in(
        'name',
        RESOURCES.map((r) => r.name),
      ),
    svc
      .from('site_content')
      .select('id', { count: 'exact', head: true })
      .eq('locale', 'en')
      .in(
        'key',
        SITE_CONTENT.map((c) => c.key),
      ),
  ]);
  return {
    partners: partners.count ?? 0,
    resources: resources.count ?? 0,
    site_content: siteContent.count ?? 0,
  };
}

describe('seed', () => {
  // Seeds once up front so every test below can rely on the rows existing,
  // regardless of test execution order.
  beforeAll(async () => {
    await seed();
  });

  it('seeds exactly the rows scripts/seed-data.ts declares', async () => {
    const counts = await seededRowCounts();
    expect(counts.partners, 'partners').toBe(PARTNERS.length);
    expect(counts.resources, 'resources').toBe(RESOURCES.length);
    expect(counts.site_content, 'site_content').toBe(SITE_CONTENT.length);
  });

  it('is idempotent — running it twice does not duplicate rows', async () => {
    const before = await seededRowCounts();
    await seed();
    const after = await seededRowCounts();
    expect(after).toEqual(before);
  });

  // A static source check is stronger than a row-count assertion here: it
  // proves there is no code path at all that could write to these four
  // tables, not merely that this particular run happened not to.
  it('never mentions the four forbidden tables in seed.ts or seed-data.ts', () => {
    const seedSrc = readFileSync('scripts/seed.ts', 'utf8');
    const dataSrc = readFileSync('scripts/seed-data.ts', 'utf8');
    const combined = `${seedSrc}\n${dataSrc}`;
    for (const table of ['subscribers', 'submissions', 'digest_sends', 'engagement_events']) {
      expect(combined.includes(table), `${table} is mentioned in scripts/`).toBe(false);
    }
  });

  // impact_stories, headline_stats, compute_metrics, and programmes all get
  // no rows from this seed. The first three: no source data / blocked
  // pending attested figures. `programmes`: every one of the prototype's six
  // descriptions carries an unattested AI Hub performance figure of its own
  // (e.g. "376 applications", "targeting up to 45M jobs"), and
  // programmes_public is anon-readable — see scripts/seed-data.ts's header
  // for the full reasoning. Scoped as a before/after delta around the
  // seed() call in this suite, rather than a bare "count is 0" assertion, so
  // this test cannot depend on whatever an unrelated suite happens to have
  // left in these tables.
  it('adds nothing to impact_stories, headline_stats, compute_metrics, or programmes', async () => {
    const svc = serviceClient();
    const tables = ['impact_stories', 'headline_stats', 'compute_metrics', 'programmes'] as const;
    const before: Record<(typeof tables)[number], number> = {
      impact_stories: 0,
      headline_stats: 0,
      compute_metrics: 0,
      programmes: 0,
    };
    for (const table of tables) {
      const { count } = await svc.from(table).select('id', { count: 'exact', head: true });
      before[table] = count ?? 0;
    }

    await seed();

    for (const table of tables) {
      const { count } = await svc.from(table).select('id', { count: 'exact', head: true });
      expect(count ?? 0, `${table} row count changed`).toBe(before[table]);
    }
  });

  // The partner->resource FK guarantees referential integrity at the
  // database level already; the property worth asserting here is that
  // seed-data.ts itself is internally consistent — every partner name a
  // resource declares is also a name PARTNERS declares — so a future edit
  // to one array cannot silently orphan a resource's partner reference.
  it('every seeded resource names a partner also present in PARTNERS', () => {
    const partnerNames = new Set(PARTNERS);
    for (const resource of RESOURCES) {
      expect(
        partnerNames.has(resource.partner),
        `${resource.name} names unseeded partner "${resource.partner}"`,
      ).toBe(true);
    }
  });

  // Content rules (CLAUDE.md), checked against the actual seeded rows rather
  // than the source arrays, so the assertion proves what landed in
  // Postgres, not just what seed-data.ts intends. Covers BOTH site_content
  // (the About/welcome copy) and resources (every free-text column a public
  // visitor can read via resources_public) — resource descriptions are
  // equally public and were previously unguarded by this suite. Both
  // queries are scoped to the seed's own keys/names, not a global read.
  it('holds content rules over the seeded site_content and resource text', async () => {
    const svc = serviceClient();

    const keys = SITE_CONTENT.map((c) => c.key);
    const { data: siteContentRows } = await svc
      .from('site_content')
      .select('value')
      .eq('locale', 'en')
      .in('key', keys);
    expect(siteContentRows, 'expected every seeded site_content key to be present').toHaveLength(
      keys.length,
    );

    const resourceNames = RESOURCES.map((r) => r.name);
    const { data: resourceRows } = await svc
      .from('resources')
      .select('name, description, sub_category, action_label, resource_type, partner')
      .in('name', resourceNames);
    expect(resourceRows, 'expected every seeded resource to be present').toHaveLength(
      resourceNames.length,
    );

    const combined = [
      ...(siteContentRows ?? []).map((row: { value: string }) => row.value),
      ...(resourceRows ?? []).flatMap((row: Record<string, string | null>) => Object.values(row)),
    ]
      .filter((value): value is string => typeof value === 'string')
      .join('\n');

    expect(combined).not.toMatch(/Mattei Plan/i);
    // "the Hub" bare must never appear — only "AI Hub" or "AI Hub for
    // Sustainable Development". Word-boundaried so it does not false-match
    // "the AI Hub". Case-insensitive so a sentence-initial "The Hub" is
    // caught too — every other check in this block is `/i` and this one
    // originally was not, which was a coverage gap, not a passing case.
    expect(combined).not.toMatch(/\bthe Hub\b/i);
    expect(combined).not.toMatch(/\bDRC\b/i);
    expect(combined).not.toMatch(/powered by|implemented by/i);

    // One mailbox only. Any email-shaped substring in the seeded copy must
    // be the canonical mailbox — this is a regression guard (today's seeded
    // copy contains no email address at all) rather than an expectation
    // that one is present.
    const emails = combined.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g) ?? [];
    for (const email of emails) {
      expect(email).toBe('aihubfordevelopment@undp.org');
    }
  });
});
