import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ForgotPasswordForm from '@/components/admin/ForgotPasswordForm';

/**
 * Where "Forgot your password?" on the sign-in screen leads: an address
 * field and a button, which asks Supabase Auth to email a recovery link.
 * The link lands on /admin/set-password, the same screen an invitation
 * lands on, and the password is set there.
 *
 * Like the login screen this renders with no session and calls no
 * requireRole -- it exists for people who cannot sign in -- so it carries an
 * entry in PAGE_ROLE_EXEMPT and in the proxy's session-optional paths. It
 * reads no data and exposes none: `requestPasswordReset` says the same
 * thing whatever address it is given (PRD 14.4).
 *
 * An operator who is already signed in has no use for it and is sent to
 * the portal, as the login screen does; changing a password while signed
 * in is /admin/set-password directly.
 */
export default async function ForgotPasswordPage() {
  if (await getCurrentUser()) redirect('/admin');
  return <ForgotPasswordForm />;
}
