import { describe, it, expect, beforeAll } from 'vitest';
import { ensureTestUsers, roleClient, serviceClient } from '../helpers/clients';

/**
 * The database boundary for Site Content's five tables (design spec §3,
 * PRD 6.7 panels 3-8): editor may write, viewer may not, and every
 * successful write produces exactly one audit row carrying the entity-type
 * prefix from 0017_audit_triggers.sql / PRD 4.15.
 *
 * Like tests/rls/admin-actions-resources.test.ts, this exercises the tables
 * directly through role-authenticated Supabase clients rather than the
 * server actions themselves — `requireRole` needs `next/headers` cookies
 * that Vitest's node environment cannot provide, so the actions' own
 * `requireRole` gate is verified by reading the code
 * (src/lib/actions/content.ts), while RLS — the layer that holds even if
 * that gate were ever removed — is verified here, against the real
 * database.
 */
describe('site content writes at the database boundary', () => {
  beforeAll(async () => {
    await ensureTestUsers();
  });

  async function siteContentFixture(key: string): Promise<string> {
    const svc = serviceClient();
    const { data, error } = await svc
      .from('site_content')
      .insert({ key, value: 'original', locale: 'en' })
      .select('id')
      .single();
    if (error) throw error;
    return data!.id as string;
  }

  it('lets an editor update site_content, and records it as edited', async () => {
    const key = `rls-content-${Date.now()}`;
    const id = await siteContentFixture(key);
    const editor = await roleClient('editor');
    const { error } = await editor.from('site_content').update({ value: 'updated' }).eq('id', id);
    expect(error).toBeNull();

    const { data } = await serviceClient()
      .from('audit_log')
      .select('actor_name, entity_label')
      .eq('entity_id', id)
      .eq('action', 'edited');
    expect(data).toHaveLength(1);
    expect(data![0]!.actor_name).not.toBe('system');
    expect(data![0]!.entity_label).toBe(`Site content: ${key}`);
  });

  it('refuses a viewer write to site_content, and the row is unchanged', async () => {
    const key = `rls-content-viewer-${Date.now()}`;
    const id = await siteContentFixture(key);
    const viewer = await roleClient('viewer');
    await viewer.from('site_content').update({ value: 'hacked' }).eq('id', id);

    const { data } = await serviceClient()
      .from('site_content')
      .select('value')
      .eq('id', id)
      .single();
    expect(data!.value, 'a viewer wrote to site_content').toBe('original');
  });
});

describe('headline_stats writes at the database boundary', () => {
  beforeAll(async () => {
    await ensureTestUsers();
  });

  async function statFixture(label: string): Promise<string> {
    const svc = serviceClient();
    const { data, error } = await svc
      .from('headline_stats')
      .insert({
        value: '100+',
        label,
        source: 'RLS boundary fixture, test dataset',
        attested_by: 'RLS test harness',
        attested_on: '2026-01-01',
      })
      .select('id')
      .single();
    if (error) throw error;
    return data!.id as string;
  }

  it('lets an editor update a headline stat, and records it as edited', async () => {
    const label = `rls-stat-${Date.now()}`;
    const id = await statFixture(label);
    const editor = await roleClient('editor');
    const { error } = await editor.from('headline_stats').update({ value: '150+' }).eq('id', id);
    expect(error).toBeNull();

    const { data } = await serviceClient()
      .from('audit_log')
      .select('actor_name, entity_label')
      .eq('entity_id', id)
      .eq('action', 'edited');
    expect(data).toHaveLength(1);
    expect(data![0]!.actor_name).not.toBe('system');
    expect(data![0]!.entity_label).toBe(`Headline stat: ${label}`);
  });

  it('refuses a viewer write, and the row is unchanged', async () => {
    const label = `rls-stat-viewer-${Date.now()}`;
    const id = await statFixture(label);
    const viewer = await roleClient('viewer');

    await viewer.from('headline_stats').update({ value: '999+' }).eq('id', id);
    await viewer.from('headline_stats').delete().eq('id', id);

    const { data } = await serviceClient()
      .from('headline_stats')
      .select('value')
      .eq('id', id)
      .single();
    expect(data, 'a viewer deleted a headline stat').not.toBeNull();
    expect(data!.value).toBe('100+');
  });
});

describe('compute_metrics writes at the database boundary', () => {
  beforeAll(async () => {
    await ensureTestUsers();
  });

  async function computeMetricFixture(label: string): Promise<string> {
    const svc = serviceClient();
    const { data, error } = await svc
      .from('compute_metrics')
      .insert({
        value: '10 PFLOPS',
        label,
        source: 'RLS boundary fixture, test dataset',
        attested_by: 'RLS test harness',
        attested_on: '2026-01-01',
      })
      .select('id')
      .single();
    if (error) throw error;
    return data!.id as string;
  }

  it('lets an editor update a compute metric, and records it as edited', async () => {
    const label = `rls-compute-${Date.now()}`;
    const id = await computeMetricFixture(label);
    const editor = await roleClient('editor');
    const { error } = await editor
      .from('compute_metrics')
      .update({ value: '20 PFLOPS' })
      .eq('id', id);
    expect(error).toBeNull();

    const { data } = await serviceClient()
      .from('audit_log')
      .select('actor_name, entity_label')
      .eq('entity_id', id)
      .eq('action', 'edited');
    expect(data).toHaveLength(1);
    expect(data![0]!.actor_name).not.toBe('system');
    expect(data![0]!.entity_label).toBe(`Compute metric: ${label}`);
  });

  it('refuses a viewer write, and the row is unchanged', async () => {
    const label = `rls-compute-viewer-${Date.now()}`;
    const id = await computeMetricFixture(label);
    const viewer = await roleClient('viewer');

    await viewer.from('compute_metrics').update({ value: '999 PFLOPS' }).eq('id', id);
    await viewer.from('compute_metrics').delete().eq('id', id);

    const { data } = await serviceClient()
      .from('compute_metrics')
      .select('value')
      .eq('id', id)
      .single();
    expect(data, 'a viewer deleted a compute metric').not.toBeNull();
    expect(data!.value).toBe('10 PFLOPS');
  });
});

describe('programmes writes at the database boundary', () => {
  beforeAll(async () => {
    await ensureTestUsers();
  });

  async function programmeFixture(title: string): Promise<string> {
    const svc = serviceClient();
    const { data, error } = await svc
      .from('programmes')
      .insert({ title, timeframe: '2026', description: 'RLS boundary fixture.' })
      .select('id')
      .single();
    if (error) throw error;
    return data!.id as string;
  }

  it('lets an editor update a programme, and records it as edited', async () => {
    const title = `rls-programme-${Date.now()}`;
    const id = await programmeFixture(title);
    const editor = await roleClient('editor');
    const { error } = await editor
      .from('programmes')
      .update({ timeframe: '2026-2027' })
      .eq('id', id);
    expect(error).toBeNull();

    const { data } = await serviceClient()
      .from('audit_log')
      .select('actor_name, entity_label')
      .eq('entity_id', id)
      .eq('action', 'edited');
    expect(data).toHaveLength(1);
    expect(data![0]!.actor_name).not.toBe('system');
    expect(data![0]!.entity_label).toBe(`Programme: ${title}`);
  });

  it('refuses a viewer write, and the row is unchanged', async () => {
    const title = `rls-programme-viewer-${Date.now()}`;
    const id = await programmeFixture(title);
    const viewer = await roleClient('viewer');

    await viewer.from('programmes').update({ timeframe: 'hacked' }).eq('id', id);
    await viewer.from('programmes').delete().eq('id', id);

    const { data } = await serviceClient().from('programmes').select('timeframe').eq('id', id).single();
    expect(data, 'a viewer deleted a programme').not.toBeNull();
    expect(data!.timeframe).toBe('2026');
  });
});

describe('impact_stories writes at the database boundary', () => {
  beforeAll(async () => {
    await ensureTestUsers();
  });

  async function impactStoryFixture(organisation: string): Promise<string> {
    const svc = serviceClient();
    const { data, error } = await svc
      .from('impact_stories')
      .insert({
        organisation,
        country: 'Democratic Republic of the Congo',
        description: 'RLS boundary fixture.',
      })
      .select('id')
      .single();
    if (error) throw error;
    return data!.id as string;
  }

  it('lets an editor update an impact story, and records it as edited', async () => {
    const organisation = `rls-story-${Date.now()}`;
    const id = await impactStoryFixture(organisation);
    const editor = await roleClient('editor');
    const { error } = await editor
      .from('impact_stories')
      .update({ description: 'Updated description.' })
      .eq('id', id);
    expect(error).toBeNull();

    const { data } = await serviceClient()
      .from('audit_log')
      .select('actor_name, entity_label')
      .eq('entity_id', id)
      .eq('action', 'edited');
    expect(data).toHaveLength(1);
    expect(data![0]!.actor_name).not.toBe('system');
    expect(data![0]!.entity_label).toBe(`Impact story: ${organisation}`);
  });

  it('refuses a viewer write, and the row is unchanged', async () => {
    const organisation = `rls-story-viewer-${Date.now()}`;
    const id = await impactStoryFixture(organisation);
    const viewer = await roleClient('viewer');

    await viewer.from('impact_stories').update({ description: 'hacked' }).eq('id', id);
    await viewer.from('impact_stories').delete().eq('id', id);

    const { data } = await serviceClient()
      .from('impact_stories')
      .select('description')
      .eq('id', id)
      .single();
    expect(data, 'a viewer deleted an impact story').not.toBeNull();
    expect(data!.description).toBe('RLS boundary fixture.');
  });
});
