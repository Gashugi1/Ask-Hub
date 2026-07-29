import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { COUNTRIES, SECTORS, STAGES, NEEDS, NEED_KEYS } from '@/lib/reference';

describe('reference lists', () => {
  it('has non-empty canonical lists for every filter dimension', () => {
    expect(COUNTRIES.length).toBeGreaterThan(0);
    expect(SECTORS.length).toBeGreaterThan(0);
    expect(STAGES.length).toBeGreaterThan(0);
    expect(NEED_KEYS.length).toBeGreaterThan(0);
    expect(NEEDS.length).toBe(NEED_KEYS.length);
  });

  it('has no "Global programmes" country option (PRD content rule 10.6)', () => {
    expect(COUNTRIES).not.toContain('Global programmes');
  });

  it('spells the DRC out in full', () => {
    expect(COUNTRIES).toContain('Democratic Republic of the Congo');
  });
});

/**
 * NEED_KEYS is the UI's canonical need list; public.need_type is the
 * database's. A drift between the two would surface as a runtime failure
 * in SP2 (a resource seeded with a need the UI does not know how to render)
 * rather than as a compile error here, so this test reads the enum directly
 * off the running local Supabase stack rather than trusting a hand-copied
 * duplicate to stay in sync.
 *
 * Requires `npm run db:start` (or an already-running local stack) — the
 * same dependency every RLS suite in this repo already has.
 */
describe('NEED_KEYS matches public.need_type', () => {
  it('agrees with the database enum, in the same order', () => {
    const output = execFileSync(
      'npx',
      [
        'supabase',
        'db',
        'query',
        '--local',
        'select unnest(enum_range(NULL::public.need_type))::text as label',
        '--output',
        'json',
      ],
      { encoding: 'utf8' },
    );

    const parsed = JSON.parse(output) as { rows: Array<{ label: string }> };
    const dbLabels = parsed.rows.map((row) => row.label);

    expect(dbLabels).toEqual([...NEED_KEYS]);
  });
});
