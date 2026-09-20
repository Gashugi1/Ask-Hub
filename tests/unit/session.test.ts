import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * `signIn` builds its client via `createServerSupabase()`, which calls
 * `await cookies()` from `next/headers` (throws outside a request scope
 * under vitest) and `createServerClient` from `@supabase/ssr` (a real network
 * client). Both are stubbed so the real `signIn` logic in
 * src/lib/actions/session.ts runs against a controlled response, exactly as
 * tests/unit/auth.test.ts stubs the same seam for `getCurrentUser`.
 *
 * `redirect` is also stubbed: the real one throws a special NEXT_REDIRECT
 * value to unwind the render, and `signIn` only reaches it on success — which
 * neither test here exercises, but the stub is here so a future change that
 * *did* start calling it on a failure path would be caught by
 * "never redirects on a failure path" below rather than by a confusing
 * "cannot read properties of undefined" from an unmocked import.
 */
const signInWithPassword = vi.fn();
const resetPasswordForEmail = vi.fn();
const createServerClient = vi.fn(() => ({ auth: { signInWithPassword } }));
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => createServerClient(...(args as [])),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: () => {},
  })),
  headers: vi.fn(async () => ({
    get: (name: string) =>
      name === 'host' ? 'askhub.example' : name === 'x-forwarded-proto' ? 'https' : null,
  })),
}));

vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirect(path),
}));

// The reset request goes through the sessionless public client, not the SSR
// one (session.ts says why); stubbed at the factory so the real action runs.
vi.mock('@/lib/public/client', () => ({
  createPublicSupabase: () => ({ auth: { resetPasswordForEmail } }),
}));

const { signIn, requestPasswordReset } = await import('@/lib/actions/session');

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  signInWithPassword.mockReset();
  resetPasswordForEmail.mockReset();
  createServerClient.mockClear();
  redirect.mockClear();
  // vitest.config.ts loads .env.test, so both are already present; asserted
  // rather than assumed, because createServerSupabase throws by name without
  // them and the failure would otherwise look like a signIn bug.
  expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeTruthy();
  expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeTruthy();
});

describe('signIn', () => {
  it('reports the identical message for a malformed submission and for credentials Supabase itself rejects', async () => {
    // Malformed input never reaches Supabase at all -- Zod rejects first, so
    // this path needs no mock response and calls Supabase zero times.
    const malformed = await signIn(formData({ email: 'not-an-email', password: 'x' }));
    expect(signInWithPassword).not.toHaveBeenCalled();

    // A well-formed pair that Supabase itself refuses -- the other branch
    // that returns `{ error }`.
    signInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    });
    const rejected = await signIn(
      formData({ email: 'someone@askhub.test', password: 'wrong-password' }),
    );

    expect(malformed).toBeDefined();
    expect(rejected).toBeDefined();

    // The invariant this file exists to pin (PRD 14.5): one message for
    // every failure mode, so the form cannot be used to discover which
    // addresses hold accounts. Asserted by equality between the two actual
    // return values, not against a literal English string -- a copy edit
    // that changes the wording still passes here; only a *divergence*
    // between the two branches should fail it.
    expect(malformed?.error).toBe(rejected?.error);
  });

  it('never redirects on either failure path', async () => {
    await signIn(formData({ email: 'not-an-email', password: 'x' }));
    signInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    });
    await signIn(formData({ email: 'someone@askhub.test', password: 'wrong-password' }));

    expect(redirect).not.toHaveBeenCalled();
  });

  it('redirects to /admin on a genuine match, taking the one path signIn does not return from', async () => {
    signInWithPassword.mockResolvedValue({ error: null });

    await expect(
      signIn(formData({ email: 'someone@askhub.test', password: 'correct-password' })),
    ).rejects.toThrow('NEXT_REDIRECT:/admin');
  });
});

describe('requestPasswordReset', () => {
  it('reports the identical outcome for a malformed address, an unknown one, a sent email and a Supabase error', async () => {
    // PRD 14.4: the reset flow must not disclose whether an account exists.
    // Supabase's own errors are not uniform -- its email rate limit trips
    // only when an email was actually sent -- so the action has to flatten
    // every outcome itself. Four cases, one shape.
    const malformed = await requestPasswordReset(formData({ email: 'not-an-email' }));
    resetPasswordForEmail.mockResolvedValueOnce({ error: null });
    const sent = await requestPasswordReset(formData({ email: 'someone@askhub.test' }));
    resetPasswordForEmail.mockResolvedValueOnce({ error: null });
    const unknown = await requestPasswordReset(formData({ email: 'nobody@askhub.test' }));
    resetPasswordForEmail.mockResolvedValueOnce({
      error: { message: 'For security purposes, you can only request this once every 60 seconds' },
    });
    const errored = vi.spyOn(console, 'error').mockImplementation(() => {});
    const limited = await requestPasswordReset(formData({ email: 'someone@askhub.test' }));
    errored.mockRestore();

    expect(malformed).toEqual({ done: true });
    expect(sent).toEqual(malformed);
    expect(unknown).toEqual(malformed);
    expect(limited).toEqual(malformed);
  });

  it('never calls Supabase for a malformed address', async () => {
    await requestPasswordReset(formData({ email: 'not-an-email' }));
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('points the recovery link at this host\'s set-password screen', async () => {
    // The same derivation inviteUser uses: a reset requested on a preview
    // deployment must land back on that preview, not on whichever host an
    // environment variable happens to name.
    resetPasswordForEmail.mockResolvedValue({ error: null });
    await requestPasswordReset(formData({ email: 'Someone@askhub.test' }));
    expect(resetPasswordForEmail).toHaveBeenCalledWith('Someone@askhub.test', {
      redirectTo: 'https://askhub.example/admin/set-password',
    });
  });

  it('never redirects: the screen shows its one sentence and stays', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    await requestPasswordReset(formData({ email: 'someone@askhub.test' }));
    expect(redirect).not.toHaveBeenCalled();
  });
});
