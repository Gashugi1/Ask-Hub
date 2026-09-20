import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ensureTestUsers, roleClient, serviceClient } from '../helpers/clients';

/**
 * House rule from tests/rls/site.test.ts: a suite may add its own fixture
 * rows, but must clean them up in `afterAll` rather than trust the test body
 * to reach its own cleanup step. `resources` has no throwaway key the way
 * `settings`/`site_content` do, so this suite tracks every id it creates and
 * deletes them unconditionally, regardless of which assertions passed or
 * failed — a mid-run failure must not leave a fixture behind for
 * `resources_public` to serve to an anonymous visitor.
 */
describe('resource writes at the database boundary', () => {
  const createdIds: string[] = [];

  beforeAll(async () => {
    await ensureTestUsers();
  });

  afterAll(async () => {
    if (createdIds.length === 0) return;
    await serviceClient().from('resources').delete().in('id', createdIds);
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
    // Recorded immediately, before the caller runs any assertion that might
    // throw — this is what makes cleanup robust to a failing test mid-run.
    createdIds.push(data!.id as string);
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

  it('publishes a batch in one statement as an editor, touching only the non-live rows', async () => {
    // publishResources's own statement: update ... in(ids) ... neq('status',
    // 'live'). Two pipeline fixtures and one already live: exactly two rows
    // change, and the trigger writes exactly two `published` audit rows.
    const a = await fixture(`batch-a-${Date.now()}`);
    const b = await fixture(`batch-b-${Date.now()}`);
    const c = await fixture(`batch-c-${Date.now()}`);
    await serviceClient().from('resources').update({ status: 'live' }).eq('id', c);

    const editor = await roleClient('editor');
    const { data, error } = await editor
      .from('resources')
      .update({ status: 'live' })
      .in('id', [a, b, c])
      .neq('status', 'live')
      .select('id');
    expect(error).toBeNull();
    expect(data!.map((row) => row.id).sort()).toEqual([a, b].sort());

    const { data: audit } = await serviceClient()
      .from('audit_log')
      .select('entity_id')
      .in('entity_id', [a, b, c])
      .eq('action', 'published')
      .neq('actor_name', 'system');
    expect(audit!.map((row) => row.entity_id).sort()).toEqual([a, b].sort());
  });

  it('publishes nothing for a viewer, and reports it as zero rows rather than an error', async () => {
    const a = await fixture(`batch-viewer-${Date.now()}`);
    const viewer = await roleClient('viewer');
    const { data, error } = await viewer
      .from('resources')
      .update({ status: 'live' })
      .in('id', [a])
      .neq('status', 'live')
      .select('id');
    expect(error).toBeNull();
    expect(data).toEqual([]);
    const { data: after } = await serviceClient().from('resources').select('status').eq('id', a).single();
    expect(after!.status).toBe('pipeline');
  });

  it('refuses every write verb to a viewer', async () => {
    const id = await fixture(`viewer-denied-${Date.now()}`);
    const viewer = await roleClient('viewer');
    const svc = serviceClient();

    await viewer.from('resources').update({ status: 'live' }).eq('id', id);
    await viewer.from('resources').delete().eq('id', id);
    const insert = await viewer
      .from('resources')
      .insert({
        name: `viewer-insert-${Date.now()}`,
        partner: 'CINECA Leonardo',
        partner_tier: 'strategic',
        resource_type: 'Credits',
        need_primary: 'compute',
        description: 'Should never exist.',
        external_url: 'https://example.org/apply',
      })
      // .select('id') so that if RLS ever regressed and let this insert
      // through, the row would still be caught by afterAll's cleanup instead
      // of becoming an untracked, unattributed resource visible to anon.
      .select('id');
    expect(insert.error).not.toBeNull();
    if (insert.data && insert.data.length > 0) {
      createdIds.push(...insert.data.map((row) => row.id as string));
    }

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
