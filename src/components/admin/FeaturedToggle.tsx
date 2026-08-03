'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setResourceFeatured } from '@/lib/actions/resources';
import { t } from '@/lib/i18n';

/**
 * Inline featured toggle for one table row. Rendered only when the caller
 * already knows `canWrite` is true (see ResourceTable) — no disabled
 * variant, per CLAUDE.md.
 */
export default function FeaturedToggle({ id, isFeatured }: { id: string; isFeatured: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={isFeatured}
      aria-label={t('badge.featured')}
      onClick={() => {
        startTransition(async () => {
          await setResourceFeatured(id, !isFeatured);
          router.refresh();
        });
      }}
      className={isFeatured ? 'text-primary' : 'text-muted-light'}
    >
      {isFeatured ? t('admin.resources.actions.featuredOn') : t('admin.resources.actions.featuredOff')}
    </button>
  );
}
