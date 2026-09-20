import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { readPartnerNames } from './readers';

/**
 * Make sure a provider row exists for `name`, creating it name-only if the
 * registry lacks it. Returns whether a row was created.
 *
 * This is the prototype's answer to "a resource from an organisation not yet
 * in the registry": its form's provider field is free text and saving simply
 * records the name. Here `resources.partner` is a foreign key to
 * `partners(name)`, so the row has to exist first -- and this is where every
 * writer makes it exist: the resource modal, the tracker import and the
 * review queue all go through here rather than each carrying its own copy.
 *
 * Runs on the caller's own RLS-bound client, never the service role:
 * `partners_insert_staff` (0014) admits admin and editor and refuses a
 * viewer at the database, and the `partners_audit` trigger records the
 * creation against the caller. Name only -- `logo_url`, `website_url` and
 * `sort_order` are left to the column defaults -- and `ignoreDuplicates`
 * makes the statement ON CONFLICT DO NOTHING, so a race with another writer
 * creating the same provider neither fails nor writes a spurious "updated"
 * audit row.
 *
 * Deliberately not a substitute for `assertKnownPartner`: callers still run
 * that check on a fresh read after this returns. What it covers is a row the
 * caller's role could not create or cannot see -- the case where this
 * function's insert was refused -- so the operator gets a message naming the
 * provider rather than a constraint violation from the resource write.
 */
export async function ensureProvider(
  supabase: SupabaseClient<Database>,
  name: string,
): Promise<{ created: boolean }> {
  if ((await readPartnerNames()).includes(name)) return { created: false };
  const { error } = await supabase
    .from('partners')
    .upsert({ name }, { onConflict: 'name', ignoreDuplicates: true });
  if (error) throw new Error(`ensureProvider failed (partners): ${error.message}`);
  return { created: true };
}
