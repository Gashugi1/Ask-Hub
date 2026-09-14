'use client';

import { useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { t } from '@/lib/i18n';
import AdminNavList from './AdminNavList';

/**
 * The rail's head and its screen list, with the phone-width menu button
 * that collapses the list.
 *
 * On a desktop the list is always shown and the button is not rendered by
 * CSS (`.admin-menu-toggle`). Below 900px the rail is a bar across the top
 * of the page, and six stacked screens plus the signed-in block would fill
 * the first screen before any content; so the list starts collapsed, the
 * button opens it, and the signed-in block moves to a page footer
 * (AdminLayout renders it there).
 *
 * Open state is "opened on this path": navigating to a screen changes the
 * pathname, which closes the menu without an effect that sets state.
 */
export default function AdminNav({
  brand,
  items,
}: {
  /** The wordmark row, rendered by the server sidebar. */
  brand: ReactNode;
  items: readonly { href: string; labelKey: string }[];
}) {
  const pathname = usePathname();
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;

  return (
    <>
      <div className="admin-rail-head">
        {brand}
        <button
          type="button"
          className="admin-menu-toggle"
          aria-expanded={open}
          aria-controls="admin-nav"
          onClick={() => setOpenedOn(open ? null : pathname)}
        >
          {t('admin.nav.menu')}
        </button>
      </div>
      <AdminNavList id="admin-nav" items={items} className={open ? 'admin-nav admin-nav--open' : 'admin-nav'} />
    </>
  );
}
