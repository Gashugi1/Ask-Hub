import { describe, it, expect, beforeAll } from 'vitest';
import { anonClient, roleClient, serviceClient, ensureTestUsers } from '../helpers/clients';

describe('partners and resources', () => {
  beforeAll(async () => {
    await ensureTestUsers();
  });

  it('rejects a non-https external_url', async () => {
    const svc = serviceClient();
    const { error } = await svc.from('resources').insert({
      name: `Insecure ${Date.now()}`, partner: 'Test Partner', partner_tier: 'network',
      resource_type: 'Course',
      need_primary: 'training', description: 'x',
      external_url: 'http://example.org/apply',
    });
    expect(error?.code).toBe('23514');
  });

  it('rejects an SVG banner image url', async () => {
    const svc = serviceClient();
    const { error } = await svc.from('resources').insert({
      name: `Svg banner ${Date.now()}`, partner: 'Test Partner', partner_tier: 'network',
      resource_type: 'Course',
      need_primary: 'training', description: 'x',
      external_url: 'https://example.org/apply',
      banner_image_url: 'https://example.org/logo.svg',
    });
    expect(error?.code).toBe('23514');
  });

  it('rejects an SVG banner image url with the extension mid-path', async () => {
    // Regression case for a verified bypass: some CDN/image-transform URLs
    // put the real extension mid-path rather than at the end (e.g.
    // .../logo.svg/w_300). The original regex only anchored on
    // end-of-string, `?` or `#`, so `.svg/...` slipped through uncaught.
    const svc = serviceClient();
    const { error } = await svc.from('resources').insert({
      name: `Svg mid-path banner ${Date.now()}`, partner: 'Test Partner', partner_tier: 'network',
      resource_type: 'Course',
      need_primary: 'training', description: 'x',
      external_url: 'https://example.org/apply',
      banner_image_url: 'https://example.org/logo.svg/banner.png',
    });
    expect(error?.code).toBe('23514');
  });

  it('rejects an svgz banner image url', async () => {
    // .svgz is gzip-compressed SVG and carries the same active-content
    // risk as .svg; the constraint must catch it too.
    const svc = serviceClient();
    const { error } = await svc.from('resources').insert({
      name: `Svgz banner ${Date.now()}`, partner: 'Test Partner', partner_tier: 'network',
      resource_type: 'Course',
      need_primary: 'training', description: 'x',
      external_url: 'https://example.org/apply',
      banner_image_url: 'https://example.org/logo.svgz',
    });
    expect(error?.code).toBe('23514');
  });

  // Note: partner logos no longer exist anywhere in the schema -- the
  // partners table (and its partners_logo_not_svg constraint) is gone per
  // Task 12r's denormalisation ruling (H8). There is nothing left to guard
  // on that side; the two SVG regression cases above still cover
  // resources.banner_image_url, whose constraint is untouched.

  it('is not readable anonymously on the base table', async () => {
    // Insert a real row via service_role first so an unguarded anon read
    // would actually return something -- without this, resources is empty
    // at this point in the file (the preceding cases are constraint
    // violations that never persist), and the length assertion alone would
    // pass vacuously even if anon held full SELECT.
    const svc = serviceClient();
    const { error: insertError } = await svc.from('resources').insert({
      name: `Anon probe ${Date.now()}`, partner: 'Test Partner', partner_tier: 'network',
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

  // "is not readable anonymously on partners" is deleted: the partners
  // table no longer exists (Task 12r). tests/rls/schema-guards.test.ts's
  // G2 already asserts, catalog-wide, that anon holds no SELECT/INSERT/
  // UPDATE/DELETE on any base table -- a strict superset of what that case
  // checked, so nothing is lost by removing it rather than replacing it
  // with a weaker per-table variant.

  it('lets editor create a resource', async () => {
    const client = await roleClient('editor');
    const { data, error } = await client
      .from('resources')
      .insert({
        name: `Editor created ${Date.now()}`, partner: 'Test Partner', partner_tier: 'network',
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
      name: `Viewer created ${Date.now()}`, partner: 'Test Partner', partner_tier: 'network',
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
        name: `Untouchable ${Date.now()}`, partner: 'Test Partner', partner_tier: 'network',
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
        name: `Default status ${Date.now()}`, partner: 'Test Partner', partner_tier: 'network',
        resource_type: 'Course', need_primary: 'training',
        description: 'x', external_url: 'https://example.org/apply',
      })
      .select('status')
      .single();
    expect(data!.status).toBe('pipeline');
  });

  // Ruling H10: exclusivity replaces is_exclusive boolean because the
  // prototype's field is three-state and a boolean cannot distinguish
  // "early access" from "exclusive to AskHub" -- rendering one as the
  // other overstates the claim. This case is the direct test of that
  // distinction: both real values are accepted, and a third is rejected
  // at the enum level (22P02, invalid input value for enum), not merely
  // by a CHECK constraint.
  it('accepts exclusive and early_access but rejects any other exclusivity value', async () => {
    const svc = serviceClient();

    const exclusive = await svc.from('resources').insert({
      name: `Exclusive resource ${Date.now()}`, partner: 'Test Partner', partner_tier: 'network',
      resource_type: 'Course', need_primary: 'training',
      description: 'x', external_url: 'https://example.org/apply',
      exclusivity: 'exclusive',
    });
    expect(exclusive.error).toBeNull();

    const earlyAccess = await svc.from('resources').insert({
      name: `Early access resource ${Date.now()}`, partner: 'Test Partner', partner_tier: 'network',
      resource_type: 'Course', need_primary: 'training',
      description: 'x', external_url: 'https://example.org/apply',
      exclusivity: 'early_access',
    });
    expect(earlyAccess.error).toBeNull();

    const bogus = await svc.from('resources').insert({
      name: `Bogus exclusivity resource ${Date.now()}`, partner: 'Test Partner', partner_tier: 'network',
      resource_type: 'Course', need_primary: 'training',
      description: 'x', external_url: 'https://example.org/apply',
      exclusivity: 'not_a_real_value',
    });
    expect(bogus.error?.code).toBe('22P02');
  });
});
