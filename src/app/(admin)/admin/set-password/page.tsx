import SetPasswordForm from '@/components/admin/SetPasswordForm';
import { t } from '@/lib/i18n';

/**
 * Where an invitation link lands, and where a signed-in operator changes their
 * password.
 *
 * **This page deliberately does not call `requireRole`,** which is why it
 * carries an entry in `PAGE_ROLE_EXEMPT`. An invited operator arrives here
 * with their session in the URL fragment and *no cookie yet* — the fragment is
 * never sent to the server, so `requireRole` would resolve no user and bounce
 * them to the login screen before the browser had a chance to read it. Gating
 * this page server-side would make the invitation flow permanently impossible,
 * which is precisely the failure being fixed.
 *
 * It renders no data and exposes nothing: the entire page is a heading and a
 * form. The authorisation lives where it can actually be enforced —
 * `updateUser` acts only on the session the browser holds, so a visitor with
 * no session can do nothing here but be told so.
 */
export default function SetPasswordPage() {
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 p-8">
      <h1 className="text-xl font-semibold text-navy">{t('setPassword.heading')}</h1>
      <p className="text-sm text-muted">{t('setPassword.intro')}</p>
      <SetPasswordForm />
    </main>
  );
}
