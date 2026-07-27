/**
 * Layout for the signed-in portal. SP3 fills this with the PRD 6 sidebar —
 * Dashboard, Resources, Review Queue, Reach & Engagement, Partnerships,
 * Alerts & Subscribers, Site Content, Updates, Audit Log — and the footer
 * showing signed-in name, display label, View site and Sign out.
 *
 * PRD 3: a viewer must not be shown write affordances at all, so SP3 reads
 * the role here and passes it down rather than each screen guessing.
 */
export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="flex min-h-full">{children}</div>;
}
