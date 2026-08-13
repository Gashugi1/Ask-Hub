import { describe, it, expect } from 'vitest';
import { readActionFunctions } from './action-modules';
import {
  ACTION_ROLE_EXEMPT,
  EXPECTED_ACTION_ROLE_EXEMPT,
} from './admin-guard-allowlist';

/**
 * CLAUDE.md: "Every mutating server action re-checks the caller's role.
 * Middleware gating is UX, not security." PRD 14.4 and
 * src/lib/actions/README.md say the same thing more precisely: the check is
 * `await requireRole([...])` and it is the *first* statement.
 *
 * **This is the only thing in the repository that checks that.** The Task 4
 * review found, and the Task 5 re-review confirmed, that no test fails if an
 * action drops its `requireRole` call: the RLS suites exercise Postgres
 * directly and never import an action module, and they cannot be made to —
 * `requireRole` resolves the session through `cookies()` from `next/headers`,
 * which a Vitest process has no way to provide. Runtime coverage of the action
 * layer's permission check is unavailable, so static assertion is what is left.
 *
 * That is not the same as saying the check is the only barrier. RLS refuses the
 * write regardless, and if the two ever disagree RLS wins. What a dropped call
 * costs is the FORBIDDEN-before-a-request behaviour PRD 14.4 requires, the
 * ability to distinguish "you may not" from "the database said no", and — for
 * `inviteUser`, which reaches the Auth Admin API on the service_role key before
 * it touches a table — an unauthenticated caller reaching a code path RLS is
 * not in front of at all.
 *
 * Why *first*, and not merely present. A check after the Zod parse still
 * refuses the write, but the function has already accepted, validated and
 * shaped input on behalf of a caller whose right to ask was never established;
 * `inviteUser` would have created an auth user before it. "First" is
 * mechanically decidable and needs no judgement in review, which is exactly
 * what makes it enforceable here.
 */

const ROLE_TOKEN = 'requireRole';

describe('every server action re-checks the caller’s role', () => {
  it('finds the action modules at all', () => {
    // A rename of src/lib/actions would otherwise reduce every assertion below
    // to "zero functions had zero problems" and keep them green forever.
    const functions = readActionFunctions();
    expect(
      functions.length,
      'no exported async function found under src/lib/actions — the guards below would be vacuous',
    ).toBeGreaterThan(10);
  });

  it('opens every exported async action with await requireRole([...])', () => {
    const offenders = readActionFunctions()
      .filter((fn) => !(fn.key in ACTION_ROLE_EXEMPT))
      .filter((fn) => !fn.requireRoleFirst)
      .map(
        (fn) =>
          `${fn.file}: ${fn.name} — ${
            fn.requireRoleAnywhere
              ? `calls ${ROLE_TOKEN} but not as its first statement`
              : `never calls ${ROLE_TOKEN}`
          }`,
      );

    expect(
      offenders,
      'a server action does not establish the caller’s role before doing anything else. A ' +
        'server action can be invoked directly — a reposted form, a stale tab, a crafted ' +
        'request — with no page and no proxy in the path, so this call is the application’s ' +
        'entire permission check for that entry point (PRD 14.4, src/lib/actions/README.md). ' +
        `Add \`await ${ROLE_TOKEN}([...])\` as the first statement, or, if the action is ` +
        'genuinely pre-authentication, add a documented entry to ACTION_ROLE_EXEMPT in ' +
        `tests/structure/admin-guard-allowlist.ts. Offenders:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('exempts nothing that does not exist', () => {
    // An exemption for a deleted or renamed function is not harmless: it is a
    // live licence waiting for the next function to be given that name.
    const known = new Set(readActionFunctions().map((fn) => fn.key));
    const stale = Object.keys(ACTION_ROLE_EXEMPT).filter((key) => !known.has(key));
    expect(
      stale,
      'ACTION_ROLE_EXEMPT names a function that no longer exists. Remove the entry and drop ' +
        `EXPECTED_ACTION_ROLE_EXEMPT to match — a stale exemption is a licence waiting to be ` +
        `inherited by the next function given that name. Stale: ${stale.join(', ')}`,
    ).toEqual([]);
  });
});

describe('the action exemption list is a policy document', () => {
  it('gives every entry a plan task and a real reason', () => {
    const offenders = Object.entries(ACTION_ROLE_EXEMPT).flatMap(([key, entry]) => {
      const problems: string[] = [];
      // Sub-project ids carry an optional letter -- SP2 split into SP2a and
      // SP2b -- so the pattern must allow one after the number as well as
      // after the task. This is the same expression the sibling registry's
      // meta-test in tests/rls/schema-guards.test.ts already uses
      // (/^SP\d+[a-z]?-T\d+[a-z]?$/), where entries like 'SP2a-T1' and
      // 'SP1-T12l' are long-standing. The two policy documents disagreeing on
      // the shape of the same field is the defect; this makes them agree.
      // Nothing is loosened beyond that: an id still has to name a
      // sub-project and a task.
      if (!/^SP\d+[a-z]?-T\d+[a-z]?$/.test(entry.approvedIn)) {
        problems.push(`approvedIn "${entry.approvedIn}" is not a plan task id`);
      }
      if (entry.why.length < 40) problems.push('why is shorter than 40 characters');
      if (key.includes(entry.why)) problems.push('why merely restates the key');
      return problems.map((problem) => `${key}: ${problem}`);
    });
    expect(
      offenders,
      `an ungated server action was exempted without a stated reason:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('has exactly the pinned number of entries', () => {
    expect(
      Object.keys(ACTION_ROLE_EXEMPT).length,
      'the number of server actions running without a role check changed. Bump ' +
        'EXPECTED_ACTION_ROLE_EXEMPT in the same diff as the new entry, so a third ' +
        'pre-authentication action has to argue for itself in review rather than arriving ' +
        'as a one-line addition to a list nobody re-reads.',
    ).toBe(EXPECTED_ACTION_ROLE_EXEMPT);
  });
});
