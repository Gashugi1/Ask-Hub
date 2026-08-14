'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { t } from '@/lib/i18n';

/**
 * The sidebar's nav items, split out as a client component for one reason:
 * the prototype highlights the current screen (reference line 677), and
 * knowing which screen that is means reading the pathname.
 *
 * Only this list is a client component. The sidebar around it, the user block
 * and the layout stay on the server, so the role check that decides which
 * items exist at all still happens where it cannot be tampered with.
 *
 * The items are given, not chosen here: `visibleNavItems(role)` filters by
 * role on the server and this renders exactly what it is handed.
 */
export default function AdminNavList({
  items,
}: {
  items: readonly { href: string; labelKey: string }[];
}) {
  const pathname = usePathname();

  return (
    <ul
      style={{
        marginTop: 26,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        listStyle: 'none',
        padding: 0,
      }}
    >
      {items.map((item) => {
        // `/admin` would otherwise light up on every screen beneath it.
        const active =
          item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className="proto-admin-nav"
              style={{
                display: 'block',
                textAlign: 'left',
                background: active ? '#1F5FBF' : 'transparent',
                color: active ? '#fff' : '#C6D2F2',
                borderRadius: 9,
                padding: '11px 14px',
                fontSize: 13.5,
                fontWeight: 700,
              }}
            >
              {t(item.labelKey)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
