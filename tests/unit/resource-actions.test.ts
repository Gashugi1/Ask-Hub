import { describe, it, expect } from 'vitest';
import {
  assertRowAffected,
  assertKnownPartner,
  resourceWriteError,
  unknownPartnerMessage,
} from '@/lib/actions/resource-mutation-guards';

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

describe('assertKnownPartner', () => {
  const known = ['Amazon Web Services', 'Google', 'NVIDIA'];

  it('accepts a partner that is in the list', () => {
    expect(() => assertKnownPartner('Google', known)).not.toThrow();
  });

  it('rejects one that is not, naming the value and the remedy', () => {
    try {
      assertKnownPartner('Googel', known);
      expect.unreachable('expected assertKnownPartner to throw');
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain('Googel');
      expect(message).toContain('is not a known partner');
      expect(message).toContain('choose one from the list');
    }
  });

  it('compares exactly: case and surrounding space are not folded', () => {
    // `partners.name` is the primary key and the foreign key target, so
    // `google` and `Google` are different rows, not the same one spelled
    // differently. Trimming has already happened in `resourceInput`; doing it
    // again here would accept a value the insert then sends untrimmed.
    for (const wrong of ['google', 'GOOGLE', ' Google', 'Google ']) {
      expect(() => assertKnownPartner(wrong, known), wrong).toThrow();
    }
  });

  it('rejects everything when there are no partners at all', () => {
    expect(() => assertKnownPartner('Google', [])).toThrow();
  });
});

/**
 * `assertKnownPartner` above is checked against the list the action reads;
 * the two together are covered end to end, against the real tables, in
 * `tests/rls/resource-partner-fk.test.ts`. What is pinned here is the other
 * half of the same guarantee — the window that pre-flight check cannot close.
 * A partner that no resource references yet can be deleted between the check
 * and the insert, and the write then fails with the constraint violation
 * itself. Translating it is what makes "a curator never sees raw constraint
 * text for a bad partner" true rather than usually true.
 */
describe('resourceWriteError', () => {
  /** The shape PostgREST returns for a foreign-key violation. */
  const fkViolation = {
    code: '23503',
    message:
      'insert or update on table "resources" violates foreign key constraint "resources_partner_fkey"',
    details: 'Key (partner)=(Googel) is not present in table "partners".',
  };

  it('turns a partner constraint violation into the actionable message', () => {
    const error = resourceWriteError('createResource', fkViolation, 'Googel');
    expect(error.message).toBe(unknownPartnerMessage('Googel'));
    expect(error.message).toContain('Googel');
    expect(error.message).not.toMatch(/foreign key constraint|resources_partner_fkey/);
  });

  it('leaves every other failure exactly as it was reported', () => {
    // Rewording a failure this function does not recognise would be inventing
    // a diagnosis. A check constraint on a different column is still reported
    // verbatim, under the action's name.
    const other = {
      code: '23514',
      message: 'new row violates check constraint "resources_external_url_https"',
      details: null,
    };
    const error = resourceWriteError('updateResource', other, 'Google');
    expect(error.message).toBe(`updateResource failed: ${other.message}`);
  });

  it('does not claim an unknown partner for a different foreign key', () => {
    // A synthetic shape, and deliberately so: `resources.partner` is the only
    // foreign key `resources` has today, so no insert or update of a resource
    // can currently produce this error. It pins the contract for the day a
    // second one exists — the code alone would then no longer identify the
    // partner as the culprit, and this function must not say that it does.
    const otherFk = {
      code: '23503',
      message:
        'insert or update on table "submissions" violates foreign key constraint "submissions_target_resource_id_fkey"',
      details: 'Key (target_resource_id)=(...) is not present in table "resources".',
    };
    const error = resourceWriteError('createResource', otherFk, 'Google');
    expect(error.message).toBe(`createResource failed: ${otherFk.message}`);
  });
});
