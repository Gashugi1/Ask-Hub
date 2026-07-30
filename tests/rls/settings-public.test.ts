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

  it('projects no other settings key to anon', async () => {
    const { data } = await anonClient().from('settings_public').select('key');
    for (const forbidden of ['ga4_measurement_id', 'ga4_property_id', 'contact_email']) {
      expect(
        (data ?? []).map((r) => r.key),
        `${forbidden} must not reach the public projection`,
      ).not.toContain(forbidden);
    }
  });

  it('still denies anon the settings base table', async () => {
    const { error } = await anonClient().from('settings').select('key');
    expect(error).not.toBeNull();
  });

});
