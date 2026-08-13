import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { findRoleGatedDisabled, callsRoleGate } from './admin-affordances';
import { walk } from './ts-source';
import { PAGE_ROLE_EXEMPT, EXPECTED_PAGE_ROLE_EXEMPT } from './admin-guard-allowlist';

/**
 * CLAUDE.md: "`viewer` role has no write policy on any table, and sees no write
 * affordances in the UI."
 *
 * This catches the regression where someone "helpfully" re-adds a greyed-out
 * Add button so the layout does not shift for viewers. It is a tidy-looking
 * change, it passes review as a CSS nicety, and it is precisely the thing the
 * rule forbids: a disabled control advertises a capability the viewer will
 * never be granted, and the design spec's answer is that the affordance must be
 * absent, not inert. Every admin component in src/components/admin already says
 * so in a comment. Comments do not fail; this does.
 *
 * The second assertion is the page-level half: a screen that forgot its gate
 * renders admin data to whoever asks. `requireRole`/`requirePageRole` on the
 * page is UX rather than the security boundary — the actions re-check and RLS
 * refuses regardless — but a page missing it leaks *reads*, which no action
 * check and no write policy covers.
 *
 * Both assertions are `expect(offenders, message).toEqual([])`, following
 * tests/rls/schema-guards.test.ts: the offenders array is the value under test,
 * so a pass genuinely proves zero offenders and a failure names every one of
 * them in a message that stands on its own.
 */

const ADMIN_TREES = ['src/app/(admin)', 'src/components/admin'];

function adminTsx(): string[] {
  return ADMIN_TREES.flatMap((dir) => walk(dir, /\.tsx$/));
}

/** Every page.tsx under the admin route group, path-from-root. */
function adminPages(): string[] {
  return walk('src/app/(admin)/admin', /^page\.tsx$/);
}

describe('admin write affordances', () => {
  it('scans a non-empty set of admin .tsx files', () => {
    // Without this, a renamed directory would silently reduce both assertions
    // below to "zero files contained zero offenders" and keep them green
    // forever. The number is a floor, not a pin: adding a component is
    // routine and should not fail a security guard.
    expect(
      adminTsx().length,
      'the admin component trees resolved to (almost) no files — the guards below ' +
        `would be vacuous. Trees searched: ${ADMIN_TREES.join(', ')}`,
    ).toBeGreaterThan(20);
    expect(adminPages().length, 'no admin page.tsx found').toBeGreaterThan(5);
  });

  it('renders no write control that is disabled by role rather than absent', () => {
    const offenders = adminTsx()
      .flatMap((file) => findRoleGatedDisabled(file, readFileSync(file, 'utf8')))
      .map((o) => `${o.file}:${o.line}: disabled expression mentions "${o.token}" — ${o.text}`);

    expect(
      offenders,
      'a write control is being disabled by role instead of being omitted. CLAUDE.md: a ' +
        'viewer sees no write affordance at all, not a greyed-out one — a disabled button ' +
        'tells a viewer the product has a capability they are being denied. Render the ' +
        'control inside the same branch that already decides the role may write (see ' +
        'ResourceTable and ContentPanel), and leave `disabled` for transient states such ' +
        `as \`pending\`. Offenders:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('gates every admin page on requireRole or requirePageRole', () => {
    const offenders = adminPages()
      .filter((file) => !(file in PAGE_ROLE_EXEMPT))
      .filter((file) => !callsRoleGate(file, readFileSync(file, 'utf8')))
      .map((file) => `${file}: no requireRole( or requirePageRole( call`);

    expect(
      offenders,
      'an admin page renders without establishing the caller’s role. The page check is UX ' +
        'rather than the security boundary — actions re-check and RLS refuses regardless — ' +
        'but a page missing it serves admin *reads* to anyone, which no action check covers. ' +
        'Add `await requireRole([...])` (or `requirePageRole` for an admin-only screen) as ' +
        'the first statement, or add a documented entry to PAGE_ROLE_EXEMPT in ' +
        `tests/structure/admin-guard-allowlist.ts. Offenders:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});

describe('the page-gate exemption list is a policy document', () => {
  it('gives every entry a plan task and a real reason', () => {
    const offenders = Object.entries(PAGE_ROLE_EXEMPT).flatMap(([key, entry]) => {
      const problems: string[] = [];
      // Third copy of this expression in the repository, and the second that
      // could not express a lettered sub-project id. SP2 split into SP2a and
      // SP2b, so the letter belongs after the number as well as after the
      // task. tests/rls/schema-guards.test.ts has always used the wider form
      // (/^SP\d+[a-z]?-T\d+[a-z]?$/) and carries entries like 'SP2a-T1' and
      // 'SP1-T12l'; these three checks disagreeing about the shape of the same
      // field is the defect. An id must still name a sub-project and a task.
      if (!/^SP\d+[a-z]?-T\d+[a-z]?$/.test(entry.approvedIn)) {
        problems.push(`approvedIn "${entry.approvedIn}" is not a plan task id`);
      }
      if (entry.why.length < 40) problems.push('why is shorter than 40 characters');
      if (key.includes(entry.why)) problems.push('why merely restates the key');
      return problems.map((p) => `${key}: ${p}`);
    });
    expect(
      offenders,
      `an ungated admin page was exempted without a stated reason:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('has exactly the pinned number of entries', () => {
    expect(
      Object.keys(PAGE_ROLE_EXEMPT).length,
      'the count of ungated admin pages changed. Bump EXPECTED_PAGE_ROLE_EXEMPT in the same ' +
        'diff as the new entry, so the change argues for itself rather than arriving as a ' +
        'side effect.',
    ).toBe(EXPECTED_PAGE_ROLE_EXEMPT);
  });
});
