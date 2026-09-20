import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ensureTestUsers, anonClient, roleClient, serviceClient } from '../helpers/clients';
import { fixtureStamp } from '../helpers/fixtures';
import { submissionToResourceInput } from '@/lib/admin/submission-to-resource';
import { resourceInput, toRow } from '@/lib/schemas/resource';

/**
 * The public suggestion form's database boundary: `submit_resource_suggestion`
 * from migration 0024, called as `anon` -- the role a visitor's client holds.
 *
 * Every row this suite creates carries the stamp in `resource_name` and in
 * `submitter_email`, and `afterAll` deletes by that stamp regardless of
 * which assertions passed.
 */
describe('submit_resource_suggestion as anon', () => {
  const stamp = fixtureStamp();
  const email = `suggest-${stamp}@askhub.test`;

  beforeAll(async () => {
    await ensureTestUsers();
  });

  afterAll(async () => {
    const svc = serviceClient();
    await svc.from('submissions').delete().like('resource_name', `%${stamp}%`);
    await svc.from('resources').delete().like('name', `%${stamp}%`);
    await svc.from('partners').delete().like('name', `%${stamp}%`);
    await svc.from('audit_log').delete().like('entity_label', `%${stamp}%`);
  });

  function args(over: Partial<Record<string, string>> = {}) {
    return {
      p_resource_name: `Suggested ${stamp}`,
      p_organisation: 'Example Compute Co',
      p_need: 'compute',
      p_link: 'https://example.org/apply',
      p_description: 'Credits for teams.',
      p_programme_contact_email: '',
      p_submitter_name: 'Ada Submitter',
      p_submitter_email: email.toUpperCase(),
      p_source_ip_hash: '',
      ...over,
    };
  }

  it('lands a pending new_resource row with the email lowercased', async () => {
    const { error } = await anonClient().rpc('submit_resource_suggestion', args());
    expect(error).toBeNull();

    const { data } = await serviceClient()
      .from('submissions')
      .select('type, status, submitter_email, submitter_name, programme_contact_email, need')
      .eq('resource_name', `Suggested ${stamp}`)
      .single();
    expect(data).toMatchObject({
      type: 'new_resource',
      status: 'pending',
      submitter_email: email,
      submitter_name: 'Ada Submitter',
      programme_contact_email: null,
      need: 'compute',
    });
  });

  it('records the audit row without the name, the email or the contact', async () => {
    const { data } = await serviceClient()
      .from('audit_log')
      .select('entity_label, diff, change_summary')
      .eq('entity_label', `Submission: Suggested ${stamp}`);
    expect(data).toHaveLength(1);
    const text = JSON.stringify(data![0]);
    expect(text).not.toContain('Ada Submitter');
    expect(text).not.toContain(email);
  });

  it('refuses each cap as invalid input (22023)', async () => {
    const anon = anonClient();
    const cases: Partial<Record<string, string>>[] = [
      { p_resource_name: '' },
      { p_organisation: ' ' },
      { p_need: 'nonsense' },
      { p_link: 'http://example.org' },
      { p_description: '' },
      { p_submitter_name: '' },
      { p_submitter_email: 'not-an-address' },
      { p_programme_contact_email: 'also-not' },
    ];
    for (const over of cases) {
      const { error } = await anon.rpc('submit_resource_suggestion', args(over));
      expect(error?.code, JSON.stringify(over)).toBe('22023');
    }
  });

  it('rate-limits the fourth suggestion from one address inside the hour (54000)', async () => {
    // The two prior rows are seeded directly rather than through the
    // function, so this suite never pushes the global ten-minute count up by
    // its own repeated calls across runs.
    const svc = serviceClient();
    const { error: seedError } = await svc.from('submissions').insert([2, 3].map((n) => ({
      type: 'new_resource' as const,
      resource_name: `Suggested ${stamp} seed ${n}`,
      description: 'seed',
      submitter_email: email,
    })));
    expect(seedError).toBeNull();

    const { error } = await anonClient().rpc(
      'submit_resource_suggestion',
      args({ p_resource_name: `Suggested ${stamp} fourth` }),
    );
    expect(error?.code).toBe('54000');
  });

  it('grants anon no way to read the queue back', async () => {
    const { data, error } = await anonClient().from('submissions').select('id').limit(1);
    // Either a permission error or an empty result: never a row.
    expect(data ?? []).toEqual([]);
    expect(error === null || error.code === '42501').toBe(true);
  });

  it('lets an editor approve or reject, and a viewer neither', async () => {
    const { data: row } = await serviceClient()
      .from('submissions')
      .select('id')
      .eq('resource_name', `Suggested ${stamp}`)
      .single();

    const viewer = await roleClient('viewer');
    const denied = await viewer
      .from('submissions')
      .update({ status: 'approved' })
      .eq('id', row!.id)
      .select('id');
    expect(denied.data ?? []).toEqual([]);

    const editor = await roleClient('editor');
    const approved = await editor
      .from('submissions')
      .update({ status: 'approved' })
      .eq('id', row!.id)
      .eq('status', 'pending')
      .select('id');
    expect(approved.error).toBeNull();
    expect(approved.data).toHaveLength(1);

    // A second approval matches no row: the pending predicate is the race guard.
    const again = await editor
      .from('submissions')
      .update({ status: 'rejected' })
      .eq('id', row!.id)
      .eq('status', 'pending')
      .select('id');
    expect(again.data ?? []).toEqual([]);
  });

  it('runs the approve-and-publish sequence as an editor, and logs the decision as approved', async () => {
    // approveAndPublishSubmission's own statements, on the editor's client:
    // name-only partner upsert, resource insert from the mapper, then the
    // pending-only status update. The trigger (0025) classifies the last as
    // 'approved', and the partner and resource both exist afterwards.
    const partner = `Suggested Org ${stamp}`;
    const name = `Approve seq ${stamp}`;
    const svc = serviceClient();
    const { data: row } = await svc
      .from('submissions')
      .insert({
        type: 'new_resource',
        resource_name: name,
        organisation: partner,
        need: 'compute',
        link: 'https://example.org/apply',
        description: 'Credits for teams.',
        submitter_email: email,
        submitter_name: 'Ada Submitter',
      })
      .select('id, type, resource_name, organisation, need, link, description')
      .single();

    const editor = await roleClient('editor');
    const upsert = await editor.from('partners').upsert({ name: partner }, { onConflict: 'name' });
    expect(upsert.error).toBeNull();

    const parsed = resourceInput.parse(
      submissionToResourceInput({
        resourceName: row!.resource_name,
        organisation: row!.organisation,
        need: row!.need,
        link: row!.link,
        description: row!.description,
      }),
    );
    const inserted = await editor.from('resources').insert(toRow(parsed)).select('id, status').single();
    expect(inserted.error).toBeNull();
    expect(inserted.data!.status).toBe('live');

    const approved = await editor
      .from('submissions')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', row!.id)
      .eq('status', 'pending')
      .select('id');
    expect(approved.error).toBeNull();
    expect(approved.data).toHaveLength(1);

    const { data: audit } = await svc
      .from('audit_log')
      .select('action, actor_name, diff')
      .eq('entity_id', row!.id)
      .order('created_at', { ascending: true });
    expect(audit!.map((entry) => entry.action)).toEqual(['created', 'approved']);
    expect(audit![1]!.actor_name).not.toBe('system');
    expect(JSON.stringify(audit)).not.toContain('Ada Submitter');
  });
});
