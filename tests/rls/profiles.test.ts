import { describe, it, expect, beforeAll } from 'vitest';
import { anonClient, roleClient, serviceClient, ensureTestUsers } from '../helpers/clients';

describe('profiles', () => {
  beforeAll(async () => {
    await ensureTestUsers();
  });

  it('creates a profile row automatically, defaulting to viewer', async () => {
    const svc = serviceClient();
    const email = `default-role-${Date.now()}@askhub.test`;
    const { data, error } = await svc.auth.admin.createUser({
      email,
      password: 'Default-Role-Passw0rd!',
      email_confirm: true,
    });
    expect(error).toBeNull();

    const { data: profile } = await svc
      .from('profiles')
      .select('role, is_active, email')
      .eq('user_id', data.user!.id)
      .single();

    expect(profile!.role).toBe('viewer');
    expect(profile!.is_active).toBe(true);
    expect(profile!.email).toBe(email);
  });

  it('is unreadable anonymously', async () => {
    const { data, error } = await anonClient().from('profiles').select('id');
    expect(data ?? []).toHaveLength(0);
    // Assert the denial positively: `anon` was revoked at the grant layer
    // (Ruling 1), so this must fail with 42501 (permission denied). A bare
    // `not.toBe('42P01')` inside an `if (error)` would also go green if the
    // table were dropped entirely and PostgREST answered PGRST205 instead --
    // exactly the trap that already bit this repo once.
    expect(error?.code).toBe('42501');
  });

  it('is readable by all three authenticated roles', async () => {
    for (const role of ['admin', 'editor', 'viewer'] as const) {
      const client = await roleClient(role);
      const { data, error } = await client.from('profiles').select('id');
      expect(error, `${role} read failed`).toBeNull();
      expect((data ?? []).length).toBeGreaterThan(0);
    }
  });

  it('lets admin change a role', async () => {
    // A throwaway user, not one of the three fixtures: roleClient('editor')
    // and roleClient('viewer') in the other cases depend on ensureTestUsers
    // having set those roles, and vitest gives no ordering guarantee across
    // cases. Mutating a fixture's role here would make this case's outcome
    // depend on run order.
    const svc = serviceClient();
    const email = `role-change-target-${Date.now()}@askhub.test`;
    const { data: created, error: createError } = await svc.auth.admin.createUser({
      email,
      password: 'Role-Change-Target-Passw0rd!',
      email_confirm: true,
    });
    expect(createError).toBeNull();

    const admin = await roleClient('admin');
    const { error } = await admin
      .from('profiles')
      .update({ role: 'editor' })
      .eq('user_id', created.user!.id);
    expect(error).toBeNull();

    // Read the value back through service_role to prove the write actually
    // landed, rather than trusting a null error alone -- an UPDATE that
    // matches zero rows also returns a null error.
    const { data: profile, error: readError } = await svc
      .from('profiles')
      .select('role')
      .eq('user_id', created.user!.id)
      .single();
    expect(readError).toBeNull();
    expect(profile!.role).toBe('editor');
  });

  it('does not let editor change a role', async () => {
    const client = await roleClient('editor');
    const { error } = await client
      .from('profiles')
      .update({ role: 'admin' })
      .eq('email', 'rls-editor@askhub.test');
    // RLS denies via missing policy: either an explicit error or zero
    // rows affected. Assert the row did not actually change.
    const svc = serviceClient();
    const { data } = await svc
      .from('profiles')
      .select('role')
      .eq('email', 'rls-editor@askhub.test')
      .single();
    expect(data!.role).toBe('editor');
    if (error) expect(error.code).toBe('42501');
  });

  it('does not let viewer change anything', async () => {
    const client = await roleClient('viewer');
    await client
      .from('profiles')
      .update({ display_label: 'hacked' })
      .eq('email', 'rls-viewer@askhub.test');
    const svc = serviceClient();
    const { data } = await svc
      .from('profiles')
      .select('display_label')
      .eq('email', 'rls-viewer@askhub.test')
      .single();
    expect(data!.display_label).not.toBe('hacked');
  });
});
