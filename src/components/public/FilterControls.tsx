'use client';

import { useEffect, useRef, useState } from 'react';
import { t } from '@/lib/i18n';
import { COUNTRIES, SECTORS, STAGES, NEED_KEYS } from '@/lib/reference';
import { DEFAULT_SORT, type FilterCriteria, type SortMode } from '@/lib/public/filters';

/** Idle typing time before the search box commits `query` to the URL. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Every control writes the whole criteria object back through `onChange`,
 * except the search box: it holds the in-progress text in local state and
 * commits it to the URL debounced. That is a deliberate, spec'd exception
 * (an uncommitted keystroke is not filter state) and not a second copy of
 * committed state -- everything else still round-trips through the URL with
 * no local mirror and no syncing effect, because a second copy of *that* is
 * what makes back-button behaviour and shared links disagree.
 *
 * The reason the exception exists: `criteria.query` is trimmed on read and
 * on write (see filters.ts), so if the input's value came straight from
 * `criteria.query` on every keystroke, a trailing space would be trimmed out
 * of the DOM the instant a URL update committed -- deleting it before the
 * next keystroke could arrive, and doing so nondeterministically depending on
 * render timing. Multi-word search would be unusable.
 */
export default function FilterControls({
  criteria,
  resultCount,
  onChange,
}: {
  criteria: FilterCriteria;
  resultCount: number;
  onChange: (next: FilterCriteria) => void;
}) {
  const [queryText, setQueryText] = useState(criteria.query);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Read inside the debounce callback instead of closing over `criteria`
  // directly, so a facet changed by a select while the search box is still
  // debouncing is not clobbered by a stale snapshot of the other fields.
  // Updated in an effect, not during render, per the rules of hooks -- a ref
  // written mid-render is not something React (or this codebase's lint
  // config) allows.
  const criteriaRef = useRef(criteria);
  useEffect(() => {
    criteriaRef.current = criteria;
  });

  // Re-seed local text when the committed query changes from somewhere other
  // than this input's own debounce -- a shared link, the back button, or
  // Clear filters. This is "adjusting state when a prop changes" (React's own
  // recipe for it): compare during render and call setState directly rather
  // than in an effect, which only bails the render out and re-renders once,
  // instead of committing the stale value to the screen first.
  const [syncedQuery, setSyncedQuery] = useState(criteria.query);
  if (criteria.query !== syncedQuery) {
    setSyncedQuery(criteria.query);
    setQueryText(criteria.query);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleQueryChange(value: string) {
    setQueryText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange({ ...criteriaRef.current, query: value });
    }, SEARCH_DEBOUNCE_MS);
  }

  function clearAll() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQueryText('');
    onChange({
      need: null,
      sector: null,
      country: null,
      stage: null,
      query: '',
      sort: DEFAULT_SORT,
    });
  }

  const isFiltered =
    criteria.need !== null ||
    criteria.sector !== null ||
    criteria.country !== null ||
    criteria.stage !== null ||
    criteria.query !== '' ||
    criteria.sort !== DEFAULT_SORT;

  return (
    <div className="flex flex-col gap-4">
      <label className="block">
        <span className="sr-only">{t('filter.searchHint')}</span>
        <input
          type="search"
          className="w-full rounded-lg border border-hairline px-4 py-3"
          value={queryText}
          placeholder={t('filter.search')}
          onChange={(event) => handleQueryChange(event.target.value)}
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <Select
          label={t('filter.need')}
          value={criteria.need}
          options={NEED_KEYS.map((key) => ({ value: key, label: t(`need.${key}`) }))}
          onChange={(value) => onChange({ ...criteria, need: value as FilterCriteria['need'] })}
        />
        <Select
          label={t('filter.sector')}
          value={criteria.sector}
          options={SECTORS.map((s) => ({ value: s, label: s }))}
          onChange={(value) => onChange({ ...criteria, sector: value })}
        />
        <Select
          label={t('filter.country')}
          value={criteria.country}
          options={COUNTRIES.map((c) => ({ value: c, label: c }))}
          onChange={(value) => onChange({ ...criteria, country: value })}
        />
        <Select
          label={t('filter.stage')}
          value={criteria.stage}
          options={STAGES.map((s) => ({ value: s, label: s }))}
          onChange={(value) => onChange({ ...criteria, stage: value })}
        />
        <Select
          label={t('sort.label')}
          value={criteria.sort}
          allowAny={false}
          options={[
            { value: 'featured', label: t('sort.featured') },
            { value: 'recent', label: t('sort.recent') },
          ]}
          onChange={(value) =>
            onChange({ ...criteria, sort: (value as SortMode | null) ?? DEFAULT_SORT })
          }
        />
      </div>

      <div className="flex items-center gap-4 text-sm text-muted">
        <span>
          {resultCount === 1
            ? t('directory.countOne')
            : t('directory.count', { count: resultCount })}
        </span>
        {isFiltered ? (
          <button type="button" className="text-primary underline" onClick={clearAll}>
            {t('filter.clear')}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
  allowAny = true,
}: {
  label: string;
  value: string | null;
  options: { value: string; label: string }[];
  onChange: (value: string | null) => void;
  allowAny?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-muted">
      <span>{label}</span>
      <select
        className="rounded-lg border border-hairline bg-surface px-3 py-2 text-navy"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
      >
        {allowAny ? <option value="">{t('filter.any')}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
