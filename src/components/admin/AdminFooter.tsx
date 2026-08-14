import Link from 'next/link';
import SignOutButton from './SignOutButton';
import { t } from '@/lib/i18n';
import type { CurrentUser } from '@/lib/auth';

/**
 * PRD 6: signed-in name, display label, View site, Sign out.
 *
 * `display_label` is free text and independent of `role` (PRD 3). It is shown
 * as given and never used to decide what the user may do.
 */
export default function AdminFooter({ user }: { user: CurrentUser }) {
  return (
    <footer className="border-t border-hairline px-4 py-3 text-sm text-muted">
      <div className="flex flex-wrap items-center gap-4">
        <span>{user.fullName || user.email}</span>
        {user.displayLabel ? <span>{user.displayLabel}</span> : null}
        <Link href="/">{t('admin.footer.viewSite')}</Link>
        <SignOutButton />
      </div>
    </footer>
  );
}
