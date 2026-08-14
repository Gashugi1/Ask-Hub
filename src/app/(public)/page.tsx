import { Suspense } from 'react';
import WelcomeBand from '@/components/public/WelcomeBand';
import StatsBand from '@/components/public/StatsBand';
import BrowseByNeed from '@/components/public/BrowseByNeed';
import FeaturedCarousel from '@/components/public/FeaturedCarousel';
import PartnerRow from '@/components/public/PartnerRow';
import RecentlyAddedRail from '@/components/public/RecentlyAddedRail';
import ResourceDirectoryStatic from '@/components/public/ResourceDirectoryStatic';
import ResourceDirectoryClient from '@/components/public/ResourceDirectoryClient';
import {
  listPublicResources,
  listNeedCounts,
  listPublicPartners,
  listHeadlineStats,
  getSiteContent,
} from '@/lib/public/readers';

/**
 * The storefront home, PRD 5.1 in order: welcome, reach strip, search,
 * browse by need, featured, partners, recently added, then the full
 * directory on the same page (PRD 5.1 item 8 puts it here rather than on a
 * route of its own).
 *
 * Every band hides itself when it has no rows, so the page reads as finished
 * rather than broken while the client's data is still arriving. The five
 * readers are awaited together rather than in sequence: five sequential round
 * trips would be five times the latency for no benefit. The bands take rows
 * as props rather than fetching their own, which is what keeps each of them a
 * synchronous pure function a test renderer can mount -- an `async` server
 * component cannot be rendered by one, so a self-fetching band could only be
 * exercised by loading a page.
 *
 * `searchParams` is deliberately not read here: doing so would make this
 * route dynamic and lose its static prerender, and PRD 12.2 requires the
 * directory to be server-rendered content -- not client-only rendering --
 * which a dynamic-per-request page would undermine just as badly as an empty
 * fallback does.
 *
 * `ResourceDirectoryClient` calls `useSearchParams()`, which opts its
 * subtree, and only its subtree, into client-side rendering during
 * prerender. `Suspense`'s `fallback` is not a spinner: it is
 * `ResourceDirectoryStatic`, the same live resources rendered as real,
 * crawlable, no-JS-safe HTML with no dependency on search params. Next can
 * and does render that fallback fully at build time, so the static shell for
 * `/` contains genuine resource markup rather than nothing. Once a real
 * browser hydrates, the client component takes over and swaps in the
 * filtered view.
 *
 * The boundary is drawn here, around the smallest subtree that needs it, so
 * the bands above the directory still prerender as static HTML. `SearchPill`
 * in the header is a client component too, but it calls only `useRouter`, not
 * `useSearchParams`, so it prerenders in place and needs no boundary of its
 * own.
 *
 * **The separate hero search is gone.** It was a second search box on a page
 * whose header now carries the prototype's pill, and the prototype has one
 * search above the fold, not two. PRD 5.1 item 3 asks for prominent search
 * above the fold; the sticky header satisfies it on every route rather than
 * only this one. The directory keeps its own field, exactly as the prototype
 * does.
 */
export default async function PublicHomePage() {
  const [resources, needCounts, partners, stats, content] = await Promise.all([
    listPublicResources(),
    listNeedCounts(),
    listPublicPartners(),
    listHeadlineStats(),
    getSiteContent(),
  ]);

  return (
    <>
      <WelcomeBand content={content} />
      <StatsBand stats={stats} />

      {/* The prototype's storefront is two columns (reference lines 49-174):
          a sticky department menu on the left and a single scrolling column
          on the right, inside a 1280px measure. `flex-wrap` is what collapses
          it to one column on a narrow screen — the sidebar's 232px basis and
          the main column's 300px minimum cannot both fit, so the sidebar
          wraps above the content rather than needing a breakpoint. */}
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '22px 28px 0 28px',
          display: 'flex',
          gap: 28,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
        }}
      >
        <BrowseByNeed counts={needCounts} />

        <div
          style={{
            flex: 1,
            minWidth: 300,
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
            minInlineSize: 0,
          }}
        >
          <FeaturedCarousel resources={resources} />
          <PartnerRow partners={partners} />
          <RecentlyAddedRail resources={resources} />
        </div>
      </div>

      {/* Only this subtree calls useSearchParams(), so only this subtree
          needs the boundary — everything above still prerenders. */}
      <Suspense fallback={<ResourceDirectoryStatic resources={resources} />}>
        <ResourceDirectoryClient resources={resources} />
      </Suspense>
    </>
  );
}
