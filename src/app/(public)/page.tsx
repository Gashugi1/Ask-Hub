import { Suspense } from 'react';
import WelcomeBand from '@/components/public/WelcomeBand';
import StatsBand from '@/components/public/StatsBand';
import BrowseByNeed from '@/components/public/BrowseByNeed';
import BrowseByNeedClient from '@/components/public/BrowseByNeedClient';
import FeaturedCarousel from '@/components/public/FeaturedCarousel';
import RecentlyAddedRail from '@/components/public/RecentlyAddedRail';
import ResourceDirectoryStatic from '@/components/public/ResourceDirectoryStatic';
import ResourceDirectoryClient from '@/components/public/ResourceDirectoryClient';
import { buildNeedMenu } from '@/lib/public/need-menu';
import {
  listPublicResources,
  listNeedCounts,
  listHeadlineStats,
  getSiteContent,
} from '@/lib/public/readers';

/**
 * The storefront home, PRD 5.1 in order: welcome, reach strip, search,
 * browse by need, featured, recently added, then the full
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
  const [resources, needCounts, stats, content] = await Promise.all([
    listPublicResources(),
    listNeedCounts(),
    listHeadlineStats(),
    getSiteContent(),
  ]);

  const needMenu = buildNeedMenu(needCounts, resources);

  return (
    <>
      <WelcomeBand content={content} />
      <StatsBand stats={stats} />

      {/* The prototype's storefront is two columns (reference lines 49-174):
          a sticky department menu on the left and a single scrolling column
          on the right, inside a 1280px measure. `flex-wrap` collapses it to
          one column on a narrow screen, with no breakpoint needed.

          The main column is `flex: 1 1 300px`, not the prototype's `flex: 1`
          with `min-width: 300px`. Those are not equivalent: `flex: 1` means
          `flex-basis: 0`, and flex line-breaking decides what fits using the
          basis — so the column claims to need no width, stays on the
          sidebar's line, and only then does `min-width` force it past the
          container's edge. The result is horizontal overflow where a wrap was
          intended. Stating the 300px as the basis makes the line-breaking
          arithmetic use the number that actually governs, and the column
          drops below the menu as soon as the two cannot sit side by side.
          The prototype carries the same latent bug; at its 1280px measure it
          simply never bites. */}
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
        {/* The menu's entries are derived here, on the server, from the
            counts and the same resource list the directory renders, and
            passed to both renderings below so they cannot list different
            things. `BrowseByNeedClient` reads the active need from the URL;
            the fallback is the same menu with nothing active, which is real
            markup rather than a placeholder — every category, count and
            category link is in the static HTML and works without JavaScript.
            Only the sub-items of an already-applied filter wait for
            hydration. Same boundary, same reasoning, as the directory below. */}
        <Suspense fallback={<BrowseByNeed entries={needMenu} activeNeed={null} />}>
          <BrowseByNeedClient entries={needMenu} />
        </Suspense>

        <div
          style={{
            flex: '1 1 300px',
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
            minInlineSize: 0,
          }}
        >
          <FeaturedCarousel resources={resources} />
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
