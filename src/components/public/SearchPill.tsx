'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n';

/**
 * The prototype's rounded search control (docs/prototype/prototype.html lines
 * 11-16), transcribed verbatim: a 1.5px hairline pill with a flush primary
 * button, the input at 13.5px and the button at 13px/800.
 *
 * It lives in its own file because the prototype uses the same control in two
 * places -- the sticky header and, at a larger scale, the storefront's
 * above-the-fold search. Two copies of these values would drift the moment
 * one of them was adjusted, and the plan's Task 11 explicitly requires the
 * hero to reuse the header's values rather than re-derive them.
 *
 * Behaviour matches the search that was already here: write `?q=` and jump to
 * the directory, which owns the filtering. There is one implementation of
 * search on the page, not two. `useRouter` is called but `useSearchParams` is
 * not, so this needs no Suspense boundary and the bands around it still
 * prerender.
 *
 * Hover and focus arrive as `style-hover` / `style-focus` attributes in the
 * prototype, which are not real HTML. This is already a client component, so
 * they are state here rather than another pair of global classes.
 */
export default function SearchPill({ maxWidth = 430 }: { maxWidth?: number }) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  function go() {
    const query = value.trim();
    router.replace(query === '' ? '/#directory' : `/?q=${encodeURIComponent(query)}#directory`);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        go();
      }}
      style={{
        display: 'flex',
        gap: 0,
        width: '100%',
        minWidth: 0,
        maxWidth,
        border: `1.5px solid ${focused ? '#1F5FBF' : '#C9D3E8'}`,
        borderRadius: 99,
        overflow: 'hidden',
      }}
    >
      <label style={{ display: 'contents' }}>
        <span className="sr-only">{t('home.searchHeading')}</span>
        <input
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={t('search.placeholder')}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '9px 18px',
            border: 'none',
            fontSize: 13.5,
            color: '#1A2332',
            outline: 'none',
            background: 'transparent',
          }}
        />
      </label>
      <button
        type="submit"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: hovered ? '#174A99' : '#1F5FBF',
          color: '#fff',
          border: 'none',
          padding: '0 18px',
          fontSize: 13,
          fontWeight: 800,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {t('search.submit')}
      </button>
    </form>
  );
}
