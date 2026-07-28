import { describe, it, expect, beforeAll } from 'vitest';
import { anonClient, roleClient, serviceClient, ensureTestUsers } from '../helpers/clients';

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

  it('is readable by all three roles for reporting', async () => {
    for (const role of ['admin', 'editor', 'viewer'] as const) {
      const client = await roleClient(role);
      const { error } = await client.from('engagement_events').select('id').limit(1);
      expect(error, `${role} could not read events`).toBeNull();
    }
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
