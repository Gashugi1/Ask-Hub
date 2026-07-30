import { describe, it, expect, beforeAll } from 'vitest';
import { ensureTestUsers, roleClient, serviceClient } from '../helpers/clients';

describe('resource writes at the database boundary', () => {
  beforeAll(async () => {
    await ensureTestUsers();
  });

  async function fixture(name: string) {
    const svc = serviceClient();
    const { data: partner } = await svc.from('partners').select('name').limit(1).single();
    const { data, error } = await svc
      .from('resources')
      .insert({
        name,
        partner: partner!.name,
        partner_tier: 'strategic',
        resource_type: 'Credits',
        need_primary: 'compute',
        description: 'Action boundary fixture.',
        external_url: 'https://example.org/apply',
      })
      .select('id')
      .single();
    if (error) throw error;
    return data!.id as string;
  }

  it('lets an editor publish, and records it as published', async () => {
    const id = await fixture(`editor-publish-${Date.now()}`);
    const editor = await roleClient('editor');
    const { error } = await editor.from('resources').update({ status: 'live' }).eq('id', id);
    expect(error).toBeNull();

    const { data } = await serviceClient()
      .from('audit_log')
      .select('action, actor_name')
      .eq('entity_id', id)
      .eq('action', 'published');
    expect(data).toHaveLength(1);
    expect(data![0]!.actor_name).not.toBe('system');
  });

  it('refuses every write verb to a viewer', async () => {
    const id = await fixture(`viewer-denied-${Date.now()}`);
    const viewer = await roleClient('viewer');
    const svc = serviceClient();

    await viewer.from('resources').update({ status: 'live' }).eq('id', id);
    await viewer.from('resources').delete().eq('id', id);
    const insert = await viewer.from('resources').insert({
      name: `viewer-insert-${Date.now()}`,
      partner: 'CINECA Leonardo',
      partner_tier: 'strategic',
      resource_type: 'Credits',
      need_primary: 'compute',
      description: 'Should never exist.',
      external_url: 'https://example.org/apply',
    });
    expect(insert.error).not.toBeNull();

    const { data } = await svc.from('resources').select('status').eq('id', id).single();
    expect(data, 'a viewer deleted a resource').not.toBeNull();
    expect(data!.status).toBe('pipeline');
  });

  /**
   * The precondition behind the "silent no-op" finding: PostgREST returns
   * `{ error: null, data: [] }` for an UPDATE or DELETE whose `.eq('id', ...)`
   * matches no row — for an admin, not only a refused role — with no status
   * code that distinguishes "nothing matched" from "one row changed".
   * src/lib/actions/resources.ts's `assertRowAffected` (unit-tested in
   * tests/unit/resource-actions.test.ts) is what turns this into a thrown
   * error instead of a reported success; this test pins the shape it relies
   * on, using the same `.select('id')` the fixed actions now perform.
   */
  it('returns no error and zero rows for a write against a nonexistent id, even as an admin', async () => {
    const admin = await roleClient('admin');
    const missingId = '00000000-0000-0000-0000-000000000404';

    const updated = await admin
      .from('resources')
      .update({ status: 'live' })
      .eq('id', missingId)
      .select('id');
    expect(updated.error).toBeNull();
    expect(updated.data).toEqual([]);

    const deleted = await admin.from('resources').delete().eq('id', missingId).select('id');
    expect(deleted.error).toBeNull();
    expect(deleted.data).toEqual([]);
  });
});
