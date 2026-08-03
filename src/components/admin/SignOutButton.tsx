'use client';

import { signOut } from '@/lib/actions/session';
import { t } from '@/lib/i18n';

export default function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className="text-primary underline">
        {t('admin.footer.signOut')}
      </button>
    </form>
  );
}
