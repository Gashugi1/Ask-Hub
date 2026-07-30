import { requirePageRole } from '@/lib/admin/guard';
import { readUsers } from '@/lib/admin/readers';
import InviteForm from '@/components/admin/InviteForm';
import UserTable from '@/components/admin/UserTable';
import { t } from '@/lib/i18n';

/**
 * Admin-only (PRD §3's capability table: "Users: invite, change role,
 * deactivate — admin yes, editor no, viewer no"). `requirePageRole` calls
 * `notFound()` for an editor or viewer rather than redirecting with a
 * message: whether this route exists is not information a non-admin needs.
 *
 * Why the screen exists at all: PRD §3 says there is no public sign-up route
 * and users are created by an admin. `scripts/provision-admins.ts` bootstraps
 * the first two accounts; after that this is the only non-operator path to
 * the rest of the client team.
 *
 * Not the security boundary. Each of `inviteUser`, `changeUserRole` and
 * `setUserActive` re-checks `requireRole(['admin'])` as its first statement,
 * and `profiles_update_admin` (0003_profiles.sql) refuses the write at the
 * database regardless of what this page or those actions do.
 *
 * `profileId` is threaded to the table so the signed-in admin's own row can
 * render without controls — see UserTable for why that is the right shape
 * rather than disabled ones.
 */
export default async function AdminUsersPage() {
  const actor = await requirePageRole(['admin']);
  const users = await readUsers();

  return (
    <main data-route="/admin/users" className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-navy">{t('admin.users.heading')}</h1>
        <p className="text-sm text-muted">{t('admin.users.intro')}</p>
      </div>
      <InviteForm />
      <UserTable rows={users} currentProfileId={actor.profileId} />
    </main>
  );
}
