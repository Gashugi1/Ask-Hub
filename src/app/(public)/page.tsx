import { Suspense } from 'react';
import ResourceDirectoryStatic from '@/components/public/ResourceDirectoryStatic';
import ResourceDirectoryClient from '@/components/public/ResourceDirectoryClient';
import { listPublicResources } from '@/lib/public/readers';

/**
 * The storefront home. Task 6 adds the six bands that sit above the
 * directory; this is the directory itself, which PRD 5.1 item 8 puts on the
 * home page rather than on a route of its own.
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
 * the six bands Task 6 adds above the directory still prerender as static
 * HTML.
 */
export default async function PublicHomePage() {
  const resources = await listPublicResources();
  return (
    <Suspense fallback={<ResourceDirectoryStatic resources={resources} />}>
      <ResourceDirectoryClient resources={resources} />
    </Suspense>
  );
}
