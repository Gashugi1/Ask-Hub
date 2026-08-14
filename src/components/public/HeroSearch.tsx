'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n';

/**
 * PRD 5.1 item 3: prominent search above the fold. It writes `?q=` and jumps
 * to the directory, which owns the filtering -- there is one implementation
 * of search on this page, not two.
 *
 * This component calls useRouter but not useSearchParams, so it needs no
 * Suspense boundary and the bands around it still prerender.
 */
export default function HeroSearch() {
  const router = useRouter();
  const [value, setValue] = useState('');

  return (
    <section className="mx-auto max-w-3xl px-4 pb-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const query = value.trim();
          router.replace(query === '' ? '/#directory' : `/?q=${encodeURIComponent(query)}#directory`);
        }}
      >
        <label className="block">
          <span className="sr-only">{t('home.searchHeading')}</span>
          <input
            type="search"
            className="w-full rounded-lg border border-hairline px-5 py-4 text-lg"
            placeholder={t('filter.search')}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
      </form>
    </section>
  );
}
