import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ensureTestUsers, roleClient, serviceClient } from '../helpers/clients';

/**
 * Both flags this suite touches gate real behaviour (`feature_public_impact_page`
 * gates a public page; `feature_innovator_profiles` gates a phase-2 feature),
 * and `settings` rows are seeded once by migration, not created per test run
 * -- there is no `db:reset` between suite runs in normal CI/dev use (house
 * rule, tests/rls/site.test.ts:33-45). So this suite captures both flags'
 * values before touching either and restores both unconditionally in
 * `afterAll`, regardless of which assertion above passed or failed: an
 * admin's flip in the first test is expected to be undone by the test
 * itself, but a failure partway through must not be able to leave a flag
 * flipped on for every later suite and every later screen render.
 */
describe('settings writes are admin-only at the database boundary', () => {
  const originalFlags: Record<string, unknown> = {};

  beforeAll(async () => {
    await ensureTestUsers();
    const svc = serviceClient();
    const { data, error } = await svc
      .from('settings')
      .select('key, value')
      .in('key', ['feature_innovator_profiles', 'feature_public_impact_page']);
    if (error) throw error;
    for (const row of data ?? []) {
      originalFlags[row.key] = row.value;
    }
  });

  afterAll(async () => {
    const svc = serviceClient();
    for (const [key, value] of Object.entries(originalFlags)) {
      await svc.from('settings').update({ value }).eq('key', key);
    }
  });

  it('lets an admin change a flag and records it', async () => {
    const admin = await roleClient('admin');
    const { error } = await admin
      .from('settings')
      .update({ value: true })
      .eq('key', 'feature_innovator_profiles');
    expect(error).toBeNull();

    const { data } = await serviceClient()
      .from('audit_log')
      .select('entity_label, change_summary, actor_name')
      .eq('entity_type', 'setting')
      .order('occurred_at', { ascending: false })
      .limit(1);
    expect(data![0]!.entity_label).toBe('Setting: feature_innovator_profiles');
    expect(data![0]!.actor_name).not.toBe('system');

    // Restore: both flags are off at launch.
    await admin.from('settings').update({ value: false }).eq('key', 'feature_innovator_profiles');
  });

  it('refuses an editor, who may write every content table but not this one', async () => {
    const editor = await roleClient('editor');
    await editor.from('settings').update({ value: true }).eq('key', 'feature_public_impact_page');

    const { data } = await serviceClient()
      .from('settings')
      .select('value')
      .eq('key', 'feature_public_impact_page')
      .single();
    expect(data!.value, 'an editor flipped a feature flag').toBe(false);
  });
});
