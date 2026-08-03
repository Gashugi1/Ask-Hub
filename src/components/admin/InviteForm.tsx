'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { inviteUser } from '@/lib/actions/users';
import { inviteInput, ROLES } from '@/lib/schemas/user';
import type { Role } from '@/lib/auth';
import { t } from '@/lib/i18n';

/**
 * PRD §3: there is no public sign-up route and signup is disabled at the
 * Supabase project level, so after `scripts/provision-admins.ts` bootstraps
 * the first admins this form is the only way anyone else gets an account.
 *
 * `/admin/users` is gated `requirePageRole(['admin'])` — a non-admin gets
 * `notFound()`, not a read-only view — so there is no `canWrite` prop here
 * and no disabled rendering path, exactly as `SettingsForm` has none.
 *
 * Validated client-side against the same schema the server enforces, so a
 * missing full name is caught without a round trip. `inviteUser`'s own
 * `inviteInput.parse` remains the actual boundary regardless of what this
 * does.
 */
export default function InviteForm() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [displayLabel, setDisplayLabel] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = inviteInput.safeParse({ email, fullName, displayLabel, role });
    if (!parsed.success) {
      setError(t('admin.users.invite.invalid'));
      return;
    }
    startTransition(async () => {
      try {
        await inviteUser(parsed.data);
        setEmail('');
        setFullName('');
        setDisplayLabel('');
        setRole('viewer');
        router.refresh();
      } catch {
        // Deliberately one message for both halves of the seam. The server
        // error names the stranded address for the log; the screen cannot
        // usefully distinguish "the invitation was not sent" from "it was
        // sent but the role was not applied" without repeating server prose
        // as UI copy, and the refreshed table below shows which happened.
        setError(t('admin.users.invite.failed'));
      }
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded border border-hairline p-4">
      <h2 className="text-base font-semibold text-navy">{t('admin.users.invite.heading')}</h2>
      <p className="text-sm text-muted">{t('admin.login.noSignup')}</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-navy" htmlFor="invite-email">
            {t('admin.users.invite.email')}
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded border border-hairline px-2 py-1 text-sm text-navy"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-navy" htmlFor="invite-full-name">
            {t('admin.users.invite.fullName')}
            <input
              id="invite-full-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="rounded border border-hairline px-2 py-1 text-sm text-navy"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-navy" htmlFor="invite-display-label">
            {t('admin.users.invite.displayLabel')}
            <input
              id="invite-display-label"
              type="text"
              value={displayLabel}
              onChange={(e) => setDisplayLabel(e.target.value)}
              className="rounded border border-hairline px-2 py-1 text-sm text-navy"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-navy" htmlFor="invite-role">
            {t('admin.users.invite.role')}
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="rounded border border-hairline px-2 py-1 text-sm text-navy"
            >
              {ROLES.map((value) => (
                <option key={value} value={value}>
                  {t(`admin.users.role.${value}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-xs text-muted">{t('admin.users.invite.displayLabelNote')}</p>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="self-start rounded bg-primary px-3 py-1 text-xs text-surface"
          >
            {t('admin.users.invite.submit')}
          </button>
          {error ? <span className="text-xs text-danger">{error}</span> : null}
        </div>
      </form>
    </section>
  );
}
