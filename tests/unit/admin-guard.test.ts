import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * `requirePageRole` wraps `requireRole` from `@/lib/auth` and `notFound` from
 * `next/navigation`. Both are stubbed so this file exercises the real
 * `requirePageRole` logic in src/lib/admin/guard.ts against controlled
 * outcomes, exactly as tests/unit/auth.test.ts and tests/unit/proxy.test.ts
 * stub the seams those modules touch.
 */
const requireRole = vi.fn();
// The real notFound() throws with a special NEXT_NOT_FOUND digest and never
// returns. The stub does the same so a caller that forgets to treat this as
// terminal (falls through instead of returning/throwing) is caught here
// rather than only in a real Next render.
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('@/lib/auth', () => ({ requireRole }));
vi.mock('next/navigation', () => ({ notFound }));

const { requirePageRole } = await import('@/lib/admin/guard');

beforeEach(() => {
  requireRole.mockReset();
  notFound.mockClear();
});

describe('requirePageRole', () => {
  it('returns the current user when requireRole resolves', async () => {
    const user = { userId: 'user-1', role: 'admin' };
    requireRole.mockResolvedValue(user);

    await expect(requirePageRole(['admin'])).resolves.toBe(user);
    expect(requireRole).toHaveBeenCalledWith(['admin']);
    expect(notFound).not.toHaveBeenCalled();
  });

  it('calls notFound(), not a throw the caller must catch, when requireRole throws FORBIDDEN', async () => {
    requireRole.mockRejectedValue(new Error('FORBIDDEN'));

    // notFound() itself throws, so the promise still rejects — but via
    // notFound's mechanism, not a bare re-throw of the FORBIDDEN error. A
    // wrong-role page must render "not found", never a message admitting the
    // page exists but the visitor may not see it.
    await expect(requirePageRole(['admin'])).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it('calls notFound() when requireRole throws UNAUTHENTICATED', async () => {
    requireRole.mockRejectedValue(new Error('UNAUTHENTICATED'));

    await expect(requirePageRole(['admin'])).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
