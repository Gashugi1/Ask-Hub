import { describe, it, expect } from 'vitest';
import { assertRowAffected } from '@/lib/actions/resource-mutation-guards';

/**
 * `updateResource`/`deleteResource`/`setResourceStatus`/`setResourceFeatured`
 * cannot be invoked directly from Vitest — they open with `requireRole`,
 * which resolves the caller from `next/headers`'s `cookies()`, and there is
 * no request-scoped cookie jar outside a real Next.js request
 * (tests/rls/admin-actions-resources.test.ts's own comment records the same
 * limitation for the RLS boundary suite). `assertRowAffected` is exported
 * so the one piece of logic the coordinator's review flagged — PostgREST
 * returning `{ error: null }` for an UPDATE/DELETE that matched zero rows,
 * which every one of those four actions would otherwise report as a
 * success — can be pinned directly.
 */
describe('assertRowAffected', () => {
  it('throws when PostgREST reports no matching row (missing id, or an RLS refusal)', () => {
    // Mutating this to `if (rows && rows.length === 0)` (dropping the `!rows`
    // branch) or to a no-op would let both cases below pass silently again --
    // exactly the bug this guards against.
    expect(() => assertRowAffected('updateResource', [])).toThrow();
    expect(() => assertRowAffected('updateResource', null)).toThrow();
  });

  it('does not throw when at least one row came back', () => {
    expect(() => assertRowAffected('updateResource', [{ id: '00000000-0000-0000-0000-000000000001' }])).not.toThrow();
  });

  it('names the action in the message but does not claim the row was missing rather than refused', () => {
    // RLS refusing the write and a nonexistent id produce the identical
    // { error: null, data: [] } shape from PostgREST -- this function cannot
    // tell them apart, so the message must not assert one over the other.
    try {
      assertRowAffected('deleteResource', []);
      expect.unreachable('expected assertRowAffected to throw');
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain('deleteResource');
      expect(message.toLowerCase()).not.toMatch(/\bdoes not exist\b/);
    }
  });
});
