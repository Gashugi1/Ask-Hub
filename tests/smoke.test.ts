import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

describe('local supabase stack', () => {
  it('accepts a connection with the anon key', async () => {
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
    );
    const { error } = await client.from('profiles').select('id').limit(1);

    // No tables exist yet, so an error is expected. What matters is WHICH
    // error: a structured table-not-found proves the request cleared Kong,
    // the anon key was accepted, and PostgREST processed it — which is the
    // whole claim at this stage.
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
