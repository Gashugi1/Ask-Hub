import { describe, it, expect, afterEach, vi } from 'vitest';
import { normaliseSupabaseUrl, supabaseUrlFromEnv } from '@/lib/supabase/env';

/**
 * Probed against the installed @supabase/supabase-js before this was written,
 * because the obvious theory was wrong in a way that matters. Given a single
 * trailing slash, or leading/trailing whitespace, or a trailing newline, the
 * client already builds `https://host/rest/v1` correctly. Only two or more
 * trailing slashes survive to produce `https://host//rest/v1` -- the leading
 * empty path segment behind PostgREST's "Invalid path specified in request
 * URL".
 *
 * So these cases are not all equally load-bearing, and the file says so rather
 * than implying the library was broken for all of them.
 */
describe('normaliseSupabaseUrl', () => {
  it('removes every trailing slash, not just one', () => {
    // The only case supabase-js does not already survive.
    expect(normaliseSupabaseUrl('https://ref.supabase.co//')).toBe('https://ref.supabase.co');
    expect(normaliseSupabaseUrl('https://ref.supabase.co///')).toBe('https://ref.supabase.co');
  });

  it('removes a single trailing slash and surrounding whitespace', () => {
    // Defence in depth: the library tolerates these today, and this keeps the
    // value the same shape regardless of how it was pasted.
    for (const raw of [
      'https://ref.supabase.co/',
      ' https://ref.supabase.co',
      'https://ref.supabase.co ',
      'https://ref.supabase.co\n',
      '  https://ref.supabase.co/  ',
    ]) {
      expect(normaliseSupabaseUrl(raw), JSON.stringify(raw)).toBe('https://ref.supabase.co');
    }
  });

  it('leaves a well-formed url untouched', () => {
    expect(normaliseSupabaseUrl('https://ref.supabase.co')).toBe('https://ref.supabase.co');
    expect(normaliseSupabaseUrl('http://127.0.0.1:54321')).toBe('http://127.0.0.1:54321');
  });

  it('preserves a path rather than silently discarding it', () => {
    // new URL(x).origin would drop this. A Supabase URL carrying a path is a
    // misconfiguration worth surfacing, not one to quietly repair.
    expect(normaliseSupabaseUrl('https://ref.supabase.co/custom/')).toBe(
      'https://ref.supabase.co/custom',
    );
  });
});

describe('supabaseUrlFromEnv', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('throws naming the variable when unset or blank', () => {
    // Blank counts as unset: an empty base turns every query into a request
    // against the deployment's own origin, failing far from the cause.
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    expect(() => supabaseUrlFromEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL is not set/);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '   ');
    expect(() => supabaseUrlFromEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL is not set/);
  });

  it('never interpolates the value into the thrown message', () => {
    // House rule: a message may name a variable, never carry its contents.
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    expect(() => supabaseUrlFromEnv()).toThrow(/^NEXT_PUBLIC_SUPABASE_URL is not set$/);
  });

  it('returns the normalised value', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://ref.supabase.co//');
    expect(supabaseUrlFromEnv()).toBe('https://ref.supabase.co');
  });
});
