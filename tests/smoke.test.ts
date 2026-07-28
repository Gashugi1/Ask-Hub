import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

describe('local supabase stack', () => {
  it('accepts a connection with the anon key', async () => {
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
    );
    // Probe a relation that is guaranteed never to exist, rather than a real
    // table. `profiles` (Task 4) now exists and `anon` has been revoked on
    // it at the grant layer, so probing it would return 42501 (permission
    // denied) instead of table-not-found -- a different claim than this test
    // makes. Every later schema task grants/revokes its own tables the same
    // way, so no real table name is safe to pin this probe to long-term.
    // This name must never be created as an actual table or view.
    const { error } = await client
      .from('__connectivity_probe_do_not_create__')
      .select('id')
      .limit(1);

    // No such relation exists, so an error is expected. What matters is
    // WHICH error: a structured table-not-found proves the request cleared
    // Kong, the anon key was accepted, and PostgREST processed it — which is
    // the whole claim at this stage.
    //
    // Modern PostgREST answers a missing table from its own schema cache
    // with PGRST205 and never reaches Postgres; older versions surface
    // Postgres's own 42P01. Accept either rather than pinning the test to
    // one PostgREST version. Anything else — an auth rejection, a
    // connection failure — lands here as a different code and fails.
    expect(error, 'expected a table-not-found error, got none').not.toBeNull();
    expect(
      ['PGRST205', '42P01'],
      `unexpected error: ${error!.code} ${error!.message}`,
    ).toContain(error!.code);
  });
});
