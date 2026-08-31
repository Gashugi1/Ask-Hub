import { describe, it, expect } from 'vitest';
import {
  parseFilters,
  toSearchParams,
  directoryHref,
  filterResources,
  sortResources,
  EMPTY_CRITERIA,
  DEFAULT_SORT,
  paginate,
  resetPageOnFilterChange,
  type FilterCriteria,
} from '@/lib/public/filters';
import type { PublicResource } from '@/lib/public/types';

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
    sectorsEligible: ['Health'],
    stagesEligible: ['Building'],
    geoScope: 'specific',
    deadline: null,
    isFeatured: false,
    exclusivity: null,
    sortOrder: 0,
    addedDate: '2026-01-01',
    isClosed: false,
    daysLeft: null,
    ...overrides,
  };
}

const criteria = (over: Partial<FilterCriteria> = {}): FilterCriteria => ({
  ...EMPTY_CRITERIA,
  ...over,
});

describe('parseFilters', () => {
  it('returns the empty criteria for an empty query string', () => {
    expect(parseFilters(new URLSearchParams(''))).toEqual(EMPTY_CRITERIA);
  });

  it('reads every facet', () => {
    const parsed = parseFilters(
      new URLSearchParams(
        'need=funding&sector=Health&country=Kenya&stage=Building&q=grants&sort=recent',
      ),
    );
    expect(parsed).toEqual({
      need: 'funding',
      sector: 'Health',
      country: 'Kenya',
      stage: 'Building',
      query: 'grants',
      sort: 'recent',
      page: 1,
    });
  });

  it('falls back to the default for an unknown value rather than filtering to nothing', () => {
    // A stale or hand-edited link must not produce an empty directory with no
    // explanation. An unrecognised facet is dropped, not honoured.
    const parsed = parseFilters(
      new URLSearchParams('need=teleportation&sector=Mining&country=Atlantis&stage=Wizard&sort=price'),
    );
    expect(parsed).toEqual(EMPTY_CRITERIA);
    expect(parsed.sort).toBe(DEFAULT_SORT);
  });

  it('trims the free-text query', () => {
    expect(parseFilters(new URLSearchParams('q=%20%20grants%20%20')).query).toBe('grants');
  });
});

describe('directoryHref', () => {
  it('drops the query string entirely when nothing is filtered', () => {
    // Not '/?#directory'. A visitor copies whatever is in the address bar,
    // and a bare '?' propagates through every subsequent share of that link.
    expect(directoryHref(EMPTY_CRITERIA)).toBe('/#directory');
  });

  it('always carries the directory fragment, so a filter click lands on the band', () => {
    // The directory is a section of the home page, not a route. Without the
    // fragment a browse-menu link navigates to the top of the page and the
    // filtered results are somewhere below the fold, unannounced.
    expect(directoryHref(criteria({ need: 'compute' }))).toBe('/?need=compute#directory');
  });

  it('serialises a need and a sub-category search as the pair the chips use', () => {
    // This exact string is what a browse-menu sub-item links to, and it must
    // parse back to the same selection a visitor could have reached by
    // choosing the need chip and typing the phrase into the search box.
    const href = directoryHref(criteria({ need: 'training', query: 'Cloud credits' }));
    expect(href).toBe('/?need=training&q=Cloud+credits#directory');
    expect(parseFilters(new URLSearchParams(href.slice(2, href.indexOf('#'))))).toEqual(
      criteria({ need: 'training', query: 'Cloud credits' }),
    );
  });

  it('preserves unrelated parameters from the base it is given', () => {
    const base = new URLSearchParams('utm_source=newsletter');
    expect(directoryHref(criteria({ need: 'funding' }), base)).toContain('utm_source=newsletter');
  });
});

describe('toSearchParams', () => {
  it('serialises nothing for the empty criteria', () => {
    expect(toSearchParams(EMPTY_CRITERIA).toString()).toBe('');
  });

  it('omits the default sort but keeps a non-default one', () => {
    expect(toSearchParams(criteria({ sort: DEFAULT_SORT })).toString()).toBe('');
    expect(toSearchParams(criteria({ sort: 'recent' })).toString()).toBe('sort=recent');
  });

  it('round-trips every facet', () => {
    const original = criteria({
      need: 'training',
      sector: 'Education & Training',
      country: 'Democratic Republic of the Congo',
      stage: 'Scaling',
      query: 'curriculum',
      sort: 'recent',
    });
    expect(parseFilters(toSearchParams(original))).toEqual(original);
  });

  it('preserves unrelated parameters already in the URL', () => {
    // A campaign tag or an anchor-carrying param must survive a filter click.
    const base = new URLSearchParams('utm_source=newsletter');
    const out = toSearchParams(criteria({ need: 'funding' }), base);
    expect(out.get('utm_source')).toBe('newsletter');
    expect(out.get('need')).toBe('funding');
  });

  it('removes a facet that has been cleared rather than serialising it empty', () => {
    const base = new URLSearchParams('need=funding&sector=Health');
    const out = toSearchParams(criteria({ need: 'funding' }), base);
    expect(out.has('sector')).toBe(false);
  });
});

describe('filterResources', () => {
  const rows = [
    resource({ id: 'a', needPrimary: 'compute', name: 'Cloud credits programme' }),
    resource({
      id: 'b',
      needPrimary: 'funding',
      needSecondary: 'compute',
      name: 'Seed grant',
      partnerName: 'Google',
      description: 'Equity-free grant.',
      subCategory: 'Grant',
      sectorsEligible: [],
      countriesEligible: [],
      stagesEligible: [],
      geoScope: 'global',
    }),
    resource({
      id: 'c',
      needPrimary: 'training',
      name: 'Curriculum',
      partnerName: 'Deep Learning Indaba',
      // Overridden so this row's default subCategory ('Cloud credits',
      // inherited from the resource() factory) does not accidentally match
      // the 'cloud' query the search test below asserts is exclusive to 'a'.
      subCategory: 'Course design',
      sectorsEligible: ['Education & Training'],
      countriesEligible: ['Senegal'],
      stagesEligible: ['New to AI'],
    }),
  ];

  it('returns everything for the empty criteria', () => {
    expect(filterResources(rows, EMPTY_CRITERIA)).toHaveLength(3);
  });

  it('matches a need on either the primary or the secondary', () => {
    // need_secondary exists so a resource can serve two needs; ignoring it
    // would hide the compute half of every funding-and-compute resource.
    expect(filterResources(rows, criteria({ need: 'compute' })).map((r) => r.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('treats an empty sectors_eligible array as all sectors', () => {
    // The seed maps the prototype's 'All' sentinel to []; an empty array must
    // therefore match every sector rather than none.
    expect(filterResources(rows, criteria({ sector: 'Health' })).map((r) => r.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('treats an empty stages_eligible array as all stages', () => {
    expect(filterResources(rows, criteria({ stage: 'Scaling' })).map((r) => r.id)).toEqual(['b']);
  });

  it('matches any country when geo_scope is global, all_africa or partner_countries', () => {
    // PRD 4.x and content rule 10.6: there is no "Global programmes" option
    // in the country filter. A globally-scoped resource matches every
    // country selection instead.
    expect(filterResources(rows, criteria({ country: 'Zambia' })).map((r) => r.id)).toEqual(['b']);
    expect(filterResources(rows, criteria({ country: 'Kenya' })).map((r) => r.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('searches name, partner, description and sub-category', () => {
    expect(filterResources(rows, criteria({ query: 'cloud' })).map((r) => r.id)).toEqual(['a']);
    expect(filterResources(rows, criteria({ query: 'indaba' })).map((r) => r.id)).toEqual(['c']);
    expect(filterResources(rows, criteria({ query: 'equity-free' })).map((r) => r.id)).toEqual([
      'b',
    ]);
    expect(filterResources(rows, criteria({ query: 'grant' })).map((r) => r.id)).toEqual(['b']);
  });

  it('searches case-insensitively', () => {
    expect(filterResources(rows, criteria({ query: 'CLOUD' })).map((r) => r.id)).toEqual(['a']);
  });

  it('intersects facets rather than unioning them', () => {
    expect(
      filterResources(rows, criteria({ need: 'compute', country: 'Senegal' })),
    ).toHaveLength(1);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterResources(rows, criteria({ query: 'no such thing' }))).toEqual([]);
  });

  it('keeps closed resources in the results', () => {
    // PRD 4.2: a past deadline changes the display, never the listing.
    const closed = [resource({ id: 'z', isClosed: true, deadline: '2020-01-01', daysLeft: -1 })];
    expect(filterResources(closed, EMPTY_CRITERIA)).toHaveLength(1);
  });
});

describe('sortResources', () => {
  const rows = [
    resource({ id: 'a', isFeatured: false, sortOrder: 2, addedDate: '2026-03-01' }),
    resource({ id: 'b', isFeatured: true, sortOrder: 5, addedDate: '2026-01-01' }),
    resource({ id: 'c', isFeatured: false, sortOrder: 1, addedDate: '2026-05-01' }),
  ];

  it('puts featured first, then sort_order', () => {
    expect(sortResources(rows, 'featured').map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('orders by added date descending for recent', () => {
    expect(sortResources(rows, 'recent').map((r) => r.id)).toEqual(['c', 'a', 'b']);
  });

  it('breaks ties on id so the order is stable across renders', () => {
    // Without a tie-breaker, two rows with the same sort_order can swap
    // between a server render and a client re-render, which React reports as
    // a hydration mismatch and a visitor sees as a flicker.
    const tied = [
      resource({ id: 'y', sortOrder: 1, addedDate: '2026-01-01' }),
      resource({ id: 'x', sortOrder: 1, addedDate: '2026-01-01' }),
    ];
    expect(sortResources(tied, 'featured').map((r) => r.id)).toEqual(['x', 'y']);
    expect(sortResources(tied, 'recent').map((r) => r.id)).toEqual(['x', 'y']);
  });

  it('does not mutate its input', () => {
    const input = [...rows];
    sortResources(input, 'recent');
    expect(input.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts a resource with no added date last under recent', () => {
    const withNull = [resource({ id: 'n', addedDate: null }), resource({ id: 'd', addedDate: '2026-01-01' })];
    expect(sortResources(withNull, 'recent').map((r) => r.id)).toEqual(['d', 'n']);
  });
});

describe('pagination', () => {
  /**
   * Page is filter state, so it lives in the URL with every other facet --
   * otherwise a shared link to page 3 opens on page 1, and the back button
   * walks past the pages the visitor actually went through.
   */
  it('defaults to page 1 when the URL says nothing', () => {
    expect(parseFilters(new URLSearchParams('')).page).toBe(1);
  });

  it('reads a valid page', () => {
    expect(parseFilters(new URLSearchParams('page=3')).page).toBe(3);
  });

  it.each(['0', '-2', 'abc', '', '1.5', '1e3'])(
    'clamps a nonsense page (%s) to 1 rather than showing nothing',
    (raw) => {
      // A hand-edited or stale URL must not produce an empty grid with no
      // explanation. Every one of these used to be a way to reach page zero.
      expect(parseFilters(new URLSearchParams(`page=${raw}`)).page).toBe(1);
    },
  );

  it('omits page 1 from the URL, so a first-page link is the bare link', () => {
    expect(toSearchParams({ ...EMPTY_CRITERIA, page: 1 }).toString()).toBe('');
    expect(directoryHref({ ...EMPTY_CRITERIA, page: 1 })).toBe('/#directory');
  });

  it('serialises a page beyond the first, and round-trips it', () => {
    const criteria: FilterCriteria = { ...EMPTY_CRITERIA, need: 'compute', page: 4 };
    const params = toSearchParams(criteria);
    expect(params.get('page')).toBe('4');
    expect(parseFilters(params)).toEqual(criteria);
  });

  /**
   * The trap this rule exists for: narrow a 60-row directory while on page 5,
   * and without the reset the visitor lands on page 5 of a two-page result --
   * an empty grid that looks like "no matches" for a filter that matched.
   */
  it('resets to the first page when any filter changes', () => {
    const onPageFive: FilterCriteria = { ...EMPTY_CRITERIA, page: 5 };
    expect(resetPageOnFilterChange({ ...onPageFive, need: 'compute' }, onPageFive).page).toBe(1);
    expect(resetPageOnFilterChange({ ...onPageFive, query: 'gpu' }, onPageFive).page).toBe(1);
    expect(resetPageOnFilterChange({ ...onPageFive, sort: 'recent' }, onPageFive).page).toBe(1);
  });

  it('keeps the page when only the page itself changes', () => {
    // Paging forward is not a filter change; resetting here would pin the
    // visitor to page 1 and make the control inert.
    const previous: FilterCriteria = { ...EMPTY_CRITERIA, need: 'compute', page: 2 };
    const next: FilterCriteria = { ...previous, page: 3 };
    expect(resetPageOnFilterChange(next, previous).page).toBe(3);
  });

  it('slices the rows for the page it is given', () => {
    const rows = Array.from({ length: 25 }, (_, i) => resource({ id: `r${i}` }));
    expect(paginate(rows, 1, 12).rows).toHaveLength(12);
    expect(paginate(rows, 3, 12).rows).toHaveLength(1);
    expect(paginate(rows, 1, 12).pageCount).toBe(3);
  });

  it('clamps a page past the end to the last one, rather than showing an empty grid', () => {
    // Reachable from a shared link whose result set has since shrunk.
    const rows = Array.from({ length: 5 }, (_, i) => resource({ id: `r${i}` }));
    const result = paginate(rows, 9, 12);
    expect(result.page).toBe(1);
    expect(result.rows).toHaveLength(5);
  });

  it('reports one page for an empty result, not zero', () => {
    // pageCount 0 would render "page 1 of 0" and break every range check.
    expect(paginate([], 1, 12)).toEqual({ rows: [], page: 1, pageCount: 1 });
  });
});
