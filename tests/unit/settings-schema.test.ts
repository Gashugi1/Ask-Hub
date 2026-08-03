import { describe, it, expect } from 'vitest';
import { settingUpdate } from '@/lib/schemas/settings';

describe('settingUpdate', () => {
  it('accepts a GA4 Measurement ID in its real shape', () => {
    expect(settingUpdate.safeParse({ key: 'ga4_measurement_id', value: 'G-ABCD123456' }).success).toBe(true);
    // Clearing it back to unconfigured must stay possible: an empty string is
    // what drives the "Not connected" state (PRD 6.4).
    expect(settingUpdate.safeParse({ key: 'ga4_measurement_id', value: '' }).success).toBe(true);
  });

  it('refuses a Measurement ID that is not one', () => {
    expect(settingUpdate.safeParse({ key: 'ga4_measurement_id', value: 'UA-12345-1' }).success).toBe(false);
    expect(settingUpdate.safeParse({ key: 'ga4_measurement_id', value: '<script>' }).success).toBe(false);
  });

  it('accepts only the one mailbox for contact_email', () => {
    // CLAUDE.md: one mailbox only. A settings row is the one place a second
    // address could be introduced without touching a locale file, so the
    // rule is enforced here rather than trusted.
    expect(settingUpdate.safeParse({ key: 'contact_email', value: 'aihubfordevelopment@undp.org' }).success).toBe(true);
    expect(settingUpdate.safeParse({ key: 'contact_email', value: 'someone.else@undp.org' }).success).toBe(false);
  });

  it('takes booleans for the flags and refuses strings', () => {
    expect(settingUpdate.safeParse({ key: 'feature_public_impact_page', value: true }).success).toBe(true);
    expect(settingUpdate.safeParse({ key: 'feature_public_impact_page', value: 'true' }).success).toBe(false);
  });

  it('refuses a key outside the five', () => {
    expect(settingUpdate.safeParse({ key: 'service_role_key', value: 'x' }).success).toBe(false);
  });
});
