import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * `createServerClient` is stubbed so nothing in this file touches the network.
 * The stub also records every call, which is how the "costs no auth call"
 * assertions are expressed: the short-circuit is only observable by the
 * absence of a client construction.
 */
const getUser = vi.fn();
const createServerClient = vi.fn(() => ({ auth: { getUser } }));

vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => createServerClient(...(args as [])),
}));

const { proxy, config } = await import('@/proxy');

/** Any `sb-`-prefixed cookie is a Supabase auth cookie as far as the proxy is concerned. */
const AUTH_COOKIE = 'sb-127-auth-token=stub-value';

function request(path: string, { cookie }: { cookie?: string } = {}) {
  return new NextRequest(new URL(path, 'https://askhub.example'), {
    headers: cookie ? { cookie } : {},
  });
}

/** The proxy only ever reads `data.user`, so a bare object is a sufficient user. */
function signedIn() {
  getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
}

function signedOut() {
  getUser.mockResolvedValue({ data: { user: null }, error: null });
}

beforeEach(() => {
  getUser.mockReset();
  createServerClient.mockClear();
  // vitest.config.ts loads .env.test, so both are already present; asserted
  // rather than assumed, because the proxy throws by name without them and the
  // failure would otherwise look like a proxy bug.
  expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeTruthy();
  expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeTruthy();
});

describe('the /admin gate', () => {
  it('redirects an unauthenticated /admin request to the login route', async () => {
    signedOut();
    const response = await proxy(request('/admin'));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')!).pathname).toBe('/admin/login');
  });

  it('redirects an unauthenticated request to a nested /admin route', async () => {
    signedOut();
    const response = await proxy(request('/admin/resources'));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')!).pathname).toBe('/admin/login');
  });

  it('does not redirect /admin/login itself', async () => {
    // Redirecting the login page to the login page is an infinite loop.
    signedOut();
    const response = await proxy(request('/admin/login'));

    expect(response.status).not.toBe(307);
    expect(response.headers.get('location')).toBeNull();
  });

  it('does not redirect /admin/set-password for a visitor with no session', async () => {
    // The regression this pins is the whole invitation flow.
    //
    // Supabase's invite email verifies its token and redirects the invitee to
    // /admin/set-password#access_token=..., putting the session in the URL
    // *fragment*. A fragment is never sent to a server, so this middleware
    // sees no cookie and resolves no user — exactly like a stranger. Redirect
    // them and the fragment goes with the redirect, taking the only copy of
    // the session with it: the invited operator can never set a password, and
    // no error is shown, because from the browser's point of view the login
    // page simply loaded.
    //
    // Signed out is therefore the case that matters here, not signed in.
    signedOut();
    const response = await proxy(request('/admin/set-password'));

    expect(response.status).not.toBe(307);
    expect(response.headers.get('location')).toBeNull();
  });

  it('still redirects a nested admin route that merely starts like set-password', async () => {
    // The exemption is an exact-path match, not a prefix. A future
    // /admin/set-password-policy screen must not inherit it by accident.
    signedOut();
    const response = await proxy(request('/admin/set-password-policy'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://askhub.example/admin/login');
  });

  it('does not redirect an authenticated /admin request', async () => {
    signedIn();
    const response = await proxy(request('/admin', { cookie: AUTH_COOKIE }));

    expect(getUser).toHaveBeenCalled();
    expect(response.status).not.toBe(307);
    expect(response.headers.get('location')).toBeNull();
  });

  it('reaches the auth check for /admin even with no cookie at all', async () => {
    // The public short-circuit must never swallow the admin gate: a request
    // with no cookie is exactly the one that has to be redirected.
    signedOut();
    const response = await proxy(request('/admin'));

    expect(createServerClient).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(307);
  });
});

describe('the login redirect carries no user-supplied destination', () => {
  it('strips the query string from an /admin redirect', async () => {
    // PRD 14.5. Without this, `?next=` survives the redirect and the login
    // page inherits an attacker-chosen destination -- an open redirect that
    // lends the UN programme's own domain to a phishing chain.
    signedOut();
    const response = await proxy(request('/admin?next=https://evil.example.com'));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location')!);
    expect(location.pathname).toBe('/admin/login');
    expect(location.search).toBe('');
    expect(response.headers.get('location')).not.toContain('evil.example.com');
  });

  it('strips a query string that is innocuous too', async () => {
    // The guard is unconditional, not a blocklist of suspicious-looking values.
    signedOut();
    const response = await proxy(request('/admin/resources?page=2&q=compute'));

    expect(new URL(response.headers.get('location')!).search).toBe('');
  });
});

describe('the public surface', () => {
  it('does not redirect an anonymous request to /', async () => {
    signedOut();
    const response = await proxy(request('/'));

    expect(response.status).not.toBe(307);
    expect(response.headers.get('location')).toBeNull();
  });

  it('costs no auth call when the visitor carries no Supabase cookie', async () => {
    // The whole public site would otherwise depend on the availability and
    // latency of the auth server (PRD 5: open browsing, cached pages, CWV).
    signedOut();
    await proxy(request('/resources/some-slug'));

    expect(createServerClient).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it('still refreshes the session of a signed-in visitor browsing publicly', async () => {
    // The short-circuit must not cost a signed-in curator their session
    // refresh while they read the public site.
    signedIn();
    await proxy(request('/', { cookie: AUTH_COOKIE }));

    expect(getUser).toHaveBeenCalled();
  });
});

describe('the matcher', () => {
  const pattern = new RegExp(`^${config.matcher[0]!}$`);

  it('excludes the liveness endpoint', () => {
    // A liveness probe that depends on the auth server reports the wrong
    // thing precisely when auth is the thing that is down.
    expect(pattern.test('/api/health')).toBe(false);
  });

  it('excludes static assets', () => {
    for (const path of ['/_next/static/chunk.js', '/favicon.ico', '/robots.txt']) {
      expect(pattern.test(path), path).toBe(false);
    }
  });

  it('still matches the admin portal and the public site', () => {
    for (const path of ['/admin', '/admin/login', '/', '/resources/some-slug']) {
      expect(pattern.test(path), path).toBe(true);
    }
  });
});
