import { describe, it, expect, beforeAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureTestUsers, roleClient, serviceClient } from '../helpers/clients';

/**
 * The audit row is written by a database trigger inside the mutation's own
 * transaction, not by the server action that caused it. These are the boundary
 * assertions for that claim: attribution the caller cannot influence, one row
 * per mutated row, redaction of values that must not reach a log all three
 * roles can read, and -- the load-bearing one, in its own describe block
 * below -- no successful write when the audit insert fails.
 *
 * See docs/superpowers/specs/2026-07-30-sp3-admin-portal-design.md section 4.
 */
async function newResource(svc: SupabaseClient, name: string) {
  const { data: partner, error: partnerError } = await svc
    .from('partners')
    .select('name')
    .limit(1)
    .single();
  if (partnerError) throw partnerError;

  const { data, error } = await svc
    .from('resources')
    .insert({
      name,
      partner: partner!.name,
      partner_tier: 'strategic',
      resource_type: 'Credits',
      need_primary: 'compute',
      description: 'Audit trigger fixture.',
      external_url: 'https://example.org/apply',
    })
    .select('id, name, status')
    .single();
  if (error) throw error;
  return data!;
}

async function auditRowsFor(entityId: string) {
  const { data, error } = await serviceClient()
    .from('audit_log')
    .select('actor, actor_name, action, entity_type, entity_id, entity_label, change_summary, diff')
    .eq('entity_id', entityId)
    .order('occurred_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

describe('audit_row_change', () => {
  beforeAll(async () => {
    await ensureTestUsers();
  });

  it('writes exactly one row for an admin edit, attributed to that admin', async () => {
    const svc = serviceClient();
    const row = await newResource(svc, `audit-edit-${Date.now()}`);
    const admin = await roleClient('admin');

    const { error } = await admin
      .from('resources')
      .update({ resource_type: 'Grant' })
      .eq('id', row.id);
    expect(error).toBeNull();

    const rows = (await auditRowsFor(row.id)).filter((r) => r.action !== 'created');
    expect(rows).toHaveLength(1);

    const { data: profile } = await svc
      .from('profiles')
      .select('id, full_name, email')
      .eq('email', 'rls-admin@askhub.test')
      .single();

    // actor is profiles.id, not auth.uid(): PRD 4.15 defines the field against
    // profiles, and the two ids differ.
    expect(rows[0]!.actor).toBe(profile!.id);
    expect(rows[0]!.actor_name).not.toBe('system');
    expect(rows[0]!.action).toBe('edited');
    expect(rows[0]!.entity_type).toBe('resource');
    // Resources appear by bare name, no prefix (PRD 4.15).
    expect(rows[0]!.entity_label).toBe(row.name);
    expect(rows[0]!.change_summary).toBe('Resource type Credits to Grant');
    expect(rows[0]!.diff).toEqual({ resource_type: { from: 'Credits', to: 'Grant' } });
  });

  it('records a status change to live as published, not edited', async () => {
    const svc = serviceClient();
    const row = await newResource(svc, `audit-publish-${Date.now()}`);
    const admin = await roleClient('admin');

    await admin.from('resources').update({ status: 'live' }).eq('id', row.id);

    const rows = (await auditRowsFor(row.id)).filter((r) => r.action !== 'created');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.action).toBe('published');
    // Sentence case, so this reads as PRD 4.15's own example does.
    expect(rows[0]!.change_summary).toBe('Status Pipeline to Live');
  });

  it('writes no row when only updated_at would change', async () => {
    const svc = serviceClient();
    const row = await newResource(svc, `audit-noop-${Date.now()}`);
    const admin = await roleClient('admin');

    // Same value it already holds. set_updated_at still fires, so a naive
    // trigger would record a change nobody made.
    await admin.from('resources').update({ resource_type: 'Credits' }).eq('id', row.id);

    const rows = (await auditRowsFor(row.id)).filter((r) => r.action !== 'created');
    expect(rows).toHaveLength(0);
  });

  it('records a delete, and the row survives the entity it describes', async () => {
    const svc = serviceClient();
    const row = await newResource(svc, `audit-delete-${Date.now()}`);
    const admin = await roleClient('admin');

    const { error } = await admin.from('resources').delete().eq('id', row.id);
    expect(error).toBeNull();

    const deleted = (await auditRowsFor(row.id)).filter((r) => r.action === 'deleted');
    expect(deleted).toHaveLength(1);
    expect(deleted[0]!.entity_label).toBe(row.name);
    expect(deleted[0]!.change_summary).toBe('Deleted');
  });

  it('attributes a service_role write to the system sentinel, not to a person', async () => {
    const svc = serviceClient();
    const row = await newResource(svc, `audit-system-${Date.now()}`);
    const rows = await auditRowsFor(row.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.action).toBe('created');
    expect(rows[0]!.actor).toBeNull();
    expect(rows[0]!.actor_name).toBe('system');
  });

  it('prefixes every non-resource entity label per the 4.15 convention', async () => {
    const admin = await roleClient('admin');

    // `welcome_title`, not PRD 4.12's `welcome_band_heading`: the seed invented
    // its own key names (scripts/seed-data.ts says so in its own header) and the
    // PRD's were never implemented. Asserting against the database's actual
    // keys rather than the PRD's prose is the whole point of a boundary test --
    // and an update matching zero rows is how this discrepancy surfaced.
    const { error, count } = await admin
      .from('site_content')
      .update({ value: `Welcome to AskHub ${Date.now()}` }, { count: 'exact' })
      .eq('key', 'welcome_title')
      .eq('locale', 'en');
    expect(error).toBeNull();
    expect(count, 'the fixture key must exist, or this test passes vacuously').toBe(1);

    const { data } = await serviceClient()
      .from('audit_log')
      .select('entity_type, entity_label')
      .eq('entity_type', 'site_content')
      .order('occurred_at', { ascending: false })
      .limit(1);
    expect(data![0]!.entity_label).toBe('Site content: welcome_title');
  });

  it('redacts a subscriber email from both the label and the diff', async () => {
    const svc = serviceClient();
    const stamp = Date.now();
    const email = `audit-sub-${stamp}@example.org`;
    const { data: sub, error: insertError } = await svc
      .from('subscribers')
      .insert({
        email,
        categories: ['compute'],
        consent_text_version: 'v1',
        confirm_token: `confirm-${stamp}`,
        unsubscribe_token: `unsubscribe-${stamp}`,
      })
      .select('id')
      .single();
    if (insertError) throw insertError;

    const admin = await roleClient('admin');
    const { error } = await admin.from('subscribers').update({ country: 'Kenya' }).eq('id', sub!.id);
    expect(error).toBeNull();

    const rows = await auditRowsFor(sub!.id);
    const serialised = JSON.stringify(rows);
    // audit_log is readable by all three roles, viewer included. The address
    // and both tokens must not be there -- not in the insert's diff, and not
    // in the update's label.
    expect(serialised).not.toContain(email);
    expect(serialised).not.toContain(`confirm-${stamp}`);
    expect(serialised).not.toContain(`unsubscribe-${stamp}`);
    // The fact of the account is still recorded.
    expect(rows.some((r) => r.entity_label.startsWith('Subscriber: a***@'))).toBe(true);
  });

  it('records a role change as role_changed', async () => {
    const svc = serviceClient();
    const admin = await roleClient('admin');
    const { data: viewer } = await svc
      .from('profiles')
      .select('id, role')
      .eq('email', 'rls-viewer@askhub.test')
      .single();

    await admin.from('profiles').update({ role: 'editor' }).eq('id', viewer!.id);
    await admin.from('profiles').update({ role: 'viewer' }).eq('id', viewer!.id);

    const changes = (await auditRowsFor(viewer!.id)).filter((r) => r.action === 'role_changed');
    expect(changes.length).toBeGreaterThanOrEqual(2);
    expect(changes.at(-1)!.change_summary).toBe('Role Editor to Viewer');
    expect(changes.at(-1)!.entity_label.startsWith('User: ')).toBe(true);
  });

  it('does not let a viewer produce an audit row, because it cannot write at all', async () => {
    const svc = serviceClient();
    const row = await newResource(svc, `audit-viewer-${Date.now()}`);
    const viewer = await roleClient('viewer');

    const { error } = await viewer
      .from('resources')
      .update({ resource_type: 'Grant' })
      .eq('id', row.id);

    // PostgREST reports zero rows affected rather than an error for an UPDATE
    // no policy admits, so the row itself is the assertion.
    const { data: after } = await svc
      .from('resources')
      .select('resource_type')
      .eq('id', row.id)
      .single();
    expect(after!.resource_type).toBe('Credits');
    const rows = (await auditRowsFor(row.id)).filter((r) => r.action !== 'created');
    expect(rows, `viewer write produced an audit row: ${JSON.stringify(error)}`).toHaveLength(0);
  });
});

describe('a failed audit insert aborts the mutation', () => {
  beforeAll(async () => {
    await ensureTestUsers();
  });

  it('leaves the row unchanged rather than committing an unaudited write', async () => {
    const svc = serviceClient();
    const row = await newResource(svc, `audit-atomic-${Date.now()}`);
    const admin = await roleClient('admin');

    // Local-only helper (supabase/seed.sql): adds `check (false) not valid` to
    // audit_log, so every new audit insert fails while the existing rows other
    // suites depend on are left alone. This is the only way to prove property 3
    // of spec 4.2 rather than asserting it.
    const broke = await svc.rpc('test_break_audit_log');
    expect(broke.error).toBeNull();

    try {
      const { error } = await admin
        .from('resources')
        .update({ resource_type: 'Grant' })
        .eq('id', row.id);
      expect(error, 'the mutation must fail when its audit row cannot be written').not.toBeNull();

      const { data: after } = await svc
        .from('resources')
        .select('resource_type')
        .eq('id', row.id)
        .single();
      expect(after!.resource_type, 'an unaudited write was committed').toBe('Credits');
    } finally {
      const fixed = await svc.rpc('test_unbreak_audit_log');
      expect(fixed.error).toBeNull();
    }

    // The same edit succeeds once auditing works again, so this test did not
    // merely prove the table was broken.
    const { error: retry } = await admin
      .from('resources')
      .update({ resource_type: 'Grant' })
      .eq('id', row.id);
    expect(retry).toBeNull();
  });
});
