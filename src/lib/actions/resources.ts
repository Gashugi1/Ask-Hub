'use server';

import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { createAdminReadClient } from '@/lib/admin/client';
import { resourceInput } from '@/lib/schemas/resource';
import { CACHE_TAGS } from '@/lib/public/cache';

const id = z.string().uuid();
const status = z.enum(['live', 'pipeline', 'reference']);

/**
 * `revalidateTag` in this Next.js version (16.2.12) requires a second
 * `profile` argument: a bare `revalidateTag(tag)` still runs but is
 * deprecated in favour of either `'max'` (stale-while-revalidate — the next
 * visitor may still see the old page while a fresh one loads in the
 * background) or a custom `{ expire }` profile. PRD 13.4 and CLAUDE.md both
 * require Site Content and resource edits to "appear everywhere immediately
 * with no rebuild," which stale-while-revalidate does not strictly satisfy
 * for the very next request. `{ expire: 0 }` reproduces the pre-16
 * single-argument behaviour exactly (see the `revalidate()` implementation
 * in next/dist/server/web/spec-extension/revalidate.js: a profile whose
 * `expire` is 0 marks the path as fully revalidated, the same branch a
 * missing profile takes), without the deprecation warning.
 */
function revalidateResources(): void {
  revalidateTag(CACHE_TAGS.resources, { expire: 0 });
}

/**
 * Every action here opens with its own requireRole. Not because the page did
 * not check — because an action can be invoked directly, with no page and no
 * proxy in the path (PRD 14.4).
 *
 * No action writes an audit_log row: the trigger from 0017_audit_triggers.sql
 * writes it inside this mutation's own transaction, attributed to auth.uid().
 * See src/lib/actions/README.md.
 *
 * revalidateTag comes last and only on success. Invalidating a tag for a
 * write that failed would evict a correct cached page and replace it with an
 * identical one, hiding the failure behind a cache miss.
 */
function toRow(input: ReturnType<typeof resourceInput.parse>) {
  return {
    name: input.name,
    partner: input.partner,
    partner_tier: input.partnerTier,
    resource_type: input.resourceType,
    need_primary: input.needPrimary,
    need_secondary: input.needSecondary,
    sub_category: input.subCategory,
    description: input.description,
    action_label: input.actionLabel,
    external_url: input.externalUrl,
    banner_image_url: input.bannerImageUrl,
    countries_eligible: input.countriesEligible,
    sectors_eligible: input.sectorsEligible,
    stages_eligible: input.stagesEligible,
    geo_scope: input.geoScope,
    deadline: input.deadline,
    status: input.status,
    is_featured: input.isFeatured,
    exclusivity: input.exclusivity,
    sort_order: input.sortOrder,
  };
}

export async function createResource(input: unknown): Promise<{ id: string }> {
  await requireRole(['admin', 'editor']);
  const parsed = resourceInput.parse(input);
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('resources')
    .insert(toRow(parsed))
    .select('id')
    .single();
  if (error) throw new Error(`createResource failed: ${error.message}`);
  revalidateResources();
  return { id: data!.id };
}

export async function updateResource(rawId: unknown, input: unknown): Promise<void> {
  await requireRole(['admin', 'editor']);
  const targetId = id.parse(rawId);
  const parsed = resourceInput.parse(input);
  const supabase = await createAdminReadClient();
  const { error } = await supabase.from('resources').update(toRow(parsed)).eq('id', targetId);
  if (error) throw new Error(`updateResource failed: ${error.message}`);
  revalidateResources();
}

export async function setResourceStatus(rawId: unknown, rawStatus: unknown): Promise<void> {
  await requireRole(['admin', 'editor']);
  const targetId = id.parse(rawId);
  const next = status.parse(rawStatus);
  const supabase = await createAdminReadClient();
  const { error } = await supabase.from('resources').update({ status: next }).eq('id', targetId);
  if (error) throw new Error(`setResourceStatus failed: ${error.message}`);
  revalidateResources();
}

export async function setResourceFeatured(rawId: unknown, rawFeatured: unknown): Promise<void> {
  await requireRole(['admin', 'editor']);
  const targetId = id.parse(rawId);
  const isFeatured = z.boolean().parse(rawFeatured);
  const supabase = await createAdminReadClient();
  const { error } = await supabase.from('resources').update({ is_featured: isFeatured }).eq('id', targetId);
  if (error) throw new Error(`setResourceFeatured failed: ${error.message}`);
  revalidateResources();
}

export async function deleteResource(rawId: unknown): Promise<void> {
  await requireRole(['admin', 'editor']);
  const targetId = id.parse(rawId);
  const supabase = await createAdminReadClient();
  const { error } = await supabase.from('resources').delete().eq('id', targetId);
  if (error) throw new Error(`deleteResource failed: ${error.message}`);
  revalidateResources();
}
