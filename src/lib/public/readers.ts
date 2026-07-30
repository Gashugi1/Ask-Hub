import 'server-only';
import { unstable_cache } from 'next/cache';
import { createPublicSupabase } from './client';
import { CACHE_TAGS, RESOURCE_TTL_SECONDS, SETTINGS_TTL_SECONDS } from './cache';
import {
  toPublicResource,
  toPublicPartner,
  toPublicStat,
  toPublicStory,
  toNeedCount,
  type PublicResource,
  type PublicPartner,
  type PublicStat,
  type PublicStory,
  type NeedCount,
} from './types';

/**
 * The public site's cached readers. This is the only module that touches the
 * anon client.
 *
 * `unstable_cache` rather than `'use cache'`: the newer directive needs
 * `cacheComponents: true` in next.config.ts, which changes data-access
 * semantics app-wide. Migrating is a follow-up, not a prerequisite.
 *
 * A read error throws. It does not return an empty array and it does not
 * retry with a more privileged client: an empty directory and a broken
 * directory look identical to a visitor, and only one of them is honest.
 */
function fail(what: string, message: string): never {
  throw new Error(`public read failed (${what}): ${message}`);
}

export const listPublicResources = unstable_cache(
  async (): Promise<PublicResource[]> => {
    const { data, error } = await createPublicSupabase()
      .from('resources_public')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });
    if (error) fail('resources_public', error.message);
    return (data ?? []).map(toPublicResource);
  },
  ['public:resources'],
  // The only reader with a TTL. See RESOURCE_TTL_SECONDS for why: is_closed
  // and days_left move with the clock, so tag invalidation alone is not
  // sufficient. Every other reader is tag-only and caches indefinitely.
  { tags: [CACHE_TAGS.resources], revalidate: RESOURCE_TTL_SECONDS },
);

export async function getPublicResource(id: string): Promise<PublicResource | null> {
  // Served from the same cached list rather than a per-id query: the list is
  // already in cache for the directory, and a second cache entry per resource
  // would need its own invalidation. Absent from the list means absent from
  // resources_public, which means status is not 'live'.
  const all = await listPublicResources();
  return all.find((r) => r.id === id) ?? null;
}

export const listNeedCounts = unstable_cache(
  async (): Promise<NeedCount[]> => {
    const { data, error } = await createPublicSupabase()
      .from('need_counts_public')
      .select('*');
    if (error) fail('need_counts_public', error.message);
    return (data ?? []).map(toNeedCount);
  },
  ['public:need-counts'],
  // Resource-derived but not deadline-derived: the view groups by need across
  // need_primary and need_secondary where status = 'live' and contains no
  // current_date, so it needs the resources tag and no TTL.
  { tags: [CACHE_TAGS.resources] },
);

export const listPublicPartners = unstable_cache(
  async (): Promise<PublicPartner[]> => {
    const { data, error } = await createPublicSupabase()
      .from('partners_public')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) fail('partners_public', error.message);
    return (data ?? []).map(toPublicPartner);
  },
  ['public:partners'],
  { tags: [CACHE_TAGS.partners] },
);

export const getSiteContent = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const { data, error } = await createPublicSupabase()
      .from('site_content_public')
      .select('key, value, locale')
      .eq('locale', 'en');
    if (error) fail('site_content_public', error.message);
    const out: Record<string, string> = {};
    for (const row of data ?? []) {
      if (row.key !== null && row.value !== null) out[row.key] = row.value;
    }
    return out;
  },
  ['public:site-content'],
  { tags: [CACHE_TAGS.siteContent] },
);

export const listHeadlineStats = unstable_cache(
  async (): Promise<PublicStat[]> => {
    const { data, error } = await createPublicSupabase()
      .from('headline_stats_public')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) fail('headline_stats_public', error.message);
    return (data ?? []).map(toPublicStat);
  },
  ['public:headline-stats'],
  { tags: [CACHE_TAGS.headlineStats] },
);

export const listImpactStories = unstable_cache(
  async (): Promise<PublicStory[]> => {
    const { data, error } = await createPublicSupabase()
      .from('impact_stories_public')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) fail('impact_stories_public', error.message);
    return (data ?? []).map(toPublicStory);
  },
  ['public:impact-stories'],
  { tags: [CACHE_TAGS.impactStories] },
);

const readFlags = unstable_cache(
  async (): Promise<Record<string, boolean>> => {
    const { data, error } = await createPublicSupabase()
      .from('settings_public')
      .select('key, value');
    if (error) fail('settings_public', error.message);
    const out: Record<string, boolean> = {};
    for (const row of data ?? []) {
      if (row.key !== null) out[row.key] = row.value === true;
    }
    return out;
  },
  ['public:settings'],
  // See SETTINGS_TTL_SECONDS for why this reader, unlike the others besides
  // resources, needs a TTL rather than tag invalidation alone: a flag can
  // flip with no revalidateTag call ever firing, and an untimed cache entry
  // here bakes into the static generation of the route it gates -- making a
  // flag that can never be turned on at runtime, however the value changes.
  { tags: [CACHE_TAGS.settings], revalidate: SETTINGS_TTL_SECONDS },
);

/**
 * Both flags are off at launch (PRD 7). A missing or non-boolean value reads
 * as false: a feature flag that fails open would ship an unfinished page.
 */
export async function isFeatureEnabled(
  key: 'feature_public_impact_page' | 'feature_innovator_profiles',
): Promise<boolean> {
  return (await readFlags())[key] ?? false;
}
