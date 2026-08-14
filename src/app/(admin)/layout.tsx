/**
 * Admin group shell. Exists so the admin subtree can diverge from the public
 * one — its own chrome, its own error and loading boundaries — without either
 * leaking into the other.
 *
 * Authorization is NOT here. src/proxy.ts redirects unauthenticated /admin
 * traffic, which is UX; the real boundary is RLS plus a role re-check inside
 * every mutating server action (PRD 3, 14.4).
 */
export default function AdminGroupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-full">{children}</div>;
}
