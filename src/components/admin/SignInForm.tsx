'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { signIn } from '@/lib/actions/session';
import { t } from '@/lib/i18n';

type State = { error: string } | null;

/**
 * Transcribed from the approved prototype, docs/prototype/prototype.html
 * lines 632-665: a 420px card centred on a #F4F6F9 field, under a wordmark
 * with its accent dot and a "team admin" note, with a link back to the public
 * site beneath.
 *
 * This screen does not use the public header. It is its own shell in the
 * prototype and stays so here -- a sign-in page carrying a site-wide search
 * box and a Contact button is a page that has not decided what it is for.
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
    <main
      style={{
        minHeight: '100vh',
        background: '#F4F6F9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
      }}
    >
      <div style={{ width: 420, maxWidth: '100%' }}>
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            justifyContent: 'center',
            marginBottom: 26,
          }}
        >
          <span
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: '#1F5FBF',
              letterSpacing: '-0.02em',
            }}
          >
            {t('site.wordmark')}
          </span>
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: 99,
              background: 'var(--acc, #F06428)',
            }}
          />
          <span style={{ fontSize: 12, color: '#5B6B8C' }}>{t('admin.login.teamAdmin')}</span>
        </Link>

        <div
          style={{
            background: '#fff',
            border: '1px solid #DDE5EE',
            borderRadius: 16,
            padding: 30,
            boxShadow: '0 10px 30px rgba(20,32,60,0.06)',
          }}
        >
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
            {t('admin.login.heading')}
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#5B6B8C' }}>
            {t('admin.login.intro')}
          </p>

          <form action={action}>
            <div
              style={{
                marginTop: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 11,
              }}
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
                style={{
                  margin: '10px 0 0 0',
                  fontSize: 13,
                  color: '#C0392B',
                  fontWeight: 600,
                }}
              >
                {state.error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="proto-primary-button"
              style={{
                marginTop: 16,
                width: '100%',
                background: '#1F5FBF',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: 13,
                fontSize: 14.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t('admin.login.submit')}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <Link
            href="/"
            className="proto-back-link"
            style={{ color: '#5B6B8C', fontSize: 13, fontWeight: 600 }}
          >
            {t('admin.login.backToSite')}
          </Link>
        </div>

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
      </div>
    </main>
  );
}

/** Prototype line 647: uppercase micro-label above each field. */
const FIELD_LABEL = {
  fontSize: 11.5,
  fontWeight: 800,
  color: '#5B6B8C',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  display: 'block',
  marginBottom: 6,
} as const;

const FIELD = {
  width: '100%',
  padding: '12px 14px',
  border: '1px solid #C9D3E8',
  borderRadius: 9,
  fontSize: 14,
  color: '#1A2332',
  outline: 'none',
} as const;
