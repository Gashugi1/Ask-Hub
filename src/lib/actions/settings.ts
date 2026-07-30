'use server';

import { revalidateTag } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createAdminReadClient } from '@/lib/admin/client';
import { settingUpdate } from '@/lib/schemas/settings';
import { CACHE_TAGS } from '@/lib/public/cache';
import { assertRowAffected } from './resource-mutation-guards';

/**
 * Admin only, and that is checked here rather than only on the page that
 * renders the form (PRD §3's capability table, one row above Site Content).
 * This is the action an editor could most plausibly reach by hand — the
 * prototype put these panels on the screen editors legitimately use — so a
 * stale client or a reposted form is a realistic path, not a theoretical
 * one.
 *
 * `settings_write_admin` (supabase/migrations/0006_site.sql) refuses the
 * write at the database too. Neither layer is decorative: this one produces
 * FORBIDDEN before a request is even sent, that one is the actual boundary
 * if this check were ever wrong.
 *
 * Never upsert: the five keys are seeded once by migration and this action
 * only ever updates one of them. `assertRowAffected` catches both a typo'd
 * key (impossible today, since `settingUpdate`'s key is a closed union) and
 * an RLS refusal that PostgREST reports as zero rows with no error.
 */
export async function saveSetting(input: unknown): Promise<void> {
  await requireRole(['admin']);
  const parsed = settingUpdate.parse(input);
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('settings')
    .update({ value: parsed.value })
    .eq('key', parsed.key)
    .select('id');
  if (error) throw new Error(`saveSetting failed: ${error.message}`);
  assertRowAffected('saveSetting', data);
  // settings_public projects the two feature flags to anon, so a flag
  // change must reach the public site immediately, with no rebuild. `{
  // expire: 0 }` is the two-argument form revalidateTag requires in the
  // installed Next 16.2.12 (see src/lib/actions/resources.ts's
  // revalidateResources for the full trace) — 'max' would resolve to a
  // one-year expiry and would not satisfy that.
  revalidateTag(CACHE_TAGS.settings, { expire: 0 });
}
