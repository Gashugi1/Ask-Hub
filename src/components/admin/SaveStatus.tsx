'use client';

import { t } from '@/lib/i18n';
import type { CommitStatus } from './useFieldCommit';

/**
 * The transient word beside a Settings field: "Saved" in green after a
 * commit, or the refusal in red. A live region, so a screen reader hears the
 * outcome of a blur it cannot otherwise perceive. Renders an empty region
 * when idle rather than nothing, so the live region exists before it has
 * something to announce -- a region that appears with its first message is
 * not reliably read.
 */
export default function SaveStatus({ status }: { status: CommitStatus }) {
  const text =
    status.kind === 'saved'
      ? t('admin.settings.saved')
      : status.kind === 'error'
        ? status.message || t('admin.error.generic')
        : '';
  return (
    <span
      role="status"
      aria-live="polite"
      style={{
        fontSize: 12,
        fontWeight: 700,
        color: status.kind === 'error' ? '#C0392B' : '#0E7A54',
        textTransform: 'none',
        letterSpacing: 'normal',
      }}
    >
      {text}
    </span>
  );
}
