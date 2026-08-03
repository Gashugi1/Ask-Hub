import 'server-only';
import { notFound } from 'next/navigation';
import { requireRole, type CurrentUser, type Role } from '@/lib/auth';

export interface NavItem {
  href: string;
  labelKey: string;
  adminOnly: boolean;
}

/**
 * The launch sidebar (spec 1). Deferred screens are absent rather than
 * disabled: a route that does not exist asks no questions, while a greyed-out
 * "Subscribers" entry reads as a broken feature.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/admin', labelKey: 'admin.nav.dashboard', adminOnly: false },
  { href: '/admin/resources', labelKey: 'admin.nav.resources', adminOnly: false },
  { href: '/admin/content', labelKey: 'admin.nav.content', adminOnly: false },
  { href: '/admin/settings', labelKey: 'admin.nav.settings', adminOnly: true },
  { href: '/admin/users', labelKey: 'admin.nav.users', adminOnly: true },
  { href: '/admin/audit', labelKey: 'admin.nav.audit', adminOnly: false },
];

export function canWrite(role: Role): boolean {
  return role === 'admin' || role === 'editor';
}

export function canAdminister(role: Role): boolean {
  return role === 'admin';
}

export function visibleNavItems(role: Role): readonly NavItem[] {
  return NAV_ITEMS.filter((item) => !item.adminOnly || canAdminister(role));
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
