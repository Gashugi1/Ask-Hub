// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ResourceCard from '@/components/public/ResourceCard';
import RecentlyAddedRail from '@/components/public/RecentlyAddedRail';
import PartnerLogo, { LOGO_ON_DETAIL } from '@/components/public/PartnerLogo';
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
 * Cards carry no partner mark: `partners.logo_url` is null for 16 of 19
 * partners, so a tile that rendered for the other three read as a defect in
 * the grid rather than as data the grid did not have. Each card surface is
 * asserted with a logo present, because passing `partnerLogoUrl: null` alone
 * would also pass against a card that still renders the mark.
 */
describe('the partner logo slot', () => {
  it('puts no mark on a directory card, even when the partner has one', () => {
    const { container } = render(<ResourceCard resource={resource()} />);
    expect(images(container)).toEqual([]);
  });

  it('puts no mark on a recently-added rail card, even when the partner has one', () => {
    const { container } = render(<RecentlyAddedRail resources={[resource()]} />);
    expect(images(container)).toEqual([]);
  });

  it('still names the organisation in text on a card', () => {
    // The mark is gone; the name it duplicated is what a reader actually
    // needs, and it is still there — in the banner and again in the body.
    render(<ResourceCard resource={resource()} />);
    expect(screen.getAllByText('Amazon Web Services')).toHaveLength(2);
  });

  it('leaves the detail-page mark out of the accessible tree', () => {
    // The detail banner names the organisation in text beside the tile. A
    // described logo would make a screen reader announce it twice.
    const { container } = render(
      <PartnerLogo logoUrl="/partners/aws.png" style={LOGO_ON_DETAIL} />,
    );
    expect(images(container).map((i) => i.getAttribute('alt'))).toEqual(['']);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('contains the mark rather than cropping it, on white', () => {
    // The banner behind the tile is a saturated need colour and partner marks
    // are drawn for white; `cover` would crop a wordmark to a square.
    const { container } = render(
      <PartnerLogo logoUrl="/partners/aws.png" style={LOGO_ON_DETAIL} />,
    );
    const style = container.querySelector('img')?.getAttribute('style') ?? '';
    expect(style).toContain('object-fit: contain');
    expect(style).toContain('background: rgb(255, 255, 255)');
  });

  it('renders nothing for an empty string, not a broken image', () => {
    // `logo_url` is nullable, but nothing stops a curator saving an empty
    // field, and `<img src="">` re-requests the current page in some browsers.
    const { container } = render(<PartnerLogo logoUrl="" style={LOGO_ON_DETAIL} />);
    expect(container.firstChild).toBeNull();
  });
});
