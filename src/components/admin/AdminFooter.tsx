import Link from 'next/link';
import SignOutButton from './SignOutButton';
import { t } from '@/lib/i18n';
import type { CurrentUser } from '@/lib/auth';

/**
 * PRD 6: signed-in name, display label, View site, Sign out.
 *
 * Transcribed from the prototype's sidebar foot (the approved prototype): name, role beneath it, and the two links side by side above
 * a hairline. It renders inside AdminSidebar rather than as a bar across the
 * bottom of the content area, which is where the prototype puts it and where
 * it stops competing with the screen's own content for the reader's attention.
 *
 * `display_label` is free text and independent of `role` (PRD 3). It is shown
 * as given and never used to decide what the user may do.
 */
export default function AdminFooter({ user }: { user: CurrentUser }) {
  return (
    <div
      style={{
        marginTop: 'auto',
        padding: '14px 10px',
        borderTop: '1px solid rgba(255,255,255,0.14)',
      }}
    >
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
