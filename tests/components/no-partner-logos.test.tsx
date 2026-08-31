// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import ResourceCard from '@/components/public/ResourceCard';
import RecentlyAddedRail from '@/components/public/RecentlyAddedRail';
import FeaturedCarousel from '@/components/public/FeaturedCarousel';
import type { PublicResource } from '@/lib/public/types';

afterEach(cleanup);

/**
 * This release carries no partner or programme logos. The data still does --
 * `partner_logo_url` is populated for several partners and the seeded asset
 * paths are untouched -- so "no logos" is a rendering decision that nothing
 * in the schema enforces.
 *
 * That is exactly why this file exists. Every fixture below deliberately
 * *has* a logo URL: a surface that quietly started rendering marks again
 * would look correct against the seed and pass any test that only checked the
 * null case. Asserting zero images while the data offers one is what makes
 * the removal a fact rather than a coincidence of empty columns.
 *
 * It replaces tests/components/partner-logo.test.tsx, which asserted the
 * opposite for the component this release deleted.
 */
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


const images = (container: HTMLElement) => [...container.querySelectorAll('img')];

describe('no partner or programme logos are rendered', () => {
  it('renders no image on a directory card, though the partner has a logo', () => {
    const { container } = render(<ResourceCard resource={resource()} />);
    expect(images(container)).toHaveLength(0);
    // The organisation is still named, so nothing is lost but the mark.
    expect(container.textContent).toContain('Amazon Web Services');
  });

  it('renders no image on a recently-added rail card', () => {
    const { container } = render(<RecentlyAddedRail resources={[resource()]} />);
    expect(images(container)).toHaveLength(0);
    expect(container.textContent).toContain('Amazon Web Services');
  });

  it('renders no image on the featured card', () => {
    const { container } = render(<FeaturedCarousel resources={[resource()]} />);
    expect(images(container)).toHaveLength(0);
    expect(container.textContent).toContain('Amazon Web Services');
  });

});
