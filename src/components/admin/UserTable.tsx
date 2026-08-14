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
import { ADMIN_FIELD, ADMIN_TH, ADMIN_TD, ADMIN_TABLE, ADMIN_TABLE_PANEL, ADMIN_THEAD_ROW, ADMIN_TR, ADMIN_HELP } from './chrome';

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
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <RoleBadge role={row.role} />
        <span style={ADMIN_HELP}>{t('admin.users.selfNote')}</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
        style={ADMIN_FIELD}
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
        style={{ ...ADMIN_FIELD, fontSize: 12, padding: "7px 10px" }}
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
    <div style={ADMIN_TABLE_PANEL}>
      <table style={ADMIN_TABLE}>
        <thead style={ADMIN_THEAD_ROW}>
          <tr>
            <th style={ADMIN_TH}>{t('admin.users.col.user')}</th>
            <th style={ADMIN_TH}>{t('admin.users.col.displayLabel')}</th>
            <th style={ADMIN_TH}>{t('admin.users.col.status')}</th>
            <th style={ADMIN_TH}>{t('admin.users.col.lastSignIn')}</th>
            <th style={ADMIN_TH}>{t('admin.users.col.role')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} style={ADMIN_TR}>
              <td style={ADMIN_TD}>
                <p style={{ fontSize: 14, fontWeight: 800 }}>
                  {row.fullName === '' ? row.email : row.fullName}
                </p>
                <p style={{ color: "#5B6B8C" }}>{row.email}</p>
              </td>
              <td style={{ ...ADMIN_TD, color: "#5B6B8C" }}>{row.displayLabel}</td>
              <td style={ADMIN_TD}>
                {row.isActive
                  ? t('admin.users.status.active')
                  : t('admin.users.status.deactivated')}
              </td>
              <td style={{ ...ADMIN_TD, color: "#5B6B8C", whiteSpace: "nowrap" }}>
                {lastSignIn(row.lastSignInAt)}
              </td>
              <td style={ADMIN_TD}>
                <RowControls row={row} isSelf={row.id === currentProfileId} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
