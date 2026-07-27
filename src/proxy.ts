import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const LOGIN_PATH = '/admin/login';

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
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    },
  );

  // getUser, not getSession: it validates the token with the auth server
  // instead of trusting whatever the cookie claims.
  const { data } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');

  if (isAdminRoute && pathname !== LOGIN_PATH && !data.user) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    // No `next` or `redirect` query parameter is carried. PRD 14.5 forbids
    // open redirects: no route accepts a user-supplied destination.
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Everything except static assets. Public pages are matched too, so an
  // expiring session refreshes while browsing rather than only at /admin.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|fonts/|robots.txt|sitemap.xml).*)',
  ],
};
