import { describe, it, expect } from 'vitest';
import {
  assertNotSelfDemotion,
  assertNotSelfDeactivation,
  SELF_DEMOTION,
  SELF_DEACTIVATION,
} from '@/lib/actions/user-mutation-guards';

/**
 * `inviteUser`/`changeUserRole`/`setUserActive` cannot be invoked from Vitest
 * — each opens with `requireRole`, which resolves the caller from
 * `next/headers`'s `cookies()`, and there is no request-scoped cookie jar
 * outside a real Next.js request (the same limitation
 * `tests/unit/resource-actions.test.ts` records). The two checks that are
 * pure logic are exported so they can be pinned directly; the database
 * boundary itself is covered by `tests/rls/admin-actions-users.test.ts`.
 *
 * Each case below names the mutation that turns it red, because a guard test
 * that cannot fail is worse than no guard test.
 */
const ADMIN = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';

describe('assertNotSelfDemotion', () => {
  it('refuses an admin demoting their own account', () => {
    // Red if the `targetProfileId === actorProfileId` comparison is dropped,
    // or if the guard is inverted to compare against the *target's* role.
    expect(() => assertNotSelfDemotion(ADMIN, ADMIN, 'editor')).toThrow(SELF_DEMOTION);
    expect(() => assertNotSelfDemotion(ADMIN, ADMIN, 'viewer')).toThrow(SELF_DEMOTION);
  });

  it('permits an admin changing someone else to any role', () => {
    // Red if the guard is widened to "no admin may ever be demoted", which
    // would make the second admin PRD §3 requires unremovable by anyone.
    for (const role of ['admin', 'editor', 'viewer'] as const) {
      expect(() => assertNotSelfDemotion(ADMIN, OTHER, role)).not.toThrow();
    }
  });

  it('permits the no-op of an admin re-asserting their own admin role', () => {
    // Red if the guard becomes a blanket "you may not touch your own row":
    // the harm is losing the last admin, and this change cannot cause it.
    expect(() => assertNotSelfDemotion(ADMIN, ADMIN, 'admin')).not.toThrow();
  });
});

describe('assertNotSelfDeactivation', () => {
  it('refuses an admin deactivating their own account', () => {
    // Red if the `!nextIsActive` term is dropped. Deactivation is fully
    // effective at the database layer — current_app_role() returns null for
    // an inactive profile — so a self-deactivation is a genuine lockout, not
    // a cosmetic flag.
    expect(() => assertNotSelfDeactivation(ADMIN, ADMIN, false)).toThrow(SELF_DEACTIVATION);
  });

  it('permits deactivating someone else, and permits reactivation', () => {
    // Red if the guard fires on the target-id match alone: reactivating an
    // account is the repair path for the stranded-invite case, and blocking
    // it would leave the wrong direction unfixable.
    expect(() => assertNotSelfDeactivation(ADMIN, OTHER, false)).not.toThrow();
    expect(() => assertNotSelfDeactivation(ADMIN, ADMIN, true)).not.toThrow();
  });
});
