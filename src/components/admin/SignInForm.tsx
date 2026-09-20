'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { signIn } from '@/lib/actions/session';
import { t } from '@/lib/i18n';
import AuthCard, { FIELD, FIELD_LABEL, CARD_BUTTON } from './AuthCard';

type State = { error: string } | null;

/**
 * Wears the prototype's signed-out shell (see AuthCard, transcribed from
 * the approved prototype). This screen does not use the public header: it is its own shell in the prototype and stays so here -- a
 * sign-in page carrying a site-wide search box and a Contact button is a page
 * that has not decided what it is for.
 *
 * The error is rendered exactly as `signIn` returns it and nothing is added.
 * That action deliberately gives one message for both an unknown email and a
 * wrong password, so the form cannot be used to discover which addresses have
 * accounts; a friendlier, more specific message here would undo that.
 */
export default function SignInForm() {
  const [state, action, pending] = useActionState<State, FormData>(
    async (_previous, formData) => (await signIn(formData)) ?? null,
    null,
  );

  return (
    <AuthCard
      heading={t('admin.login.heading')}
      intro={t('admin.login.intro')}
      footer={
        <p
          style={{
            textAlign: 'center',
            marginTop: 14,
            fontSize: 12,
            color: '#5B6B8C',
          }}
        >
          {t('admin.login.noSignup')}
        </p>
      }
    >
      <form action={action}>
        <div
          style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 11 }}
        >
          <div>
            <label htmlFor="admin-email" style={FIELD_LABEL}>
              {t('admin.login.email')}
            </label>
            <input
              id="admin-email"
              name="email"
              type="email"
              required
              autoComplete="username"
              style={FIELD}
            />
          </div>
          <div>
            <label htmlFor="admin-password" style={FIELD_LABEL}>
              {t('admin.login.password')}
            </label>
            <input
              id="admin-password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              style={FIELD}
            />
          </div>
        </div>

        {state?.error ? (
          <p
            role="alert"
            style={{ margin: '10px 0 0 0', fontSize: 13, color: '#C0392B', fontWeight: 600 }}
          >
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="proto-primary-button"
          style={CARD_BUTTON}
        >
          {t('admin.login.submit')}
        </button>
        <p style={{ textAlign: 'center', margin: '12px 0 0 0', fontSize: 12.5 }}>
          <Link href="/admin/forgot-password" style={{ fontWeight: 700, color: '#1F5FBF' }}>
            {t('admin.login.forgot')}
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
