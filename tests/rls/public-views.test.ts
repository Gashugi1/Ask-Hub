import { describe, it, expect, beforeAll } from 'vitest';
import { anonClient, serviceClient } from '../helpers/clients';

const FORBIDDEN_COLUMNS = [
  'views', 'clicks', 'ctr', 'submitter_email', 'internal_notes',
  'note', 'source_ip_hash', 'status', 'ip_hash', 'user_agent',
];

// Ruling 1: eight views. compute_metrics_public is the one the brief's
// contract omits from Produces/Interfaces; it is created and tested here
// like the other seven.
const PUBLIC_VIEWS = [
  'partners_public',
  'resources_public',
  'headline_stats_public',
  'compute_metrics_public',
  'site_content_public',
  'programmes_public',
  'impact_stories_public',
  'need_counts_public',
] as const;

// Ruling 5: five of the eight are a single-table, simple-column-list
// projection over their base table, which Postgres treats as an
// auto-updatable view. If anon somehow held (or was ever mistakenly
// granted) write privilege on one of these, an insert/update would go
// through as the view owner, bypassing the base table's RLS entirely.
// resources_public is a join and need_counts_public is an aggregate, so
// neither is auto-updatable -- but every view is still asserted here so
// this test stays a real guard rather than one that only exercises the
// safe case.
const WRITABLE_SHAPE_VIEWS = [
  'partners_public',
  'headline_stats_public',
  'compute_metrics_public',
  'site_content_public',
  'programmes_public',
  'impact_stories_public',
] as const;

interface ColumnNameRow {
  column_name: string;
}

let livePartnerId: string;

describe('public-safe views', () => {
  beforeAll(async () => {
    const svc = serviceClient();
    const { data: partner, error: partnerError } = await svc
      .from('partners')
      .insert({
        name: `Public View Partner ${Date.now()}`,
        website_url: 'https://example.org', tier: 'strategic',
      })
      .select('id')
      .single();
    if (partnerError) throw partnerError;
    livePartnerId = partner!.id;

    const { error: resourcesError } = await svc.from('resources').insert([
      {
        name: `Live and visible ${Date.now()}`, partner_id: livePartnerId,
        resource_type: 'Credits', need_primary: 'compute',
        description: 'live', external_url: 'https://example.org/a',
        status: 'live',
      },
      {
        name: `Pipeline and hidden ${Date.now()}`, partner_id: livePartnerId,
        resource_type: 'Credits', need_primary: 'compute',
        description: 'pipeline', external_url: 'https://example.org/b',
        status: 'pipeline',
      },
      {
        name: `Reference and hidden ${Date.now()}`, partner_id: livePartnerId,
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
        name: liveName, partner_id: livePartnerId,
        resource_type: 'Credits', need_primary: 'compute',
        description: 'live', external_url: 'https://example.org/live',
        status: 'live',
      },
      {
        name: pipelineName, partner_id: livePartnerId,
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

  it('exposes no internal or analytics column on any public view', async () => {
    const svc = serviceClient();
    for (const view of PUBLIC_VIEWS) {
      const { data, error } = await svc.rpc('column_names', { table_name: view });
      expect(error, `column_names failed for ${view}`).toBeNull();
      const columns = (data as ColumnNameRow[]).map((c) => c.column_name.toLowerCase());
      expect(columns.length, `${view} returned no columns -- does it exist?`).toBeGreaterThan(0);
      for (const forbidden of FORBIDDEN_COLUMNS) {
        expect(columns, `${view} exposes ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it('computes closed state and days left without exposing status', async () => {
    const svc = serviceClient();
    const name = `Past deadline ${Date.now()}`;
    await svc.from('resources').insert({
      name, partner_id: livePartnerId,
      resource_type: 'Course', need_primary: 'training',
      description: 'closed', external_url: 'https://example.org/d',
      status: 'live', deadline: '2020-01-01',
    });

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
    await svc.from('resources').insert({
      name, partner_id: livePartnerId,
      resource_type: 'Course', need_primary: 'training',
      description: 'due today', external_url: 'https://example.org/e',
      status: 'live', deadline: today,
    });

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
    await svc.from('resources').insert({
      name, partner_id: livePartnerId,
      resource_type: 'Credits', need_primary: 'compute',
      description: 'rolling', external_url: 'https://example.org/f',
      status: 'live', deadline: null,
    });

    const { data } = await anonClient()
      .from('resources_public')
      .select('days_left, is_closed')
      .eq('name', name)
      .single();
    expect(data!.days_left).toBeNull();
    expect(data!.is_closed).toBe(false);
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
    partners_public: { name: `Injected ${Date.now()}`, website_url: 'https://example.org' },
    resources_public: { name: `Injected ${Date.now()}` },
    headline_stats_public: { value: 'x', label: `Injected ${Date.now()}` },
    compute_metrics_public: { value: 'x', label: `Injected ${Date.now()}` },
    site_content_public: { key: `injected-${Date.now()}`, value: 'x', locale: 'en' },
    programmes_public: { title: `Injected ${Date.now()}` },
    impact_stories_public: { organisation: `Injected ${Date.now()}` },
    need_counts_public: { need_primary: 'compute', live_count: 999 },
  };

  const UPDATE_PAYLOAD: Record<(typeof WRITABLE_SHAPE_VIEWS)[number], Record<string, unknown>> = {
    partners_public: { name: `Overwritten ${Date.now()}` },
    headline_stats_public: { label: `Overwritten ${Date.now()}` },
    compute_metrics_public: { label: `Overwritten ${Date.now()}` },
    site_content_public: { value: `Overwritten ${Date.now()}` },
    programmes_public: { title: `Overwritten ${Date.now()}` },
    impact_stories_public: { organisation: `Overwritten ${Date.now()}` },
  };

  // site_content_public has no `id` column (its key is key+locale), so the
  // update's WHERE filter must name a column the view actually has -- and
  // the filter value must be type-valid for that column (a non-uuid
  // string against a uuid column errors at parse time, before Postgres
  // ever reaches the permission check this test wants to exercise).
  const UPDATE_FILTER: Record<(typeof WRITABLE_SHAPE_VIEWS)[number], [string, string]> = {
    partners_public: ['id', '00000000-0000-0000-0000-000000000000'],
    headline_stats_public: ['id', '00000000-0000-0000-0000-000000000000'],
    compute_metrics_public: ['id', '00000000-0000-0000-0000-000000000000'],
    site_content_public: ['key', 'no-such-key'],
    programmes_public: ['id', '00000000-0000-0000-0000-000000000000'],
    impact_stories_public: ['id', '00000000-0000-0000-0000-000000000000'],
  };

  it('cannot be written through anonymously on any public view', async () => {
    const anon = anonClient();
    for (const view of PUBLIC_VIEWS) {
      const { error: insertError } = await anon.from(view).insert(INSERT_PAYLOAD[view] as never);
      expect(insertError, `${view} accepted an anonymous insert`).not.toBeNull();
    }
    for (const view of WRITABLE_SHAPE_VIEWS) {
      const [column, value] = UPDATE_FILTER[view];
      const { error: updateError } = await anon
        .from(view)
        .update(UPDATE_PAYLOAD[view] as never)
        .eq(column, value);
      expect(updateError, `${view} accepted an anonymous update`).not.toBeNull();
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
      name, partner_id: livePartnerId,
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
