import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureTestUsers, roleClient, serviceClient } from '../helpers/clients';
import { fixtureStamp } from '../helpers/fixtures';

/**
 * `resources.partner` is `text not null references partners(name)`
 * (0014_partner_logos.sql, line 133). The resource form's provider field is
 * free text -- the prototype's -- so the actions have to make the row exist
 * before the FK is checked: `ensureProvider` creates a missing provider
 * name-only on the caller's own client, and `assertKnownPartner` then runs on
 * a fresh read to catch the one case that leaves -- a row this role could
 * not create or cannot see -- with a message naming the value rather than a
 * constraint violation.
 *
 * These call the real actions, with their real Zod parse, their real
 * `ensureProvider`, their real `assertKnownPartner` and their real writes,
 * against the real tables under RLS as an editor -- and, for the refusal
 * case, as a viewer.
 *
 * **What is mocked, and what that costs.** Three modules, each for a reason
 * that is about the Vitest process rather than about the behaviour under test:
 *
 *  - `@/lib/admin/client`, because `createAdminReadClient()` resolves the
 *    caller's session through `cookies()` from `next/headers`, which has no
 *    meaning outside a Next request scope (the same limitation
 *    `tests/rls/admin-reader-order.test.ts` and
 *    `tests/unit/resource-actions.test.ts` both record). An editor-
 *    authenticated client is substituted, so every statement below still runs
 *    under RLS as a real role.
 *  - `@/lib/auth`, for the same cookie reason — `requireRole` cannot resolve a
 *    user here. **So nothing in this file covers the role gate.** That is
 *    asserted statically by `tests/structure/action-role-checks.test.ts`, and
 *    the database's own refusal of a viewer's resource writes by
 *    `tests/rls/admin-actions-resources.test.ts`; do not read a passing run
 *    here as evidence about permissions.
 *  - `next/cache`, whose `revalidateTag` needs a request scope too. Cache
 *    invalidation is therefore not covered here either;
 *    `tests/structure/revalidation-contract.test.ts` is what holds that.
 */
const harness = vi.hoisted(() => ({ client: null as SupabaseClient | null }));

vi.mock('@/lib/admin/client', () => ({
  createAdminReadClient: async () => {
    if (!harness.client) throw new Error('partner FK harness: no client set up');
    return harness.client;
  },
}));

vi.mock('@/lib/auth', () => ({
  requireRole: async () => ({ role: 'editor' }),
}));

vi.mock('next/cache', () => ({
  revalidateTag: () => {},
}));

const { createResource, updateResource } = await import('@/lib/actions/resources');

const stamp = fixtureStamp();
/** Created here, referenced by every resource below, deleted in `afterAll`. */
const FIXTURE_PARTNER = `Partner FK fixture ${stamp}`;
/** Deliberately absent from `partners`, and never created: only the raw-constraint test names it. The stamp lets the sweep reclaim any row that somehow landed. */
const UNKNOWN_PARTNER = `No Such Partner ${stamp}`;

/** Every id this file writes, recorded at creation and removed unconditionally. */
const createdIds: string[] = [];
/** Providers this file creates beyond the fixture, removed after the resources. */
const createdPartners: string[] = [];

/**
 * A complete, schema-valid payload. Every field is present because
 * `resourceInput` has no optional keys — an incomplete object would fail the
 * parse and make an assertion about the partner check pass for the wrong
 * reason.
 */
function payload(overrides: Record<string, unknown> = {}) {
  return {
    name: `Partner FK resource ${stamp}`,
    partner: FIXTURE_PARTNER,
    partnerTier: 'network',
    resourceType: 'Credits',
    needPrimary: 'compute',
    needSecondary: null,
    subCategory: null,
    description: 'Created by tests/rls/resource-partner-fk.test.ts.',
    actionLabel: 'Apply',
    externalUrl: 'https://example.org/partner-fk',
    bannerImageUrl: null,
    countriesEligible: ['Kenya'],
    sectorsEligible: [],
    stagesEligible: ['Building'],
    geoScope: 'specific',
    deadline: null,
    status: 'pipeline',
    isFeatured: false,
    exclusivity: null,
    sortOrder: null,
    ...overrides,
  };
}

/** A row written directly with the service client, bypassing the action under test. */
async function seedResource(name: string): Promise<string> {
  const { data, error } = await serviceClient()
    .from('resources')
    .insert({
      name,
      partner: FIXTURE_PARTNER,
      partner_tier: 'network',
      resource_type: 'Credits',
      need_primary: 'compute',
      description: 'Created by tests/rls/resource-partner-fk.test.ts.',
      external_url: 'https://example.org/partner-fk',
      status: 'pipeline',
    })
    .select('id')
    .single();
  if (error) throw error;
  // Recorded before any assertion runs, so a failure mid-test still cleans up.
  createdIds.push(data!.id as string);
  return data!.id as string;
}

beforeAll(async () => {
  await ensureTestUsers();
  harness.client = await roleClient('editor');
  const { error } = await serviceClient().from('partners').insert({ name: FIXTURE_PARTNER });
  expect(error, `seeding ${FIXTURE_PARTNER}`).toBeNull();
});

afterAll(async () => {
  const svc = serviceClient();
  if (createdIds.length > 0) {
    const { error } = await svc.from('resources').delete().in('id', createdIds);
    if (error) console.warn(`[partner-fk] could not delete resources: ${error.message}`);
  }
  // After the resources: resources.partner is ON DELETE RESTRICT, so a
  // referenced partner cannot be removed.
  const { error } = await svc
    .from('partners')
    .delete()
    .in('name', [FIXTURE_PARTNER, ...createdPartners]);
  if (error) console.warn(`[partner-fk] could not delete ${FIXTURE_PARTNER}: ${error.message}`);
});

/** How many resources currently carry this exact name. */
async function countByName(name: string): Promise<number> {
  const { data, error } = await serviceClient().from('resources').select('id').eq('name', name);
  if (error) throw error;
  return (data ?? []).length;
}

describe('createResource and the partner foreign key', () => {
  it('writes the row when the partner exists', async () => {
    const name = `Partner FK create ok ${stamp}`;
    const { id } = await createResource(payload({ name }));
    createdIds.push(id);

    const { data } = await serviceClient()
      .from('resources')
      .select('partner')
      .eq('id', id)
      .single();
    expect(data!.partner).toBe(FIXTURE_PARTNER);
  });

  it('creates a provider the registry lacks, name-only, and selects it on the resource in one call', async () => {
    // "A new provider can be created and immediately selected": the operator
    // types an organisation nobody has listed before and saves once.
    const name = `Partner FK create new provider ${stamp}`;
    const provider = `Brand New Provider ${stamp}`;
    createdPartners.push(provider);

    const { id } = await createResource(payload({ name, partner: provider }));
    createdIds.push(id);

    const svc = serviceClient();
    const { data: row } = await svc
      .from('partners')
      .select('name, logo_url, website_url')
      .eq('name', provider)
      .single();
    expect(row).toEqual({ name: provider, logo_url: null, website_url: null });

    const { data: resource } = await svc.from('resources').select('partner').eq('id', id).single();
    expect(resource!.partner).toBe(provider);

    // The trigger recorded the creation against the editor, not 'system'.
    const { data: audit } = await svc
      .from('audit_log')
      .select('action, actor_name')
      .eq('entity_type', 'partner')
      .eq('entity_label', `Partner: ${provider}`);
    expect(audit).toHaveLength(1);
    expect(audit![0]!.action).toBe('created');
    expect(audit![0]!.actor_name).not.toBe('system');
  });

  it('is refused for a viewer before any provider or resource row is written', async () => {
    // requireRole is mocked in this file, so the database is the refusing
    // layer here: partners_insert_staff (0014) admits admin and editor only.
    // The action-level gate is held by tests/structure/action-role-checks.
    const name = `Partner FK viewer ${stamp}`;
    const provider = `Viewer Provider ${stamp}`;
    createdPartners.push(provider);
    const editor = harness.client;
    harness.client = await roleClient('viewer');
    try {
      await expect(createResource(payload({ name, partner: provider }))).rejects.toThrow();
    } finally {
      harness.client = editor;
    }

    const svc = serviceClient();
    const { count } = await svc
      .from('partners')
      .select('name', { count: 'exact', head: true })
      .eq('name', provider);
    expect(count ?? 0, 'a viewer created a provider row').toBe(0);
    expect(await countByName(name), 'a viewer created a resource').toBe(0);
  });

  it('the constraint itself still refuses a resource naming a provider that does not exist', async () => {
    // Bypassing the action: what the FK does when nothing has created the
    // provider first. This is the boundary every check above sits in front of.
    const { error } = await serviceClient().from('resources').insert({
      name: `Partner FK direct ${stamp}`,
      partner: UNKNOWN_PARTNER,
      partner_tier: 'network',
      resource_type: 'Credits',
      need_primary: 'compute',
      description: 'Must not land.',
      external_url: 'https://example.org/partner-fk',
      status: 'pipeline',
    });
    expect(error?.code).toBe('23503');
  });

  it('still rejects an empty or whitespace-only partner as a missing field', async () => {
    // `resourceInput`'s `.trim().min(1)` already did this and must keep doing
    // it -- "a resource still cannot be saved with an unresolvable provider".
    // Asserting only "throws" would not hold it: without the parse, a blank
    // name would reach ensureProvider and be created as a provider called
    // "". So the wording is what pins the layer: dropping `.trim()` from the
    // schema fails this even though the write is still refused.
    for (const partner of ['', '   ', '\t\n']) {
      const label = JSON.stringify(partner);
      const name = `Partner FK blank ${label} ${stamp}`;

      try {
        await createResource(payload({ name, partner }));
        expect.unreachable(`expected createResource to reject partner ${label}`);
      } catch (err) {
        expect((err as Error).message, `a blank partner was reported as an unknown one: ${label}`)
          .not.toMatch(/is not a known (partner|provider)/);
      }

      expect(await countByName(name), `blank partner ${label} wrote a row`).toBe(0);
      const { count } = await serviceClient()
        .from('partners')
        .select('name', { count: 'exact', head: true })
        .eq('name', partner);
      expect(count ?? 0, `blank partner ${label} became a provider row`).toBe(0);
    }
  });
});

describe('updateResource and the partner foreign key', () => {
  it('retargets an edit to a provider the registry lacks by creating it first', async () => {
    const name = `Partner FK update retarget ${stamp}`;
    const provider = `Retarget Provider ${stamp}`;
    createdPartners.push(provider);
    const id = await seedResource(name);

    await updateResource(id, payload({ name, partner: provider, description: 'Edited.' }));

    const { data } = await serviceClient()
      .from('resources')
      .select('partner, description')
      .eq('id', id)
      .single();
    expect(data!.partner).toBe(provider);
    expect(data!.description).toBe('Edited.');
  });

  it('saves the edit when the partner exists', async () => {
    // The guard must refuse an unknown partner without refusing a legitimate
    // save; without this, "always throw" would satisfy the test above.
    const name = `Partner FK update ok ${stamp}`;
    const id = await seedResource(name);

    await updateResource(id, payload({ name, description: 'Edited by the action.' }));

    const { data } = await serviceClient()
      .from('resources')
      .select('description')
      .eq('id', id)
      .single();
    expect(data!.description).toBe('Edited by the action.');
  });
});

describe('renaming a partner', () => {
  /**
   * 0019_ai_hub_partners.sql renamed `CINECA / AI Hub` to `CINECA` with a
   * single UPDATE and no second statement for the resource that references
   * it, on the strength of resources_partner_fkey being `on update cascade`
   * (0014_partner_logos.sql). That is the assumption this test holds: without
   * the cascade the UPDATE would fail outright on a populated database.
   *
   * Not exercised by a `db:reset` + `npm run seed`: migrations run before any
   * partner row exists, so that UPDATE matched nothing locally. The cascade
   * only ever runs on a database that already holds content.
   */
  it('carries its resources across via the FK cascade', async () => {
    const svc = serviceClient();
    const oldName = `Partner FK rename-from ${stamp}`;
    const newName = `Partner FK rename-to ${stamp}`;
    const resourceName = `Partner FK cascade resource ${stamp}`;

    const { error: partnerError } = await svc.from('partners').insert({ name: oldName });
    expect(partnerError, 'seeding rename fixture').toBeNull();
    createdPartners.push(oldName, newName);

    const { data: inserted, error: resourceError } = await svc
      .from('resources')
      .insert({
        name: resourceName,
        partner: oldName,
        partner_tier: 'strategic',
        resource_type: 'Credits',
        need_primary: 'compute',
        description: 'cascade fixture',
        external_url: 'https://example.org/cascade',
        // `pipeline`, not `live`: this row exists only to be pointed at.
        status: 'pipeline',
      })
      .select('id')
      .single();
    expect(resourceError, 'seeding cascade resource').toBeNull();
    createdIds.push(inserted!.id as string);

    const { error: renameError } = await svc
      .from('partners')
      .update({ name: newName })
      .eq('name', oldName);
    expect(renameError, 'renaming the partner').toBeNull();

    const { data, error } = await svc
      .from('resources')
      .select('partner')
      .eq('name', resourceName)
      .single();
    expect(error).toBeNull();
    expect(data!.partner).toBe(newName);

    const { count, error: oldCountError } = await svc
      .from('partners')
      .select('name', { count: 'exact', head: true })
      .eq('name', oldName);
    expect(oldCountError).toBeNull();
    expect(count ?? 0).toBe(0);
  });
});
