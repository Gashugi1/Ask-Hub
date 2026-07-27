import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

describe('.env.example', () => {
  const example = readFileSync('.env.example', 'utf8');

  it('documents every name the app and tests read', () => {
    for (const name of [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
    ]) {
      // Line-anchored, not a substring match: SUPABASE_URL and
      // SUPABASE_ANON_KEY are both substrings of their NEXT_PUBLIC_
      // counterparts, so toContain() would pass even with the bare
      // test-only names deleted outright.
      expect(example, `${name} is undocumented`).toMatch(
        new RegExp(`^${name}=`, 'm'),
      );
    }
  });

  it('never prefixes a secret with NEXT_PUBLIC_', () => {
    // PRD 13.5: anything NEXT_PUBLIC_ is public by definition.
    expect(example).not.toMatch(/NEXT_PUBLIC_\w*SERVICE_ROLE/);
    expect(example).not.toMatch(/NEXT_PUBLIC_\w*SECRET/);
  });

  it('carries names only, no values', () => {
    const assignments = example
      .split('\n')
      .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line));
    expect(assignments.length).toBeGreaterThan(0);
    for (const line of assignments) {
      const value = line.slice(line.indexOf('=') + 1).trim();
      expect(value, `${line} has a value committed`).toBe('');
    }
  });

  it('contains no JWT', () => {
    // A Supabase anon or service key is a JWT starting `eyJ`.
    expect(example).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
  });
});

describe('supabase local config', () => {
  const config = readFileSync('supabase/config.toml', 'utf8');

  it('disables public signup at the project level', () => {
    // PRD 3 and 14.3: no public sign-up route can exist regardless of
    // application code. Enforced by config, not by omitting a page.
    //
    // Bound the slice to the [auth] block itself. Slicing to end-of-file
    // swallows [auth.email] and [auth.sms], which carry their own
    // enable_signup lines — an unanchored match then passes when ANY of
    // the three is false, including with the top-level master switch
    // flipped to true. Verified: that exact mutation passed the earlier
    // version of this test.
    const start = config.indexOf('[auth]');
    expect(start, '[auth] section missing from config.toml').toBeGreaterThan(-1);
    const next = config.indexOf('\n[', start + 1);
    const block = config.slice(start, next === -1 ? undefined : next);
    expect(block).toMatch(/^enable_signup\s*=\s*false\s*$/m);
  });
});

describe('secrets are not committed', () => {
  it('tracks no env file other than the template', () => {
    // Presence on disk is fine and expected — .env.local and .env.test both
    // hold a real service_role key. What must never be true is git knowing
    // about them. Asked of git directly rather than of .gitignore, because
    // a file already tracked stays tracked no matter what the ignore rules
    // say afterwards.
    const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
      .split('\n')
      .filter((file) => file.startsWith('.env'));
    const offenders = tracked.filter((file) => file !== '.env.example');
    expect(offenders, `tracked env files: ${offenders.join(', ')}`).toEqual([]);
  });

  it('keeps the template itself present', () => {
    expect(existsSync('.env.example')).toBe(true);
  });
});
