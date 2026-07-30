import { describe, it, expect, beforeAll } from 'vitest';
import { anonClient, roleClient, serviceClient, ensureTestUsers } from '../helpers/clients';

let rowId: string;

describe('audit_log is append-only', () => {
  beforeAll(async () => {
    await ensureTestUsers();
    const svc = serviceClient();
    const { data, error } = await svc
      .from('audit_log')
      .insert({
        actor_name: 'RLS Test',
        action: 'published',
        entity_type: 'resource',
        entity_label: 'Test Resource',
        change_summary: 'Status Pipeline to Live',
        diff: { status: { before: 'pipeline', after: 'live' } },
      })
      .select('id')
      .single();
    if (error) throw error;
    rowId = data.id;
  });

  it('is unreadable anonymously', async () => {
    const { data } = await anonClient().from('audit_log').select('id');
    expect(data ?? []).toHaveLength(0);
  });

  it('is readable by all three roles', async () => {
    for (const role of ['admin', 'editor', 'viewer'] as const) {
      const client = await roleClient(role);
      const { data, error } = await client.from('audit_log').select('id');
      expect(error, `${role} could not read audit_log`).toBeNull();
      expect((data ?? []).length).toBeGreaterThan(0);
    }
  });

  // Title updated in SP3 Task 1: rows arrive through the audit trigger, in the
  // mutation's own transaction, NOT through a service_role insert made by the
  // server action. The invariant this asserts is unchanged and is what makes
  // that design necessary -- no role, admin included, may write here by hand.
  it('grants no insert policy even to admin — rows arrive via the audit trigger', async () => {
    const admin = await roleClient('admin');
    const { error } = await admin.from('audit_log').insert({
      actor_name: 'Admin direct', action: 'edited',
      entity_type: 'resource', entity_label: 'x', change_summary: 'y',
    });
    expect(error?.code).toBe('42501');
  });

  it('rejects UPDATE as admin', async () => {
    // RLS denying an UPDATE through a missing policy filters every row
    // out: zero rows affected, no error, PostgREST returns 204. There is
    // no error to assert here — the real guard is that the row is
    // unchanged, verified below via service_role.
    const admin = await roleClient('admin');
    await admin
      .from('audit_log')
      .update({ change_summary: 'rewritten' })
      .eq('id', rowId);

    const svc = serviceClient();
    const { data } = await svc
      .from('audit_log')
      .select('change_summary')
      .eq('id', rowId)
      .single();
    expect(data!.change_summary).toBe('Status Pipeline to Live');
  });

  it('rejects UPDATE as service_role — the trigger, not the policy, does this', async () => {
    const svc = serviceClient();
    const { error } = await svc
      .from('audit_log')
      .update({ change_summary: 'rewritten by service_role' })
      .eq('id', rowId);
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/append-only/i);
  });

  it('rejects DELETE as service_role', async () => {
    const svc = serviceClient();
    const { error } = await svc.from('audit_log').delete().eq('id', rowId);
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/append-only/i);

    const { data } = await svc.from('audit_log').select('id').eq('id', rowId);
    expect(data).toHaveLength(1);
  });

  it('keeps actor_name readable after the referencing profile is removed', async () => {
    const svc = serviceClient();
    const { data: created, error: createError } = await svc.auth.admin.createUser({
      email: `doomed-${Date.now()}@askhub.test`,
      password: 'Doomed-Passw0rd!', email_confirm: true,
    });
    if (createError) throw createError;
    const { data: profile } = await svc
      .from('profiles')
      .select('id')
      .eq('user_id', created.user!.id)
      .single();

    const { data: entry } = await svc
      .from('audit_log')
      .insert({
        actor: profile!.id, actor_name: 'Doomed User', action: 'created',
        entity_type: 'resource', entity_label: 'Survives deletion',
        change_summary: 'Created resource',
      })
      .select('id')
      .single();

    const { error: deleteError } = await svc.auth.admin.deleteUser(created.user!.id);
    if (deleteError) throw deleteError;

    const { data: after } = await svc
      .from('audit_log')
      .select('actor, actor_name, entity_label')
      .eq('id', entry!.id)
      .single();
    // No FK on audit_log.actor (Ruling 2): a deleted profile leaves the
    // stale uuid in place rather than being nulled out by an ON DELETE SET
    // NULL cascade — there is no such cascade to fire. actor_name is the
    // durable, denormalised record this whole test exists to prove.
    expect(after!.actor).toBe(profile!.id);
    expect(after!.actor_name).toBe('Doomed User');
    expect(after!.entity_label).toBe('Survives deletion');
  });

  it('accepts the trigger-written insert while still refusing a direct one', async () => {
    const admin = await roleClient('admin');

    // Direct insert: still refused, exactly as before. SP3's trigger changed
    // how rows arrive, not who may write them by hand.
    const direct = await admin.from('audit_log').insert({
      actor_name: 'hand-written',
      action: 'edited',
      entity_type: 'resource',
      entity_label: 'hand-written',
      change_summary: 'hand-written',
    });
    expect(direct.error?.code).toBe('42501');

    // Trigger-written: succeeds, as the mutation's own side effect, even though
    // the very same session cannot insert here directly. That asymmetry is the
    // architecture -- the row is written by the database as the table owner,
    // inside the transaction of the write it describes.
    const svc = serviceClient();
    const before = await svc.from('audit_log').select('id', { count: 'exact', head: true });
    const { error, count } = await admin
      .from('site_content')
      .update({ value: `Welcome to AskHub ${Date.now()}` }, { count: 'exact' })
      .eq('key', 'welcome_title')
      .eq('locale', 'en');
    expect(error).toBeNull();
    expect(count, 'the fixture key must exist, or this test passes vacuously').toBe(1);

    const after = await svc.from('audit_log').select('id', { count: 'exact', head: true });
    expect((after.count ?? 0) - (before.count ?? 0)).toBe(1);
  });
});
