import { describe, it, expect } from 'vitest';
import { inviteInput, roleChange } from '@/lib/schemas/user';

describe('inviteInput', () => {
  const valid = {
    email: 'new.editor@undp.org',
    fullName: 'A. Nakamura',
    displayLabel: 'Leadership',
    role: 'editor' as const,
  };

  it('accepts a complete invitation', () => {
    expect(inviteInput.safeParse(valid).success).toBe(true);
  });

  it('requires a full name', () => {
    // audit_log.actor_name falls back to display_label then email when
    // full_name is blank, and PRD 6.9 says the audit log shows the actor's
    // full name, not their email address. Requiring it here is what keeps
    // that promise; the fallback exists for accounts that predate the screen.
    expect(inviteInput.safeParse({ ...valid, fullName: '' }).success).toBe(false);
    expect(inviteInput.safeParse({ ...valid, fullName: '   ' }).success).toBe(false);
  });

  it('accepts a display label that says anything, including a role name', () => {
    // display_label is free text and independent of role (PRD 3). "Leadership"
    // on a viewer is legitimate and must not be rejected or reinterpreted.
    expect(inviteInput.safeParse({ ...valid, role: 'viewer', displayLabel: 'Leadership' }).success).toBe(true);
    expect(inviteInput.safeParse({ ...valid, displayLabel: '' }).success).toBe(true);
  });

  it('refuses a role outside the enum', () => {
    expect(inviteInput.safeParse({ ...valid, role: 'superadmin' }).success).toBe(false);
  });

  it('refuses a malformed email', () => {
    expect(inviteInput.safeParse({ ...valid, email: 'not-an-address' }).success).toBe(false);
  });

  it('normalises the address it hands to the Auth Admin API', () => {
    // GoTrue stores and matches an address case-insensitively, but `profiles`
    // does not: `handle_new_user()` copies `new.email` verbatim, and the RLS
    // suites and the Users table both look accounts up by that column. Parsing
    // the surrounding whitespace and case off once, here, is what stops the
    // same person arriving twice under two spellings.
    const parsed = inviteInput.parse({ ...valid, email: '  New.Editor@UNDP.org ' });
    expect(parsed.email).toBe('new.editor@undp.org');
  });
});

describe('roleChange', () => {
  it('requires a uuid profile id', () => {
    expect(roleChange.safeParse({ profileId: 'abc', role: 'admin' }).success).toBe(false);
    expect(
      roleChange.safeParse({ profileId: '00000000-0000-0000-0000-000000000001', role: 'admin' }).success,
    ).toBe(true);
  });
});
