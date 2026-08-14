import { describe, it, expect, vi, beforeEach } from 'vitest';

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
const isFeatureEnabled = vi.fn<() => Promise<boolean>>();
const listImpactStories = vi.fn(async () => []);

vi.mock('next/navigation', () => ({ notFound }));
vi.mock('@/lib/public/readers', () => ({ isFeatureEnabled, listImpactStories }));

/**
 * PRD 5.7: the page is built, renders impact_stories, and is gated behind
 * feature_public_impact_page, which is off at launch. When off it returns
 * 404. This is the reachability half of the requirement; the "no navigation
 * link" half is asserted separately below by scanning the source.
 */
describe('/impact', () => {
  beforeEach(() => {
    notFound.mockClear();
    isFeatureEnabled.mockReset();
    listImpactStories.mockClear();
  });

  it('returns notFound when the flag is off', async () => {
    isFeatureEnabled.mockResolvedValue(false);
    const { default: ImpactPage } = await import('@/app/(public)/impact/page');
    await expect(ImpactPage()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledOnce();
  });

  it('does not read impact stories at all while the flag is off', async () => {
    // A gated page that still queries is a gated page that still leaks
    // timing and load. Check the gate short-circuits.
    isFeatureEnabled.mockResolvedValue(false);
    const { default: ImpactPage } = await import('@/app/(public)/impact/page');
    await ImpactPage().catch(() => undefined);
    expect(listImpactStories).not.toHaveBeenCalled();
  });

  it('renders rather than 404s once the flag is on', async () => {
    isFeatureEnabled.mockResolvedValue(true);
    const { default: ImpactPage } = await import('@/app/(public)/impact/page');
    await expect(ImpactPage()).resolves.toBeDefined();
    expect(notFound).not.toHaveBeenCalled();
  });
});

describe('the Impact page is unreachable by link while gated', () => {
  it('is linked from no component, no page, and no route config', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const files: string[] = [];
    (function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        // .ts as well as .tsx: a sitemap.ts, or a route-constants/nav-config
        // .ts file, is framework-conventional plain TypeScript with no JSX,
        // so a .tsx-only scan cannot see it -- and PRD 5.7's "no sitemap
        // entry" vector lives in exactly that kind of file. .d.ts is
        // excluded: it is a type-only declaration file that cannot contain a
        // route reference that resolves to anything.
        else if (
          /\.(ts|tsx)$/.test(entry) &&
          !/\.d\.ts$/.test(entry) &&
          !full.includes(join('impact'))
        )
          files.push(full);
      }
    })('src');

    const offenders = files.filter((file) => /["'`]\/impact\b/.test(readFileSync(file, 'utf8')));
    expect(
      offenders,
      `PRD 5.7: no navigation links to /impact while feature_public_impact_page is off ` +
        `(offending file(s): ${offenders.join(', ') || 'none'})`,
    ).toEqual([]);
  });
});
