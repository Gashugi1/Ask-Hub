'use client';

import { signOut } from '@/lib/actions/session';
import { t } from '@/lib/i18n';
import { FOOT_LINK } from './AdminFooter';

/**
 * Sits beside "View site" at the foot of the admin rail and takes the same
 * treatment from one definition, so the pair cannot drift apart. `display:
 * contents` keeps the wrapping form out of the flex row -- it exists only to
 * carry the server action, and without this it would become a layout box the
 * prototype's row does not have.
 */
export default function SignOutButton() {
  return (
    <form action={signOut} style={{ display: 'contents' }}>
      <button type="submit" className="proto-admin-footer-link" style={FOOT_LINK}>
        {t('admin.footer.signOut')}
      </button>
    </form>
  );
}
