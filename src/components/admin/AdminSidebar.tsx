import Link from 'next/link';
import { visibleNavItems } from '@/lib/admin/guard';
import { t } from '@/lib/i18n';
import type { Role } from '@/lib/auth';

/**
 * PRD 6's sidebar, reduced to the launch screens (spec 1) and filtered by
 * role. Settings and Users are absent for non-admins, matching the routes,
 * which return notFound() for them.
 */
export default function AdminSidebar({ role }: { role: Role }) {
  return (
    <nav className="w-56 shrink-0 border-r border-hairline bg-tint-2 p-4">
      <ul className="flex flex-col gap-1 text-sm">
        {visibleNavItems(role).map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="block rounded px-3 py-2 text-navy">
              {t(item.labelKey)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
