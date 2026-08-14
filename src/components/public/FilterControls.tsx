'use client';

import { useEffect, useRef, useState } from 'react';
import { t } from '@/lib/i18n';
import { COUNTRIES, SECTORS, STAGES, NEED_KEYS } from '@/lib/reference';
import { DEFAULT_SORT, type FilterCriteria, type SortMode } from '@/lib/public/filters';

/** Idle typing time before the search box commits `query` to the URL. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Transcribed from the approved prototype, docs/prototype/prototype.html
 * lines 190-235 and 240-251: a wide search field with a flush primary button,
 * a row of removable chips for whatever is currently filtered, and a #F4F6F9
 * panel holding need, sector and stage as toggle chips with country as a
 * select.
 *
 * Need, sector and stage became chips because the prototype shows them as
 * chips; country stays a select because eighteen countries do not fit a chip
 * row, which is why the prototype keeps that one a select too.
 *
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
 *
 * The prototype's Search button is kept even though the field already
 * commits on its own. It is how the control reads as a search box rather than
 * a text input, and pressing it simply commits immediately instead of waiting
 * out the debounce -- so it is never the only way to search, which would make
 * the field unusable without JavaScript-driven clicks.
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
  const [searchFocused, setSearchFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Read inside the debounce callback instead of closing over `criteria`
  // directly, so a facet changed by a chip while the search box is still
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

  function commitQuery() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onChange({ ...criteriaRef.current, query: queryText });
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

  /** The active facets, as the prototype's removable chip row. */
  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  if (criteria.need) {
    activeChips.push({
      key: 'need',
      label: t(`need.${criteria.need}`),
      clear: () => onChange({ ...criteria, need: null }),
    });
  }
  if (criteria.sector) {
    activeChips.push({
      key: 'sector',
      label: criteria.sector,
      clear: () => onChange({ ...criteria, sector: null }),
    });
  }
  if (criteria.country) {
    activeChips.push({
      key: 'country',
      label: criteria.country,
      clear: () => onChange({ ...criteria, country: null }),
    });
  }
  if (criteria.stage) {
    activeChips.push({
      key: 'stage',
      label: criteria.stage,
      clear: () => onChange({ ...criteria, stage: null }),
    });
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12 }}>
        <label style={{ flex: 1, display: 'flex' }}>
          <span className="sr-only">{t('filter.searchHint')}</span>
          <input
            type="search"
            value={queryText}
            placeholder={t('filter.search')}
            onChange={(event) => handleQueryChange(event.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitQuery();
              }
            }}
            style={{
              flex: 1,
              padding: '13px 18px',
              borderRadius: 10,
              border: `1.5px solid ${searchFocused ? '#1F5FBF' : '#C9D3E8'}`,
              fontSize: 15,
              color: '#1A2332',
              outline: 'none',
            }}
          />
        </label>
        <button
          type="button"
          onClick={commitQuery}
          className="proto-primary-button"
          style={{
            background: '#1F5FBF',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '0 26px',
            fontSize: 14.5,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {t('search.submit')}
        </button>
      </div>

      {activeChips.length > 0 ? (
        <div
          style={{
            marginTop: 14,
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              className="proto-active-chip"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                background: '#EEF2FB',
                color: '#1F5FBF',
                border: '1px solid #C9D3E8',
                borderRadius: 99,
                padding: '6px 13px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {chip.label}
              <span aria-hidden="true" style={{ fontWeight: 800, opacity: 0.6 }}>
                ×
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="proto-clear-all"
            style={{
              background: 'none',
              border: 'none',
              color: '#5B6B8C',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '6px 8px',
            }}
          >
            {t('filter.clear')}
          </button>
        </div>
      ) : null}

      <div
        style={{
          marginTop: 20,
          background: '#F4F6F9',
          border: '1px solid #DDE5EE',
          borderRadius: 14,
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <ChipGroup
            label={t('filter.need')}
            options={NEED_KEYS.map((key) => ({ value: key, label: t(`need.${key}`) }))}
            selected={criteria.need}
            onPick={(value) =>
              onChange({ ...criteria, need: value as FilterCriteria['need'] })
            }
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginLeft: 'auto',
            }}
          >
            <span style={GROUP_LABEL}>{t('filter.country')}</span>
            <select
              value={criteria.country ?? ''}
              onChange={(event) =>
                onChange({
                  ...criteria,
                  country: event.target.value === '' ? null : event.target.value,
                })
              }
              style={SELECT}
            >
              <option value="">{t('filter.any')}</option>
              {COUNTRIES.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <ChipGroup
            label={t('filter.sector')}
            options={SECTORS.map((s) => ({ value: s, label: s }))}
            selected={criteria.sector}
            onPick={(value) => onChange({ ...criteria, sector: value })}
          />
          <ChipGroup
            label={t('filter.stage')}
            options={STAGES.map((s) => ({ value: s, label: s }))}
            selected={criteria.stage}
            onPick={(value) => onChange({ ...criteria, stage: value })}
          />
        </div>
      </div>

      <div
        style={{
          marginTop: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: 13.5, color: '#5B6B8C', fontWeight: 600 }}>
          {resultCount === 1
            ? t('directory.countOne')
            : t('directory.count', { count: resultCount })}
          {' · '}
          {t('site.curationStatement')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={GROUP_LABEL}>{t('sort.label')}</span>
          <select
            value={criteria.sort}
            onChange={(event) =>
              onChange({
                ...criteria,
                sort: (event.target.value as SortMode | null) ?? DEFAULT_SORT,
              })
            }
            style={{ ...SELECT, fontSize: 13, padding: '7px 10px', fontWeight: 600 }}
          >
            <option value="featured">{t('sort.featured')}</option>
            <option value="recent">{t('sort.recent')}</option>
          </select>
        </div>
      </div>
    </div>
  );
}

/**
 * One facet rendered as the prototype's toggle chips. Clicking the selected
 * chip clears the facet, which is the only way to get back to "any" without a
 * chip labelled so -- the prototype has no such chip, and the removable chips
 * above the panel are the other route back.
 */
function ChipGroup({
  label,
  options,
  selected,
  onPick,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string | null;
  onPick: (value: string | null) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={GROUP_LABEL}>{label}</span>
      {options.map((option) => {
        const on = selected === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(on ? null : option.value)}
            style={{
              border: `1px solid ${on ? '#1F5FBF' : '#C9D3E8'}`,
              background: on ? '#EEF2FB' : '#fff',
              color: on ? '#1F5FBF' : '#42506E',
              borderRadius: 99,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

const GROUP_LABEL = {
  fontSize: 11.5,
  fontWeight: 800,
  color: '#5B6B8C',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
} as const;

const SELECT = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #C9D3E8',
  fontSize: 13.5,
  background: '#fff',
  color: '#1A2332',
  cursor: 'pointer',
} as const;
