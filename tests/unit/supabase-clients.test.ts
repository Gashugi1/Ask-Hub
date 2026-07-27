import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const browser = readFileSync('src/lib/supabase/browser.ts', 'utf8');
const server = readFileSync('src/lib/supabase/server.ts', 'utf8');
const admin = readFileSync('src/lib/supabase/admin.ts', 'utf8');
const proxy = readFileSync('src/proxy.ts', 'utf8');

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

  it('fails loudly when the key is absent rather than falling back', () => {
    expect(admin).toMatch(/throw new Error/);
  });

  it('does not persist or auto-refresh a session', () => {
    expect(admin).toMatch(/persistSession:\s*false/);
    expect(admin).toMatch(/autoRefreshToken:\s*false/);
  });
});

describe('proxy', () => {
  it('exports a proxy function, the Next 16 convention', () => {
    // middleware.ts still builds but prints a deprecation warning.
    expect(proxy).toMatch(/export async function proxy\(/);
  });

  it('redirects unauthenticated admin traffic to the login route', () => {
    expect(proxy).toContain('/admin/login');
  });

  it('never touches the service_role key', () => {
    // The proxy runs on every request with no role check of its own.
    expect(proxy).not.toMatch(/SERVICE_ROLE/);
  });

  it('states that route gating is UX and not the security boundary', () => {
    expect(proxy.toLowerCase()).toContain('not security');
  });
});
