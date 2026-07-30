import { describe, it, expect } from 'vitest';
import {
  contentEntry,
  statInput,
  computeMetricInput,
  programmeInput,
  impactStoryInput,
  CONTENT_KEYS,
} from '@/lib/schemas/content';

describe('contentEntry', () => {
  it('accepts every key the table actually holds', () => {
    for (const key of CONTENT_KEYS) {
      expect(contentEntry.safeParse({ key, value: 'Copy.' }).success, key).toBe(true);
    }
  });

  it('refuses a key that is not in the list', () => {
    // The key set is an allow-list, not free text: a typo would otherwise
    // attempt an UPDATE that matches zero rows, and the edit would appear to
    // have silently done nothing.
    expect(contentEntry.safeParse({ key: 'ga4_measurement_id', value: 'G-XXXX' }).success).toBe(
      false,
    );
    expect(contentEntry.safeParse({ key: 'welcome_titel', value: 'typo' }).success).toBe(false);
  });

  it("refuses PRD 4.12's key names, which the database does not have", () => {
    // Not pedantry -- this is the failure this allow-list exists to prevent.
    // scripts/seed-data.ts invented its own key names because the prototype had
    // no key/locale structure to inherit, and SP2a's readers read those. A
    // write on `about_intro` would match zero rows, and the editor would see
    // their save succeed (no error thrown) and change nothing on the site
    // unless the action itself checks the affected row count.
    for (const phantom of ['welcome_band_heading', 'about_intro', 'privacy_copy', 'terms_copy']) {
      expect(contentEntry.safeParse({ key: phantom, value: 'Copy.' }).success, phantom).toBe(
        false,
      );
    }
  });

  it('accepts an empty value only where the database does', () => {
    // site_content.value is `not null default ''`, so blank is legal; the
    // public band decides whether to render.
    expect(contentEntry.safeParse({ key: 'identity_lead', value: '' }).success).toBe(true);
  });
});

describe('statInput', () => {
  const valid = {
    value: '150+',
    label: 'Extended network',
    isHero: true,
    sortOrder: 1,
    source: 'AI Hub programme office, June 2026 partner count',
    attestedBy: 'A. Nakamura, Programme Lead',
    attestedOn: '2026-06-30',
  };

  it('accepts a fully attested stat', () => {
    expect(statInput.safeParse(valid).success).toBe(true);
  });

  it('refuses a stat with no provenance', () => {
    // headline_stats requires source, attested_by and attested_on NOT NULL
    // and non-blank (0015_stat_provenance.sql). A figure on a UN leadership
    // surface without a named source is exactly what that migration exists to
    // prevent; the form must not be able to attempt it.
    for (const field of ['source', 'attestedBy']) {
      expect(statInput.safeParse({ ...valid, [field]: '' }).success, field).toBe(false);
      expect(statInput.safeParse({ ...valid, [field]: '   ' }).success, `${field} blank`).toBe(
        false,
      );
    }
    expect(statInput.safeParse({ ...valid, attestedOn: '' }).success).toBe(false);
  });

  it('requires a value and a label', () => {
    expect(statInput.safeParse({ ...valid, value: '' }).success).toBe(false);
    expect(statInput.safeParse({ ...valid, label: '' }).success).toBe(false);
  });
});

describe('computeMetricInput', () => {
  const valid = {
    value: '12 PFLOPS',
    label: 'CINECA Leonardo allocation',
    subNote: 'Shared quarterly allocation across partner projects',
    sortOrder: 0,
    source: 'AI Hub programme dataset, received 2026-06-01',
    attestedBy: 'A. Nakamura, Programme Lead',
    attestedOn: '2026-06-01',
  };

  it('accepts a fully attested compute metric, including a null sub-note', () => {
    expect(computeMetricInput.safeParse(valid).success).toBe(true);
    expect(computeMetricInput.safeParse({ ...valid, subNote: null }).success).toBe(true);
  });

  it('refuses a compute metric with no provenance, same as a headline stat', () => {
    expect(computeMetricInput.safeParse({ ...valid, source: '' }).success).toBe(false);
    expect(computeMetricInput.safeParse({ ...valid, attestedBy: '   ' }).success).toBe(false);
    expect(computeMetricInput.safeParse({ ...valid, attestedOn: '' }).success).toBe(false);
  });
});

describe('programmeInput', () => {
  const valid = {
    title: 'AI for Climate Resilience',
    timeframe: '2026-2027',
    description: 'A cross-country cohort programme.',
    sortOrder: 0,
  };

  it('accepts a programme with no provenance fields at all', () => {
    // Programmes are not reported figures, so the schema must not require
    // source/attestedBy/attestedOn the way statInput does.
    expect(programmeInput.safeParse(valid).success).toBe(true);
    expect('source' in valid).toBe(false);
  });

  it('requires a title', () => {
    expect(programmeInput.safeParse({ ...valid, title: '' }).success).toBe(false);
  });
});

describe('impactStoryInput', () => {
  const valid = {
    organisation: 'A partner organisation',
    country: 'Democratic Republic of the Congo',
    description: 'An impact story.',
    sortOrder: 0,
  };

  it('accepts an impact story', () => {
    expect(impactStoryInput.safeParse(valid).success).toBe(true);
  });

  it('requires an organisation', () => {
    expect(impactStoryInput.safeParse({ ...valid, organisation: '' }).success).toBe(false);
  });
});
