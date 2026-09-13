// Data only. No assertions live here -- that is the point, and it is the same
// point tests/rls/security-allowlist.ts makes: a diff that touches this file is
// unambiguously a policy change, never an incidental side effect of adding a
// test or renaming a function.
//
// The meta-tests in tests/structure/action-role-checks.test.ts and
// tests/structure/admin-write-affordances.test.ts enforce, for every entry:
// `approvedIn` matches /^SP\d+-T\d+[a-z]?$/, `why` is at least 40 characters
// and is not a substring of the entry's own key, and each record's length
// equals its pinned EXPECTED_* count below. Adding an exception therefore costs
// three coordinated, visible acts in one diff -- a new entry, a real rationale
// citing a real plan task, and a bumped count -- not one line silencing a
// guard.

export interface Exception {
  approvedIn: string;
  why: string;
}

// Exported async functions in src/lib/actions/*.ts that legitimately do NOT
// open with `await requireRole([...])`.
//
// Keyed `<file>#<exportedName>`, so an exemption covers one function rather
// than a whole module: adding a third action to session.ts does not inherit
// signIn's exemption.
//
// Three entries. The first two are pre-authentication by definition -- an
// authentication check cannot be a precondition of authenticating. The third
// is the public suggestion form, whose caller is a visitor with no session by
// definition; its authorisation lives in the database function it calls,
// which is the only write `anon` can reach and enforces every cap and the
// rate limit itself. Every other action in this folder mutates data on behalf
// of a caller whose role has to be established first, and PRD 14.4 plus
// src/lib/actions/README.md require that check to be the first statement,
// before any parse, any client construction and any I/O.
export const ACTION_ROLE_EXEMPT: Record<string, Exception> = {
  'session.ts#signIn': {
    approvedIn: 'SP3-T9',
    why: 'Establishes the session that every other requireRole call reads; gating sign-in on already being signed in is circular and would make the admin portal unreachable.',
  },
  'session.ts#signOut': {
    approvedIn: 'SP3-T9',
    why: 'Destroys a session and is safe for any caller including one with none; refusing it for a role would strand a signed-in user who may no longer sign out.',
  },
  'suggestions.ts#submitResourceSuggestion': {
    approvedIn: 'SP2b-T1',
    why: 'The public Suggest a resource form, whose caller is an anonymous visitor by definition. It runs on the visitor own anon client and calls submit_resource_suggestion (migration 0024), the one write that role can reach on submissions; the function re-checks every cap and enforces the rate limit itself, and never the service-role client. Registered in ANON_EXECUTABLE.',
  },
};

// Pages under src/app/(admin)/admin that legitimately do NOT call requireRole
// or requirePageRole.
//
// Keyed by path from the repository root. One entry, for the same reason as
// signIn above: the login screen is what a visitor with no session reaches,
// and it is the only admin page that must render for one.
export const PAGE_ROLE_EXEMPT: Record<string, Exception> = {
  'src/app/(admin)/admin/login/page.tsx': {
    approvedIn: 'SP3-T9',
    why: 'The one admin route that must render with no session at all; it calls getCurrentUser only to redirect an already-authenticated visitor away, and renders a form that writes nothing.',
  },
  'src/app/(admin)/admin/set-password/page.tsx': {
    approvedIn: 'SP2a-T9',
    why: 'Where an invitation link lands. Supabase returns the session in a URL fragment, which is never sent to the server, so at render time there is no cookie and requireRole would bounce every invitee to the login screen before the browser could read it -- gating this page is what would make invitations impossible. It renders no data: a heading and a form. Authorisation sits where it can be enforced, in updateUser, which acts only on the session the browser holds.',
  },
};

export const EXPECTED_ACTION_ROLE_EXEMPT = 3;
export const EXPECTED_PAGE_ROLE_EXEMPT = 2;
