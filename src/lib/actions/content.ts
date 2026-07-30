'use server';

import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { createAdminReadClient } from '@/lib/admin/client';
import {
  contentEntry,
  statInput,
  computeMetricInput,
  programmeInput,
  impactStoryInput,
} from '@/lib/schemas/content';
import { CACHE_TAGS } from '@/lib/public/cache';
import { assertRowAffected } from './resource-mutation-guards';

const id = z.string().uuid();

/**
 * Same two-argument form as `src/lib/actions/resources.ts`'s
 * `revalidateResources`: `revalidateTag` in the installed Next 16.2.12
 * requires a `profile` argument, and `{ expire: 0 }` is the one that marks
 * the tag fully stale immediately (see that file's comment for the full
 * trace through next/dist). `'max'` would resolve to a one-year expiry and
 * would not satisfy PRD 13.4/6.7's "no rebuild" requirement for the very
 * next request.
 */
function revalidate(tag: string): void {
  revalidateTag(tag, { expire: 0 });
}

/**
 * The six content areas map onto five tables; two of those five tables
 * revalidate nothing. `CACHE_TAGS` (src/lib/public/cache.ts, owned by
 * SP2a/SP3's shared surface — not edited here) has no entry for
 * `compute_metrics` or `programmes` because no public reader currently
 * queries either table. Inventing a tag here would create a name nothing
 * listens to, which reads like working invalidation and is not. If a public
 * page later renders either table, SP2a adds the reader and the tag
 * together, and an action here starts calling `revalidate(...)` with it.
 */

// ---------------------------------------------------------------------------
// site_content — panels 1 and 2 (welcome band, identity/About)
// ---------------------------------------------------------------------------

/**
 * UPDATE only, never upsert. `site_content` has a unique `(key, locale)`
 * constraint an upsert could target, but an upsert would silently create a
 * sixth row nothing renders if the key were ever wrong — impossible here
 * since `contentEntry`'s `key` is `z.enum(CONTENT_KEYS)`, but the mutation
 * itself must not rely on that alone. `assertRowAffected` below is the
 * second line of defence: if the five seeded rows were ever missing this
 * throws instead of reporting a save that changed nothing.
 */
export async function saveContentEntry(input: unknown): Promise<void> {
  await requireRole(['admin', 'editor']);
  const parsed = contentEntry.parse(input);
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('site_content')
    .update({ value: parsed.value })
    .eq('key', parsed.key)
    .eq('locale', 'en')
    .select('id');
  if (error) throw new Error(`saveContentEntry failed: ${error.message}`);
  assertRowAffected('saveContentEntry', data);
  revalidate(CACHE_TAGS.siteContent);
}

// ---------------------------------------------------------------------------
// headline_stats — panel 5
// ---------------------------------------------------------------------------

function statToRow(input: ReturnType<typeof statInput.parse>) {
  return {
    value: input.value,
    label: input.label,
    is_hero: input.isHero,
    sort_order: input.sortOrder,
    source: input.source,
    attested_by: input.attestedBy,
    attested_on: input.attestedOn,
  };
}

export async function createStat(input: unknown): Promise<{ id: string }> {
  await requireRole(['admin', 'editor']);
  const parsed = statInput.parse(input);
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('headline_stats')
    .insert(statToRow(parsed))
    .select('id')
    .single();
  if (error) throw new Error(`createStat failed: ${error.message}`);
  revalidate(CACHE_TAGS.headlineStats);
  return { id: data!.id };
}

export async function saveStat(rawId: unknown, input: unknown): Promise<void> {
  await requireRole(['admin', 'editor']);
  const targetId = id.parse(rawId);
  const parsed = statInput.parse(input);
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('headline_stats')
    .update(statToRow(parsed))
    .eq('id', targetId)
    .select('id');
  if (error) throw new Error(`saveStat failed: ${error.message}`);
  assertRowAffected('saveStat', data);
  revalidate(CACHE_TAGS.headlineStats);
}

export async function deleteStat(rawId: unknown): Promise<void> {
  await requireRole(['admin', 'editor']);
  const targetId = id.parse(rawId);
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('headline_stats')
    .delete()
    .eq('id', targetId)
    .select('id');
  if (error) throw new Error(`deleteStat failed: ${error.message}`);
  assertRowAffected('deleteStat', data);
  revalidate(CACHE_TAGS.headlineStats);
}

// ---------------------------------------------------------------------------
// compute_metrics — panel 6. No cache tag: see the file-level comment above.
// ---------------------------------------------------------------------------

function computeMetricToRow(input: ReturnType<typeof computeMetricInput.parse>) {
  return {
    value: input.value,
    label: input.label,
    sub_note: input.subNote,
    sort_order: input.sortOrder,
    source: input.source,
    attested_by: input.attestedBy,
    attested_on: input.attestedOn,
  };
}

export async function createComputeMetric(input: unknown): Promise<{ id: string }> {
  await requireRole(['admin', 'editor']);
  const parsed = computeMetricInput.parse(input);
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('compute_metrics')
    .insert(computeMetricToRow(parsed))
    .select('id')
    .single();
  if (error) throw new Error(`createComputeMetric failed: ${error.message}`);
  return { id: data!.id };
}

export async function saveComputeMetric(rawId: unknown, input: unknown): Promise<void> {
  await requireRole(['admin', 'editor']);
  const targetId = id.parse(rawId);
  const parsed = computeMetricInput.parse(input);
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('compute_metrics')
    .update(computeMetricToRow(parsed))
    .eq('id', targetId)
    .select('id');
  if (error) throw new Error(`saveComputeMetric failed: ${error.message}`);
  assertRowAffected('saveComputeMetric', data);
}

export async function deleteComputeMetric(rawId: unknown): Promise<void> {
  await requireRole(['admin', 'editor']);
  const targetId = id.parse(rawId);
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('compute_metrics')
    .delete()
    .eq('id', targetId)
    .select('id');
  if (error) throw new Error(`deleteComputeMetric failed: ${error.message}`);
  assertRowAffected('deleteComputeMetric', data);
}

// ---------------------------------------------------------------------------
// programmes — panel 7. No cache tag: see the file-level comment above.
// ---------------------------------------------------------------------------

function programmeToRow(input: ReturnType<typeof programmeInput.parse>) {
  return {
    title: input.title,
    timeframe: input.timeframe,
    description: input.description,
    sort_order: input.sortOrder,
  };
}

export async function createProgramme(input: unknown): Promise<{ id: string }> {
  await requireRole(['admin', 'editor']);
  const parsed = programmeInput.parse(input);
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('programmes')
    .insert(programmeToRow(parsed))
    .select('id')
    .single();
  if (error) throw new Error(`createProgramme failed: ${error.message}`);
  return { id: data!.id };
}

export async function saveProgramme(rawId: unknown, input: unknown): Promise<void> {
  await requireRole(['admin', 'editor']);
  const targetId = id.parse(rawId);
  const parsed = programmeInput.parse(input);
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('programmes')
    .update(programmeToRow(parsed))
    .eq('id', targetId)
    .select('id');
  if (error) throw new Error(`saveProgramme failed: ${error.message}`);
  assertRowAffected('saveProgramme', data);
}

export async function deleteProgramme(rawId: unknown): Promise<void> {
  await requireRole(['admin', 'editor']);
  const targetId = id.parse(rawId);
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase.from('programmes').delete().eq('id', targetId).select('id');
  if (error) throw new Error(`deleteProgramme failed: ${error.message}`);
  assertRowAffected('deleteProgramme', data);
}

// ---------------------------------------------------------------------------
// impact_stories — panel 8
// ---------------------------------------------------------------------------

function impactStoryToRow(input: ReturnType<typeof impactStoryInput.parse>) {
  return {
    organisation: input.organisation,
    country: input.country,
    description: input.description,
    sort_order: input.sortOrder,
  };
}

export async function createImpactStory(input: unknown): Promise<{ id: string }> {
  await requireRole(['admin', 'editor']);
  const parsed = impactStoryInput.parse(input);
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('impact_stories')
    .insert(impactStoryToRow(parsed))
    .select('id')
    .single();
  if (error) throw new Error(`createImpactStory failed: ${error.message}`);
  revalidate(CACHE_TAGS.impactStories);
  return { id: data!.id };
}

export async function saveImpactStory(rawId: unknown, input: unknown): Promise<void> {
  await requireRole(['admin', 'editor']);
  const targetId = id.parse(rawId);
  const parsed = impactStoryInput.parse(input);
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('impact_stories')
    .update(impactStoryToRow(parsed))
    .eq('id', targetId)
    .select('id');
  if (error) throw new Error(`saveImpactStory failed: ${error.message}`);
  assertRowAffected('saveImpactStory', data);
  revalidate(CACHE_TAGS.impactStories);
}

export async function deleteImpactStory(rawId: unknown): Promise<void> {
  await requireRole(['admin', 'editor']);
  const targetId = id.parse(rawId);
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('impact_stories')
    .delete()
    .eq('id', targetId)
    .select('id');
  if (error) throw new Error(`deleteImpactStory failed: ${error.message}`);
  assertRowAffected('deleteImpactStory', data);
  revalidate(CACHE_TAGS.impactStories);
}
