import Link from 'next/link';
import SignOutButton from './SignOutButton';
import { t } from '@/lib/i18n';
import type { CurrentUser } from '@/lib/auth';

/**
 * PRD 6: signed-in name, display label, View site, Sign out.
 *
 * Transcribed from the prototype's sidebar foot (the approved prototype): name, role beneath it, and the two links side by side above
 * a hairline. On a desktop it renders inside AdminSidebar, which is where the
 * prototype puts it and where it stops competing with the screen's own
 * content for the reader's attention. At phone width the rail is a bar
 * across the top and the nav is collapsed, so the same block renders as a
 * footer under the content instead -- AdminLayout mounts that copy, and
 * globals.css shows exactly one of the two at any width.
 *
 * `display_label` is free text and independent of `role` (PRD 3). It is shown
 * as given and never used to decide what the user may do.
 */
export default function AdminFooter({
  user,
  className,
}: {
  user: CurrentUser;
  /** `admin-rail-foot` in the rail (desktop), `admin-page-foot` under the content (phone); globals.css shows one per width. */
  className: 'admin-rail-foot' | 'admin-page-foot';
}) {
  return (
    // Box styling lives on the two classes (globals.css): an inline margin
    // or border here would beat the phone-width rule that restyles the
    // footer copy.
    <div className={className}>
      <div style={{ fontSize: 13.5, fontWeight: 800 }}>{user.fullName || user.email}</div>
      {user.displayLabel ? (
        <div style={{ fontSize: 11.5, color: '#A9B8E0', marginTop: 2 }}>
          {user.displayLabel}
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <Link href="/" className="proto-admin-footer-link" style={FOOT_LINK}>
          {t('admin.footer.viewSite')}
        </Link>
        <SignOutButton />
      </div>
    </div>
  );
}

/** The prototype's. Exported so SignOutButton matches it exactly. */
export const FOOT_LINK = {
  background: 'none',
  border: 'none',
  color: '#C6D2F2',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  padding: 0,
} as const;
