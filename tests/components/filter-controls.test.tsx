// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { t } from '@/lib/i18n';
import FilterControls from '@/components/public/FilterControls';
import { EMPTY_CRITERIA, filterResources } from '@/lib/public/filters';
import type { PublicResource } from '@/lib/public/types';

afterEach(cleanup);

function resource(overrides: Partial<PublicResource> = {}): PublicResource {
  return {
    id: 'r1',
    name: 'Cloud credits programme',
    partnerName: 'Amazon Web Services',
    partnerLogoUrl: null,
    partnerWebsiteUrl: null,
    partnerTier: 'strategic',
    resourceType: 'Credits',
    needPrimary: 'compute',
    needSecondary: null,
    subCategory: 'Cloud credits',
    description: 'Credits for early-stage teams.',
    actionLabel: null,
    externalUrl: 'https://example.org',
    bannerImageUrl: null,
    countriesEligible: ['Kenya', 'Ghana'],
    sectorsEligible: [],
    stagesEligible: ['Building'],
    geoScope: 'specific',
    deadline: '2026-09-01',
    isFeatured: false,
    exclusivity: null,
    sortOrder: 0,
    addedDate: '2026-01-01',
    isClosed: false,
    daysLeft: 33,
    ...overrides,
  };
}

const searchBox = () => screen.getByLabelText('Search resources') as HTMLInputElement;

/** Types `text` one character at a time, as a keyboard delivers it. */
function type(input: HTMLInputElement, text: string) {
  let typed = '';
  for (const character of text) {
    typed += character;
    fireEvent.change(input, { target: { value: typed } });
  }
}

describe('FilterControls search', () => {
  it('commits nothing while the visitor is still typing', () => {
    // Submit-only: a query is parsed into facets, and parsing half a sentence
    // would set filters from words nobody had finished typing.
    const onChange = vi.fn();
    render(<FilterControls criteria={EMPTY_CRITERIA} resultCount={0} onChange={onChange} />);

    type(searchBox(), 'funding in kenya');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps a space typed between two words in the DOM', () => {
    // The original regression: the box once took its value straight from
    // `criteria.query`, which filters.ts trims on read and on write, so a
    // trailing space vanished before the next keystroke could arrive and
    // multi-word search was impossible to type.
    const onChange = vi.fn();
    render(<FilterControls criteria={EMPTY_CRITERIA} resultCount={0} onChange={onChange} />);
    const input = searchBox();

    type(input, 'zindi indaba');

    expect(input.value).toBe('zindi indaba');
  });

  it('parses the sentence into facets when the button is pressed', () => {
    const onChange = vi.fn();
    render(<FilterControls criteria={EMPTY_CRITERIA} resultCount={0} onChange={onChange} />);

    type(searchBox(), 'funding for health ai in kenya');
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_CRITERIA,
      need: 'funding',
      sector: 'Health',
      country: 'Kenya',
      query: '',
      page: 1,
    });
  });

  it('does the same on Enter', () => {
    const onChange = vi.fn();
    render(<FilterControls criteria={EMPTY_CRITERIA} resultCount={0} onChange={onChange} />);

    type(searchBox(), 'grants in rwanda');
    fireEvent.submit(screen.getByRole('search'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_CRITERIA,
      need: 'funding',
      country: 'Rwanda',
      query: '',
      page: 1,
    });
  });

  it('leaves the typed sentence in the box after it has been parsed away', () => {
    // The committed query is the *leftover* of parsing, so after "funding in
    // kenya" it is empty while the box still reads the sentence. Re-seeding
    // the box from `criteria.query` here would wipe what the visitor typed
    // the instant they pressed Search.
    const onChange = vi.fn();
    const { rerender } = render(
      <FilterControls criteria={EMPTY_CRITERIA} resultCount={0} onChange={onChange} />,
    );

    type(searchBox(), 'funding in kenya');
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    const committed = onChange.mock.calls[0]![0];
    rerender(<FilterControls criteria={committed} resultCount={1} onChange={onChange} />);

    expect(searchBox().value).toBe('funding in kenya');
  });

  it('re-seeds the box when the query changes from somewhere else', () => {
    // A shared link or the back button, which arrive as a new `criteria`.
    const onChange = vi.fn();
    const { rerender } = render(
      <FilterControls criteria={EMPTY_CRITERIA} resultCount={0} onChange={onChange} />,
    );

    rerender(
      <FilterControls
        criteria={{ ...EMPTY_CRITERIA, query: 'zindi' }}
        resultCount={1}
        onChange={onChange}
      />,
    );

    expect(searchBox().value).toBe('zindi');
  });

  it('still finds a resource by two words it could not turn into facets', () => {
    const committed = { ...EMPTY_CRITERIA, query: 'amazon programme' };
    expect(filterResources([resource()], committed).map((r) => r.id)).toEqual(['r1']);
  });
});

describe('FilterControls facets', () => {
  it('offers the four dropdowns, each with its own all-values option', () => {
    render(
      <FilterControls criteria={EMPTY_CRITERIA} resultCount={0} onChange={vi.fn()} />,
    );

    expect((screen.getByLabelText('Need') as HTMLSelectElement).value).toBe('');
    // Read through t() rather than pinning the English: these labels are copy
    // and have already been reworded once.
    for (const key of ['anyNeed', 'anySector', 'anyStage', 'anyCountry']) {
      expect(screen.getByRole('option', { name: t(`filter.${key}`) }), key).toBeTruthy();
    }
  });

  it('renders no toggle chips — the facet panel is gone', () => {
    // Guards the deletion: the grey panel used aria-pressed chip buttons for
    // need, sector and stage, and the dropdowns replace all three.
    const { container } = render(
      <FilterControls criteria={EMPTY_CRITERIA} resultCount={0} onChange={vi.fn()} />,
    );
    expect(container.querySelectorAll('[aria-pressed]')).toHaveLength(0);
  });

  it('commits a facet chosen from a dropdown', () => {
    const onChange = vi.fn();
    render(<FilterControls criteria={EMPTY_CRITERIA} resultCount={0} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'Ghana' } });

    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_CRITERIA, country: 'Ghana' });
  });
});

describe('FilterControls chips', () => {
  const filtered = {
    ...EMPTY_CRITERIA,
    need: 'funding' as const,
    country: 'Kenya',
    query: 'zindi indaba',
  };

  it('shows the text term in quotes, as its own removable chip', () => {
    render(<FilterControls criteria={filtered} resultCount={1} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '“zindi indaba”' })).toBeTruthy();
  });

  it('clears one facet without disturbing the others', () => {
    const onChange = vi.fn();
    render(<FilterControls criteria={filtered} resultCount={1} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Funding' }));

    expect(onChange).toHaveBeenCalledWith({ ...filtered, need: null });
  });

  it('resets everything from Clear all', () => {
    const onChange = vi.fn();
    render(<FilterControls criteria={filtered} resultCount={1} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));

    expect(onChange).toHaveBeenCalledWith(EMPTY_CRITERIA);
  });

  it('empties the search box when everything is cleared', () => {
    const onChange = vi.fn();
    render(<FilterControls criteria={filtered} resultCount={1} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));

    expect(searchBox().value).toBe('');
  });
});
