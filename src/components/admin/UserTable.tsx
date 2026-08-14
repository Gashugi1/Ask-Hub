'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { changeUserRole, setUserActive } from '@/lib/actions/users';
import { ROLES } from '@/lib/schemas/user';
import type { AdminUser } from '@/lib/admin/readers';
import type { Role } from '@/lib/auth';
import { t } from '@/lib/i18n';
import EmptyState from './EmptyState';
import RoleBadge from './RoleBadge';

/**
 * `last_sign_in_at` exactly as stored, and an explicit "not recorded" when it
 * is null. Nothing in SP3 writes that column, so it is null for every account
 * today — saying so is the honest rendering. Deriving "active now", "last
 * seen recently" or any status from it would be a fabricated figure on a
 * leadership surface, which CLAUDE.md makes a launch-blocking defect.
 */
function lastSignIn(iso: string | null): string {
  if (!iso) return t('admin.users.lastSignInUnrecorded');
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * The controls for one account. The signed-in admin's own row gets a badge
 * and no controls at all, rather than controls that would be refused: PRD §3
 * requires at least two admin accounts so a single lockout does not lock the
 * team out, and self-demotion or self-deactivation is the ordinary way that
 * requirement gets undone by accident. `assertNotSelfDemotion` /
 * `assertNotSelfDeactivation` in `src/lib/actions/user-mutation-guards.ts`
 * refuse it server-side regardless of what this renders; omitting the control
 * is what stops it being offered in the first place, and a disabled control
 * is the failure mode CLAUDE.md rules out.
 */
function RowControls({ row, isSelf }: { row: AdminUser; isSelf: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (isSelf) {
    return (
      <div className="flex flex-col gap-1">
        <RoleBadge role={row.role} />
        <span className="text-xs text-muted">{t('admin.users.selfNote')}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <select
        aria-label={t('admin.users.col.role')}
        defaultValue={row.role}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value as Role;
          startTransition(async () => {
            await changeUserRole({ profileId: row.id, role: next });
            router.refresh();
          });
        }}
        className="rounded border border-hairline px-2 py-1 text-sm text-navy"
      >
        {ROLES.map((value) => (
          <option key={value} value={value}>
            {t(`admin.users.role.${value}`)}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            await setUserActive(row.id, !row.isActive);
            router.refresh();
          });
        }}
        className="rounded border border-hairline px-2 py-1 text-xs text-navy"
      >
        {row.isActive ? t('admin.users.action.deactivate') : t('admin.users.action.reactivate')}
      </button>
    </div>
  );
}

/**
 * Every account, active and deactivated. There is no delete control (design
 * spec §7 decision 4): deactivation is complete at the database layer —
 * `current_app_role()` returns null for an inactive profile, so every policy
 * in the schema stops passing — and it keeps the audit trail readable, which
 * a cascading hard delete would not.
 *
 * No `canWrite` prop and no read-only branch: `/admin/users` calls
 * `requirePageRole(['admin'])`, so an editor or viewer gets `notFound()` and
 * never reaches this component. Adding role-conditional rendering here would
 * imply a non-admin can see this screen, which is exactly the wrong thing to
 * imply about the screen that decides who can do anything.
 */
export default function UserTable({
  rows,
  currentProfileId,
}: {
  rows: AdminUser[];
  currentProfileId: string;
}) {
  if (rows.length === 0) {
    return <EmptyState heading={t('admin.empty.noRows')} />;
  }

  return (
    <div className="overflow-x-auto rounded border border-hairline">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-tint-1 text-muted">
          <tr>
            <th className="px-4 py-2 font-medium">{t('admin.users.col.user')}</th>
            <th className="px-4 py-2 font-medium">{t('admin.users.col.displayLabel')}</th>
            <th className="px-4 py-2 font-medium">{t('admin.users.col.status')}</th>
            <th className="px-4 py-2 font-medium">{t('admin.users.col.lastSignIn')}</th>
            <th className="px-4 py-2 font-medium">{t('admin.users.col.role')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-hairline align-top">
              <td className="px-4 py-3">
                <p className="font-medium text-navy">
                  {row.fullName === '' ? row.email : row.fullName}
                </p>
                <p className="text-muted-light">{row.email}</p>
              </td>
              <td className="px-4 py-3 text-muted">{row.displayLabel}</td>
              <td className="px-4 py-3 text-navy">
                {row.isActive
                  ? t('admin.users.status.active')
                  : t('admin.users.status.deactivated')}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-muted">
                {lastSignIn(row.lastSignInAt)}
              </td>
              <td className="px-4 py-3">
                <RowControls row={row} isSelf={row.id === currentProfileId} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
