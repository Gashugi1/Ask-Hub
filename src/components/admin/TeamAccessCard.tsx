'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { changeUserRole, setUserActive } from '@/lib/actions/users';
import { ROLES } from '@/lib/schemas/user';
import type { AdminUser } from '@/lib/admin/readers';
import type { Role } from '@/lib/auth';
import { t } from '@/lib/i18n';
import InviteForm from './InviteForm';
import RoleBadge from './RoleBadge';
import { ADMIN_PANEL, ADMIN_CARD_TITLE, ADMIN_CARD_SUB, ADMIN_HELP } from './chrome';

/**
 * A fixed locale and zone, so the server render and the browser's hydration
 * format the same instant the same way. `toLocaleDateString(undefined)`
 * would use the server's locale on one side and the visitor's on the other
 * and React would report the mismatch on every row.
 */
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * `last_sign_in_at` exactly as stored, and an explicit "not recorded" when
 * it is null. Nothing writes that column yet, so it is null for every
 * account today -- saying so is the honest rendering; deriving "active
 * recently" from it would be a fabricated figure (CLAUDE.md).
 */
function lastSignIn(iso: string | null): string {
  if (!iso) return t('admin.users.lastSignInUnrecorded');
  return shortDate(iso);
}

const TH = {
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 800,
  color: '#5B6B8C',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  padding: '10px 16px',
} as const;

const TD = {
  fontSize: 12,
  color: '#5B6B8C',
  padding: '12px 16px',
  verticalAlign: 'middle',
} as const;

const TEXT_ACTION = {
  background: 'none',
  border: 'none',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
  padding: 0,
  whiteSpace: 'nowrap',
} as const;

/**
 * One account's row. The signed-in admin's own row gets a badge and no
 * controls rather than controls that would be refused: PRD 3 requires two
 * admins so one lockout cannot lock the team out, and self-demotion or
 * self-deactivation is the ordinary way that gets undone by accident.
 * `assertNotSelfDemotion` / `assertNotSelfDeactivation` refuse it
 * server-side regardless; omitting the control is what stops it being
 * offered, and a disabled control is the failure mode CLAUDE.md rules out.
 *
 * The prototype's last column is a red x that hard-deletes the account.
 * There is no delete here by design (docs/sp3-ledger.md Q4): deactivation
 * is complete at the database layer -- `current_app_role()` returns null
 * for an inactive profile, so every policy stops passing -- and keeps the
 * audit trail readable. So the column carries Deactivate or Reactivate,
 * named as such, not an x that implies something it does not do.
 */
function TeamRow({ row, isSelf }: { row: AdminUser; isSelf: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <tr style={{ borderTop: '1px solid #F1F4FA', opacity: row.isActive ? 1 : 0.6 }}>
      <td style={{ ...TD, fontSize: 13, fontWeight: 700, color: '#1A2332' }}>
        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {row.email}
        </span>
        {row.isActive ? null : (
          <span style={{ ...ADMIN_HELP, fontSize: 11 }}>{t('admin.users.status.deactivated')}</span>
        )}
      </td>
      <td style={TD}>
        {isSelf ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <RoleBadge role={row.role} />
            <span style={{ ...ADMIN_HELP, fontSize: 11 }}>{t('admin.users.selfNote')}</span>
          </div>
        ) : (
          <select
            aria-label={t('admin.settings.team.col.role')}
            defaultValue={row.role}
            disabled={pending}
            onChange={(event) => {
              const next = event.target.value as Role;
              startTransition(async () => {
                await changeUserRole({ profileId: row.id, role: next });
                router.refresh();
              });
            }}
            style={{
              padding: '6px 8px',
              borderRadius: 7,
              border: '1px solid #C9D3E8',
              fontSize: 12,
              fontWeight: 700,
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            {ROLES.map((value) => (
              <option key={value} value={value}>
                {t(`admin.users.role.${value}`)}
              </option>
            ))}
          </select>
        )}
      </td>
      <td style={{ ...TD, whiteSpace: 'nowrap' }}>{shortDate(row.createdAt)}</td>
      <td style={{ ...TD, whiteSpace: 'nowrap' }}>{lastSignIn(row.lastSignInAt)}</td>
      <td style={{ ...TD, textAlign: 'right' }}>
        {isSelf ? null : (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                await setUserActive(row.id, !row.isActive);
                router.refresh();
              });
            }}
            style={{ ...TEXT_ACTION, color: row.isActive ? '#C0392B' : '#1F5FBF' }}
          >
            {row.isActive ? t('admin.users.action.deactivate') : t('admin.users.action.reactivate')}
          </button>
        )}
      </td>
    </tr>
  );
}

/**
 * The prototype's Team access card: every account in a five-column table --
 * Email, Role, Added, Last sign-in, and the action -- under a title, the
 * one-line role legend and a "+ Invite user" button that reveals the
 * invitation form in place.
 *
 * Mounted by `/admin/settings` for an admin and for nobody else; an
 * editor's Settings has no such card. So there is no `canWrite` prop and
 * no read-only branch: role-conditional rendering here would imply a
 * non-admin can see the screen that decides who can do anything.
 */
export default function TeamAccessCard({
  rows,
  currentProfileId,
}: {
  rows: AdminUser[];
  currentProfileId: string;
}) {
  const [inviting, setInviting] = useState(false);

  return (
    <section style={ADMIN_PANEL} aria-labelledby="settings-team">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 id="settings-team" style={ADMIN_CARD_TITLE}>
            {t('admin.settings.team.heading')}
          </h2>
          <div style={ADMIN_CARD_SUB}>{t('admin.settings.team.roles')}</div>
        </div>
        <button
          type="button"
          aria-expanded={inviting}
          onClick={() => setInviting((open) => !open)}
          style={{
            border: '1.5px solid #C9D3E8',
            color: '#1F5FBF',
            background: '#fff',
            fontSize: 12.5,
            fontWeight: 700,
            padding: '8px 14px',
            borderRadius: 8,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {t('admin.settings.team.invite')}
        </button>
      </div>

      {inviting ? (
        <div style={{ marginTop: 14 }}>
          <InviteForm />
        </div>
      ) : null}

      <div style={{ marginTop: 14, border: '1px solid #F1F4FA', borderRadius: 11, overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F4F6F9' }}>
              <th style={TH}>{t('admin.settings.team.col.email')}</th>
              <th style={TH}>{t('admin.settings.team.col.role')}</th>
              <th style={TH}>{t('admin.settings.team.col.added')}</th>
              <th style={TH}>{t('admin.settings.team.col.lastSignIn')}</th>
              <th style={TH}>
                <span className="sr-only">{t('admin.settings.team.col.action')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <TeamRow key={row.id} row={row} isSelf={row.id === currentProfileId} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
