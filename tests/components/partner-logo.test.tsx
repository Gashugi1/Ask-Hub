// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ResourceCard from '@/components/public/ResourceCard';
import RecentlyAddedRail from '@/components/public/RecentlyAddedRail';
import FeaturedCarousel from '@/components/public/FeaturedCarousel';
import PartnerLogo, { LOGO_ON_CARD } from '@/components/public/PartnerLogo';
import type { PublicResource } from '@/lib/public/types';

afterEach(cleanup);

const resource = (over: Partial<PublicResource> = {}): PublicResource => ({
  id: 'r1',
  name: 'AWS Activate',
  partnerName: 'Amazon Web Services',
  partnerLogoUrl: '/partners/aws.png',
  partnerWebsiteUrl: 'https://aws.amazon.com/',
  partnerTier: 'strategic',
  resourceType: null,
  needPrimary: 'compute',
  needSecondary: null,
  subCategory: null,
  description: null,
  actionLabel: null,
  externalUrl: null,
  bannerImageUrl: null,
  countriesEligible: [],
  sectorsEligible: [],
  stagesEligible: [],
  geoScope: 'global',
  deadline: null,
  isFeatured: true,
  exclusivity: null,
  sortOrder: 0,
  addedDate: '2026-01-01',
  isClosed: false,
  daysLeft: null,
  ...over,
});

/** Every <img> in the tree, whether or not it has an accessible name. */
const images = (container: HTMLElement) => [...container.querySelectorAll('img')];

/**
 * The logo slot is the one piece of a resource card whose *absence* is the
 * normal case: `partners.logo_url` is null for 16 of 19 partners. So each
 * surface is asserted both ways in one test -- a "renders the logo" assertion
 * on its own passes against a component that renders an <img> unconditionally
 * with `src=""`, which is a broken-image icon on every card the client has
 * not supplied a mark for.
 */
describe('the partner logo slot', () => {
  it('renders the mark on a directory card, and nothing at all without one', () => {
    const { container: withLogo } = render(<ResourceCard resource={resource()} />);
    expect(images(withLogo).map((i) => i.getAttribute('src'))).toEqual(['/partners/aws.png']);

    cleanup();
    const { container: without } = render(
      <ResourceCard resource={resource({ partnerLogoUrl: null })} />,
    );
    expect(images(without)).toEqual([]);
  });

  it('renders it on a recently-added rail card, and nothing at all without one', () => {
    const { container: withLogo } = render(
      <RecentlyAddedRail resources={[resource()]} />,
    );
    expect(images(withLogo).map((i) => i.getAttribute('src'))).toEqual(['/partners/aws.png']);

    cleanup();
    const { container: without } = render(
      <RecentlyAddedRail resources={[resource({ partnerLogoUrl: null })]} />,
    );
    expect(images(without)).toEqual([]);
  });

  it('renders it on the featured card, and nothing at all without one', () => {
    const { container: withLogo } = render(
      <FeaturedCarousel resources={[resource()]} />,
    );
    expect(images(withLogo).map((i) => i.getAttribute('src'))).toEqual(['/partners/aws.png']);

    cleanup();
    const { container: without } = render(
      <FeaturedCarousel resources={[resource({ partnerLogoUrl: null })]} />,
    );
    expect(images(without)).toEqual([]);
  });

  it('leaves the mark out of the accessible tree', () => {
    // The banner names the organisation in text immediately below the tile.
    // A described logo would make a screen reader announce "Amazon Web
    // Services" twice for one card.
    render(<ResourceCard resource={resource()} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getAllByText('Amazon Web Services')).toHaveLength(2);
  });

  it('contains the mark rather than cropping it, on white', () => {
    // Every banner behind the tile is a saturated need colour and partner
    // marks are drawn for white; `cover` would crop a wordmark to a square.
    const { container } = render(<PartnerLogo logoUrl="/partners/aws.png" style={LOGO_ON_CARD} />);
    const style = container.querySelector('img')?.getAttribute('style') ?? '';
    expect(style).toContain('object-fit: contain');
    expect(style).toContain('background: rgb(255, 255, 255)');
  });

  it('renders nothing for an empty string, not a broken image', () => {
    // `logo_url` is nullable, but nothing stops a curator saving an empty
    // field, and `<img src="">` re-requests the current page in some browsers.
    const { container } = render(<PartnerLogo logoUrl="" style={LOGO_ON_CARD} />);
    expect(container.firstChild).toBeNull();
  });
});
