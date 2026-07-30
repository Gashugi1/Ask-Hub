'use client';

import { t } from '@/lib/i18n';

/**
 * A failed read shows an error. It does not fall back to hardcoded copy, to
 * a cached older payload, or to the admin client -- a public page quietly
 * serving invented content is worse than one saying it broke, and on a
 * leadership reporting surface a plausible substitute is the defect.
 */
export default function PublicError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold text-navy">{t('error.title')}</h1>
      <p className="mt-3 text-muted">{t('error.body')}</p>
      <button
        type="button"
        className="mt-6 rounded-lg bg-primary px-5 py-3 text-surface"
        onClick={reset}
      >
        {t('error.retry')}
      </button>
    </div>
  );
}
