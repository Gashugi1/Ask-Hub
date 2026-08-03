import { t } from '@/lib/i18n';
import type { Role } from '@/lib/auth';

/**
 * The role of an account the signed-in admin may not change — today, their
 * own row. Read-only by construction: this renders text, never a control, so
 * the row that has no permitted role change shows no affordance for one
 * rather than a disabled dropdown (CLAUDE.md; design spec §3.3).
 *
 * Colours reuse existing tokens, as `AuditTable`'s action badges do, rather
 * than introducing new literals: `admin` takes the amber-brown already
 * defined for the `funding` need, `editor` the blue defined for `compute`,
 * and `viewer` the neutral pair. Nothing here is inferred from
 * `display_label`, which is free text and independent of role (PRD §3).
 */
const ROLE_CLASSES: Record<Role, string> = {
  admin: 'bg-need-funding-bg text-need-funding',
  editor: 'bg-need-compute-bg text-need-compute',
  viewer: 'bg-neutral-bg text-neutral',
};

export default function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${ROLE_CLASSES[role]}`}>
      {t(`admin.users.role.${role}`)}
    </span>
  );
}
