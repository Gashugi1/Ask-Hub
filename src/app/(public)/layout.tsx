import SiteHeader from '@/components/public/SiteHeader';
import SiteFooter from '@/components/public/SiteFooter';

/**
 * Public surface layout. PRD 5: no authentication anywhere here, every page
 * fully usable anonymously, and PRD 5.8: no login link or admin reference in
 * public navigation. The route-group split is what keeps that structural —
 * the admin sidebar lives in a sibling subtree and cannot render here.
 *
 * The alerts and suggest-a-resource modals are SP2b: they are write paths,
 * and the write paths ship with SP4's Turnstile, honeypots and rate limiting.
 */
export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
