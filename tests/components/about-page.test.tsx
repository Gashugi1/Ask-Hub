// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { PublicStat } from '@/lib/public/types';

const getSiteContent = vi.fn(async () => ({}) as Record<string, string>);
const listHeadlineStats = vi.fn(async () => [] as PublicStat[]);

vi.mock('@/lib/public/readers', () => ({ getSiteContent, listHeadlineStats }));

// No global setup file wires up automatic cleanup between tests (that is
// normally done via @testing-library/jest-dom's setup or a test-environment
// preset), so each render() would otherwise accumulate in the shared jsdom
// document and a later test could see a previous test's markup.
afterEach(cleanup);

function stat(id: string, value: string, label: string): PublicStat {
  return { id, value, label, isHero: false, sortOrder: 0 };
}

/**
 * PRD 5.6: About renders every attested headline stat, not the home strip's
 * first four -- and no stats section at all when there are none. The client
 * supplies the fifteen figures over time, so the two-stat case below is the
 * normal case, not a fixture standing in for a future full set.
 *
 * CLAUDE.md: never fabricate a metric. The zero-stats case guards that rule
 * directly -- a future change that swapped `null` for an empty `<dl>` or a
 * placeholder figure would still "look" like a stats section and must fail
 * this test.
 */
describe('/about stats section', () => {
  beforeEach(() => {
    getSiteContent.mockReset().mockResolvedValue({});
    listHeadlineStats.mockReset();
  });

  it('renders no stats section at all when there are zero stats', async () => {
    listHeadlineStats.mockResolvedValue([]);
    const { default: AboutPage } = await import('@/app/(public)/about/page');
    const element = await AboutPage();
    render(element);

    expect(screen.queryByText('By the numbers')).toBeNull();
    expect(document.querySelector('dl')).toBeNull();
  });

  it('renders exactly the attested stats and nothing standing in for the rest', async () => {
    listHeadlineStats.mockResolvedValue([
      stat('1', '54', 'Innovators supported'),
      stat('2', '12', 'Countries reached'),
    ]);
    const { default: AboutPage } = await import('@/app/(public)/about/page');
    const element = await AboutPage();
    render(element);

    // getByText throws if the text is absent, so a passing call is itself
    // the presence assertion.
    expect(screen.getByText('By the numbers')).toBeTruthy();
    expect(screen.getByText('54')).toBeTruthy();
    expect(screen.getByText('Innovators supported')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('Countries reached')).toBeTruthy();

    // Exactly two <dt>/<dd> pairs -- nothing filling in for the other
    // thirteen figures that have not arrived yet.
    expect(document.querySelectorAll('dt')).toHaveLength(2);
    expect(document.querySelectorAll('dd')).toHaveLength(2);
  });
});
