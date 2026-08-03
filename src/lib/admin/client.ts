import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * The admin surface's only database client: request-scoped, carrying the
 * caller's cookies, so every read is evaluated by RLS as that user.
 *
 * Named separately from createServerSupabase so no admin screen has to make
 * the choice. Never the anon client (it holds only the *_public views, which
 * strip the status and provenance columns these screens exist to edit) and
 * never the service_role client (its reads would show a viewer rows their own
 * policies deny).
 */
export function createAdminReadClient() {
  return createServerSupabase();
}
