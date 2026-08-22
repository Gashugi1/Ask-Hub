import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { serviceClient } from '../helpers/clients';
import { fixtureStamp } from '../helpers/fixtures';

/**
 * `partners_logo_https_or_local`, from
 * supabase/migrations/0021_partner_logo_asset_paths.sql.
 *
 * 0014 wrote this column's rule as `logo_url ~* '^https://'` and 0021 widens
 * it to also accept a site-root-relative path, so the client's asset pack can
 * be served from this application's own origin instead of from a Storage
 * bucket that was never committed and no longer exists.
 *
 * **Widening a constraint whose purpose is to keep third-party hosts out of
 * the page needs its boundary asserted, not described.** The migration's own
 * comment claims the alternation is anchored `^/[^/\\]` rather than `^/`
 * specifically so that `//evil.example/logo.png` -- a protocol-relative URL
 * the browser resolves to a *remote* host -- is still refused. A comment
 * cannot fail a build; this file is what stops a later hand from "simplifying"
 * that pattern to `^/` and reopening exactly the hole the original rule
 * existed to close.
 *
 * Written against the database rather than against a regex in TypeScript,
 * because the constraint is the thing that runs: an admin upload path, a
 * migration, a psql session and the seed all pass through it, and only some
 * of them pass through any code this repository could unit-test.
 *
 * service_role is used deliberately: it bypasses RLS, so a rejection here is
 * the CHECK refusing the value and cannot be a policy refusing the writer.
 */
describe('what partners.logo_url will and will not store', () => {
  let client: SupabaseClient;
  const partner = `Logo Probe Partner ${fixtureStamp()}`;

  beforeAll(async () => {
    client = serviceClient();
    // website_url is set up front: partners_logo_requires_site (content rule
    // 10.10) refuses a logo with no site to link to, and without it every
    // probe below would be rejected by the wrong constraint.
    const { error } = await client
      .from('partners')
      .insert({ name: partner, website_url: 'https://example.org/' });
    expect(error).toBeNull();
  });

  afterAll(async () => {
    await client.from('partners').delete().eq('name', partner);
  });

  /** Returns the constraint that refused the value, or null if it was stored. */
  async function store(logoUrl: string): Promise<string | null> {
    const { error } = await client
      .from('partners')
      .update({ logo_url: logoUrl })
      .eq('name', partner);
    if (error === null) return null;
    // Anchored on the phrase, not on "the first quoted word": Postgres names
    // the relation before the constraint, so a looser pattern reports
    // "partners" for every refusal and this whole file would assert nothing
    // about which rule fired.
    return /check constraint "([a-z_]+)"/.exec(error.message)?.[1] ?? error.message;
  }

  it('stores an asset this application serves from its own origin', async () => {
    expect(await store('/partners/aws.png')).toBeNull();
  });

  it('still stores an absolute https URL', async () => {
    // 0014's original case. The widening adds an alternative; it removes none.
    expect(await store('https://cdn.example.org/aws.png')).toBeNull();
  });

  it('refuses a protocol-relative URL, which is a remote host in disguise', async () => {
    // The single case this whole file exists for. `//evil.example/logo.png`
    // starts with `/` and is not a same-origin path at all -- the browser
    // fetches it from evil.example over the page's scheme. `^/` alone would
    // have admitted it.
    expect(await store('//evil.example/logo.png')).toBe('partners_logo_https_or_local');
  });

  it('refuses a backslash-smuggled path, which some parsers also treat as a host', async () => {
    expect(await store('/\\evil.example/logo.png')).toBe('partners_logo_https_or_local');
  });

  it('refuses cleartext http, exactly as before', async () => {
    expect(await store('http://cdn.example.org/aws.png')).toBe(
      'partners_logo_https_or_local',
    );
  });

  it('refuses a scheme that is neither', async () => {
    expect(await store('ftp://cdn.example.org/aws.png')).toBe(
      'partners_logo_https_or_local',
    );
  });

  it('refuses a bare relative path, which resolves differently on every route', async () => {
    // `partners/aws.png` on /resources/abc resolves to /resources/partners/...
    expect(await store('partners/aws.png')).toBe('partners_logo_https_or_local');
  });

  it('still refuses SVG, at a path as well as at a URL', async () => {
    // PRD 14.5: SVG is an active-content XSS vector. The widening must not
    // have given it a way in through the new alternative.
    expect(await store('/partners/logo.svg')).toBe('partners_logo_not_svg');
    expect(await store('/partners/logo.SVGZ')).toBe('partners_logo_not_svg');
    expect(await store('/partners/logo.svg?v=2')).toBe('partners_logo_not_svg');
  });
});
