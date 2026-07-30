// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import StatsBand from '@/components/public/StatsBand';
import PartnerRow from '@/components/public/PartnerRow';
import BrowseByNeed from '@/components/public/BrowseByNeed';
import FeaturedCarousel from '@/components/public/FeaturedCarousel';
import type { PublicStat, PublicPartner, PublicResource, NeedCount } from '@/lib/public/types';

afterEach(cleanup);

const stat = (over: Partial<PublicStat> = {}): PublicStat => ({
  id: 's1',
  value: '18',
  label: 'partner countries',
  isHero: true,
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
          stat({ id: 'a', value: '18', label: 'partner countries' }),
          stat({ id: 'b', value: '6', label: 'priority sectors' }),
        ]}
      />,
    );
    expect(screen.getAllByRole('term')).toHaveLength(2);
    expect(screen.getByText('18')).toBeDefined();
    expect(screen.getByText('6')).toBeDefined();
  });

  it('shows at most the first four hero figures', () => {
    // PRD 5.1 item 2: the home strip is the first four hero stats. The About
    // page renders all of them; this band is the strip.
    render(
      <StatsBand
        stats={[1, 2, 3, 4, 5, 6].map((n) => stat({ id: `s${n}`, value: String(n) }))}
      />,
    );
    expect(screen.getAllByRole('term')).toHaveLength(4);
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

  it('renders only the featured resources', () => {
    render(
      <FeaturedCarousel
        resources={[resource({ id: 'a' }), resource({ id: 'b', isFeatured: false, name: 'Not featured' })]}
      />,
    );
    expect(screen.queryByText('Not featured')).toBeNull();
  });
});
