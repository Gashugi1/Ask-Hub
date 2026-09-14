'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { requestPasswordReset } from '@/lib/actions/session';
import { t } from '@/lib/i18n';
import AuthCard, { FIELD, FIELD_LABEL, CARD_BUTTON } from './AuthCard';

type State = { done: true } | null;

/**
 * The address field behind "Forgot your password?", in the sign-in shell.
 *
 * Once submitted it shows one sentence, the same for every address, and
 * does not go back to the field: `requestPasswordReset` reports nothing
 * about whether the address has an account (PRD 14.4), and a form that
 * re-enabled itself with a different message for a second try would be a
 * way to tell. The link back to sign-in is the only thing left to do.
 */
export default function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<State, FormData>(
    async (_previous, formData) => requestPasswordReset(formData),
    null,
  );

  return (
    <AuthCard
      heading={t('forgotPassword.heading')}
      intro={t('forgotPassword.intro')}
      footer={
        <p style={{ textAlign: 'center', marginTop: 14, fontSize: 12 }}>
          <Link href="/admin/login" style={{ fontWeight: 700, color: '#1F5FBF' }}>
            {t('forgotPassword.toLogin')}
          </Link>
        </p>
      }
    >
      {state?.done ? (
        <p
          role="status"
          aria-live="polite"
          style={{ margin: '18px 0 0 0', fontSize: 13.5, lineHeight: 1.55, color: '#1A2332' }}
        >
          {t('forgotPassword.sent')}
        </p>
      ) : (
        <form action={action}>
          <div style={{ marginTop: 18 }}>
            <label htmlFor="reset-email" style={FIELD_LABEL}>
              {t('admin.login.email')}
            </label>
            <input
              id="reset-email"
              name="email"
              type="email"
              required
              autoComplete="username"
              style={FIELD}
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="proto-primary-button"
            style={CARD_BUTTON}
          >
            {t('forgotPassword.submit')}
          </button>
        </form>
      )}
    </AuthCard>
  );
}
