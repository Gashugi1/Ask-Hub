'use client';

import { useActionState } from 'react';
import { signIn } from '@/lib/actions/session';
import { t } from '@/lib/i18n';

type State = { error: string } | null;

export default function SignInForm() {
  const [state, action, pending] = useActionState<State, FormData>(
    async (_previous, formData) => (await signIn(formData)) ?? null,
    null,
  );

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 p-8">
      <h1 className="text-xl font-semibold text-navy">{t('admin.login.heading')}</h1>
      <p className="text-sm text-muted">{t('admin.login.intro')}</p>
      <form action={action} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {t('admin.login.email')}
          <input name="email" type="email" required autoComplete="username" className="rounded border border-hairline px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('admin.login.password')}
          <input name="password" type="password" required autoComplete="current-password" className="rounded border border-hairline px-3 py-2" />
        </label>
        <button type="submit" disabled={pending} className="rounded bg-primary px-4 py-2 text-white">
          {t('admin.login.submit')}
        </button>
      </form>
      {state?.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
      <p className="text-xs text-muted">{t('admin.login.noSignup')}</p>
    </main>
  );
}
