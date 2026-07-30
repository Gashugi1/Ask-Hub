import { Suspense } from 'react';
import ResourceDirectory from '@/components/public/ResourceDirectory';
import { listPublicResources } from '@/lib/public/readers';

/**
 * The storefront home. Task 6 adds the six bands that sit above the
 * directory; this is the directory itself, which PRD 5.1 item 8 puts on the
 * home page rather than on a route of its own.
 */
export default async function PublicHomePage() {
  const resources = await listPublicResources();
  return (
    // ResourceDirectory calls useSearchParams(), which opts its subtree into
    // client-side rendering during prerender. The boundary is here, around
    // the smallest subtree that needs it, so the bands Task 6 adds above
    // still prerender as static HTML.
    <Suspense fallback={null}>
      <ResourceDirectory resources={resources} />
    </Suspense>
  );
}
