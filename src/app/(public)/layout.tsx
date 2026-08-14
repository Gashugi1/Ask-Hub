/**
 * Public surface layout. PRD 5: no authentication anywhere here, every page
 * fully usable anonymously, and PRD 5.8: no login link or admin reference in
 * public navigation. The route-group split is what keeps that structural —
 * the admin sidebar lives in a sibling subtree and cannot render here.
 *
 * SP2 fills this with the header, the footer carrying the exact 10.1
 * attribution, and the alerts and suggest-a-resource modals.
 */
export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="flex min-h-full flex-col">{children}</div>;
}
