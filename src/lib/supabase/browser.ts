import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

/**
 * Client-component Supabase client on the anon key. Every query it makes is
 * subject to RLS as the signed-in user, or as `anon` when there is no session.
 *
 * The anon key is public by design (PRD 13.5) — it is safe in the bundle
 * precisely because RLS, not key secrecy, is the authorization boundary.
 */
export function createBrowserSupabase() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
