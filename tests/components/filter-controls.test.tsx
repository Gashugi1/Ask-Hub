// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import FilterControls from '@/components/public/FilterControls';
import { EMPTY_CRITERIA, filterResources } from '@/lib/public/filters';
import type { PublicResource } from '@/lib/public/types';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

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

/**
 * Regression coverage for the review's Finding 3: the search box swallowed
 * the space between two words because its `value` came straight from
 * `criteria.query`, which is trimmed on both write and read (filters.ts).
 * Once a keystroke's `router.replace` committed, the input re-rendered from
 * the trimmed URL value and any trailing space vanished before the next
 * keystroke could land -- making "cloud credits" impossible to type and
 * `matchesQuery`'s substring match search "cloudcredits" instead.
 *
 * This test drives the real keystroke loop demonstrated in the review
 * (typing char by char, exactly as a keyboard would deliver `onChange`
 * events) rather than setting the input's value in one shot, because the
 * bug was specifically about what happens *between* keystrokes.
 */
describe('FilterControls search input', () => {
  it('keeps a space typed between two words in the DOM before it commits', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<FilterControls criteria={EMPTY_CRITERIA} resultCount={0} onChange={onChange} />);
    const input = screen.getByPlaceholderText('Search resources') as HTMLInputElement;

    // Type "cloud credits" one character at a time. Each keystroke fires the
    // component's onChange with the DOM's own next value, exactly like a
    // real <input>.
    let typed = '';
    for (const ch of 'cloud credits') {
      typed += ch;
      fireEvent.change(input, { target: { value: typed } });
    }

    // The space must still be there -- this is exactly what the old
    // implementation lost by re-rendering the input from the trimmed,
    // already-committed URL value on every keystroke.
    expect(input.value).toBe('cloud credits');
  });

  it('commits the full query, space included, after the debounce elapses', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<FilterControls criteria={EMPTY_CRITERIA} resultCount={0} onChange={onChange} />);
    const input = screen.getByPlaceholderText('Search resources') as HTMLInputElement;

    let typed = '';
    for (const ch of 'cloud credits') {
      typed += ch;
      fireEvent.change(input, { target: { value: typed } });
    }

    // Nothing commits mid-keystroke: it is still debouncing.
    expect(onChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_CRITERIA, query: 'cloud credits' });
  });

  it('a multi-word query matches resources once committed', () => {
    // The other half of the regression: even if the space survived, a
    // single substring match still has to find something. This is the
    // criteria FilterControls's onChange ultimately produces, fed straight
    // through the real filterResources from Task 3.
    const rows = [resource()];
    const committed = { ...EMPTY_CRITERIA, query: 'cloud credits' };
    expect(filterResources(rows, committed).map((r) => r.id)).toEqual(['r1']);
  });
});
