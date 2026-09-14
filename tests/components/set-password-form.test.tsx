// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { t } from '@/lib/i18n';

/**
 * The landing form's one job before it is a form: turn the tokens in the URL
 * fragment into a stored session. `@supabase/ssr`'s browser client will not
 * do that itself -- it is PKCE-only and rejects an implicit fragment -- so
 * the form does, and this pins that it does, for both an invitation and a
 * recovery link, and that the tokens are scrubbed from the address bar once
 * stored.
 */
const auth = vi.hoisted(() => ({
  setSession: vi.fn(),
  getSession: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('@/lib/supabase/browser', () => ({
  createBrowserSupabase: () => ({ auth }),
}));

const SetPasswordForm = (await import('@/components/admin/SetPasswordForm')).default;

beforeEach(() => {
  auth.setSession.mockReset();
  auth.getSession.mockReset();
  window.history.replaceState(null, '', '/admin/set-password');
});

afterEach(cleanup);

describe('SetPasswordForm', () => {
  it('adopts the session from a recovery or invitation fragment, then clears it', async () => {
    window.location.hash = '#access_token=at.jwt&refresh_token=rt&type=recovery';
    auth.setSession.mockResolvedValue({ data: { session: { user: {} } }, error: null });

    render(<SetPasswordForm />);

    await waitFor(() => expect(screen.getByLabelText(t('setPassword.password'))).toBeTruthy());
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: 'at.jwt', refresh_token: 'rt' });
    expect(auth.getSession).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
  });

  it('falls back to the stored session when there is no fragment', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: {} } } });

    render(<SetPasswordForm />);

    await waitFor(() => expect(screen.getByLabelText(t('setPassword.password'))).toBeTruthy());
    expect(auth.setSession).not.toHaveBeenCalled();
  });

  it('says the link is no longer valid when the fragment tokens are refused', async () => {
    window.location.hash = '#access_token=stale&refresh_token=stale&type=recovery';
    auth.setSession.mockResolvedValue({ data: { session: null }, error: { message: 'expired' } });

    render(<SetPasswordForm />);

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(t('setPassword.noSession')));
    expect(screen.queryByLabelText(t('setPassword.password'))).toBeNull();
  });
});
