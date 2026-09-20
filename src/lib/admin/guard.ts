import 'server-only';
import { notFound } from 'next/navigation';
import { requireRole, type CurrentUser, type Role } from '@/lib/auth';

export interface NavItem {
  href: string;
  labelKey: string;
  /** The roles whose sidebar lists this screen. */
  roles: readonly Role[];
}

/**
 * The sidebar, in the approved prototype's order and with its visibility:
 * a viewer sees Dashboard, Reach & Engagement and Audit Log; an editor and
 * an admin see every screen. Expressed as a role list rather than an
 * `adminOnly` boolean because the prototype's middle tier -- editor and
 * admin, not viewer -- is not a boolean.
 *
 * Every entry here has a route. The screens the prototype lists but this
 * application does not have (subscribers, updates, partnerships) are absent
 * rather than disabled: a route that does not exist asks no questions,
 * while a greyed-out entry reads as a broken feature. Reach & Engagement
 * exists as a route precisely so it can say, on its own screen, that the
 * reporting is not available yet.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/admin', labelKey: 'admin.nav.dashboard', roles: ['admin', 'editor', 'viewer'] },
  { href: '/admin/reach', labelKey: 'admin.nav.reach', roles: ['admin', 'editor', 'viewer'] },
  { href: '/admin/resources', labelKey: 'admin.nav.resources', roles: ['admin', 'editor'] },
  { href: '/admin/review', labelKey: 'admin.nav.review', roles: ['admin', 'editor'] },
  { href: '/admin/settings', labelKey: 'admin.nav.settings', roles: ['admin', 'editor'] },
  { href: '/admin/audit', labelKey: 'admin.nav.audit', roles: ['admin', 'editor', 'viewer'] },
];

export function canWrite(role: Role): boolean {
  return role === 'admin' || role === 'editor';
}

export function canAdminister(role: Role): boolean {
  return role === 'admin';
}

export function visibleNavItems(role: Role): readonly NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

/**
 * Page-level gate. `requireRole` throws, which is right for an action — the
 * caller gets FORBIDDEN and the client shows it. For a page, a role that may
 * not see the screen should be told the screen does not exist: `notFound()`
 * rather than a redirect carrying a message, because whether /admin/settings
 * exists is not information a non-admin needs.
 *
 * This is not the security boundary. Every action on these pages calls
 * `requireRole` for itself, and RLS refuses the write regardless.
 */
export async function requirePageRole(allowed: Role[]): Promise<CurrentUser> {
  try {
    return await requireRole(allowed);
  } catch {
    notFound();
  }
}
