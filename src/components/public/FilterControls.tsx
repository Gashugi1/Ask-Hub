'use client';

import { t } from '@/lib/i18n';
import { COUNTRIES, SECTORS, STAGES, NEED_KEYS } from '@/lib/reference';
import { DEFAULT_SORT, type FilterCriteria, type SortMode } from '@/lib/public/filters';

/**
 * Every control writes the whole criteria object back through `onChange`.
 * There is no local mirror of URL state and no effect copying one into the
 * other: the URL is the single source of truth, and a second copy is what
 * makes back-button behaviour and shared links disagree.
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
          value={criteria.query}
          placeholder={t('filter.search')}
          onChange={(event) => onChange({ ...criteria, query: event.target.value })}
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
          <button
            type="button"
            className="text-primary underline"
            onClick={() =>
              onChange({
                need: null,
                sector: null,
                country: null,
                stage: null,
                query: '',
                sort: DEFAULT_SORT,
              })
            }
          >
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
