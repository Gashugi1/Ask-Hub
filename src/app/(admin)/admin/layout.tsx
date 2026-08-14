import { getCurrentUser } from '@/lib/auth';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminFooter from '@/components/admin/AdminFooter';

/**
 * Every screen under /admin is per-request: this layout resolves the
 * signed-in user's role, the Dashboard counts live rows, and later tasks add
 * screens that read the caller's own writes. None of that is ever correct to
 * serve from a static build-time render, so the whole subtree is forced
 * dynamic here once rather than left to Next's own dynamic-API detection
 * (which bails out on `cookies()`, but only after the code that runs before
 * it has already had a chance to throw — see the build-time note below).
 * Placed on the layout, not each page, so every route this task and later
 * SP3 tasks add under (admin)/admin inherits it with nothing to remember.
 *
 * Build-time note for whoever hits this: `getCurrentUser()` calls
 * `createServerSupabase()`, which throws by name
 * (`NEXT_PUBLIC_SUPABASE_URL is not set` / `..._ANON_KEY is not set`) before
 * it ever reaches `cookies()` — see src/lib/supabase/server.ts. Next's static
 * page generation pass renders this layout once at build time to discover
 * whether a route can be static; without both variables present in the build
 * environment (`.env.local` locally, project env vars in CI/Vercel) that
 * render throws for real and `next build` hard-fails, rather than the
 * dynamic-API bailout deferring the render as it would for a page that only
 * used `cookies()` directly. `force-dynamic` sidesteps the static-generation
 * pass entirely, so this is required regardless — the env vars still need to
 * be present at *runtime* on any deploy for the pages to work at all.
 */
export const dynamic = 'force-dynamic';

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
