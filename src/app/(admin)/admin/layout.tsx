import { getCurrentUser } from '@/lib/auth';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminFooter from '@/components/admin/AdminFooter';

/**
 * The signed-in shell. It resolves the role once and passes it down, so no
 * screen guesses at what the current user may do — and so a viewer's write
 * affordances are absent by construction rather than by each screen
 * remembering to check (PRD 3, spec 3.3).
 *
 * Authorization is not here. Every page calls requirePageRole or requireRole
 * for itself and every action re-checks; this layout only decides what to
 * draw.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();

  // The login page lives under this layout and must render with no session.
  // The proxy has already redirected an unauthenticated visitor away from
  // every other /admin path.
  if (!user) return <div className="min-h-full">{children}</div>;

  return (
    <div className="flex min-h-full">
      <AdminSidebar role={user.role} />
      <div className="flex min-h-full flex-1 flex-col">
        <div className="flex-1 p-6">{children}</div>
        <AdminFooter user={user} />
      </div>
    </div>
  );
}
