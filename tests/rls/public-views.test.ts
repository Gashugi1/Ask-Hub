import { describe, it, expect, beforeAll } from 'vitest';
import { anonClient, serviceClient } from '../helpers/clients';

// Eight views. compute_metrics_public is the one the brief's contract
// omits from Produces/Interfaces; it is created and tested here like the
// other seven. partners_public is back as of Task 12L: the client
// confirmed they want partner logos after all, reversing the Task 12r
// (H8) denormalisation that had dropped the partners table and this view
// along with it.
const PUBLIC_VIEWS = [
  'resources_public',
  'headline_stats_public',
  'compute_metrics_public',
  'site_content_public',
  'programmes_public',
  'impact_stories_public',
  'need_counts_public',
  'partners_public',
] as const;

// Ruling 5, updated by Task 12L: resources_public is a join again (it
// joins partners to project partner_logo_url/partner_website_url), so
// Postgres refuses any write through it outright -- it belongs in the
// NOT_AUTO_UPDATABLE_CODE group below now, alongside need_counts_public,
// not in this one. partners_public is a single-table projection (like
// headline_stats_public etc.) and is auto-updatable -- confirmed
// directly against this database with pg_relation_is_updatable. If anon
// somehow held (or was ever mistakenly granted) write privilege on one of
// the views below, an insert/update would go through as the view owner,
// bypassing the base table's RLS entirely. Every view in PUBLIC_VIEWS is
// still asserted in the write-denial test below, whether or not it is in
// this auto-updatable group, so that test stays a real guard rather than
// one that only exercises the safe case.
const WRITABLE_SHAPE_VIEWS = [
  'headline_stats_public',
  'compute_metrics_public',
  'site_content_public',
  'programmes_public',
  'impact_stories_public',
  'partners_public',
] as const;

describe('public-safe views', () => {
  beforeAll(async () => {
    const svc = serviceClient();

    // resources.partner is a real FK (Task 12L) against partners(name),
    // so the fixed partner name every fixture below references must
    // exist first. Upserted with ignoreDuplicates rather than a plain
    // insert: this suite has run against a database that already holds
    // this row from a previous run within the same reset, and the point
    // of this row is only that it exists, not any particular values on
    // it, so a conflict here is not a fixture failure.
    const { error: partnerError } = await svc
      .from('partners')
      .upsert({ name: 'Public View Partner' }, { onConflict: 'name', ignoreDuplicates: true });
    if (partnerError) throw partnerError;

    const { error: resourcesError } = await svc.from('resources').insert([
      {
        name: `Live and visible ${Date.now()}`, partner: 'Public View Partner', partner_tier: 'strategic',
        resource_type: 'Credits', need_primary: 'compute',
        description: 'live', external_url: 'https://example.org/a',
        status: 'live',
      },
      {
        name: `Pipeline and hidden ${Date.now()}`, partner: 'Public View Partner', partner_tier: 'strategic',
        resource_type: 'Credits', need_primary: 'compute',
        description: 'pipeline', external_url: 'https://example.org/b',
        status: 'pipeline',
      },
      {
        name: `Reference and hidden ${Date.now()}`, partner: 'Public View Partner', partner_tier: 'strategic',
        resource_type: 'Credits', need_primary: 'compute',
        description: 'reference', external_url: 'https://example.org/c',
        status: 'reference',
      },
    ]);
    if (resourcesError) throw resourcesError;
  });

  it('exposes only live resources anonymously', async () => {
    const stamp = Date.now();
    const svc = serviceClient();
    const liveName = `Live scoped ${stamp}`;
    const pipelineName = `Pipeline scoped ${stamp}`;
    const { error } = await svc.from('resources').insert([
      {
        name: liveName, partner: 'Public View Partner', partner_tier: 'strategic',
        resource_type: 'Credits', need_primary: 'compute',
        description: 'live', external_url: 'https://example.org/live',
        status: 'live',
      },
      {
        name: pipelineName, partner: 'Public View Partner', partner_tier: 'strategic',
        resource_type: 'Credits', need_primary: 'compute',
        description: 'pipeline', external_url: 'https://example.org/pipeline',
        status: 'pipeline',
      },
    ]);
    expect(error).toBeNull();

    const { data, error: readError } = await anonClient()
      .from('resources_public')
      .select('name')
      .in('name', [liveName, pipelineName]);
    expect(readError).toBeNull();
    const names = (data ?? []).map((r) => r.name as string);
    expect(names).toContain(liveName);
    expect(names).not.toContain(pipelineName);
  });

  // Requirement 8 (Task 11b): the hand-list FORBIDDEN_COLUMNS this test
  // used to check against (10 names) is deleted, not replaced in place,
  // because it is superseded by tests/rls/schema-guards.test.ts's G7,
  // which is strictly stronger: G7 is driven by the full catalog of 18
  // @sensitive-marked columns (this hand-list held 10 and would have
  // passed unchanged the day a 19th sensitive column -- e.g. `email` on
  // some future table -- was added to a view, since nothing here scales
  // with the schema), and it is alias-proof (resolved through
  // view_column_sources()'s pg_rewrite/pg_depend walk, so renaming a
  // forbidden column in a view's select list cannot dodge it, unlike a
  // name-based list here ever could). Keeping both would mean two
  // independently-maintained descriptions of the same fact drifting apart
  // silently; G7 is the one that cannot go stale.

  it('computes closed state and days left without exposing status', async () => {
    const svc = serviceClient();
    const name = `Past deadline ${Date.now()}`;
    const { error } = await svc.from('resources').insert({
      name, partner: 'Public View Partner', partner_tier: 'strategic',
      resource_type: 'Course', need_primary: 'training',
      description: 'closed', external_url: 'https://example.org/d',
      status: 'live', deadline: '2020-01-01',
    });
    expect(error).toBeNull();

    const { data } = await anonClient()
      .from('resources_public')
      .select('name, is_closed, days_left')
      .eq('name', name)
      .single();
    expect(data!.is_closed).toBe(true);
    expect(data!.days_left as number).toBeLessThan(0);
  });

  it('treats a deadline of today as open, not closed', async () => {
    const svc = serviceClient();
    const name = `Deadline today ${Date.now()}`;
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await svc.from('resources').insert({
      name, partner: 'Public View Partner', partner_tier: 'strategic',
      resource_type: 'Course', need_primary: 'training',
      description: 'due today', external_url: 'https://example.org/e',
      status: 'live', deadline: today,
    });
    expect(error).toBeNull();

    const { data } = await anonClient()
      .from('resources_public')
      .select('name, is_closed, days_left')
      .eq('name', name)
      .single();
    expect(data!.is_closed).toBe(false);
    expect(data!.days_left).toBe(0);
  });

  it('reports rolling resources with a null days_left', async () => {
    const svc = serviceClient();
    const name = `Rolling resource ${Date.now()}`;
    const { error } = await svc.from('resources').insert({
      name, partner: 'Public View Partner', partner_tier: 'strategic',
      resource_type: 'Credits', need_primary: 'compute',
      description: 'rolling', external_url: 'https://example.org/f',
      status: 'live', deadline: null,
    });
    expect(error).toBeNull();

    const { data } = await anonClient()
      .from('resources_public')
      .select('days_left, is_closed')
      .eq('name', name)
      .single();
    expect(data!.days_left).toBeNull();
    expect(data!.is_closed).toBe(false);
  });

  // Nothing else in this file pins that resources_public actually exposes
  // the exclusivity badge -- the positive column-list check was retired in
  // favour of tests/rls/schema-guards.test.ts's G7, which only catches
  // *over*-exposure. A future rebuild of this view could silently drop
  // the column (or revert to projecting is_exclusive) and every guard in
  // this suite would stay green, even though the badge is the entire
  // reason ruling H10 replaced is_exclusive with this enum. This reads the
  // value back through the anon client, not the service client, so it
  // proves the public surface actually carries it, not merely that the
  // column exists on the base table.
  it('exposes the exclusivity badge value anonymously', async () => {
    const svc = serviceClient();
    const name = `Exclusive resource ${Date.now()}`;
    const { error } = await svc.from('resources').insert({
      name, partner: 'Public View Partner', partner_tier: 'strategic',
      resource_type: 'Credits', need_primary: 'compute',
      description: 'exclusive fixture', external_url: 'https://example.org/h',
      status: 'live', exclusivity: 'exclusive',
    });
    expect(error).toBeNull();

    const { data, error: readError } = await anonClient()
      .from('resources_public')
      .select('exclusivity')
      .eq('name', name)
      .single();
    expect(readError).toBeNull();
    expect(data!.exclusivity).toBe('exclusive');
  });

  // Task 12L restores partner_logo_url/partner_website_url to
  // resources_public via a LEFT join against partners. Same rationale as
  // the exclusivity case above: a catalog guard can prove the column is
  // absent when it shouldn't be, but only reading the value back through
  // the anon client proves the join actually resolves and the real value
  // reaches the public surface, not merely that the column name exists.
  it('exposes partner logo and website through the restored join anonymously', async () => {
    const svc = serviceClient();
    const stamp = Date.now();
    const partnerName = `Public View Partner With Logo ${stamp}`;
    const { error: partnerError } = await svc.from('partners').insert({
      name: partnerName,
      logo_url: 'https://example.org/logo.png',
      website_url: 'https://example.org',
    });
    expect(partnerError).toBeNull();

    const name = `Has partner logo ${stamp}`;
    const { error } = await svc.from('resources').insert({
      name, partner: partnerName, partner_tier: 'strategic',
      resource_type: 'Credits', need_primary: 'compute',
      description: 'has partner logo', external_url: 'https://example.org/i',
      status: 'live',
    });
    expect(error).toBeNull();

    const { data, error: readError } = await anonClient()
      .from('resources_public')
      .select('partner_logo_url, partner_website_url')
      .eq('name', name)
      .single();
    expect(readError).toBeNull();
    expect(data!.partner_logo_url).toBe('https://example.org/logo.png');
    expect(data!.partner_website_url).toBe('https://example.org');
  });

  // Ruling 6: the brief's hand-written "leaves the base tables unreachable
  // anonymously" case is deleted here. It lists six of sixteen base tables
  // and asserts toHaveLength(0), which is satisfied by a permission error,
  // an empty table, or a wide-open grant alike -- so it doesn't test what
  // it claims. A dedicated later task adds a catalog-driven guard over
  // pg_class that covers every base table and cannot go stale; a weaker,
  // partial version does not belong here.

  // A payload valid for the view's real columns, per view. This matters:
  // if the payload names a column the view doesn't have (e.g. `name` on
  // site_content_public), PostgREST rejects it at the schema-cache
  // column-resolution stage (PGRST204) *before* the request ever reaches
  // Postgres's permission check. That failure is real but proves nothing
  // about whether anon holds a write grant -- it would happen identically
  // even if anon had full insert privilege on the view. Using a payload
  // that matches each view's actual columns forces the request through to
  // Postgres so the assertion exercises the real permission check
  // (SQLSTATE 42501) rather than an artifact of the wrong column name.
  const INSERT_PAYLOAD: Record<(typeof PUBLIC_VIEWS)[number], Record<string, unknown>> = {
    resources_public: { name: `Injected ${Date.now()}` },
    headline_stats_public: { value: 'x', label: `Injected ${Date.now()}` },
    compute_metrics_public: { value: 'x', label: `Injected ${Date.now()}` },
    site_content_public: { key: `injected-${Date.now()}`, value: 'x', locale: 'en' },
    programmes_public: { title: `Injected ${Date.now()}` },
    impact_stories_public: { organisation: `Injected ${Date.now()}` },
    need_counts_public: { need_primary: 'compute', live_count: 999 },
    partners_public: { name: `Injected Partner ${Date.now()}` },
  };

  const UPDATE_PAYLOAD: Record<(typeof WRITABLE_SHAPE_VIEWS)[number], Record<string, unknown>> = {
    headline_stats_public: { label: `Overwritten ${Date.now()}` },
    compute_metrics_public: { label: `Overwritten ${Date.now()}` },
    site_content_public: { value: `Overwritten ${Date.now()}` },
    programmes_public: { title: `Overwritten ${Date.now()}` },
    impact_stories_public: { organisation: `Overwritten ${Date.now()}` },
    partners_public: { sort_order: 999 },
  };

  // site_content_public has no `id` column (its key is key+locale), and
  // partners_public has no `id` column either (its key is `name`), so the
  // update's WHERE filter must name a column the view actually has -- and
  // the filter value must be type-valid for that column (a non-uuid
  // string against a uuid column errors at parse time, before Postgres
  // ever reaches the permission check this test wants to exercise).
  const UPDATE_FILTER: Record<(typeof WRITABLE_SHAPE_VIEWS)[number], [string, string]> = {
    headline_stats_public: ['id', '00000000-0000-0000-0000-000000000000'],
    compute_metrics_public: ['id', '00000000-0000-0000-0000-000000000000'],
    site_content_public: ['key', 'no-such-key'],
    programmes_public: ['id', '00000000-0000-0000-0000-000000000000'],
    impact_stories_public: ['id', '00000000-0000-0000-0000-000000000000'],
    partners_public: ['name', 'no-such-partner'],
  };

  // Requirement 8 (Task 11b), updated by Task 12L: assert the SQLSTATE,
  // not merely that some error occurred. `not.toBeNull()` alone is the
  // same shape that would let a PGRST204 schema-cache rejection (wrong
  // column name in the payload) masquerade as a real permission denial --
  // confirmed directly against this database: the single-table views
  // (headline_stats_public, compute_metrics_public, site_content_public,
  // programmes_public, impact_stories_public and, as of Task 12L,
  // partners_public) are auto-updatable, so their write is stopped by an
  // actual GRANT check (42501, "permission denied for view <name>");
  // need_counts_public (a GROUP BY aggregate) and, as of Task 12L,
  // resources_public (a join against partners again) are not
  // automatically updatable at all, so Postgres rejects the write before
  // any privilege is even checked (55000, "cannot insert into view").
  const AUTO_UPDATABLE_CODE = '42501';
  const NOT_AUTO_UPDATABLE_CODE = '55000';

  it('cannot be written through anonymously on any public view', async () => {
    const anon = anonClient();
    const writableShape: readonly string[] = WRITABLE_SHAPE_VIEWS;
    for (const view of PUBLIC_VIEWS) {
      const { error: insertError } = await anon.from(view).insert(INSERT_PAYLOAD[view] as never);
      expect(insertError, `${view} accepted an anonymous insert`).not.toBeNull();
      const expectedCode = writableShape.includes(view)
        ? AUTO_UPDATABLE_CODE
        : NOT_AUTO_UPDATABLE_CODE;
      expect(
        insertError!.code,
        `${view} insert failed with SQLSTATE ${insertError!.code} ("${insertError!.message}"), expected ${expectedCode}`,
      ).toBe(expectedCode);
    }
    for (const view of WRITABLE_SHAPE_VIEWS) {
      const [column, value] = UPDATE_FILTER[view];
      const { error: updateError } = await anon
        .from(view)
        .update(UPDATE_PAYLOAD[view] as never)
        .eq(column, value);
      expect(updateError, `${view} accepted an anonymous update`).not.toBeNull();
      expect(
        updateError!.code,
        `${view} update failed with SQLSTATE ${updateError!.code} ("${updateError!.message}"), expected ${AUTO_UPDATABLE_CODE}`,
      ).toBe(AUTO_UPDATABLE_CODE);
    }
  });

  // Requirement 8: today only resources_public and need_counts_public are
  // actually read anonymously by the rest of this file. Without this test,
  // dropping a view from the anon SELECT grant (supabase/migrations/
  // 0009_public_views.sql, as rebuilt by 0013_reconcile_partners.sql and
  // 0014_partner_logos.sql) would leave every other test in this file
  // green while the public page backed by that view now 403s. Asserting
  // `error` is null only, not a row count: most of the base tables
  // underlying these eight views are empty in a fresh reset (only
  // resources gets fixture rows in this file), so a row-count assertion
  // would be asserting fixture data, not the grant.
  it('can be read anonymously on all eight public views', async () => {
    const anon = anonClient();
    for (const view of PUBLIC_VIEWS) {
      const { error } = await anon.from(view).select().limit(1);
      expect(error, `${view} could not be read anonymously: ${error?.message}`).toBeNull();
    }
  });

  it('counts live resources per need for the home page browse band', async () => {
    const stamp = Date.now();
    const svc = serviceClient();
    const name = `Need count resource ${stamp}`;
    const { data: before } = await anonClient()
      .from('need_counts_public')
      .select('live_count')
      .eq('need_primary', 'compute')
      .single();
    const beforeCount = (before?.live_count as number | undefined) ?? 0;

    const { error } = await svc.from('resources').insert({
      name, partner: 'Public View Partner', partner_tier: 'strategic',
      resource_type: 'Credits', need_primary: 'compute',
      description: 'need count fixture', external_url: 'https://example.org/g',
      status: 'live',
    });
    expect(error).toBeNull();

    const { data: after, error: readError } = await anonClient()
      .from('need_counts_public')
      .select('need_primary, live_count')
      .eq('need_primary', 'compute')
      .single();
    expect(readError).toBeNull();
    expect(after!.live_count as number).toBeGreaterThan(beforeCount);
  });
});
