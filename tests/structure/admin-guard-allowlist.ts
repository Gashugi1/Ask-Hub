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
// The list is two entries and should stay that way. Both are
// pre-authentication by definition -- an authentication check cannot be a
// precondition of authenticating. Every other action in this folder mutates
// data on behalf of a caller whose role has to be established first, and PRD
// 14.4 plus src/lib/actions/README.md require that check to be the first
// statement, before any parse, any client construction and any I/O.
export const ACTION_ROLE_EXEMPT: Record<string, Exception> = {
  'session.ts#signIn': {
    approvedIn: 'SP3-T9',
    why: 'Establishes the session that every other requireRole call reads; gating sign-in on already being signed in is circular and would make the admin portal unreachable.',
  },
  'session.ts#signOut': {
    approvedIn: 'SP3-T9',
    why: 'Destroys a session and is safe for any caller including one with none; refusing it for a role would strand a signed-in user who may no longer sign out.',
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
};

export const EXPECTED_ACTION_ROLE_EXEMPT = 2;
export const EXPECTED_PAGE_ROLE_EXEMPT = 1;
