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
  // Named, not valued: `supabaseUrl is required.` from the SDK does not say
  // which of the two variables is missing, and both are inlined at build time,
  // so a missing one is a deploy-configuration mistake worth naming.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
  return createBrowserClient<Database>(url, anonKey);
}
