import { describe, it, expect, beforeAll } from 'vitest';
import { anonClient, roleClient, serviceClient, ensureTestUsers } from '../helpers/clients';
import { fixtureStamp } from '../helpers/fixtures';

describe('engagement_events', () => {
  beforeAll(async () => {
    await ensureTestUsers();
  });

  it('cannot be written anonymously — writes go through a server route', async () => {
    // A valid, complete payload that would genuinely insert if permitted --
    // a denial test asserting only a malformed payload proves nothing about
    // the grant/policy actually stopping anon.
    const { error } = await anonClient().from('engagement_events').insert({
      event_name: 'resource_view',
      session_hash: `anon-attempt-${Date.now()}`,
    });
    expect(error).not.toBeNull();
    // Assert the denial positively: anon holds no grant on this table at
    // all, so this must fail with 42501 (permission denied), not merely
    // fail for some unrelated reason (e.g. a bad payload).
    expect(error?.code).toBe('42501');
  });

  it('cannot be read anonymously', async () => {
    // Insert a row via service_role first so an unguarded anon read would
    // actually return something -- without this, the table is empty at
    // this point in the file and the length assertion alone would pass
    // vacuously even if anon held full SELECT.
    const svc = serviceClient();
    const { error: insertError } = await svc.from('engagement_events').insert({
      event_name: 'resource_view',
      session_hash: `anon-read-probe-${Date.now()}`,
    });
    expect(insertError).toBeNull();

    const { data, error } = await anonClient().from('engagement_events').select('id');
    expect(data ?? []).toHaveLength(0);
    // Assert the denial positively: anon was revoked at the grant layer, so
    // this must fail with 42501, not merely return no rows for some other
    // reason.
    expect(error?.code).toBe('42501');
  });

  it('accepts the five specified event names through service_role', async () => {
    const svc = serviceClient();
    const stamp = Date.now();
    for (const name of ['resource_view', 'apply_click', 'search_performed', 'filter_used', 'export_clicked']) {
      const { error } = await svc.from('engagement_events').insert({
        event_name: name,
        session_hash: `sess-${name}-${stamp}`,
      });
      expect(error, `${name} rejected`).toBeNull();
    }
  });

  it('rejects a sixth, unspecified event name with a CHECK violation', async () => {
    // The five names above are fixed by CLAUDE.md/GA4; the CHECK constraint
    // is what actually enforces that, not just convention. Without it, an
    // arbitrary string like 'lol' would insert identically to the five.
    const svc = serviceClient();
    const { error } = await svc.from('engagement_events').insert({
      event_name: 'lol',
      session_hash: `sess-bad-name-${Date.now()}`,
    });
    expect(error?.code).toBe('23514');
  });

  it('defaults is_bot to false', async () => {
    const svc = serviceClient();
    const { data } = await svc
      .from('engagement_events')
      .insert({
        event_name: 'resource_view',
        session_hash: `bot-default-${Date.now()}`,
      })
      .select('is_bot')
      .single();
    expect(data!.is_bot).toBe(false);
  });

  it('is readable by all three roles for reporting, and by nobody else', async () => {
    // `authenticated` holds a table-level SELECT grant here, so an RLS
    // *policy* denial never surfaces as an error at all: PostgREST returns
    // `data: []` with `error: null`, indistinguishable from a table that
    // genuinely holds no matching row. `expect(error).toBeNull()` -- all this
    // test asserted until SP2a -- therefore passes with
    // engagement_events_select_authenticated dropped entirely (verified by
    // dropping it: the whole file stayed 8/8 green). The same reasoning
    // tests/rls/public-views.test.ts:333 applies to writes applies to reads:
    // the permitted side must name rows it knows exist and require them back,
    // and the forbidden side must name the exact SQLSTATE.
    const svc = serviceClient();
    const stamp = fixtureStamp();

    // engagement_events rows are swept only when their resource_id points at
    // a fixture resource (tests/helpers/fixtures.ts), so these hang off a
    // stamped resource rather than standing alone -- an event row with a null
    // resource_id is invisible to the sweep and accumulates run after run.
    // The resource takes the default status ('pipeline'), so it never reaches
    // resources_public or the prerendered page count while it exists.
    const { error: partnerError } = await svc
      .from('partners')
      .upsert({ name: 'Test Partner' }, { onConflict: 'name', ignoreDuplicates: true });
    expect(partnerError).toBeNull();

    const { data: resource, error: resourceError } = await svc
      .from('resources')
      .insert({
        name: `Reporting read fixture ${stamp}`,
        partner: 'Test Partner',
        partner_tier: 'network',
        resource_type: 'Course',
        need_primary: 'training',
        description: 'engagement_events read-scope fixture',
        external_url: 'https://example.org/apply',
      })
      .select('id')
      .single();
    expect(resourceError, `could not seed the fixture resource: ${resourceError?.message}`).toBeNull();
    const resourceId = (resource as { id: string }).id;

    const { data: inserted, error: seedError } = await svc
      .from('engagement_events')
      .insert(
        ['resource_view', 'apply_click', 'export_clicked'].map((event_name) => ({
          event_name,
          resource_id: resourceId,
          session_hash: `report-read-${event_name}-${stamp}`,
        })),
      )
      .select('id');
    expect(seedError, `could not seed engagement_events: ${seedError?.message}`).toBeNull();
    const seededIds = ((inserted ?? []) as Array<{ id: string }>).map((r) => r.id).sort();
    // Guards the positive assertion below against becoming vacuous: three
    // seeded rows compared against three returned rows only proves anything
    // if three rows were really seeded.
    expect(seededIds, 'the seed itself inserted no rows').toHaveLength(3);

    for (const role of ['admin', 'editor', 'viewer'] as const) {
      const client = await roleClient(role);
      const { data, error } = await client
        .from('engagement_events')
        .select('id')
        .eq('resource_id', resourceId);
      expect(error, `${role} could not read events: ${error?.message}`).toBeNull();
      const seen = ((data ?? []) as Array<{ id: string }>).map((r) => r.id).sort();
      expect(
        seen,
        `${role} saw ${seen.length} of the ${seededIds.length} engagement_events rows just seeded ` +
          `against resource ${resourceId}. An empty result is what an RLS denial looks like ` +
          'through a table-level SELECT grant, not an empty table: check that policy ' +
          'engagement_events_select_authenticated still exists and still admits current_app_role().',
      ).toEqual(seededIds);
    }

    // The forbidden side, on the identical query shape so the contrast is
    // the role and nothing else. anon holds no grant on this table at all, so
    // it is stopped a layer earlier than RLS and must say so with SQLSTATE
    // 42501 rather than returning the empty success authenticated-without-a-
    // profile would get.
    const { data: anonData, error: anonError } = await anonClient()
      .from('engagement_events')
      .select('id')
      .eq('resource_id', resourceId);
    expect(anonData ?? [], 'anon read back rows from engagement_events').toHaveLength(0);
    expect(
      anonError?.code,
      `anon read of engagement_events ${
        anonError ? `failed with SQLSTATE ${anonError.code} ("${anonError.message}")` : 'returned no error at all'
      }, expected 42501 (permission denied)`,
    ).toBe('42501');
  });

  it('stores no ip address or raw user agent column', async () => {
    // column_names/index_names (supabase/seed.sql, Task 3) are set-returning
    // functions -- `returns table (column_name text)` / `returns table
    // (index_name text)` -- so the RPC resolves to an array of row objects,
    // e.g. [{ column_name: 'id' }, { column_name: 'event_name' }, ...],
    // not a flat text[]. Confirmed by calling it directly against this DB.
    const svc = serviceClient();
    const { data, error } = await svc.rpc('column_names', { table_name: 'engagement_events' });
    expect(error).toBeNull();
    const columns = (data as Array<{ column_name: string }>).map((row) =>
      row.column_name.toLowerCase(),
    );
    for (const forbidden of ['ip', 'ip_address', 'ip_hash', 'user_agent']) {
      expect(columns, `engagement_events must not have ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('has the indexes the dashboard read pattern needs', async () => {
    const svc = serviceClient();
    const { data, error } = await svc.rpc('index_names', { table_name: 'engagement_events' });
    expect(error).toBeNull();
    const names = (data as Array<{ index_name: string }>).map((row) => row.index_name);
    expect(names).toContain('engagement_events_occurred_at_idx');
    expect(names).toContain('engagement_events_name_time_idx');
    expect(names).toContain('engagement_events_resource_idx');
    expect(names).toContain('engagement_events_human_idx');
  });
});
