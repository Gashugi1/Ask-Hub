// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { t } from '@/lib/i18n';

/**
 * The reset-request screen's one behaviour that matters: after a submission
 * it shows a single sentence and offers no second attempt, so the screen
 * cannot be used to tell one address from another. The action is mocked;
 * tests/unit/session.test.ts proves the action itself says the same thing
 * for every address.
 */
const actions = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
}));

vi.mock('@/lib/actions/session', () => actions);

const ForgotPasswordForm = (await import('@/components/admin/ForgotPasswordForm')).default;

afterEach(() => {
  cleanup();
  actions.requestPasswordReset.mockReset();
});

describe('ForgotPasswordForm', () => {
  it('offers an address field, a submit, and a way back to sign in', () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByLabelText(t('admin.login.email'))).toBeTruthy();
    expect(screen.getByRole('button', { name: t('forgotPassword.submit') })).toBeTruthy();
    expect(screen.getByRole('link', { name: t('forgotPassword.toLogin') }).getAttribute('href')).toBe(
      '/admin/login',
    );
  });

  it('replaces the form with the one sentence after submitting, with no second try', async () => {
    actions.requestPasswordReset.mockResolvedValue({ done: true });
    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText(t('admin.login.email')), {
      target: { value: 'someone@askhub.test' },
    });
    fireEvent.submit(screen.getByRole('button', { name: t('forgotPassword.submit') }).closest('form')!);

    await waitFor(() => expect(screen.getByText(t('forgotPassword.sent'))).toBeTruthy());
    expect(actions.requestPasswordReset).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText(t('admin.login.email'))).toBeNull();
    expect(screen.queryByRole('button', { name: t('forgotPassword.submit') })).toBeNull();
  });
});
