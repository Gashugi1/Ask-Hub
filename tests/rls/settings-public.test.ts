import { describe, it, expect, beforeAll } from 'vitest';
import { anonClient, serviceClient } from '../helpers/clients';

describe('settings_public', () => {
  beforeAll(async () => {
    // The two flags are inserted by migration 0006 and are never deleted.
    const { data } = await serviceClient()
      .from('settings')
      .select('key')
      .eq('key', 'feature_public_impact_page');
    expect(data?.length, 'migration 0006 must have seeded the flag').toBe(1);
  });

  it('lets anon read exactly the two feature flags', async () => {
    const { data, error } = await anonClient()
      .from('settings_public')
      .select('key, value');
    expect(error).toBeNull();
    expect((data ?? []).map((r) => r.key).sort()).toEqual([
      'feature_innovator_profiles',
      'feature_public_impact_page',
    ]);
  });

  // A separate 'projects no other settings key to anon' case (checking
  // ga4_measurement_id, ga4_property_id, contact_email individually) was
  // removed here: it read `data ?? []` without checking `error` first, so it
  // would pass vacuously against an empty array on any query failure, and
  // even fixed, it cannot fail for a reason the test above doesn't already
  // cover. The preceding test's `toEqual` on the sorted key list is an exact
  // match against precisely `feature_innovator_profiles` and
  // `feature_public_impact_page` -- any of those three settings keys leaking
  // through would already fail it, since a third element (or a substitution)
  // breaks exact-array equality. A second test asserting the same fact with
  // weaker (`not.toContain`) assertions is not a second guarantee.

  it('still denies anon the settings base table', async () => {
    const { error } = await anonClient().from('settings').select('key');
    expect(error).not.toBeNull();
  });
});
