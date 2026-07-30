import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import SignInForm from '@/components/admin/SignInForm';

/**
 * PRD 3 and 14.3: there is no sign-up route, and public signup is disabled at
 * the Supabase project level, so one cannot be added by application code.
 * Users are created by an admin — `scripts/provision-admins.ts` for the first
 * two, /admin/users for everyone after.
 */
export default async function AdminLoginPage() {
  if (await getCurrentUser()) redirect('/admin');
  return <SignInForm />;
}
