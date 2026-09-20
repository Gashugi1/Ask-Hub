'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { t } from '@/lib/i18n';
import { FIELD, FIELD_LABEL, CARD_BUTTON } from './AuthCard';

/**
 * Where an invited operator finishes setting up their account, where one who
 * forgot their password arrives from the recovery email, and where a
 * signed-in one changes their password.
 *
 * **Why this runs in the browser rather than as a server action.** Supabase's
 * default invitation email links to `{{ .ConfirmationURL }}`, which verifies
 * the token on Supabase's side and then redirects here with the session in the
 * URL *fragment* (`#access_token=...`). A fragment is never sent to a server,
 * so no route handler, page or server action can see it — the session simply
 * does not exist server-side until something in the browser reads that
 * fragment and stores it.
 *
 * The tidier alternative was a server route verifying a `{{ .TokenHash }}`,
 * which is what Supabase documents for SSR. It was built first and then
 * removed, because it requires replacing the invite email template and this
 * project is on the Hobby plan, where the Management API refuses exactly that:
 * "Email template modification is not available for free tier projects using
 * the default email provider." So the fragment is not a design preference
 * here, it is the only thing the platform sends. If custom SMTP is ever
 * configured — PRD 9.4 requires a transactional provider anyway, for the
 * contact form and digests — the server-side flow becomes available and this
 * component can go back to being a thin form.
 *
 * **The fragment is read here, by hand.** `createBrowserSupabase()` is
 * `@supabase/ssr`'s browser client, and that client is hard-wired to the
 * PKCE flow: shown an implicit `#access_token=...` fragment it throws "Not a
 * valid PKCE flow url" inside its own initialisation and stores nothing --
 * which, until this was followed in a real browser, made every invitation
 * and every recovery link land here and be told it was invalid. So the
 * effect below parses the fragment before constructing the client and hands
 * the pair to `setSession`, which writes them to cookies through the same
 * storage adapter, and then clears the fragment from the address bar so the
 * tokens do not sit in the history. That cookie is what makes the rest of
 * the admin portal see the operator on their next navigation. With no
 * fragment -- a signed-in operator changing their password -- `getSession`
 * reads the cookie that is already there.
 *
 * `updateUser` acts on the caller's own session and cannot be aimed at another
 * account, so there is no target check to make: the authorisation is the
 * session itself. Supabase enforces the password policy server-side; the check
 * below exists to produce a message that names what is missing.
 */
type Phase = 'checking' | 'ready' | 'nosession' | 'done';

const POLICY = [
  { test: (v: string) => v.length >= 12 },
  { test: (v: string) => /[a-z]/.test(v) },
  { test: (v: string) => /[A-Z]/.test(v) },
  { test: (v: string) => /[0-9]/.test(v) },
  { test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

export default function SetPasswordForm() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    // Read before the client is constructed: the client's own URL handling
    // leaves the fragment alone on the error path, but reading first costs
    // nothing and does not depend on that.
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = fragment.get('access_token');
    const refreshToken = fragment.get('refresh_token');

    // One client, constructed once: constructing it is what consumes the
    // fragment, so doing it per render would race with itself.
    const supabase = createBrowserSupabase();
    let cancelled = false;

    const session =
      accessToken && refreshToken
        ? supabase.auth
            .setSession({ access_token: accessToken, refresh_token: refreshToken })
            .then(({ data }) => {
              window.history.replaceState(
                null,
                '',
                window.location.pathname + window.location.search,
              );
              return data.session;
            })
        : supabase.auth.getSession().then(({ data }) => data.session);

    void session.then((value) => {
      if (cancelled) return;
      setPhase(value ? 'ready' : 'nosession');
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    const confirm = String(form.get('confirm') ?? '');

    if (!POLICY.every(({ test }) => test(password))) {
      setError(t('setPassword.invalid'));
      return;
    }
    if (password !== confirm) {
      setError(t('setPassword.mismatch'));
      return;
    }

    setPending(true);
    setError(null);
    const supabase = createBrowserSupabase();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (updateError) {
      // Supabase refuses a password identical to the current one, among other
      // cases. The message is its own and is safe to show: it describes the
      // password rule, not the account.
      setError(updateError.message);
      return;
    }
    setPhase('done');
  }

  if (phase === 'checking') {
    return (
      <p style={{ marginTop: 18, fontSize: 13, color: '#5B6B8C' }}>
        {t('setPassword.checking')}
      </p>
    );
  }

  // No session and no fragment: either a stale link, one already used, or
  // someone who navigated here directly while signed out.
  if (phase === 'nosession') {
    return (
      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p role="alert" style={{ margin: 0, fontSize: 13, color: '#C0392B', fontWeight: 600 }}>
          {t('setPassword.noSession')}
        </p>
        <Link href="/admin/login" style={{ fontSize: 13, fontWeight: 700, color: '#1F5FBF' }}>
          {t('setPassword.toLogin')}
        </Link>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p role="status" style={{ margin: 0, fontSize: 13.5, color: '#1A2332' }}>
          {t('setPassword.success')}
        </p>
        <Link href="/admin" style={{ fontSize: 13, fontWeight: 700, color: '#1F5FBF' }}>
          {t('setPassword.continue')}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div>
          <label htmlFor="new-password" style={FIELD_LABEL}>
            {t('setPassword.password')}
          </label>
          <input
            id="new-password"
            name="password"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            style={FIELD}
          />
        </div>

        <div>
          <label htmlFor="confirm-password" style={FIELD_LABEL}>
            {t('setPassword.confirm')}
          </label>
          <input
            id="confirm-password"
            name="confirm"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            style={FIELD}
          />
        </div>
      </div>

      <p style={{ margin: '10px 0 0 0', fontSize: 12, color: '#5B6B8C', lineHeight: 1.5 }}>
        {t('setPassword.policy')}
      </p>

      {error ? (
        <p
          role="alert"
          style={{ margin: '10px 0 0 0', fontSize: 13, color: '#C0392B', fontWeight: 600 }}
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="proto-primary-button"
        style={CARD_BUTTON}
      >
        {t('setPassword.submit')}
      </button>
    </form>
  );
}
