import { describe, it, expect, beforeAll } from 'vitest';
import { anonClient, roleClient, serviceClient, ensureTestUsers } from '../helpers/clients';

const PROTECTED = [
  'submissions',
  'subscribers',
  'digest_sends',
  'contact_messages',
  'partnerships',
] as const;

// One valid, complete insert payload per table -- each of these would
// genuinely succeed if the caller held the grant/policy, so a 42501 on
// them proves RLS denial rather than a NOT NULL violation on a malformed
// payload. Built fresh (with a shared stamp) inside the test so every run
// gets unique identifiers.
function validPayloads(stamp: number): Record<(typeof PROTECTED)[number], Record<string, unknown>> {
  return {
    submissions: {
      type: 'new_resource',
      resource_name: `Anon write attempt ${stamp}`,
      description: 'x',
      submitter_email: `anon-write-${stamp}@askhub.test`,
    },
    subscribers: {
      email: `anon-write-${stamp}@askhub.test`,
      categories: ['training'],
      consent_text_version: 'v1',
      confirm_token: `t-write-${stamp}`,
      unsubscribe_token: `u-write-${stamp}`,
    },
    digest_sends: {
      subject: `Anon write attempt ${stamp}`,
    },
    contact_messages: {
      name: `Anon write attempt ${stamp}`,
      email: `anon-write-contact-${stamp}@askhub.test`,
      message: 'no',
    },
    partnerships: {
      organisation: `Anon write attempt org ${stamp}`,
    },
  };
}

describe('community tables', () => {
  let resourceId: string;

  beforeAll(async () => {
    await ensureTestUsers();
    const svc = serviceClient();
    const stamp = Date.now();

    // resources.partner became a real FK to partners(name) in Task 12L
    // (0014_partner_logos.sql, restoring partner logos and official
    // links on the client's confirmation). This suite predates that
    // migration and referenced an arbitrary, never-inserted partner
    // name; the partner row now has to exist first or this insert fails
    // with a foreign key violation (23503).
    const { error: partnerErr } = await svc
      .from('partners')
      .insert({ name: `Community suite partner ${stamp}` });
    if (partnerErr) throw partnerErr;

    const { data: resource, error: resourceErr } = await svc
      .from('resources')
      .insert({
        name: `Community suite resource ${stamp}`,
        partner: `Community suite partner ${stamp}`,
        partner_tier: 'network',
        resource_type: 'Course',
        need_primary: 'training',
        description: 'x',
        external_url: 'https://example.org/apply',
      })
      .select('id')
      .single();
    if (resourceErr) throw resourceErr;
    resourceId = resource!.id;
  });

  it('is entirely unreachable anonymously, for read and for write', async () => {
    const svc = serviceClient();
    const stamp = Date.now();

    // Seed one real row into each of the five tables first, via
    // service_role, so an unguarded anon read would actually return
    // something. Without this, every table is empty at this point in the
    // suite and the length-0 assertion alone would pass vacuously even if
    // anon held full SELECT.
    const seedPartnership = await svc
      .from('partnerships')
      .insert({ organisation: `Seed org ${stamp}` });
    expect(seedPartnership.error, 'failed to seed partnerships').toBeNull();

    const seedSubmission = await svc.from('submissions').insert({
      type: 'new_resource',
      resource_name: `Seed resource ${stamp}`,
      description: 'x',
      submitter_email: `seed-${stamp}@askhub.test`,
    });
    expect(seedSubmission.error, 'failed to seed submissions').toBeNull();

    const seedSubscriber = await svc.from('subscribers').insert({
      email: `seed-${stamp}@askhub.test`,
      categories: ['training'],
      consent_text_version: 'v1',
      confirm_token: `t-seed-${stamp}`,
      unsubscribe_token: `u-seed-${stamp}`,
    });
    expect(seedSubscriber.error, 'failed to seed subscribers').toBeNull();

    const seedDigest = await svc
      .from('digest_sends')
      .insert({ subject: `Seed digest ${stamp}` });
    expect(seedDigest.error, 'failed to seed digest_sends').toBeNull();

    const seedContact = await svc.from('contact_messages').insert({
      name: `Seed contact ${stamp}`,
      email: `seed-contact-${stamp}@askhub.test`,
      message: 'hello',
    });
    expect(seedContact.error, 'failed to seed contact_messages').toBeNull();

    const payloads = validPayloads(stamp);
    const anon = anonClient();
    for (const table of PROTECTED) {
      const { data, error: readError } = await anon.from(table).select('id');
      expect(data ?? [], `${table} readable anonymously`).toHaveLength(0);
      // Assert the denial positively: anon holds no grant on this table at
      // all, so this must fail with 42501 (permission denied), not merely
      // return no rows for some other reason.
      expect(readError?.code, `${table} read not denied with 42501`).toBe('42501');

      const { error: writeError } = await anon.from(table).insert(payloads[table] as never);
      expect(writeError?.code, `${table} insertable anonymously`).toBe('42501');
    }
  });

  it('stores subscriber email case-insensitively unique', async () => {
    const svc = serviceClient();
    const stamp = Date.now();
    const email = `Case-${stamp}@askhub.test`;
    const first = await svc.from('subscribers').insert({
      email,
      categories: ['training'],
      consent_text_version: 'v1',
      confirm_token: `t-${stamp}`,
      unsubscribe_token: `u-${stamp}`,
    });
    expect(first.error).toBeNull();

    const second = await svc.from('subscribers').insert({
      email: email.toLowerCase(),
      categories: ['training'],
      consent_text_version: 'v1',
      confirm_token: `t2-${stamp}`,
      unsubscribe_token: `u2-${stamp}`,
    });
    expect(second.error?.code).toBe('23505');
  });

  it('leaves new subscribers unconfirmed', async () => {
    const svc = serviceClient();
    const stamp = Date.now();
    const { data } = await svc
      .from('subscribers')
      .insert({
        email: `unconfirmed-${stamp}@askhub.test`,
        categories: ['funding'],
        consent_text_version: 'v1',
        confirm_token: `tc-${stamp}`,
        unsubscribe_token: `uc-${stamp}`,
      })
      .select('confirmed_at')
      .single();
    expect(data!.confirmed_at).toBeNull();
  });

  it('requires target_resource_id on an update_suggestion and forbids it otherwise', async () => {
    const svc = serviceClient();
    const stamp = Date.now();

    const missing = await svc.from('submissions').insert({
      type: 'update_suggestion',
      resource_name: `Missing target ${stamp}`,
      description: 'y',
      submitter_email: `missing-target-${stamp}@askhub.test`,
    });
    expect(missing.error?.code).toBe('23514');

    // Use a real resource id here, not a nonexistent one -- a nonexistent
    // id would also violate the target_resource_id foreign key (23503),
    // and that error alone would satisfy a bare "not null" assertion
    // without ever proving the CHECK's "null otherwise" arm exists. A real
    // id isolates the failure to the CHECK constraint specifically.
    const spurious = await svc.from('submissions').insert({
      type: 'new_resource',
      resource_name: `Spurious target ${stamp}`,
      description: 'y',
      submitter_email: `spurious-target-${stamp}@askhub.test`,
      target_resource_id: resourceId,
    });
    expect(spurious.error?.code).toBe('23514');
  });

  it('lets editor read and write submissions, and viewer only read', async () => {
    const stamp = Date.now();
    const editor = await roleClient('editor');
    const { error: editorErr } = await editor.from('submissions').insert({
      type: 'new_resource',
      resource_name: `Editor sub ${stamp}`,
      description: 'y',
      submitter_email: `editor-sub-${stamp}@askhub.test`,
    });
    expect(editorErr).toBeNull();

    const viewer = await roleClient('viewer');
    const { data: readable, error: readErr } = await viewer.from('submissions').select('id');
    expect(readErr).toBeNull();
    expect((readable ?? []).length).toBeGreaterThan(0);

    const { error: writeErr } = await viewer.from('submissions').insert({
      type: 'new_resource',
      resource_name: `Viewer sub ${stamp}`,
      description: 'y',
      submitter_email: `viewer-sub-${stamp}@askhub.test`,
    });
    expect(writeErr?.code).toBe('42501');
  });

  it('lets viewer read contact messages but never write them', async () => {
    const svc = serviceClient();
    const stamp = Date.now();
    await svc.from('contact_messages').insert({
      name: `Test ${stamp}`,
      email: `contact-${stamp}@askhub.test`,
      message: 'Hello',
    });

    const viewer = await roleClient('viewer');
    const { data, error } = await viewer.from('contact_messages').select('id');
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);

    const { error: writeErr } = await viewer.from('contact_messages').insert({
      name: `x ${stamp}`,
      email: `y-${stamp}@askhub.test`,
      message: 'no',
    });
    expect(writeErr?.code).toBe('42501');
  });

  it('records contact messages as undelivered so SP5 can drain them', async () => {
    const svc = serviceClient();
    const stamp = Date.now();
    const { data } = await svc
      .from('contact_messages')
      .insert({
        name: `Drain ${stamp}`,
        email: `drain-${stamp}@askhub.test`,
        message: 'Queued',
      })
      .select('delivered_at, delivery_error')
      .single();
    expect(data!.delivered_at).toBeNull();
    expect(data!.delivery_error).toBeNull();
  });
});
