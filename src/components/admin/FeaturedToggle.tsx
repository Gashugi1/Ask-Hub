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
      // Prototype line 833: a star, coloured when the resource is featured.
      // The accessible name still comes from aria-label above, so the control
      // is not reduced to an unlabelled glyph.
      style={{
        background: 'none',
        border: 'none',
        color: isFeatured ? 'var(--acc, #F06428)' : '#C9D3E8',
        fontSize: 17,
        cursor: 'pointer',
        padding: 0,
        lineHeight: 1,
      }}
    >
      <span aria-hidden="true">★</span>
      <span className="sr-only">
        {isFeatured
          ? t('admin.resources.actions.featuredOn')
          : t('admin.resources.actions.featuredOff')}
      </span>
    </button>
  );
}
