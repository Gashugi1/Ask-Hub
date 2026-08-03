// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import StatsBand from '@/components/public/StatsBand';
import PartnerRow from '@/components/public/PartnerRow';
import BrowseByNeed from '@/components/public/BrowseByNeed';
import FeaturedCarousel from '@/components/public/FeaturedCarousel';
import type { PublicStat, PublicPartner, PublicResource, NeedCount } from '@/lib/public/types';

afterEach(cleanup);

/**
 * `isHero` is required, not defaulted.
 *
 * It used to default to `true`, which made every one of these tests build a
 * band of six heroes and left `StatsBand`'s hero filter untested: deleting the
 * filter outright kept all twelve tests green, because with six heroes and no
 * heroes alike the first four rows come out the same. A default cannot stand
 * in for the value under test. `headline_stats.is_hero` is `not null default
 * false`, so a test that does not say which it means is not describing a real
 * row anyway.
 */
const stat = (over: Partial<PublicStat> & Pick<PublicStat, 'isHero'>): PublicStat => ({
  id: 's1',
  value: '18',
  label: 'partner countries',
  sortOrder: 0,
  ...over,
});

const partner = (over: Partial<PublicPartner> = {}): PublicPartner => ({
  name: 'Zindi',
  logoUrl: null,
  websiteUrl: null,
  sortOrder: 0,
  ...over,
});

describe('StatsBand', () => {
  it('renders nothing at all when no figure has been attested', () => {
    // headline_stats cannot hold a row without source, attested_by and
    // attested_on (all NOT NULL, all non-blank). So "no rows" means "nobody
    // has vouched for a number yet", and the honest response is no band --
    // not a band of zeros, not a placeholder, not an apology.
    const { container } = render(<StatsBand stats={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders exactly the figures that exist and invents nothing for the rest', () => {
    // The partial case is the one that will actually ship: the client
    // supplies fifteen figures over time, not in one delivery.
    render(
      <StatsBand
        stats={[
          stat({ id: 'a', value: '18', label: 'partner countries', isHero: true }),
          stat({ id: 'b', value: '6', label: 'priority sectors', isHero: true }),
        ]}
      />,
    );
    expect(screen.getAllByRole('term')).toHaveLength(2);
    expect(screen.getByText('18')).toBeDefined();
    expect(screen.getByText('6')).toBeDefined();
  });

  it('shows the first four hero figures and drops the rest', () => {
    // PRD 5.1 item 2: the home strip is the first four hero stats. The About
    // page renders all of them; this band is the strip. Asserted by value, not
    // by count alone -- a count of four is equally satisfied by the wrong four.
    render(
      <StatsBand
        stats={[1, 2, 3, 4, 5, 6].map((n) => stat({ id: `s${n}`, value: String(n), isHero: true }))}
      />,
    );
    expect(screen.getAllByRole('term')).toHaveLength(4);
    for (const shown of ['1', '2', '3', '4']) {
      expect(screen.getByText(shown), `hero ${shown} is missing from the strip`).toBeDefined();
    }
    for (const dropped of ['5', '6']) {
      expect(screen.queryByText(dropped), `stat ${dropped} is past the limit of four`).toBeNull();
    }
  });

  it('renders the hero figures and only those', () => {
    // The filter, stated positively and negatively in one render: the two
    // heroes appear, the two non-heroes do not, and the count is exactly two
    // rather than "at most four". A test that only asserts absence passes just
    // as well when the component renders nothing at all.
    render(
      <StatsBand
        stats={[
          stat({ id: 'a', value: '18', label: 'partner countries', isHero: true }),
          stat({ id: 'b', value: '6', label: 'priority sectors', isHero: false }),
          stat({ id: 'c', value: '400', label: 'GPU hours', isHero: true }),
          stat({ id: 'd', value: '9', label: 'workshops held', isHero: false }),
        ]}
      />,
    );
    expect(screen.getAllByRole('term')).toHaveLength(2);
    expect(screen.getByText('18')).toBeDefined();
    expect(screen.getByText('400')).toBeDefined();
    expect(screen.queryByText('6'), 'a non-hero stat reached the home strip').toBeNull();
    expect(screen.queryByText('9'), 'a non-hero stat reached the home strip').toBeNull();
  });

  it('renders nothing when figures exist but none is marked hero', () => {
    // `headline_stats.is_hero` is `not null default false` and the Site
    // Content screen creates every stat unticked, so this is the table's
    // starting state, not a corner. The component used to fall back to
    // `stats.slice(0, 4)` here, which put four figures nobody had designated
    // into the slot PRD 5.1 item 2 reserves for hero stats and made the Hero
    // checkbox a no-op until the first tick. The About page (PRD 5.6) is where
    // every attested figure is shown regardless of the flag.
    const { container } = render(
      <StatsBand
        stats={[
          stat({ id: 'a', value: '18', label: 'partner countries', isHero: false }),
          stat({ id: 'b', value: '6', label: 'priority sectors', isHero: false }),
        ]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('PartnerRow', () => {
  it('renders nothing when there are no partners', () => {
    const { container } = render(<PartnerRow partners={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the partner name when no logo has been uploaded yet', () => {
    // Logos are a client deliverable. A name-only row is the correct state
    // until they arrive, not a gap to hide the whole band for.
    render(<PartnerRow partners={[partner({ name: 'AfriLabs' })]} />);
    expect(screen.getByText('AfriLabs')).toBeDefined();
  });

  it('renders the logo and links it to the partner site once both exist', () => {
    // Content rule 10.10, which the database enforces as a CHECK: a logo may
    // not exist without a website to link it to.
    render(
      <PartnerRow
        partners={[
          partner({ name: 'Zindi', logoUrl: 'https://cdn.test/z.png', websiteUrl: 'https://zindi.africa' }),
        ]}
      />,
    );
    const link = screen.getByRole('link', { name: 'Zindi' });
    expect(link.getAttribute('href')).toBe('https://zindi.africa');
    expect(link.getAttribute('rel')).toContain('noopener');
  });
});

describe('BrowseByNeed', () => {
  it('renders nothing when no need has a live resource', () => {
    const { container } = render(<BrowseByNeed counts={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one chip per need with a live count, linking into the directory', () => {
    const counts: NeedCount[] = [
      { need: 'compute', liveCount: 4 },
      { need: 'funding', liveCount: 2 },
    ];
    render(<BrowseByNeed counts={counts} />);
    const compute = screen.getByRole('link', { name: /Compute/ });
    expect(compute.getAttribute('href')).toBe('/?need=compute#directory');
  });
});

describe('FeaturedCarousel', () => {
  const resource = (over: Partial<PublicResource> = {}): PublicResource => ({
    id: 'r1', name: 'Cloud credits', partnerName: 'AWS', partnerLogoUrl: null,
    partnerWebsiteUrl: null, partnerTier: 'strategic', resourceType: null,
    needPrimary: 'compute', needSecondary: null, subCategory: null, description: null,
    actionLabel: null, externalUrl: null, bannerImageUrl: null, countriesEligible: [],
    sectorsEligible: [], stagesEligible: [], geoScope: 'global', deadline: null,
    isFeatured: true, exclusivity: null, sortOrder: 0, addedDate: '2026-01-01',
    isClosed: false, daysLeft: null, ...over,
  });

  it('renders nothing when nothing is featured', () => {
    const { container } = render(<FeaturedCarousel resources={[resource({ isFeatured: false })]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the featured resources, and only those', () => {
    // Both halves in one render. The absence half on its own is worthless: it
    // passed unchanged when the whole component was made to `return null`,
    // because a rail that renders nothing also renders no non-featured card.
    render(
      <FeaturedCarousel
        resources={[
          resource({ id: 'a', name: 'Cloud credits' }),
          resource({ id: 'b', isFeatured: false, name: 'Not featured' }),
        ]}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Featured opportunities' })).toBeDefined();
    const card = screen.getByRole('link', { name: 'Cloud credits' });
    expect(card.getAttribute('href')).toBe('/resources/a');
    expect(screen.queryByText('Not featured')).toBeNull();
    // Exactly one card, so "renders the featured ones" cannot be satisfied by
    // rendering everything and hiding one of them.
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });

  it('orders the rail by sort order rather than by arrival', () => {
    // PRD 5.1 item 5's rail is curated: `sort_order` is what the admin screen
    // sets to arrange it. Without the sortResources call the rail would render
    // in whatever order the reader happened to return.
    render(
      <FeaturedCarousel
        resources={[
          resource({ id: 'second', name: 'Second in the rail', sortOrder: 2 }),
          resource({ id: 'first', name: 'First in the rail', sortOrder: 1 }),
        ]}
      />,
    );
    const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(['First in the rail', 'Second in the rail']);
  });
});
