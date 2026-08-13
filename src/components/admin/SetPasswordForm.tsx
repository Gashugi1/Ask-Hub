'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { t } from '@/lib/i18n';

/**
 * Where an invited operator finishes setting up their account, and where a
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
 * `createBrowserSupabase()` picks the fragment up on construction
 * (`detectSessionInUrl`, on by default) and writes the session to cookies via
 * `@supabase/ssr`, which is what makes the rest of the admin portal see the
 * operator on their next navigation.
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
    // One client, constructed once: constructing it is what consumes the
    // fragment, so doing it per render would race with itself.
    const supabase = createBrowserSupabase();
    let cancelled = false;

    // getSession resolves after the client has processed the URL, which is why
    // this is awaited rather than read synchronously.
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setPhase(data.session ? 'ready' : 'nosession');
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
    return <p className="text-sm text-muted">{t('setPassword.checking')}</p>;
  }

  // No session and no fragment: either a stale link, one already used, or
  // someone who navigated here directly while signed out.
  if (phase === 'nosession') {
    return (
      <div className="flex flex-col gap-3">
        <p role="alert" className="text-sm text-danger">
          {t('setPassword.noSession')}
        </p>
        <Link className="text-sm text-primary underline" href="/admin/login">
          {t('setPassword.toLogin')}
        </Link>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="text-sm text-navy">
          {t('setPassword.success')}
        </p>
        <Link className="text-sm text-primary underline" href="/admin">
          {t('setPassword.continue')}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        {t('setPassword.password')}
        <input
          name="password"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
          className="rounded border border-hairline px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {t('setPassword.confirm')}
        <input
          name="confirm"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
          className="rounded border border-hairline px-3 py-2"
        />
      </label>

      <p className="text-xs text-muted">{t('setPassword.policy')}</p>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-primary px-4 py-2 text-sm text-white disabled:opacity-60"
      >
        {t('setPassword.submit')}
      </button>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}
