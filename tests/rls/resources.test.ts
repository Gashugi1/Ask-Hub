import { describe, it, expect, beforeAll } from 'vitest';
import { anonClient, roleClient, serviceClient, ensureTestUsers } from '../helpers/clients';

let partnerId: string;

describe('partners and resources', () => {
  beforeAll(async () => {
    await ensureTestUsers();
    const svc = serviceClient();
    const { data, error } = await svc
      .from('partners')
      .insert({
        name: `Test Partner ${Date.now()}`,
        website_url: 'https://example.org',
        tier: 'network',
      })
      .select('id')
      .single();
    if (error) throw error;
    partnerId = data.id;
  });

  it('rejects a non-https external_url', async () => {
    const svc = serviceClient();
    const { error } = await svc.from('resources').insert({
      name: `Insecure ${Date.now()}`, partner_id: partnerId, resource_type: 'Course',
      need_primary: 'training', description: 'x',
      external_url: 'http://example.org/apply',
    });
    expect(error?.code).toBe('23514');
  });

  it('rejects an SVG banner image url', async () => {
    const svc = serviceClient();
    const { error } = await svc.from('resources').insert({
      name: `Svg banner ${Date.now()}`, partner_id: partnerId, resource_type: 'Course',
      need_primary: 'training', description: 'x',
      external_url: 'https://example.org/apply',
      banner_image_url: 'https://example.org/logo.svg',
    });
    expect(error?.code).toBe('23514');
  });

  it('is not readable anonymously on the base table', async () => {
    // Insert a real row via service_role first so an unguarded anon read
    // would actually return something -- without this, resources is empty
    // at this point in the file (the two preceding cases are constraint
    // violations that never persist), and the length assertion alone would
    // pass vacuously even if anon held full SELECT.
    const svc = serviceClient();
    const { error: insertError } = await svc.from('resources').insert({
      name: `Anon probe ${Date.now()}`, partner_id: partnerId,
      resource_type: 'Course', need_primary: 'training',
      description: 'x', external_url: 'https://example.org/apply',
    });
    expect(insertError).toBeNull();

    const { data, error } = await anonClient().from('resources').select('id');
    expect(data ?? []).toHaveLength(0);
    // Assert the denial positively: anon was revoked at the grant layer, so
    // this must fail with 42501 (permission denied), not merely return no
    // rows for some other reason.
    expect(error?.code).toBe('42501');
  });

  it('is not readable anonymously on partners', async () => {
    // partners already has a row by this point (the beforeAll insert), so
    // this needs no extra setup -- just assert anon is denied the same way
    // resources is. The public site reads both tables only through a later
    // *_public view; neither base table is anon-readable.
    const { data, error } = await anonClient().from('partners').select('id');
    expect(data ?? []).toHaveLength(0);
    expect(error?.code).toBe('42501');
  });

  it('lets editor create a resource', async () => {
    const client = await roleClient('editor');
    const { data, error } = await client
      .from('resources')
      .insert({
        name: `Editor created ${Date.now()}`, partner_id: partnerId,
        resource_type: 'Credits', need_primary: 'compute',
        description: 'Created by editor in the RLS test.',
        external_url: 'https://example.org/apply',
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    expect(data!.id).toBeTruthy();
  });

  it('does not let viewer create a resource', async () => {
    const client = await roleClient('viewer');
    const { error } = await client.from('resources').insert({
      name: `Viewer created ${Date.now()}`, partner_id: partnerId,
      resource_type: 'Credits', need_primary: 'compute',
      description: 'Should never persist.',
      external_url: 'https://example.org/apply',
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe('42501');
  });

  it('does not let viewer update or delete a resource', async () => {
    const client = await roleClient('viewer');
    const svc = serviceClient();
    const { data: seeded } = await svc
      .from('resources')
      .insert({
        name: `Untouchable ${Date.now()}`, partner_id: partnerId,
        resource_type: 'Credits', need_primary: 'compute',
        description: 'original', external_url: 'https://example.org/apply',
      })
      .select('id')
      .single();

    await client.from('resources').update({ description: 'tampered' }).eq('id', seeded!.id);
    await client.from('resources').delete().eq('id', seeded!.id);

    const { data: after } = await svc
      .from('resources')
      .select('description')
      .eq('id', seeded!.id)
      .single();
    expect(after!.description).toBe('original');
  });

  it('defaults status to pipeline so nothing publishes by accident', async () => {
    const svc = serviceClient();
    const { data } = await svc
      .from('resources')
      .insert({
        name: `Default status ${Date.now()}`, partner_id: partnerId,
        resource_type: 'Course', need_primary: 'training',
        description: 'x', external_url: 'https://example.org/apply',
      })
      .select('status')
      .single();
    expect(data!.status).toBe('pipeline');
  });
});
