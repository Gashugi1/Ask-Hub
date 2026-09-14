import SetPasswordForm from '@/components/admin/SetPasswordForm';
import AuthCard from '@/components/admin/AuthCard';
import { t } from '@/lib/i18n';

/**
 * Where an invitation link and a password-recovery link both land, and where
 * a signed-in operator changes their password. Supabase delivers both links
 * the same way, so one screen serves both.
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
  // Wears the same shell as sign-in. The prototype has no set-password screen
  // at all, so this is the plan's one sanctioned extrapolation: rather than
  // invent a layout, the screen reuses AuthCard, which means "reads as the
  // same family" is guaranteed by construction rather than by eye.
  return (
    <AuthCard heading={t('setPassword.heading')} intro={t('setPassword.intro')}>
      <SetPasswordForm />
    </AuthCard>
  );
}
