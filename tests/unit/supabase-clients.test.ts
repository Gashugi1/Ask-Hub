import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
// Importable only because vitest.config.ts aliases `server-only` to its no-op
// shim. The marker itself is still in the module and still load-bearing in a
// real Next build; see the comment on that alias.
import { createAdminSupabase } from '@/lib/supabase/admin';

const browser = readFileSync('src/lib/supabase/browser.ts', 'utf8');
const server = readFileSync('src/lib/supabase/server.ts', 'utf8');
const admin = readFileSync('src/lib/supabase/admin.ts', 'utf8');
// The proxy is covered behaviourally in tests/unit/proxy.test.ts, which also
// keeps the two source assertions about it that cannot be expressed at runtime.

describe('browser client', () => {
  it('uses the anon key', () => {
    expect(browser).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  });

  it('never names the service_role key', () => {
    expect(browser).not.toMatch(/SERVICE_ROLE/);
  });
});

describe('server client', () => {
  it('is marked server-only so a client import is a build error', () => {
    expect(server).toMatch(/^import 'server-only';/m);
  });

  it('uses the anon key so RLS still applies to the caller', () => {
    expect(server).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    expect(server).not.toMatch(/SERVICE_ROLE/);
  });

  it('reads the session from cookies, never localStorage', () => {
    // PRD 14.3: httpOnly, Secure, SameSite cookies. Never localStorage.
    expect(server).toContain("from 'next/headers'");
    expect(server).not.toContain('localStorage');
  });
});

describe('admin client', () => {
  it('is marked server-only', () => {
    expect(admin).toMatch(/^import 'server-only';/m);
  });

  it('reads the service_role key from a non-public name', () => {
    expect(admin).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(admin).not.toMatch(/NEXT_PUBLIC_\w*SERVICE_ROLE/);
  });

  it('does not persist or auto-refresh a session', () => {
    expect(admin).toMatch(/persistSession:\s*false/);
    expect(admin).toMatch(/autoRefreshToken:\s*false/);
  });
});

describe('createAdminSupabase() behaviour', () => {
  const KEY = 'SUPABASE_SERVICE_ROLE_KEY';
  const URL_NAME = 'NEXT_PUBLIC_SUPABASE_URL';
  const saved = { [KEY]: process.env[KEY], [URL_NAME]: process.env[URL_NAME] };

  afterEach(() => {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it('returns a client when both variables are set', () => {
    const client = createAdminSupabase();
    expect(client).toBeDefined();
    expect(typeof client.from).toBe('function');
  });

  it('throws naming SUPABASE_SERVICE_ROLE_KEY when the key is unset', () => {
    delete process.env[KEY];
    expect(() => createAdminSupabase()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('throws naming NEXT_PUBLIC_SUPABASE_URL when the url is unset', () => {
    // Previously an opaque `supabaseUrl is required.` from the SDK, because the
    // URL was taken with `!` while only the key was checked.
    delete process.env[URL_NAME];
    expect(() => createAdminSupabase()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it('never puts the key value into the thrown message', () => {
    // An error message reaches logs and, in a dev overlay, a browser. The
    // real key is present in this process, so this is a genuine check that the
    // diagnostic names the variable instead of echoing it.
    const secret = saved[KEY];
    expect(secret, 'test env has no service_role key to check against').toBeTruthy();
    delete process.env[URL_NAME];
    let message = '';
    try {
      createAdminSupabase();
    } catch (error) {
      message = String(error);
    }
    expect(message).not.toBe('');
    expect(message).not.toContain(secret);
  });
});
