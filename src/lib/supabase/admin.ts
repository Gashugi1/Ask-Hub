import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * service_role client. Bypasses RLS entirely.
 *
 * Only for:
 *  - the four public write endpoints, after Zod validation (design doc 5.4.1)
 *  - audit_log writes, which no role has an insert policy for (design doc 5.4.3)
 *  - admin user provisioning
 *
 * Never for reading on a user's behalf — that is createServerSupabase, so RLS
 * still applies. A service_role read is how a viewer ends up seeing something
 * their policies deny.
 *
 * `import 'server-only'` turns an import from a client component into a build
 * error rather than a leaked key. PRD 14.9 check 6 verifies the built bundle.
 */
export function createAdminSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
