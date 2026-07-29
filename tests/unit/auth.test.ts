import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * `getCurrentUser` builds its client via `createServerSupabase()`, which
 * calls `await cookies()` from `next/headers` (throws outside a request scope
 * under vitest) and `createServerClient` from `@supabase/ssr` (a real network
 * client). Both are stubbed so the *real* `getCurrentUser`/`requireRole` logic
 * in src/lib/auth.ts runs against a controlled response, exactly as
 * tests/unit/proxy.test.ts stubs the same seam for the proxy.
 */
const getUser = vi.fn();
const single = vi.fn();
const eq = vi.fn(() => ({ single }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
const createServerClient = vi.fn(() => ({ auth: { getUser }, from }));

vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => createServerClient(...(args as [])),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: () => {},
  })),
}));

const { getCurrentUser, requireRole } = await import('@/lib/auth');

const PROFILE_ROW: {
  id: string;
  email: string;
  full_name: string;
  display_label: string;
  role: 'admin' | 'editor' | 'viewer';
  is_active: boolean;
} = {
  id: 'profile-1',
  email: 'admin@askhub.test',
  full_name: 'Ada Admin',
  display_label: 'Ada A.',
  role: 'admin',
  is_active: true,
};

function signedIn(userId = 'user-1') {
  getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
}

function signedOut() {
  getUser.mockResolvedValue({ data: { user: null }, error: null });
}

/** `.single()` on zero rows: PostgREST returns a null row and a PGRST116 error. */
function noProfileRow() {
  single.mockResolvedValue({
    data: null,
    error: { code: 'PGRST116', message: 'no rows' },
  });
}

function profileRow(overrides: Partial<typeof PROFILE_ROW> = {}) {
  single.mockResolvedValue({ data: { ...PROFILE_ROW, ...overrides }, error: null });
}

beforeEach(() => {
  getUser.mockReset();
  single.mockReset();
  eq.mockClear();
  select.mockClear();
  from.mockClear();
  createServerClient.mockClear();
  // vitest.config.ts loads .env.test, so both are already present; asserted
  // rather than assumed, because createServerSupabase throws by name without
  // them and the failure would otherwise look like an auth.ts bug.
  expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeTruthy();
  expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeTruthy();
});

describe('getCurrentUser', () => {
  it('returns null when there is no authenticated session', async () => {
    signedOut();
    await expect(getCurrentUser()).resolves.toBeNull();
    // No point querying profiles for a user that does not exist.
    expect(from).not.toHaveBeenCalled();
  });

  it('returns null when the session has no matching profile row', async () => {
    signedIn();
    noProfileRow();
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('returns null when the profile is deactivated, indistinguishable from no account', async () => {
    // The case with real security consequence: a deactivated admin must not
    // retain access just because their auth.users row still exists.
    signedIn();
    profileRow({ is_active: false, role: 'admin' });
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('maps every CurrentUser field from the profile row, catching a mis-mapped column', async () => {
    signedIn('user-42');
    profileRow({
      id: 'profile-42',
      email: 'someone@askhub.test',
      full_name: 'Someone Real',
      display_label: 'S. Real',
      role: 'editor',
      is_active: true,
    });

    await expect(getCurrentUser()).resolves.toEqual({
      userId: 'user-42',
      profileId: 'profile-42',
      email: 'someone@askhub.test',
      fullName: 'Someone Real',
      displayLabel: 'S. Real',
      role: 'editor',
    });
  });

  it('queries profiles filtered by the authenticated user_id', async () => {
    signedIn('user-7');
    profileRow();
    await getCurrentUser();

    expect(from).toHaveBeenCalledWith('profiles');
    expect(eq).toHaveBeenCalledWith('user_id', 'user-7');
  });
});

describe('requireRole', () => {
  it('resolves and returns the user when an authenticated admin is in allowed', async () => {
    signedIn();
    profileRow({ role: 'admin' });

    await expect(requireRole(['admin', 'editor'])).resolves.toMatchObject({
      role: 'admin',
      userId: 'user-1',
    });
  });

  it('throws FORBIDDEN for an authenticated viewer not in allowed', async () => {
    signedIn();
    profileRow({ role: 'viewer' });

    await expect(requireRole(['admin', 'editor'])).rejects.toThrow('FORBIDDEN');
  });

  it('throws UNAUTHENTICATED when there is no authenticated user', async () => {
    signedOut();

    await expect(requireRole(['admin'])).rejects.toThrow('UNAUTHENTICATED');
  });

  it('throws UNAUTHENTICATED for a session whose profile row is missing', async () => {
    // No profile means getCurrentUser() is null, which requireRole treats the
    // same as no session at all -- there is nothing to attach a role to.
    signedIn();
    noProfileRow();

    await expect(requireRole(['admin', 'editor', 'viewer'])).rejects.toThrow(
      'UNAUTHENTICATED',
    );
  });

  it('throws UNAUTHENTICATED for a deactivated admin, never reaching a role check', async () => {
    signedIn();
    profileRow({ role: 'admin', is_active: false });

    // Must be UNAUTHENTICATED, not FORBIDDEN: a deactivated account is
    // supposed to look like no account, not like a wrong-role account.
    await expect(requireRole(['admin'])).rejects.toThrow('UNAUTHENTICATED');
  });
});
