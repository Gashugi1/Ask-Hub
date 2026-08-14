import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { anonClient, serviceClient } from '../helpers/clients';
import { fixtureStamp } from '../helpers/fixtures';
import { toAdminResource } from '@/lib/admin/types';
import { deadlineInfo } from '@/lib/deadline';
import type { Database } from '@/lib/supabase/database.types';

type ResourceRow = Database['public']['Tables']['resources']['Row'];

/**
 * CLAUDE.md: "Deadline past means the resource displays as Closed and is
 * flagged in admin. Its `status` does not change."
 *
 * The second sentence had no test. It is true today only because nothing on
 * the read path writes `status` — an accidental truth, and accidental truths
 * break silently. `resources_public` filters on `status = 'live'` without
 * ever projecting the column, and `toAdminResource` copies `row.status`
 * straight through; both are one edit away from deriving a status from the
 * deadline instead, and nothing would have caught it.
 *
 * Both layers are covered here, through the real read path rather than a
 * hand-built row: the SQL view is read with the **anon** client (the same
 * client the public surface uses), and the mapper is fed a row selected from
 * the database, not a literal. Three independent regressions are in scope:
 *
 *   1. the view stops admitting a past-deadline live row (a
 *      `deadline >= current_date` clause bolted onto the WHERE) — the row
 *      would vanish from the directory instead of showing as Closed;
 *   2. the view starts projecting a status, derived or otherwise;
 *   3. the mapper rewrites `status` when the deadline has passed.
 *
 * The `pipeline` fixture is here for the same reason the `live` one is: a
 * derived-status change is just as wrong in the other direction, and a rule
 * checked only against the one status the public surface shows is a rule
 * checked on half its domain.
 */
describe('a past deadline never changes a resource status', () => {
  const createdIds: string[] = [];
  const stamp = fixtureStamp();
  const livePastName = `Live past deadline ${stamp}`;
  const liveFutureName = `Live future deadline ${stamp}`;
  const pipelinePastName = `Pipeline past deadline ${stamp}`;

  /** Days from today as an ISO date, so no assertion here pins a calendar date. */
  function inDays(days: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  beforeAll(async () => {
    const svc = serviceClient();

    // resources.partner is a real FK against partners(name). Upserted with
    // ignoreDuplicates for the reason tests/rls/public-views.test.ts records:
    // only the row's existence matters, so a conflict is not a failure.
    const { error: partnerError } = await svc
      .from('partners')
      .upsert({ name: 'Public View Partner' }, { onConflict: 'name', ignoreDuplicates: true });
    if (partnerError) throw partnerError;

    const base = {
      partner: 'Public View Partner',
      partner_tier: 'strategic',
      resource_type: 'Credits',
      need_primary: 'compute',
      external_url: 'https://example.org/deadline-status',
    };
    const { data, error } = await svc
      .from('resources')
      .insert([
        { ...base, name: livePastName, description: 'live, closed', status: 'live', deadline: inDays(-30) },
        { ...base, name: liveFutureName, description: 'live, open', status: 'live', deadline: inDays(30) },
        {
          ...base,
          name: pipelinePastName,
          description: 'pipeline, closed',
          status: 'pipeline',
          deadline: inDays(-30),
        },
      ])
      .select('id');
    if (error) throw error;
    // Recorded before any assertion runs, so afterAll cleans up even if a
    // test throws mid-run — the house rule tests/rls/admin-actions-resources.ts
    // follows. A stranded `status = 'live'` fixture is served to anonymous
    // visitors by resources_public until the next sweep.
    for (const row of data ?? []) createdIds.push((row as { id: string }).id);
  });

  afterAll(async () => {
    if (createdIds.length === 0) return;
    await serviceClient().from('resources').delete().in('id', createdIds);
  });

  it('still admits a past-deadline live resource anonymously, flagged closed', async () => {
    const { data, error } = await anonClient()
      .from('resources_public')
      .select('name, is_closed, days_left')
      .in('name', [livePastName, liveFutureName]);
    expect(error).toBeNull();

    const rows = data ?? [];
    const names = rows.map((r) => r.name as string);
    // The whole point: the past deadline changed the display flag and
    // nothing else. Were the deadline folded into the view's WHERE clause,
    // this row would be absent rather than Closed, which is the failure mode
    // that looks like nothing is broken.
    expect(names).toContain(livePastName);
    expect(names).toContain(liveFutureName);

    const past = rows.find((r) => r.name === livePastName)!;
    const future = rows.find((r) => r.name === liveFutureName)!;
    expect(past.is_closed).toBe(true);
    expect(past.days_left as number).toBeLessThan(0);
    expect(future.is_closed).toBe(false);
  });

  it('leaves a past-deadline pipeline resource hidden and still pipeline', async () => {
    const { data: anonRows, error } = await anonClient()
      .from('resources_public')
      .select('name')
      .eq('name', pipelinePastName);
    expect(error).toBeNull();
    expect(anonRows ?? []).toHaveLength(0);

    const { data } = await serviceClient()
      .from('resources')
      .select('status')
      .eq('name', pipelinePastName)
      .single();
    expect(data!.status).toBe('pipeline');
  });

  it('never projects a status on the public view, derived or stored', async () => {
    // A derived `case when deadline < current_date then ... end as status`
    // is the concrete way this rule gets broken at the SQL layer, and it
    // would be invisible to every other test in this suite. Asserting the
    // SQLSTATE, not merely that some error occurred: 42703 is Postgres's
    // undefined_column, which is the only reason this select may fail.
    const { error } = await anonClient().from('resources_public').select('status').limit(1);
    expect(error, 'resources_public exposed a status column').not.toBeNull();
    expect(
      error!.code,
      `resources_public status select failed with SQLSTATE ${error!.code} ("${error!.message}"), expected 42703`,
    ).toBe('42703');
  });

  it('reads back the stored status unchanged once the deadline has passed', async () => {
    const { data, error } = await serviceClient()
      .from('resources')
      .select('name, status, deadline')
      .in('name', [livePastName, liveFutureName]);
    expect(error).toBeNull();

    const rows = data ?? [];
    const past = rows.find((r) => r.name === livePastName)!;
    const future = rows.find((r) => r.name === liveFutureName)!;
    // Both were inserted `live` and neither has been written since. If a
    // trigger, a rule, or a future auto-close job ever transitions status on
    // a passed deadline, this is where it surfaces.
    expect(past.status).toBe('live');
    expect(past.status).toBe(future.status);
  });

  it('maps a past-deadline row to Closed for display while keeping its status', async () => {
    const { data, error } = await serviceClient()
      .from('resources')
      .select('*')
      .eq('name', livePastName)
      .single();
    expect(error).toBeNull();

    // The real admin read path: readAdminResources() selects '*' from
    // `resources` and maps every row through this function. The row here is
    // that same select, so the mapper is fed database output rather than a
    // literal that could not disagree with the schema.
    const mapped = toAdminResource(data as ResourceRow);
    expect(deadlineInfo(mapped.deadline).state).toBe('closed');
    expect(mapped.status).toBe('live');
  });
});
