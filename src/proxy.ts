import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseUrlFromEnv } from '@/lib/supabase/env';

const LOGIN_PATH = '/admin/login';

/**
 * The /admin paths that must render without a session.
 *
 * `/admin/login` is the obvious one. `/admin/set-password` is the one that
 * matters, and it was missing: Supabase's invitation email links to
 * `{{ .ConfirmationURL }}`, which verifies the token on Supabase's side and
 * then redirects the invitee here with their session in the URL **fragment**
 * (`#access_token=...`). A fragment is never sent to a server. Without this
 * exemption the middleware sees no cookie, resolves no user, and redirects to
 * the login page — discarding the fragment, and with it the only copy of the
 * session. An invited operator could never set a password, and the invitation
 * flow was unusable end to end.
 *
 * `src/app/(admin)/admin/set-password/page.tsx` already skips `requireRole`
 * for exactly this reason and carries an entry in `PAGE_ROLE_EXEMPT`; this is
 * the other half of that decision, which had not been made.
 *
 * Exempting the path costs nothing, because the page is not a protected
 * surface: it renders a heading and a form, reads no data, and its only action
 * is `updateUser`, which acts solely on the session the *browser* holds and
 * cannot be aimed at another account. A visitor arriving with no session can
 * do nothing here but be told so.
 */
const SESSION_OPTIONAL_PATHS: ReadonlySet<string> = new Set([
  LOGIN_PATH,
  '/admin/set-password',
  '/admin/forgot-password',
]);

/**
 * Every cookie @supabase/ssr writes is `sb-`-prefixed — `sb-<ref>-auth-token`,
 * its `.0`/`.1` chunks, and the PKCE code verifier. Matching the prefix rather
 * than an exact name is deliberate and fail-safe: the only cost of a false
 * positive is one auth call that would have happened anyway, while a false
 * negative would silently stop refreshing a real session.
 */
function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(({ name }) => name.startsWith('sb-'));
}

/**
 * Runs on every matched request. Two jobs:
 *
 *  1. Refresh the Supabase session cookie. Server components get a read-only
 *     cookie store, so this is the only place the rotated refresh token can
 *     actually be written back.
 *  2. Redirect unauthenticated /admin traffic to the login page.
 *
 * The redirect is UX and NOT security. PRD 3 and 14.4: middleware route gating
 * is UX, not security. The real boundary is RLS in the database plus a
 * `requireRole` re-check inside every mutating server action. Anything that
 * relies on this redirect having run is a vulnerability, because a server
 * action invoked directly never passes through here.
 *
 * An anonymous visitor browsing the public site costs no auth call. Without the
 * short-circuit below, `auth.getUser()` — a network round trip to Supabase Auth
 * — would sit in front of every public HTML response, making the availability
 * and latency of the entire product depend on the auth server. The public
 * surface IS the product (PRD 5: open browsing, cached pages, Core Web Vitals),
 * so it must stay servable when auth is degraded or misconfigured.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');

  // No session to refresh and no gate to apply: answer without touching auth.
  if (!isAdminRoute && !hasSupabaseAuthCookie(request)) {
    return NextResponse.next({ request });
  }

  // Named, not valued, and checked here rather than at module scope so a
  // misconfigured deployment still serves the public site. The SDK's own
  // `supabaseUrl is required.` does not say which variable is missing, and
  // it would be thrown once per request.
  const url = supabaseUrlFromEnv();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser, not getSession: it validates the token with the auth server
  // instead of trusting whatever the cookie claims.
  const { data } = await supabase.auth.getUser();

  if (isAdminRoute && !SESSION_OPTIONAL_PATHS.has(pathname) && !data.user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = LOGIN_PATH;
    // No `next` or `redirect` query parameter is carried. PRD 14.5 forbids
    // open redirects: no route accepts a user-supplied destination.
    redirectUrl.search = '';
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  // Everything except static assets and the liveness endpoint. Public pages
  // are matched so an expiring session refreshes while browsing rather than
  // only at /admin; /api/health is excluded because a liveness probe that
  // depends on the auth server reports the wrong thing when auth is down.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|fonts/|robots.txt|sitemap.xml|api/health).*)',
  ],
};
