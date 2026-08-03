'use client';

import { t } from '@/lib/i18n';

/**
 * Boundary for the admin subtree. `requireRole` throws FORBIDDEN and
 * UNAUTHENTICATED as plain Errors; neither message is shown to the user,
 * because "you are forbidden" is all the detail anyone needs and the raw
 * message could carry query detail from a failed read.
 */
export default function AdminError() {
  return (
    <main className="p-6">
      <p role="alert">{t('admin.error.generic')}</p>
    </main>
  );
}
