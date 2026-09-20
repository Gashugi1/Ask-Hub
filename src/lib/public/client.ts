import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { supabaseUrlFromEnv } from '@/lib/supabase/env';

/**
 * The public site's only database client -- and, for the same sessionless
 * reason, the client the password-reset request goes through
 * (src/lib/actions/session.ts explains the flow-type reason).
 *
 * Deliberately NOT the request-scoped `createServerSupabase()`: that one
 * carries the caller's cookies, so an admin browsing the public site would
 * read the views as `authenticated` rather than as `anon`, and the pages
 * they cached would be the ones every anonymous visitor then received.
 * A cookie-free client makes every public read identical for every visitor,
 * which is what makes the response cacheable at all.
 *
 * Deliberately NOT the `service_role` client either, and that is not a style
 * preference: `service_role` holds no SELECT on any `*_public` view (the
 * grant is `to anon, authenticated`), so reaching for it here returns 42501.
 * Verifiable directly against this database --
 * `select has_table_privilege('service_role', 'public.resources_public', 'SELECT')`
 * returns false, same for every other `*_public` view -- so this does not
 * need re-litigating from inference about default privileges. Never "fix" a
 * failing public read by swapping this client for the admin one -- the
 * failure is the signal, and the views are the public contract.
 */
export function createPublicSupabase() {
  // Named, not valued. Never interpolate a key into a thrown message.
  const url = supabaseUrlFromEnv();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
