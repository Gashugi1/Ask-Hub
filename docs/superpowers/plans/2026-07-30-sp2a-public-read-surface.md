# SP2a Public Read Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the entire anonymous read surface of AskHub — home, directory, resource detail, About, Privacy, Terms and a 404-gated Impact page — reading only the `*_public` views, writing nothing.

**Architecture:** A dedicated no-cookie `anon` Supabase client feeds tagged, cached readers in `src/lib/public/`. Those readers narrow the all-nullable generated view types into non-null domain types once, at the boundary. Server components fetch; presentational components take rows as props, so every band and card renders synchronously and is testable without a request scope. The directory ships every live row to the browser and filters there, with the URL as the single source of filter state.

**Tech Stack:** Next.js 16.2.12 (App Router, Turbopack), React 19.2, TypeScript 5 strict, Tailwind v4 (CSS-first `@theme`), Supabase JS v2, Vitest 4, `write-excel-file` for Excel export, the TypeScript compiler API for the JSX copy guard.

## Deviations from the spec, and why

Four things changed between the spec and this plan. Each is a correction to a spec assumption that did not survive contact with the repository:

1. **A migration is required after all.** The spec says SP2a adds no views. But `/impact` is gated on `settings.feature_public_impact_page`, and `anon` holds **nothing** on `public.settings` — there is no anon-readable path to the flag. Task 1 adds migration `0016_settings_public.sql` projecting **only** the two `feature_*` keys. The alternative — reading the flag with the `service_role` client to render a public page — is exactly the pattern the spec's own "never fall back to the admin client" rule exists to prevent, and CLAUDE.md's "anonymous reads go through public-safe views" is a hard rule.

2. **Excel export does not use SheetJS.** The npm `xlsx` package is frozen at `0.18.5` (verified: `npm view xlsx dist-tags` → `latest: 0.18.5`), which carries CVE-2023-30533 and CVE-2024-22363 with no patched version published to npm. Shipping two open high advisories in a UN programme codebase is not acceptable, and `npm audit` will flag it on every install. This plan uses **`write-excel-file@4.1.1`** (actively maintained, write-only, ~60KB, one dependency: `fflate`) for `.xlsx` and **hand-writes CSV** — CSV needs no library, and a hand-written `toCsvText` is more testable than a library call. The spec's D4 decision is unchanged in substance: client-side, both formats, dynamically imported on first click. The bundle gets smaller, not larger.

3. **Eight tasks, not seven.** The spec's task 1 bundled the layout shell with the data layer. They split cleanly: a reviewer can reject the header/footer while approving the readers. The AST copy guard moves to task 2 alongside the first `.tsx` that has anything to catch.

4. **`unstable_cache`, not `'use cache'`.** Next 16.2 ships `cacheTag`/`cacheLife`, but they require `cacheComponents: true` in `next.config.ts`, which changes data-access semantics across the whole app. `unstable_cache` supports `{ tags, revalidate }` today with zero config. Migrating is a follow-up, not a prerequisite.

## Global Constraints

Every task's requirements implicitly include this section. Values are copied verbatim from `CLAUDE.md` and the spec.

- **Never fabricate data.** Metric panels show true values or explicit empty states. A plausible fake number is a launch-blocking defect.
- **No hardcoded user-facing strings.** Everything goes to `src/locales/en.json` via `t()`. Stubs exist for `fr`, `pt`, `ar`. This is not style — `tests/unit/i18n.test.ts` scans every key for the content rules, and a string written directly into a `.tsx` file escapes every check.
- **Attribution is always "co-led by MIMIT and UNDP".** Never "powered by" or "implemented by".
- **Always "AI Hub" or "AI Hub for Sustainable Development".** Never "the Hub" alone.
- **One mailbox only:** `aihubfordevelopment@undp.org`.
- **No per-resource "Verified" badge.** The word `verified` may appear in `src/` **only** inside the exact string `Every resource is curated and verified by the AI Hub team.` and in the generated `database.types.ts`. `tests/unit/i18n.test.ts` enforces this. Do not write "the verified external URL" in a comment.
- **"Democratic Republic of the Congo" in full.** Never "DRC" or "DR Congo".
- **"CINECA Leonardo" with no "Mattei Plan". No "Global programmes" country filter option.**
- **RLS enabled on every table, deny by default.** A new table without RLS is a defect.
- **`service_role` key is server-only.** It must never appear in a client bundle, and must never render a public page.
- **Anonymous reads go through public-safe views** that exclude views, clicks, CTR, submitter emails and internal notes.
- **No hardcoded colours or type values.** Use the design tokens in the `@theme` block of `src/app/globals.css`. `tests/structure/app-structure.test.ts` fails on any hex/oklch/rgb/hsl literal anywhere else under `src/`.
- **Public pages are cached and revalidated on write** (`revalidateTag` / `revalidatePath`).
- **Deadline past means the resource displays as Closed and is flagged in admin. Its `status` does not change.**
- **Feature flags `feature_innovator_profiles` and `feature_public_impact_page` are both off at launch.** Build the flag, not the feature.
- **Zod at every server boundary. No string-built SQL. No `dangerouslySetInnerHTML` with user content.**
- **Reject SVG uploads and SVG image URLs.**
- **The site serves `noindex` on every page** while gated (`next.config.ts` `X-Robots-Tag` plus root-layout `robots` metadata). Do not remove either.
- **Test the security boundary and the logic, not the presentation.** No markup snapshots, no class-name assertions.
- **Canonical migration grants block**, in this order (see `supabase/migrations/README.md`): `enable row level security` → `revoke all ... from anon, authenticated` → `grant ... to authenticated` → `grant all ... to service_role` → policies. Revoke before grant is load-bearing: a fresh object hands `anon` a `Dxtm` grant including TRUNCATE, which RLS cannot govern.

## File Structure

**New — the public data layer (`src/lib/public/`):**

| File | Responsibility |
|---|---|
| `client.ts` | The no-cookie `anon` Supabase client. Nothing else. |
| `cache.ts` | `CACHE_TAGS` and `RESOURCE_TTL_SECONDS`. Pure constants, imported by SP3. |
| `types.ts` | Domain types (`PublicResource`, `PublicPartner`, …), the row→domain mappers, and `RESOURCE_VIEW_COLUMNS` — the compile-time proof that every exported column is a real `resources_public` column. |
| `readers.ts` | One cached reader per dataset. The only module that touches the anon client. |
| `filters.ts` | `parseFilters`, `toSearchParams`, `filterResources`, `sortResources`. Pure. |
| `deadline-label.ts` | `deadlineLabel`. Pure formatter over SQL-supplied state. |
| `export.ts` | `EXPORT_COLUMNS`, `toCsvText`, `downloadCsv`, `downloadXlsx`. |
| `jsonld.ts` | `resourceJsonLd`. Pure builder. |

**New — components (`src/components/public/`):**

`SiteHeader.tsx`, `SiteFooter.tsx`, `ResourceCard.tsx`, `NeedBadge.tsx`, `ResourceDirectory.tsx` (client), `FilterControls.tsx` (client), `ExportButton.tsx` (client), `ShareModal.tsx` (client), `StatsBand.tsx`, `PartnerRow.tsx`, `FeaturedCarousel.tsx`, `RecentlyAddedRail.tsx`, `BrowseByNeed.tsx`, `WelcomeBand.tsx`.

**New — routes:** `src/app/(public)/resources/[id]/page.tsx`, `about/page.tsx`, `privacy/page.tsx`, `terms/page.tsx`, `impact/page.tsx`, plus `error.tsx` at `(public)/` and `(public)/resources/[id]/`.

**Modified:** `src/app/(public)/layout.tsx`, `src/app/(public)/page.tsx`, `src/locales/*.json`, `tests/structure/routes.test.ts`, `tests/rls/security-allowlist.ts`, `package.json`, `src/lib/supabase/database.types.ts` (regenerated).

**New — migration:** `supabase/migrations/0016_settings_public.sql`.

---

### Task 1: The public data layer

**Files:**
- Create: `supabase/migrations/0016_settings_public.sql`
- Create: `src/lib/public/client.ts`, `src/lib/public/cache.ts`, `src/lib/public/types.ts`, `src/lib/public/readers.ts`
- Create: `tests/unit/public-types.test.ts`, `tests/rls/settings-public.test.ts`
- Modify: `tests/rls/security-allowlist.ts` (add one entry, bump `EXPECTED_ANON_SELECTABLE` 8 → 9)
- Modify: `tests/rls/public-views.test.ts` (add `settings_public` to `PUBLIC_VIEWS` and `WRITABLE_SHAPE_VIEWS` and give it an `INSERT_PAYLOAD` entry)
- Regenerate: `src/lib/supabase/database.types.ts` via `npm run db:types`

**Interfaces:**
- Consumes: `Database` from `@/lib/supabase/database.types`; the eight existing `*_public` views.
- Produces:
  ```ts
  // src/lib/public/cache.ts
  export const CACHE_TAGS: {
    readonly resources: 'resources';
    readonly partners: 'partners';
    readonly siteContent: 'site-content';
    readonly headlineStats: 'headline-stats';
    readonly impactStories: 'impact-stories';
    readonly settings: 'settings';
  };
  export const RESOURCE_TTL_SECONDS: number;

  // src/lib/public/types.ts
  export type NeedKey = Database['public']['Enums']['need_type'];
  export type GeoScope = Database['public']['Enums']['geo_scope'];
  export type Exclusivity = Database['public']['Enums']['exclusivity'];
  export type PartnerTier = Database['public']['Enums']['partner_tier'];
  export interface PublicResource { /* see Step 6 */ }
  export interface PublicPartner { name: string; logoUrl: string | null; websiteUrl: string | null; sortOrder: number }
  export interface PublicStat { id: string; value: string; label: string; isHero: boolean; sortOrder: number }
  export interface PublicStory { id: string; organisation: string; country: string | null; description: string | null; sortOrder: number }
  export interface NeedCount { need: NeedKey; liveCount: number }
  export const RESOURCE_VIEW_COLUMNS: Record<keyof PublicResource, keyof ResourceRow>;
  export function toPublicResource(row: ResourceRow): PublicResource;   // throws on a null NOT NULL column

  // src/lib/public/readers.ts
  export function listPublicResources(): Promise<PublicResource[]>;
  export function getPublicResource(id: string): Promise<PublicResource | null>;
  export function listNeedCounts(): Promise<NeedCount[]>;
  export function listPublicPartners(): Promise<PublicPartner[]>;
  export function getSiteContent(): Promise<Record<string, string>>;
  export function listHeadlineStats(): Promise<PublicStat[]>;
  export function listImpactStories(): Promise<PublicStory[]>;
  export function isFeatureEnabled(key: 'feature_public_impact_page' | 'feature_innovator_profiles'): Promise<boolean>;
  ```

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0016_settings_public.sql`:

```sql
-- Feature flags are the one row class in public.settings a public page must
-- read: /impact is built and 404-gated on feature_public_impact_page (PRD 5.7).
-- anon holds nothing on public.settings, so without this view the only way to
-- resolve the flag while rendering a public page is the service_role client --
-- which would put a key that bypasses RLS entirely on the critical path of an
-- anonymous page render. CLAUDE.md is explicit that anonymous reads go through
-- public-safe views; this is that view.
--
-- The where clause is an allow-list, not a deny-list. settings also holds
-- ga4_property_id and contact_email; a deny-list would expose the next key
-- anyone adds. Adding a key to the public surface must be a deliberate edit
-- here, visible in a diff.
create view public.settings_public
with (security_invoker = false) as
select s.key, s.value
from public.settings s
where s.key in ('feature_innovator_profiles', 'feature_public_impact_page');

-- Same pg_default_acl residue every view in this schema picks up the moment
-- it is created: a bare `create view` hands anon a `Dxtm` grant (TRUNCATE,
-- REFERENCES, TRIGGER, MAINTAIN), not merely nothing. Revoke before granting.
revoke all on public.settings_public from anon, authenticated;
grant select on public.settings_public to anon, authenticated;

comment on view public.settings_public is
  'Public-safe projection of the two feature flags only. Never widen the key allow-list without a matching entry in tests/rls/security-allowlist.ts.';
```

- [ ] **Step 2: Add the allow-list entry and bump the count**

In `tests/rls/security-allowlist.ts`, add to `ANON_SELECTABLE`:

```ts
  settings_public: {
    approvedIn: 'SP2a-T1',
    why: 'Allow-listed projection of the two feature flag rows so a public page can resolve feature_public_impact_page without the service_role client; no other settings key is projected.',
  },
```

and change the final constant:

```ts
export const EXPECTED_ANON_SELECTABLE = 9;
```

- [ ] **Step 3: Write the failing RLS test**

Create `tests/rls/settings-public.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { anonClient, serviceClient } from '../helpers/clients';

describe('settings_public', () => {
  beforeAll(async () => {
    // The two flags are inserted by migration 0006 and are never deleted.
    const { data } = await serviceClient()
      .from('settings')
      .select('key')
      .eq('key', 'feature_public_impact_page');
    expect(data?.length, 'migration 0006 must have seeded the flag').toBe(1);
  });

  it('lets anon read exactly the two feature flags', async () => {
    const { data, error } = await anonClient()
      .from('settings_public')
      .select('key, value');
    expect(error).toBeNull();
    expect((data ?? []).map((r) => r.key).sort()).toEqual([
      'feature_innovator_profiles',
      'feature_public_impact_page',
    ]);
  });

  it('projects no other settings key to anon', async () => {
    const { data } = await anonClient().from('settings_public').select('key');
    for (const forbidden of ['ga4_measurement_id', 'ga4_property_id', 'contact_email']) {
      expect(
        (data ?? []).map((r) => r.key),
        `${forbidden} must not reach the public projection`,
      ).not.toContain(forbidden);
    }
  });

  it('still denies anon the settings base table', async () => {
    const { error } = await anonClient().from('settings').select('key');
    expect(error).not.toBeNull();
  });

});
```

The write-denial case is **not** duplicated here. `tests/rls/public-views.test.ts` already loops every public view asserting `42501` on insert and update, with a per-view payload valid for that view's real columns — so a missing-column error cannot masquerade as a permission denial. `settings_public` joins that loop in the next step; this file covers only what is specific to it, the key allow-list.

- [ ] **Step 3b: Add the new view to the shared public-view loops**

In `tests/rls/public-views.test.ts`:

- Add `'settings_public'` to `PUBLIC_VIEWS`.
- Add `'settings_public'` to `WRITABLE_SHAPE_VIEWS` — it is a single-table projection with no join and no aggregate, so Postgres considers it auto-updatable, which is exactly why the write-denial assertion on it is meaningful rather than passing for the wrong reason.
- Add an `INSERT_PAYLOAD` entry: `settings_public: { key: 'probe', value: true }`.
- Add an `UPDATE_PAYLOAD` entry: `settings_public: { value: true }`, and an `UPDATE_FILTER` entry: `settings_public: ['key', 'feature_public_impact_page']`.

Update the comment above `PUBLIC_VIEWS` to say nine views and name SP2a Task 1 as where the ninth came from, in the same style as the existing note about `partners_public`.

**Two spec test rows are already covered by SP1 and are not rewritten here.** `public-views.test.ts` asserts the SQL deadline boundary (`deadline = current_date` → `is_closed = false`, `days_left = 0`; a past deadline → `is_closed = true`, `days_left < 0`; no deadline → `days_left` null) and asserts that a `pipeline` resource is invisible to `anon` while a `live` one is visible. Duplicating either would add a second place to update, not a second guarantee.

- [ ] **Step 4: Run the migration and the test to verify it fails**

Run: `npm run db:reset && npx vitest run tests/rls/settings-public.test.ts`
Expected before applying the migration: FAIL. After `db:reset` applies `0016`, it should PASS and `tests/rls/schema-guards.test.ts` should pass with the bumped count.

Run: `npm run db:types` to regenerate `src/lib/supabase/database.types.ts`. Verify `settings_public` appears under `Database['public']['Views']`.

- [ ] **Step 5: Write the anon client**

Create `src/lib/public/client.ts`:

```ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

/**
 * The public site's only database client.
 *
 * Deliberately NOT the request-scoped `createServerSupabase()`: that one
 * carries the caller's cookies, so an admin browsing the public site would
 * read the views as `authenticated` rather than as `anon`, and the pages
 * they cached would be the ones every anonymous visitor then received.
 * A cookie-free client makes every public read identical for every visitor,
 * which is what makes the response cacheable at all.
 *
 * Deliberately NOT the `service_role` client either, and that is not a style
 * preference: `service_role` holds no SELECT on any `*_public` view (the
 * grant is `to anon, authenticated`), so reaching for it here returns 42501.
 * Never "fix" a failing public read by swapping this client for the admin one
 * -- the failure is the signal, and the views are the public contract.
 */
export function createPublicSupabase() {
  // Named, not valued. Never interpolate a key into a thrown message.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

- [ ] **Step 6: Write the cache constants**

Create `src/lib/public/cache.ts`:

```ts
/**
 * Cache tags for the public read surface. SP3's editor save actions call
 * `revalidateTag` with these after a successful transaction; nothing
 * invalidates them until then. Exported as the SP2a/SP3 interface so two
 * sub-projects cannot invent two spellings of the same tag.
 *
 * Tags are dependency-specific rather than one global 'public' tag: an edit
 * to a partner logo should not evict the whole directory.
 */
export const CACHE_TAGS = {
  resources: 'resources',
  partners: 'partners',
  siteContent: 'site-content',
  headlineStats: 'headline-stats',
  impactStories: 'impact-stories',
  settings: 'settings',
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

/**
 * How long a cached `resources_public` read may live before it is recomputed
 * regardless of whether anything was edited.
 *
 * This exists because time passes without a database edit. `is_closed` and
 * `days_left` are computed in SQL from `current_date`, so a page cached at
 * 23:50 with "1 day left" keeps serving that after midnight -- no editor
 * touched anything, so no tag is invalidated and tag invalidation alone
 * would never correct it.
 *
 * **Maximum deadline-display staleness is therefore RESOURCE_TTL_SECONDS
 * after UTC midnight.** The database timezone is UTC (`show timezone`
 * returns UTC), so the day boundary is UTC midnight -- a product decision,
 * not a session default. At 900s that is a 15-minute worst case, which is
 * well inside "shows Closed the morning after" and cheap enough to serve
 * from cache the rest of the day.
 */
export const RESOURCE_TTL_SECONDS = 900;
```

- [ ] **Step 7: Write the failing type/mapper test**

Create `tests/unit/public-types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  toPublicResource,
  RESOURCE_VIEW_COLUMNS,
  type PublicResource,
} from '@/lib/public/types';
import type { Database } from '@/lib/supabase/database.types';

type ResourceRow = Database['public']['Views']['resources_public']['Row'];

/** A row with every NOT NULL base column populated. */
function row(overrides: Partial<ResourceRow> = {}): ResourceRow {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'GPU allocation programme',
    partner_name: 'CINECA / AI Hub',
    partner_logo_url: null,
    partner_website_url: null,
    partner_tier: 'strategic',
    resource_type: 'Credits',
    need_primary: 'compute',
    need_secondary: null,
    sub_category: 'HPC allocation',
    description: 'Leonardo GPU hours for African AI teams.',
    description_fr: null,
    description_pt: null,
    description_ar: null,
    action_label: 'Apply',
    external_url: 'https://example.org/apply',
    banner_image_url: null,
    countries_eligible: ['Kenya'],
    sectors_eligible: [],
    stages_eligible: ['Building'],
    geo_scope: 'partner_countries',
    deadline: '2026-09-01',
    is_featured: true,
    exclusivity: 'exclusive',
    sort_order: 10,
    added_date: '2026-07-01',
    is_closed: false,
    days_left: 33,
    ...overrides,
  };
}

describe('toPublicResource', () => {
  it('maps every field of a complete row', () => {
    const mapped = toPublicResource(row());
    expect(mapped).toEqual<PublicResource>({
      id: '00000000-0000-0000-0000-000000000001',
      name: 'GPU allocation programme',
      partnerName: 'CINECA / AI Hub',
      partnerLogoUrl: null,
      partnerWebsiteUrl: null,
      partnerTier: 'strategic',
      resourceType: 'Credits',
      needPrimary: 'compute',
      needSecondary: null,
      subCategory: 'HPC allocation',
      description: 'Leonardo GPU hours for African AI teams.',
      actionLabel: 'Apply',
      externalUrl: 'https://example.org/apply',
      bannerImageUrl: null,
      countriesEligible: ['Kenya'],
      sectorsEligible: [],
      stagesEligible: ['Building'],
      geoScope: 'partner_countries',
      deadline: '2026-09-01',
      isFeatured: true,
      exclusivity: 'exclusive',
      sortOrder: 10,
      addedDate: '2026-07-01',
      isClosed: false,
      daysLeft: 33,
    });
  });

  it('defaults absent array columns to empty arrays, not null', () => {
    const mapped = toPublicResource(
      row({ countries_eligible: null, sectors_eligible: null, stages_eligible: null }),
    );
    expect(mapped.countriesEligible).toEqual([]);
    expect(mapped.sectorsEligible).toEqual([]);
    expect(mapped.stagesEligible).toEqual([]);
  });

  it('throws rather than dropping a row whose NOT NULL column arrived null', () => {
    // The view types are all-nullable because Postgres views lose NOT NULL,
    // but `resources.name` IS NOT NULL, so this cannot happen. If it ever
    // does, one fewer row in the directory with no error is the worst
    // available failure -- nothing looks broken. Fail loudly instead.
    expect(() => toPublicResource(row({ name: null }))).toThrow(/name/);
    expect(() => toPublicResource(row({ id: null }))).toThrow(/id/);
    expect(() => toPublicResource(row({ partner_name: null }))).toThrow(/partner_name/);
  });
});

describe('RESOURCE_VIEW_COLUMNS', () => {
  it('names a real resources_public column for every domain field', () => {
    // The Record type already forces the values to be `keyof ResourceRow`,
    // so this asserts the pairing is exhaustive at runtime too: a domain
    // field added without a column mapping fails typecheck, and a mapping
    // left behind after a field is removed fails here.
    const domainFields = Object.keys(toPublicResource(row())).sort();
    expect(Object.keys(RESOURCE_VIEW_COLUMNS).sort()).toEqual(domainFields);
  });

  it('maps to no analytics or internal column', () => {
    // CLAUDE.md: anonymous reads exclude views, clicks, CTR, submitter
    // emails and internal notes. resources_public projects none of them, so
    // this cannot fail today -- it fails the day someone widens the view.
    const columns = Object.values(RESOURCE_VIEW_COLUMNS).join(' ');
    for (const forbidden of ['views', 'clicks', 'ctr', 'internal_note', 'submitter', 'status']) {
      expect(columns, `${forbidden} reached the public domain type`).not.toContain(forbidden);
    }
  });
});
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `npx vitest run tests/unit/public-types.test.ts`
Expected: FAIL with "Failed to resolve import @/lib/public/types".

- [ ] **Step 9: Write the types and mappers**

Create `src/lib/public/types.ts`:

```ts
import type { Database } from '@/lib/supabase/database.types';

type ResourceRow = Database['public']['Views']['resources_public']['Row'];
type PartnerRow = Database['public']['Views']['partners_public']['Row'];
type StatRow = Database['public']['Views']['headline_stats_public']['Row'];
type StoryRow = Database['public']['Views']['impact_stories_public']['Row'];
type NeedCountRow = Database['public']['Views']['need_counts_public']['Row'];

export type NeedKey = Database['public']['Enums']['need_type'];
export type GeoScope = Database['public']['Enums']['geo_scope'];
export type Exclusivity = Database['public']['Enums']['exclusivity'];
export type PartnerTier = Database['public']['Enums']['partner_tier'];

/**
 * The shape the public UI consumes.
 *
 * Postgres discards NOT NULL when a column passes through a view, so every
 * field of the generated `Row` types is `| null`. Narrowing once here, at the
 * boundary, is what keeps `?? ''` out of every component -- and turns the
 * one place the database contract could be violated into one function with
 * its own test, rather than thirty silent coalesces.
 */
export interface PublicResource {
  id: string;
  name: string;
  partnerName: string;
  partnerLogoUrl: string | null;
  partnerWebsiteUrl: string | null;
  partnerTier: PartnerTier;
  resourceType: string | null;
  needPrimary: NeedKey;
  needSecondary: NeedKey | null;
  subCategory: string | null;
  description: string | null;
  actionLabel: string | null;
  externalUrl: string | null;
  bannerImageUrl: string | null;
  countriesEligible: string[];
  sectorsEligible: string[];
  stagesEligible: string[];
  geoScope: GeoScope;
  deadline: string | null;
  isFeatured: boolean;
  exclusivity: Exclusivity | null;
  sortOrder: number;
  addedDate: string | null;
  /** Computed in SQL from current_date. Never recomputed in TypeScript. */
  isClosed: boolean;
  /** Computed in SQL: deadline - current_date. Null when there is no deadline. */
  daysLeft: number | null;
}

/**
 * Which `resources_public` column each domain field came from.
 *
 * Typed `Record<keyof PublicResource, keyof ResourceRow>` so the compiler
 * proves two things the export feature depends on: the mapping is exhaustive,
 * and every value names a column that actually exists on the public view.
 * `EXPORT_COLUMNS` is then `readonly (keyof PublicResource)[]`, which makes
 * "the export is a subset of the public view" a type-level fact rather than
 * something a reviewer has to check by eye (PRD 5.2, CLAUDE.md).
 */
export const RESOURCE_VIEW_COLUMNS: Record<keyof PublicResource, keyof ResourceRow> = {
  id: 'id',
  name: 'name',
  partnerName: 'partner_name',
  partnerLogoUrl: 'partner_logo_url',
  partnerWebsiteUrl: 'partner_website_url',
  partnerTier: 'partner_tier',
  resourceType: 'resource_type',
  needPrimary: 'need_primary',
  needSecondary: 'need_secondary',
  subCategory: 'sub_category',
  description: 'description',
  actionLabel: 'action_label',
  externalUrl: 'external_url',
  bannerImageUrl: 'banner_image_url',
  countriesEligible: 'countries_eligible',
  sectorsEligible: 'sectors_eligible',
  stagesEligible: 'stages_eligible',
  geoScope: 'geo_scope',
  deadline: 'deadline',
  isFeatured: 'is_featured',
  exclusivity: 'exclusivity',
  sortOrder: 'sort_order',
  addedDate: 'added_date',
  isClosed: 'is_closed',
  daysLeft: 'days_left',
};

/**
 * Narrow a column the base table declares NOT NULL, or say which one broke.
 *
 * Takes the relation name because every mapper in this file calls it: without
 * it, a null `partners_public.name` reports as `resources_public.name` and
 * sends whoever is debugging to the wrong view.
 */
function required<T>(value: T | null | undefined, relation: string, column: string): T {
  if (value === null || value === undefined) {
    throw new Error(
      `${relation}.${column} was null; the base column is NOT NULL, so the view or the migration has changed`,
    );
  }
  return value;
}

export function toPublicResource(row: ResourceRow): PublicResource {
  return {
    id: required(row.id, 'resources_public', 'id'),
    name: required(row.name, 'resources_public', 'name'),
    partnerName: required(row.partner_name, 'resources_public', 'partner_name'),
    partnerLogoUrl: row.partner_logo_url,
    partnerWebsiteUrl: row.partner_website_url,
    partnerTier: required(row.partner_tier, 'resources_public', 'partner_tier'),
    resourceType: row.resource_type,
    needPrimary: required(row.need_primary, 'resources_public', 'need_primary'),
    needSecondary: row.need_secondary,
    subCategory: row.sub_category,
    description: row.description,
    actionLabel: row.action_label,
    externalUrl: row.external_url,
    bannerImageUrl: row.banner_image_url,
    countriesEligible: row.countries_eligible ?? [],
    sectorsEligible: row.sectors_eligible ?? [],
    stagesEligible: row.stages_eligible ?? [],
    geoScope: required(row.geo_scope, 'resources_public', 'geo_scope'),
    deadline: row.deadline,
    // NOT NULL in the base table, and is_closed is computed in the view, so
    // none of these three can arrive null. They go through required() rather
    // than coalescing for the same reason id and name do -- and isClosed
    // especially: coalescing it to false would render a resource whose
    // deadline has passed as open, inviting an application to a programme
    // that has ended. A null here means the view changed underneath us, and
    // saying so beats picking an answer. Ruled by the human on 2026-07-30
    // after the Task 1 review flagged the original `?? false`.
    isFeatured: required(row.is_featured, 'resources_public', 'is_featured'),
    exclusivity: row.exclusivity,
    // sort_order is NULLABLE in every base table that has one (verified
    // against information_schema), so it coalesces rather than throwing.
    sortOrder: row.sort_order ?? 0,
    addedDate: row.added_date,
    isClosed: required(row.is_closed, 'resources_public', 'is_closed'),
    daysLeft: row.days_left,
  };
}

export interface PublicPartner {
  name: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  sortOrder: number;
}

export function toPublicPartner(row: PartnerRow): PublicPartner {
  return {
    name: required(row.name, 'partners_public', 'name'),
    logoUrl: row.logo_url,
    websiteUrl: row.website_url,
    sortOrder: row.sort_order ?? 0,
  };
}

export interface PublicStat {
  id: string;
  value: string;
  label: string;
  isHero: boolean;
  sortOrder: number;
}

export function toPublicStat(row: StatRow): PublicStat {
  return {
    id: required(row.id, 'headline_stats_public', 'id'),
    value: required(row.value, 'headline_stats_public', 'value'),
    label: required(row.label, 'headline_stats_public', 'label'),
    isHero: required(row.is_hero, 'headline_stats_public', 'is_hero'),
    sortOrder: row.sort_order ?? 0,
  };
}

export interface PublicStory {
  id: string;
  organisation: string;
  country: string | null;
  description: string | null;
  sortOrder: number;
}

export function toPublicStory(row: StoryRow): PublicStory {
  return {
    id: required(row.id, 'impact_stories_public', 'id'),
    organisation: required(row.organisation, 'impact_stories_public', 'organisation'),
    country: row.country,
    description: row.description,
    sortOrder: row.sort_order ?? 0,
  };
}

export interface NeedCount {
  need: NeedKey;
  liveCount: number;
}

export function toNeedCount(row: NeedCountRow): NeedCount {
  return {
    need: required(row.need_primary, 'need_counts_public', 'need_primary'),
    // count(*)::integer in a grouped view is never null in SQL, but
    // live_count is not a base column, so information_schema cannot vouch
    // for it the way it can for the others. required() is still the right
    // call: a null here would mean the aggregate stopped being an aggregate.
    liveCount: required(row.live_count, 'need_counts_public', 'live_count'),
  };
}
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `npx vitest run tests/unit/public-types.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 11: Write the readers**

Create `src/lib/public/readers.ts`:

```ts
import 'server-only';
import { unstable_cache } from 'next/cache';
import { createPublicSupabase } from './client';
import { CACHE_TAGS, RESOURCE_TTL_SECONDS } from './cache';
import {
  toPublicResource,
  toPublicPartner,
  toPublicStat,
  toPublicStory,
  toNeedCount,
  type PublicResource,
  type PublicPartner,
  type PublicStat,
  type PublicStory,
  type NeedCount,
} from './types';

/**
 * The public site's cached readers. This is the only module that touches the
 * anon client.
 *
 * `unstable_cache` rather than `'use cache'`: the newer directive needs
 * `cacheComponents: true` in next.config.ts, which changes data-access
 * semantics app-wide. Migrating is a follow-up, not a prerequisite.
 *
 * A read error throws. It does not return an empty array and it does not
 * retry with a more privileged client: an empty directory and a broken
 * directory look identical to a visitor, and only one of them is honest.
 */
function fail(what: string, message: string): never {
  throw new Error(`public read failed (${what}): ${message}`);
}

export const listPublicResources = unstable_cache(
  async (): Promise<PublicResource[]> => {
    const { data, error } = await createPublicSupabase()
      .from('resources_public')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });
    if (error) fail('resources_public', error.message);
    return (data ?? []).map(toPublicResource);
  },
  ['public:resources'],
  // The only reader with a TTL. See RESOURCE_TTL_SECONDS for why: is_closed
  // and days_left move with the clock, so tag invalidation alone is not
  // sufficient. Every other reader is tag-only and caches indefinitely.
  { tags: [CACHE_TAGS.resources], revalidate: RESOURCE_TTL_SECONDS },
);

export async function getPublicResource(id: string): Promise<PublicResource | null> {
  // Served from the same cached list rather than a per-id query: the list is
  // already in cache for the directory, and a second cache entry per resource
  // would need its own invalidation. Absent from the list means absent from
  // resources_public, which means status is not 'live'.
  const all = await listPublicResources();
  return all.find((r) => r.id === id) ?? null;
}

export const listNeedCounts = unstable_cache(
  async (): Promise<NeedCount[]> => {
    const { data, error } = await createPublicSupabase()
      .from('need_counts_public')
      .select('*');
    if (error) fail('need_counts_public', error.message);
    return (data ?? []).map(toNeedCount);
  },
  ['public:need-counts'],
  // Resource-derived but not deadline-derived: the view groups by
  // need_primary where status = 'live' and contains no current_date, so it
  // needs the resources tag and no TTL.
  { tags: [CACHE_TAGS.resources] },
);

export const listPublicPartners = unstable_cache(
  async (): Promise<PublicPartner[]> => {
    const { data, error } = await createPublicSupabase()
      .from('partners_public')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) fail('partners_public', error.message);
    return (data ?? []).map(toPublicPartner);
  },
  ['public:partners'],
  { tags: [CACHE_TAGS.partners] },
);

export const getSiteContent = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const { data, error } = await createPublicSupabase()
      .from('site_content_public')
      .select('key, value, locale')
      .eq('locale', 'en');
    if (error) fail('site_content_public', error.message);
    const out: Record<string, string> = {};
    for (const row of data ?? []) {
      if (row.key !== null && row.value !== null) out[row.key] = row.value;
    }
    return out;
  },
  ['public:site-content'],
  { tags: [CACHE_TAGS.siteContent] },
);

export const listHeadlineStats = unstable_cache(
  async (): Promise<PublicStat[]> => {
    const { data, error } = await createPublicSupabase()
      .from('headline_stats_public')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) fail('headline_stats_public', error.message);
    return (data ?? []).map(toPublicStat);
  },
  ['public:headline-stats'],
  { tags: [CACHE_TAGS.headlineStats] },
);

export const listImpactStories = unstable_cache(
  async (): Promise<PublicStory[]> => {
    const { data, error } = await createPublicSupabase()
      .from('impact_stories_public')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) fail('impact_stories_public', error.message);
    return (data ?? []).map(toPublicStory);
  },
  ['public:impact-stories'],
  { tags: [CACHE_TAGS.impactStories] },
);

const readFlags = unstable_cache(
  async (): Promise<Record<string, boolean>> => {
    const { data, error } = await createPublicSupabase()
      .from('settings_public')
      .select('key, value');
    if (error) fail('settings_public', error.message);
    const out: Record<string, boolean> = {};
    for (const row of data ?? []) {
      if (row.key !== null) out[row.key] = row.value === true;
    }
    return out;
  },
  ['public:settings'],
  { tags: [CACHE_TAGS.settings] },
);

/**
 * Both flags are off at launch (PRD 7). A missing or non-boolean value reads
 * as false: a feature flag that fails open would ship an unfinished page.
 */
export async function isFeatureEnabled(
  key: 'feature_public_impact_page' | 'feature_innovator_profiles',
): Promise<boolean> {
  return (await readFlags())[key] ?? false;
}
```

- [ ] **Step 12: Verify the whole suite, typecheck and lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS. `tests/rls/schema-guards.test.ts` must pass with `EXPECTED_ANON_SELECTABLE = 9`.

- [ ] **Step 13: Commit**

```bash
git add supabase/migrations/0016_settings_public.sql src/lib/public src/lib/supabase/database.types.ts tests/unit/public-types.test.ts tests/rls/settings-public.test.ts tests/rls/security-allowlist.ts
git commit -m "feat(public): cached anon read layer and settings_public flag view

anon holds nothing on public.settings, so /impact had no anonymous path to
feature_public_impact_page. Migration 0016 adds an allow-listed projection of
the two feature flag keys only -- the alternative was rendering a public page
through the service_role client, which is the pattern the public-view rule
exists to prevent.

The readers narrow the all-nullable generated view types once, at the
boundary, and throw rather than dropping a row whose NOT NULL column arrived
null: one fewer resource with no error is the worst failure available.
resources_public is the only reader with a TTL, because is_closed and
days_left move with the clock and tag invalidation alone would never
correct them."
```

---

### Task 2: The JSX copy guard, and the layout shell it polices

**Files:**
- Create: `tests/structure/no-hardcoded-copy.test.ts`, `tests/structure/jsx-literals.ts`, `tests/structure/jsx-literals.test.ts`
- Create: `src/components/public/SiteHeader.tsx`, `src/components/public/SiteFooter.tsx`
- Modify: `src/app/(public)/layout.tsx`, `src/locales/en.json`
- Modify: `tests/structure/routes.test.ts` (drop the public home from the placeholder list)

**Interfaces:**
- Consumes: `t` from `@/lib/i18n`.
- Produces:
  ```ts
  // tests/structure/jsx-literals.ts
  export interface Literal { file: string; line: number; text: string; kind: 'text' | 'child' | 'attribute'; attribute?: string }
  export function findUserFacingLiterals(file: string, code: string): Literal[];
  export function isAllowedLiteral(text: string): boolean;
  // src/components/public/SiteHeader.tsx, SiteFooter.tsx: default exports, no props.
  ```

**Why the guard comes before the first component:** `tests/unit/i18n.test.ts` scans every key in `en.json` for the content rules — co-led attribution, never "the Hub" alone, one mailbox, no per-resource "Verified". A string written directly into a `.tsx` file never reaches `en.json` and escapes all of it. The no-hardcoded-strings convention is not a style preference here; it is the mechanism that makes the content rules enforceable at all. Writing the guard first means every component from here on is held to it as it is written, rather than retrofitted at the end.

- [ ] **Step 1: Write the failing test for the literal finder**

Create `tests/structure/jsx-literals.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { findUserFacingLiterals, isAllowedLiteral } from './jsx-literals';

function find(code: string) {
  return findUserFacingLiterals('probe.tsx', code).map((l) => l.text);
}

describe('isAllowedLiteral', () => {
  it('allows punctuation and separators', () => {
    for (const text of ['·', '—', '/', '&', '·  ·', '()', ':']) {
      expect(isAllowedLiteral(text), text).toBe(true);
    }
  });

  it('allows urls and paths', () => {
    for (const text of ['https://example.org', 'mailto:x@y.org', '/resources', 'tel:+100']) {
      expect(isAllowedLiteral(text), text).toBe(true);
    }
  });

  it('allows dotted and hyphenated technical identifiers', () => {
    for (const text of ['application/ld+json', 'site.footer', 'data-route', 'utf-8']) {
      expect(isAllowedLiteral(text), text).toBe(true);
    }
  });

  it('rejects any bare word or sentence', () => {
    for (const text of ['Apply', 'Compute', 'Closed', 'Search resources', 'No results found']) {
      expect(isAllowedLiteral(text), text).toBe(false);
    }
  });
});

describe('findUserFacingLiterals', () => {
  it('flags a JSX text node', () => {
    expect(find('const A = () => <p>Apply now</p>;')).toEqual(['Apply now']);
  });

  it('flags a string expression child', () => {
    expect(find("const A = () => <p>{'Apply now'}</p>;")).toEqual(['Apply now']);
  });

  it('flags a template literal child with no substitutions', () => {
    expect(find('const A = () => <p>{`Apply now`}</p>;')).toEqual(['Apply now']);
  });

  it('flags the four user-facing attributes', () => {
    const code = `
      const A = () => (
        <div>
          <button aria-label="Close the dialog" />
          <abbr title="United Nations" />
          <input placeholder="Search resources" />
          <img alt="Partner logo" />
        </div>
      );`;
    expect(find(code).sort()).toEqual(
      ['Close the dialog', 'Partner logo', 'Search resources', 'United Nations'].sort(),
    );
  });

  it('ignores className, data attributes, href and other non-copy attributes', () => {
    const code = `
      const A = () => (
        <a className="text-navy underline" data-route="/about" href="/about" rel="noopener" target="_blank" id="apply" />
      );`;
    expect(find(code)).toEqual([]);
  });

  it('ignores a t() call and any other expression', () => {
    expect(find("const A = () => <p>{t('cta.apply')}</p>;")).toEqual([]);
    expect(find('const A = () => <p>{resource.name}</p>;')).toEqual([]);
  });

  it('ignores whitespace-only text between elements', () => {
    expect(find('const A = () => (\n  <div>\n    <span />\n  </div>\n);')).toEqual([]);
  });

  it('honours a per-occurrence exemption comment on the same line', () => {
    const code = 'const A = () => <p>AskHub</p>; // i18n-exempt: product name, never translated';
    expect(find(code)).toEqual([]);
  });

  it('honours a per-occurrence exemption comment on the line above', () => {
    const code = [
      'const A = () => (',
      '  // i18n-exempt: product name, never translated',
      '  <p>AskHub</p>',
      ');',
    ].join('\n');
    expect(find(code)).toEqual([]);
  });

  it('reports the line number of each offender', () => {
    const code = ['const A = () => (', '  <p>Apply now</p>', ');'].join('\n');
    expect(findUserFacingLiterals('probe.tsx', code)[0]?.line).toBe(2);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/structure/jsx-literals.test.ts`
Expected: FAIL with "Failed to resolve import ./jsx-literals".

- [ ] **Step 3: Implement the literal finder**

Create `tests/structure/jsx-literals.ts`:

```ts
import ts from 'typescript';

/**
 * A user-facing string literal found in JSX.
 *
 * Built on the TypeScript compiler API rather than a regex, and that is not
 * fastidiousness: a regex over JSX cannot tell a text node from a class name.
 * `className="text-navy underline"` and `<p>Apply now</p>` are both quoted
 * English-ish text on a line of JSX, and only one of them is a defect. The
 * parser knows which node is which; a pattern never will.
 *
 * `typescript` is already a devDependency, so this adds no package.
 */
export interface Literal {
  file: string;
  line: number;
  text: string;
  kind: 'text' | 'child' | 'attribute';
  attribute?: string;
}

/** The attributes a visitor actually reads. Everything else is machinery. */
const USER_FACING_ATTRIBUTES = new Set(['aria-label', 'title', 'placeholder', 'alt']);

const EXEMPT = /\/\/\s*i18n-exempt:\s*\S/;

/**
 * Literals that cannot be user-facing copy. Deliberately narrow: anything
 * containing a bare word is copy until proven otherwise, because the failure
 * mode of a too-permissive rule is a content-rule violation nobody catches.
 */
export function isAllowedLiteral(raw: string): boolean {
  const text = raw.trim();
  if (text === '') return true;
  // Punctuation, symbols and separators only -- no letters, no digits.
  if (/^[^\p{L}\p{N}]+$/u.test(text)) return true;
  // URLs, mail and tel links, and root-relative paths.
  if (/^(?:https?:\/\/|mailto:|tel:|\/)\S*$/.test(text)) return true;
  // Technical identifiers and schema keys: no whitespace, and at least one
  // dot, hyphen, slash, plus or underscore joining alphanumeric parts. This
  // admits `site.footer` and `application/ld+json` but never `Apply`.
  if (/^[A-Za-z0-9]+(?:[.\-_/+][A-Za-z0-9]+)+$/.test(text)) return true;
  return false;
}

export function findUserFacingLiterals(file: string, code: string): Literal[] {
  const source = ts.createSourceFile(
    file,
    code,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
  );
  const lines = code.split('\n');
  const found: Literal[] = [];

  /** 1-indexed line of a node's start position. */
  function lineOf(node: ts.Node): number {
    return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  }

  /**
   * An exemption is per-occurrence and must carry a reason: on the offending
   * line, or on the line immediately above it. There is deliberately no
   * file-level or directory-level escape -- a broad exemption silently
   * un-polices everything added to that file later, and nobody re-reads it.
   */
  function exempt(line: number): boolean {
    const own = lines[line - 1] ?? '';
    const above = lines[line - 2] ?? '';
    return EXEMPT.test(own) || EXEMPT.test(above);
  }

  function record(node: ts.Node, text: string, kind: Literal['kind'], attribute?: string) {
    if (isAllowedLiteral(text)) return;
    const line = lineOf(node);
    if (exempt(line)) return;
    found.push({ file, line, text: text.trim(), kind, ...(attribute ? { attribute } : {}) });
  }

  /** The string a node contributes, if it is a bare string with no interpolation. */
  function staticText(node: ts.Node | undefined): string | undefined {
    if (!node) return undefined;
    if (ts.isStringLiteral(node)) return node.text;
    if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    return undefined;
  }

  function visit(node: ts.Node): void {
    if (ts.isJsxText(node)) {
      record(node, node.text, 'text');
    } else if (ts.isJsxExpression(node) && node.parent && isJsxChildHost(node.parent)) {
      const text = staticText(node.expression);
      if (text !== undefined) record(node, text, 'child');
    } else if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(source);
      if (USER_FACING_ATTRIBUTES.has(name)) {
        const init = node.initializer;
        const text =
          init && ts.isJsxExpression(init) ? staticText(init.expression) : staticText(init);
        if (text !== undefined) record(node, text, 'attribute', name);
      }
    }
    ts.forEachChild(node, visit);
  }

  function isJsxChildHost(node: ts.Node): boolean {
    return ts.isJsxElement(node) || ts.isJsxFragment(node);
  }

  visit(source);
  return found;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/structure/jsx-literals.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Write the repo-wide guard**

Create `tests/structure/no-hardcoded-copy.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { findUserFacingLiterals } from './jsx-literals';

/**
 * CLAUDE.md: no hardcoded user-facing strings; everything goes to
 * src/locales/en.json.
 *
 * tests/unit/i18n.test.ts scans every key of en.json for the PRD 10 content
 * rules. A string written straight into a .tsx file never reaches en.json and
 * so escapes every one of those checks -- which is what makes this guard part
 * of the content-rule mechanism rather than a lint preference.
 *
 * Scoped to all of src/, not just the public surface, so SP3's admin screens
 * inherit it as they are written.
 */
function tsxFiles(dir = 'src', out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) tsxFiles(full, out);
    else if (entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

describe('no hardcoded user-facing copy in JSX', () => {
  it('finds no unlocalised text node, string child or user-facing attribute', () => {
    const offenders = tsxFiles()
      .flatMap((file) => findUserFacingLiterals(file, readFileSync(file, 'utf8')))
      .map(
        (l) =>
          `${l.file}:${l.line}: ${l.kind === 'attribute' ? `${l.attribute}=` : ''}"${l.text}"`,
      );

    expect(
      offenders,
      'hardcoded user-facing copy — move it to src/locales/en.json and read it with t(), ' +
        'or add `// i18n-exempt: <reason>` on that line if it genuinely is not copy',
    ).toEqual([]);
  });
});
```

- [ ] **Step 6: Run it against the existing tree**

Run: `npx vitest run tests/structure/no-hardcoded-copy.test.ts`
Expected: PASS — the current `.tsx` files render no text.

- [ ] **Step 7: Add the header and footer locale keys**

Add to `src/locales/en.json`, keeping the file flat and every value non-empty (both are asserted by `tests/unit/i18n.test.ts`):

```json
  "nav.home": "Home",
  "nav.directory": "Browse resources",
  "nav.about": "About",
  "nav.skipToContent": "Skip to content",
  "footer.privacy": "Privacy",
  "footer.terms": "Terms",
  "footer.contact": "Contact",
  "footer.contactPrompt": "Questions about the AI Hub for Sustainable Development?"
```

There is deliberately no `nav.admin` key and no admin link: PRD §5.8 forbids any login link or admin reference in public navigation, and the prototype's uppercase "ADMIN" header button is the exact thing not to copy.

- [ ] **Step 8: Write the header and footer**

Create `src/components/public/SiteHeader.tsx`:

```tsx
import Link from 'next/link';
import { t } from '@/lib/i18n';

/**
 * PRD 5.8: no login link and no admin reference anywhere in public
 * navigation. The route-group split keeps the admin subtree unreachable from
 * here structurally; this component must not reintroduce a link to it.
 */
export default function SiteHeader() {
  return (
    <header className="border-b border-hairline bg-surface">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:p-4 focus:text-primary"
      >
        {t('nav.skipToContent')}
      </a>
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-4">
        <Link href="/" className="text-lg font-semibold text-navy">
          {t('site.shortName')}
        </Link>
        <ul className="flex items-center gap-6 text-sm text-muted">
          <li>
            <Link href="/#directory">{t('nav.directory')}</Link>
          </li>
          <li>
            <Link href="/about">{t('nav.about')}</Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
```

Create `src/components/public/SiteFooter.tsx`:

```tsx
import Link from 'next/link';
import { t } from '@/lib/i18n';

/**
 * The attribution line is PRD content rule 10.1 verbatim, and
 * tests/unit/i18n.test.ts pins the exact string of `site.footer`. It reads
 * from the locale file rather than being written here so that pinning means
 * something.
 */
export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-hairline bg-tint-2">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-muted">
        <p>{t('site.footer')}</p>
        <p>
          {t('footer.contactPrompt')}{' '}
          <a className="text-primary underline" href={`mailto:${t('site.contactEmail')}`}>
            {t('site.contactEmail')}
          </a>
        </p>
        <ul className="flex gap-6">
          <li>
            <Link href="/privacy">{t('footer.privacy')}</Link>
          </li>
          <li>
            <Link href="/terms">{t('footer.terms')}</Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}
```

- [ ] **Step 9: Wire them into the public layout**

Replace the body of `src/app/(public)/layout.tsx`:

```tsx
import SiteHeader from '@/components/public/SiteHeader';
import SiteFooter from '@/components/public/SiteFooter';

/**
 * Public surface layout. PRD 5: no authentication anywhere here, every page
 * fully usable anonymously, and PRD 5.8: no login link or admin reference in
 * public navigation. The route-group split is what keeps that structural —
 * the admin sidebar lives in a sibling subtree and cannot render here.
 *
 * The alerts and suggest-a-resource modals are SP2b: they are write paths,
 * and the write paths ship with SP4's Turnstile, honeypots and rate limiting.
 */
export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
```

- [ ] **Step 10: Drop the public home from the placeholder assertion**

In `tests/structure/routes.test.ts`, remove `'src/app/(public)/page.tsx'` from the `PLACEHOLDERS` array, leaving the two admin placeholders. Add a comment above the array:

```ts
  // The public home stopped being a placeholder in SP2a Task 4, which puts
  // the directory on it; Task 6 adds the bands above. The two admin
  // placeholders stay until SP3.
```

Leave the `builds no public page beyond the placeholder home` assertion alone for now — Task 3 is the first task to add a public route, and it updates that assertion with the route it adds.

- [ ] **Step 11: Run everything**

Run: `npm run build && npm test && npm run typecheck && npm run lint`
Expected: PASS. The build must run before `npm test` because `tests/structure/routes.test.ts` reads `.next/app-path-routes-manifest.json` and fails loudly on a stale one.

- [ ] **Step 12: Commit**

```bash
git add tests/structure/jsx-literals.ts tests/structure/jsx-literals.test.ts tests/structure/no-hardcoded-copy.test.ts tests/structure/routes.test.ts src/components/public src/app/\(public\)/layout.tsx src/locales/en.json
git commit -m "feat(public): JSX copy guard, site header and footer

The content rules are enforced by scanning en.json, so a string written
straight into a .tsx escapes all of them. The guard closes that gap, and it
lands before the first component so everything after is held to it as written
rather than retrofitted.

AST rather than regex: className=\"text-navy underline\" and <p>Apply now</p>
are both quoted text on a line of JSX and only one is a defect. Exemptions are
per-occurrence with a stated reason -- a file-level escape would silently
un-police everything added to that file later.

The header carries no admin link and no nav.admin key exists (PRD 5.8)."
```

---

### Task 3: Shared logic — deadline label, filters, sort, and the resource card

**Files:**
- Create: `src/lib/public/deadline-label.ts`, `src/lib/public/filters.ts`
- Create: `src/components/public/NeedBadge.tsx`, `src/components/public/ResourceCard.tsx`
- Create: `tests/unit/deadline-label.test.ts`, `tests/unit/filters.test.ts`
- Modify: `src/locales/en.json`

**Interfaces:**
- Consumes: `PublicResource`, `NeedKey` from `@/lib/public/types`; `COUNTRIES`, `SECTORS`, `STAGES`, `NEED_KEYS` from `@/lib/reference`; `t` from `@/lib/i18n`.
- Produces:
  ```ts
  // src/lib/public/deadline-label.ts
  export interface DeadlineDisplay { deadline: string | null; isClosed: boolean; daysLeft: number | null }
  export function deadlineLabel(input: DeadlineDisplay): string;

  // src/lib/public/filters.ts
  export type SortMode = 'featured' | 'recent';
  export const DEFAULT_SORT: SortMode;
  export interface FilterCriteria {
    need: NeedKey | null; sector: string | null; country: string | null;
    stage: string | null; query: string; sort: SortMode;
  }
  export const EMPTY_CRITERIA: FilterCriteria;
  export function parseFilters(params: URLSearchParams | ReadonlyURLSearchParams): FilterCriteria;
  export function toSearchParams(criteria: FilterCriteria, base?: URLSearchParams): URLSearchParams;
  export function filterResources(rows: readonly PublicResource[], criteria: FilterCriteria): PublicResource[];
  export function sortResources(rows: readonly PublicResource[], mode: SortMode): PublicResource[];

  // components: default exports
  // NeedBadge({ need }: { need: NeedKey })
  // ResourceCard({ resource }: { resource: PublicResource })
  ```

**The rule this task exists to protect:** `deadlineLabel` **formats** state that SQL computed. It never reads a clock and never decides whether a deadline has passed. `deadlineInfo()` in `src/lib/deadline.ts` stays for SP3's admin "expiring soon" flagging, which legitimately computes — but it must not appear anywhere in the public card path. Two implementations of the closure rule is exactly the duplication this split removes.

- [ ] **Step 1: Add the locale keys**

Add to `src/locales/en.json`:

```json
  "deadline.today": "Closes today",
  "deadline.oneDay": "1 day left",
  "filter.need": "Need",
  "filter.sector": "Sector",
  "filter.country": "Country",
  "filter.stage": "Stage",
  "filter.any": "Any",
  "filter.search": "Search resources",
  "filter.searchHint": "Search by name, partner, description or category",
  "filter.clear": "Clear filters",
  "sort.label": "Sort",
  "sort.featured": "Featured first",
  "sort.recent": "Recently added",
  "badge.exclusive": "Exclusive to the AI Hub",
  "badge.earlyAccess": "Early access",
  "badge.featured": "Featured",
  "card.partner": "Partner",
  "card.eligibility": "Eligibility",
  "card.allCountries": "Open to all countries",
  "card.allSectors": "All sectors",
  "card.allStages": "All stages",
  "cta.apply": "Apply",
  "cta.viewDetail": "View details"
```

`deadline.rolling`, `deadline.closed` and `deadline.daysLeft` already exist and are reused. `badge.exclusive` says "Exclusive to the AI Hub" rather than the prototype's "Exclusive to AskHub" because content rule 10.2 forbids naming the product anything else in user-facing copy.

- [ ] **Step 2: Write the failing deadline-label test**

Create `tests/unit/deadline-label.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { deadlineLabel } from '@/lib/public/deadline-label';

describe('deadlineLabel', () => {
  it('says rolling when there is no deadline', () => {
    expect(deadlineLabel({ deadline: null, isClosed: false, daysLeft: null })).toBe('Rolling');
  });

  it('says closed when SQL says it is closed', () => {
    expect(deadlineLabel({ deadline: '2026-07-01', isClosed: true, daysLeft: -29 })).toBe(
      'Closed',
    );
  });

  it('says closes today at zero days left', () => {
    expect(deadlineLabel({ deadline: '2026-07-30', isClosed: false, daysLeft: 0 })).toBe(
      'Closes today',
    );
  });

  it('singularises one day', () => {
    // "1 days left" is the kind of slip nobody notices in review and every
    // visitor notices on the page.
    expect(deadlineLabel({ deadline: '2026-07-31', isClosed: false, daysLeft: 1 })).toBe(
      '1 day left',
    );
  });

  it('counts remaining days for anything further out', () => {
    expect(deadlineLabel({ deadline: '2026-09-01', isClosed: false, daysLeft: 33 })).toBe(
      '33 days left',
    );
  });

  it('trusts isClosed over daysLeft when they disagree', () => {
    // They come from the same SQL row and cannot actually disagree. If they
    // ever do, the closed state is the safe one to show: telling someone an
    // opportunity is open when it is not wastes their application.
    expect(deadlineLabel({ deadline: '2026-07-01', isClosed: true, daysLeft: 5 })).toBe(
      'Closed',
    );
  });

  it('falls back to rolling when a deadline exists but SQL supplied no day count', () => {
    expect(deadlineLabel({ deadline: '2026-09-01', isClosed: false, daysLeft: null })).toBe(
      'Rolling',
    );
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run tests/unit/deadline-label.test.ts`
Expected: FAIL with "Failed to resolve import @/lib/public/deadline-label".

- [ ] **Step 4: Implement deadlineLabel**

Create `src/lib/public/deadline-label.ts`:

```ts
import { t, type Locale } from '@/lib/i18n';

/**
 * The three deadline fields `resources_public` supplies. `is_closed` is
 * `deadline is not null and deadline < current_date` and `days_left` is
 * `deadline - current_date`, both evaluated in Postgres in UTC.
 */
export interface DeadlineDisplay {
  deadline: string | null;
  isClosed: boolean;
  daysLeft: number | null;
}

/**
 * Format deadline state for display.
 *
 * This function does not read a clock, does not construct a Date, and does
 * not decide whether a deadline has passed. SQL owns that rule -- see the
 * `is_closed` and `days_left` expressions in
 * supabase/migrations/0014_partner_logos.sql -- and a second implementation
 * here would be two answers to one question, drifting the moment either
 * changed. `deadlineInfo()` in src/lib/deadline.ts still computes, because
 * SP3's admin "expiring soon" flag legitimately needs to; it must not be
 * called from the public card path.
 *
 * PRD 4.2: a past deadline changes the display, never the status.
 */
export function deadlineLabel(input: DeadlineDisplay, locale?: Locale): string {
  if (input.isClosed) return t('deadline.closed', undefined, locale);
  if (input.deadline === null || input.daysLeft === null) {
    return t('deadline.rolling', undefined, locale);
  }
  if (input.daysLeft <= 0) return t('deadline.today', undefined, locale);
  if (input.daysLeft === 1) return t('deadline.oneDay', undefined, locale);
  return t('deadline.daysLeft', { count: input.daysLeft }, locale);
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run tests/unit/deadline-label.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Write the failing filters test**

Create `tests/unit/filters.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  parseFilters,
  toSearchParams,
  filterResources,
  sortResources,
  EMPTY_CRITERIA,
  DEFAULT_SORT,
  type FilterCriteria,
} from '@/lib/public/filters';
import type { PublicResource } from '@/lib/public/types';

function resource(overrides: Partial<PublicResource> = {}): PublicResource {
  return {
    id: 'r1',
    name: 'Cloud credits programme',
    partnerName: 'Amazon Web Services',
    partnerLogoUrl: null,
    partnerWebsiteUrl: null,
    partnerTier: 'strategic',
    resourceType: 'Credits',
    needPrimary: 'compute',
    needSecondary: null,
    subCategory: 'Cloud credits',
    description: 'Credits for early-stage teams.',
    actionLabel: null,
    externalUrl: 'https://example.org',
    bannerImageUrl: null,
    countriesEligible: ['Kenya', 'Ghana'],
    sectorsEligible: ['Health'],
    stagesEligible: ['Building'],
    geoScope: 'specific',
    deadline: null,
    isFeatured: false,
    exclusivity: null,
    sortOrder: 0,
    addedDate: '2026-01-01',
    isClosed: false,
    daysLeft: null,
    ...overrides,
  };
}

const criteria = (over: Partial<FilterCriteria> = {}): FilterCriteria => ({
  ...EMPTY_CRITERIA,
  ...over,
});

describe('parseFilters', () => {
  it('returns the empty criteria for an empty query string', () => {
    expect(parseFilters(new URLSearchParams(''))).toEqual(EMPTY_CRITERIA);
  });

  it('reads every facet', () => {
    const parsed = parseFilters(
      new URLSearchParams(
        'need=funding&sector=Health&country=Kenya&stage=Building&q=grants&sort=recent',
      ),
    );
    expect(parsed).toEqual({
      need: 'funding',
      sector: 'Health',
      country: 'Kenya',
      stage: 'Building',
      query: 'grants',
      sort: 'recent',
    });
  });

  it('falls back to the default for an unknown value rather than filtering to nothing', () => {
    // A stale or hand-edited link must not produce an empty directory with no
    // explanation. An unrecognised facet is dropped, not honoured.
    const parsed = parseFilters(
      new URLSearchParams('need=teleportation&sector=Mining&country=Atlantis&stage=Wizard&sort=price'),
    );
    expect(parsed).toEqual(EMPTY_CRITERIA);
    expect(parsed.sort).toBe(DEFAULT_SORT);
  });

  it('trims the free-text query', () => {
    expect(parseFilters(new URLSearchParams('q=%20%20grants%20%20')).query).toBe('grants');
  });
});

describe('toSearchParams', () => {
  it('serialises nothing for the empty criteria', () => {
    expect(toSearchParams(EMPTY_CRITERIA).toString()).toBe('');
  });

  it('omits the default sort but keeps a non-default one', () => {
    expect(toSearchParams(criteria({ sort: DEFAULT_SORT })).toString()).toBe('');
    expect(toSearchParams(criteria({ sort: 'recent' })).toString()).toBe('sort=recent');
  });

  it('round-trips every facet', () => {
    const original = criteria({
      need: 'training',
      sector: 'Education & Training',
      country: 'Democratic Republic of the Congo',
      stage: 'Scaling',
      query: 'curriculum',
      sort: 'recent',
    });
    expect(parseFilters(toSearchParams(original))).toEqual(original);
  });

  it('preserves unrelated parameters already in the URL', () => {
    // A campaign tag or an anchor-carrying param must survive a filter click.
    const base = new URLSearchParams('utm_source=newsletter');
    const out = toSearchParams(criteria({ need: 'funding' }), base);
    expect(out.get('utm_source')).toBe('newsletter');
    expect(out.get('need')).toBe('funding');
  });

  it('removes a facet that has been cleared rather than serialising it empty', () => {
    const base = new URLSearchParams('need=funding&sector=Health');
    const out = toSearchParams(criteria({ need: 'funding' }), base);
    expect(out.has('sector')).toBe(false);
  });
});

describe('filterResources', () => {
  const rows = [
    resource({ id: 'a', needPrimary: 'compute', name: 'Cloud credits programme' }),
    resource({
      id: 'b',
      needPrimary: 'funding',
      needSecondary: 'compute',
      name: 'Seed grant',
      partnerName: 'Google',
      description: 'Equity-free grant.',
      subCategory: 'Grant',
      sectorsEligible: [],
      countriesEligible: [],
      stagesEligible: [],
      geoScope: 'global',
    }),
    resource({
      id: 'c',
      needPrimary: 'training',
      name: 'Curriculum',
      partnerName: 'Deep Learning Indaba',
      // Overridden, not inherited: the shared default is 'Cloud credits', which
      // would make this row match the `query: 'cloud'` assertion below and turn
      // that test's expected ['a'] into ['a', 'c']. Found by the Task 3
      // implementer, which correctly fixed the fixture rather than the
      // implementation -- the search behaviour was right, the fixture was not.
      subCategory: 'Curriculum',
      sectorsEligible: ['Education & Training'],
      countriesEligible: ['Senegal'],
      stagesEligible: ['New to AI'],
    }),
  ];

  it('returns everything for the empty criteria', () => {
    expect(filterResources(rows, EMPTY_CRITERIA)).toHaveLength(3);
  });

  it('matches a need on either the primary or the secondary', () => {
    // need_secondary exists so a resource can serve two needs; ignoring it
    // would hide the compute half of every funding-and-compute resource.
    expect(filterResources(rows, criteria({ need: 'compute' })).map((r) => r.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('treats an empty sectors_eligible array as all sectors', () => {
    // The seed maps the prototype's 'All' sentinel to []; an empty array must
    // therefore match every sector rather than none.
    expect(filterResources(rows, criteria({ sector: 'Health' })).map((r) => r.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('treats an empty stages_eligible array as all stages', () => {
    expect(filterResources(rows, criteria({ stage: 'Scaling' })).map((r) => r.id)).toEqual(['b']);
  });

  it('matches any country when geo_scope is global, all_africa or partner_countries', () => {
    // PRD 4.x and content rule 10.6: there is no "Global programmes" option
    // in the country filter. A globally-scoped resource matches every
    // country selection instead.
    expect(filterResources(rows, criteria({ country: 'Zambia' })).map((r) => r.id)).toEqual(['b']);
    expect(filterResources(rows, criteria({ country: 'Kenya' })).map((r) => r.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('searches name, partner, description and sub-category', () => {
    expect(filterResources(rows, criteria({ query: 'cloud' })).map((r) => r.id)).toEqual(['a']);
    expect(filterResources(rows, criteria({ query: 'indaba' })).map((r) => r.id)).toEqual(['c']);
    expect(filterResources(rows, criteria({ query: 'equity-free' })).map((r) => r.id)).toEqual([
      'b',
    ]);
    expect(filterResources(rows, criteria({ query: 'grant' })).map((r) => r.id)).toEqual(['b']);
  });

  it('searches case-insensitively', () => {
    expect(filterResources(rows, criteria({ query: 'CLOUD' })).map((r) => r.id)).toEqual(['a']);
  });

  it('intersects facets rather than unioning them', () => {
    expect(
      filterResources(rows, criteria({ need: 'compute', country: 'Senegal' })),
    ).toHaveLength(1);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterResources(rows, criteria({ query: 'no such thing' }))).toEqual([]);
  });

  it('keeps closed resources in the results', () => {
    // PRD 4.2: a past deadline changes the display, never the listing.
    const closed = [resource({ id: 'z', isClosed: true, deadline: '2020-01-01', daysLeft: -1 })];
    expect(filterResources(closed, EMPTY_CRITERIA)).toHaveLength(1);
  });
});

describe('sortResources', () => {
  const rows = [
    resource({ id: 'a', isFeatured: false, sortOrder: 2, addedDate: '2026-03-01' }),
    resource({ id: 'b', isFeatured: true, sortOrder: 5, addedDate: '2026-01-01' }),
    resource({ id: 'c', isFeatured: false, sortOrder: 1, addedDate: '2026-05-01' }),
  ];

  it('puts featured first, then sort_order', () => {
    expect(sortResources(rows, 'featured').map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('orders by added date descending for recent', () => {
    expect(sortResources(rows, 'recent').map((r) => r.id)).toEqual(['c', 'a', 'b']);
  });

  it('breaks ties on id so the order is stable across renders', () => {
    // Without a tie-breaker, two rows with the same sort_order can swap
    // between a server render and a client re-render, which React reports as
    // a hydration mismatch and a visitor sees as a flicker.
    const tied = [
      resource({ id: 'y', sortOrder: 1, addedDate: '2026-01-01' }),
      resource({ id: 'x', sortOrder: 1, addedDate: '2026-01-01' }),
    ];
    expect(sortResources(tied, 'featured').map((r) => r.id)).toEqual(['x', 'y']);
    expect(sortResources(tied, 'recent').map((r) => r.id)).toEqual(['x', 'y']);
  });

  it('does not mutate its input', () => {
    const input = [...rows];
    sortResources(input, 'recent');
    expect(input.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts a resource with no added date last under recent', () => {
    const withNull = [resource({ id: 'n', addedDate: null }), resource({ id: 'd', addedDate: '2026-01-01' })];
    expect(sortResources(withNull, 'recent').map((r) => r.id)).toEqual(['d', 'n']);
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npx vitest run tests/unit/filters.test.ts`
Expected: FAIL with "Failed to resolve import @/lib/public/filters".

- [ ] **Step 8: Implement filters.ts**

Create `src/lib/public/filters.ts`:

```ts
import { COUNTRIES, SECTORS, STAGES, NEED_KEYS } from '@/lib/reference';
import type { NeedKey, PublicResource } from './types';

export type SortMode = 'featured' | 'recent';

const SORT_MODES: readonly SortMode[] = ['featured', 'recent'];

export const DEFAULT_SORT: SortMode = 'featured';

export interface FilterCriteria {
  need: NeedKey | null;
  sector: string | null;
  country: string | null;
  stage: string | null;
  query: string;
  sort: SortMode;
}

export const EMPTY_CRITERIA: FilterCriteria = {
  need: null,
  sector: null,
  country: null,
  stage: null,
  query: '',
  sort: DEFAULT_SORT,
};

/**
 * The narrowest shape both `URLSearchParams` and Next's
 * `ReadonlyURLSearchParams` satisfy. Declared structurally rather than
 * importing `ReadonlyURLSearchParams`, so this module stays free of a
 * next/navigation import and remains testable with a plain URLSearchParams.
 */
interface ReadableParams {
  get(name: string): string | null;
}

function oneOf<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T | null {
  if (value === null) return null;
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/**
 * Read filter state from the URL, which is the single source of truth.
 *
 * An unrecognised value falls back to the default rather than being honoured.
 * A stale bookmark, a hand-edited link or a filter option removed from
 * reference.ts would otherwise produce an empty directory with nothing on
 * screen explaining why.
 */
export function parseFilters(params: ReadableParams): FilterCriteria {
  return {
    need: oneOf<NeedKey>(params.get('need'), NEED_KEYS),
    sector: oneOf(params.get('sector'), SECTORS),
    country: oneOf(params.get('country'), COUNTRIES),
    stage: oneOf(params.get('stage'), STAGES),
    query: (params.get('q') ?? '').trim(),
    sort: oneOf<SortMode>(params.get('sort'), SORT_MODES) ?? DEFAULT_SORT,
  };
}

/**
 * Write filter state back to the URL.
 *
 * `base` carries anything already in the query string that is not ours --
 * campaign tags, a future locale param -- so a filter click preserves it.
 * Our own keys are always rewritten from `criteria`, so clearing a facet
 * removes the key rather than serialising it empty; `?sector=` in a shared
 * link is noise that survives every subsequent copy of that link.
 */
export function toSearchParams(
  criteria: FilterCriteria,
  base?: URLSearchParams,
): URLSearchParams {
  const out = new URLSearchParams(base?.toString() ?? '');
  const set = (key: string, value: string | null) => {
    if (value === null || value === '') out.delete(key);
    else out.set(key, value);
  };
  set('need', criteria.need);
  set('sector', criteria.sector);
  set('country', criteria.country);
  set('stage', criteria.stage);
  set('q', criteria.query.trim());
  set('sort', criteria.sort === DEFAULT_SORT ? null : criteria.sort);
  return out;
}

/**
 * An empty eligibility array means "no restriction", not "eligible for
 * nothing". The seed maps the prototype's `sectors: 'All'` sentinel to `[]`,
 * so reading an empty array as a filter miss would hide every
 * open-to-everyone resource -- the ones most worth showing.
 */
function matchesList(eligible: readonly string[], selected: string | null): boolean {
  if (selected === null) return true;
  if (eligible.length === 0) return true;
  return eligible.includes(selected);
}

/**
 * Content rule 10.6: the country filter has no catch-all option. A resource
 * whose geo_scope is global, all_africa or partner_countries matches every
 * country selection; only `specific` consults countries_eligible.
 */
function matchesCountry(row: PublicResource, selected: string | null): boolean {
  if (selected === null) return true;
  if (row.geoScope !== 'specific') return true;
  return matchesList(row.countriesEligible, selected);
}

function matchesQuery(row: PublicResource, query: string): boolean {
  if (query === '') return true;
  const needle = query.toLowerCase();
  return [row.name, row.partnerName, row.description, row.subCategory].some(
    (field) => field !== null && field.toLowerCase().includes(needle),
  );
}

export function filterResources(
  rows: readonly PublicResource[],
  criteria: FilterCriteria,
): PublicResource[] {
  return rows.filter(
    (row) =>
      (criteria.need === null ||
        row.needPrimary === criteria.need ||
        row.needSecondary === criteria.need) &&
      matchesList(row.sectorsEligible, criteria.sector) &&
      matchesList(row.stagesEligible, criteria.stage) &&
      matchesCountry(row, criteria.country) &&
      matchesQuery(row, criteria.query),
  );
}

/**
 * Both modes end in a comparison on `id`. Without it, two rows with the same
 * sort_order or added_date can come back in a different order from one render
 * to the next, which React reports as a hydration mismatch and a visitor sees
 * as cards jumping.
 */
export function sortResources(
  rows: readonly PublicResource[],
  mode: SortMode,
): PublicResource[] {
  const copy = [...rows];
  if (mode === 'recent') {
    return copy.sort(
      (a, b) =>
        (b.addedDate ?? '').localeCompare(a.addedDate ?? '') || a.id.localeCompare(b.id),
    );
  }
  return copy.sort(
    (a, b) =>
      Number(b.isFeatured) - Number(a.isFeatured) ||
      a.sortOrder - b.sortOrder ||
      a.id.localeCompare(b.id),
  );
}
```

- [ ] **Step 9: Run it to verify it passes**

Run: `npx vitest run tests/unit/filters.test.ts`
Expected: PASS (all tests).

- [ ] **Step 10: Write NeedBadge**

Create `src/components/public/NeedBadge.tsx`:

```tsx
import { t } from '@/lib/i18n';
import type { NeedKey } from '@/lib/public/types';

/**
 * Per-need colours are design tokens, never literals: globals.css defines
 * --color-need-<key> and --color-need-<key>-bg, and
 * tests/structure/app-structure.test.ts fails on a colour value anywhere
 * outside that @theme block. The map is static rather than interpolated
 * because Tailwind cannot see a class name built at runtime.
 */
const NEED_CLASSES: Record<NeedKey, string> = {
  compute: 'bg-need-compute-bg text-need-compute',
  training: 'bg-need-training-bg text-need-training',
  funding: 'bg-need-funding-bg text-need-funding',
  accelerator: 'bg-need-accelerator-bg text-need-accelerator',
  partners: 'bg-need-partners-bg text-need-partners',
};

export default function NeedBadge({ need }: { need: NeedKey }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${NEED_CLASSES[need]}`}
    >
      {t(`need.${need}`)}
    </span>
  );
}
```

- [ ] **Step 11: Write ResourceCard**

Create `src/components/public/ResourceCard.tsx`:

```tsx
import Link from 'next/link';
import { t } from '@/lib/i18n';
import NeedBadge from './NeedBadge';
import { deadlineLabel } from '@/lib/public/deadline-label';
import type { PublicResource } from '@/lib/public/types';

/**
 * One directory card. Pure presentation over a `resources_public` row: it
 * derives nothing the database did not already state, which is what keeps the
 * deadline rule in exactly one place.
 *
 * A closed resource is still listed and still links to its detail page
 * (PRD 4.2). The apply link is suppressed rather than the card, because a
 * closed opportunity is still worth reading about.
 */
export default function ResourceCard({ resource }: { resource: PublicResource }) {
  const label = deadlineLabel(resource);
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <NeedBadge need={resource.needPrimary} />
        {resource.isFeatured ? (
          <span className="rounded-full bg-tint-1 px-3 py-1 text-xs text-primary">
            {t('badge.featured')}
          </span>
        ) : null}
        {resource.exclusivity === 'exclusive' ? (
          <span className="rounded-full bg-tint-1 px-3 py-1 text-xs text-deep-blue">
            {t('badge.exclusive')}
          </span>
        ) : null}
        {resource.exclusivity === 'early_access' ? (
          <span className="rounded-full bg-tint-1 px-3 py-1 text-xs text-deep-blue">
            {t('badge.earlyAccess')}
          </span>
        ) : null}
        <span
          className={`ml-auto text-xs ${resource.isClosed ? 'text-danger' : 'text-muted-light'}`}
        >
          {label}
        </span>
      </div>

      <h3 className="text-lg font-semibold text-navy">
        <Link href={`/resources/${resource.id}`}>{resource.name}</Link>
      </h3>

      <p className="text-sm text-muted-light">{resource.partnerName}</p>

      {resource.description ? (
        <p className="line-clamp-3 text-sm text-muted">{resource.description}</p>
      ) : null}

      <div className="mt-auto flex items-center gap-4 pt-2 text-sm">
        <Link className="text-primary underline" href={`/resources/${resource.id}`}>
          {t('cta.viewDetail')}
        </Link>
        {resource.externalUrl && !resource.isClosed ? (
          <a
            className="text-primary underline"
            href={resource.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {resource.actionLabel ?? t('cta.apply')}
          </a>
        ) : null}
      </div>
    </article>
  );
}
```

- [ ] **Step 12: Run the full suite**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS. `tests/structure/no-hardcoded-copy.test.ts` must stay green — every string in both new components goes through `t()`.

- [ ] **Step 13: Commit**

```bash
git add src/lib/public/deadline-label.ts src/lib/public/filters.ts src/components/public/NeedBadge.tsx src/components/public/ResourceCard.tsx tests/unit/deadline-label.test.ts tests/unit/filters.test.ts src/locales/en.json
git commit -m "feat(public): deadline label, filters, sort and the resource card

deadlineLabel formats the is_closed and days_left that SQL computed. It reads
no clock and decides nothing: the closure rule lives in the view expression
and a second implementation here would be two answers to one question.
deadlineInfo() stays for SP3's expiring-soon flag and appears nowhere in the
public card path.

An empty eligibility array means no restriction, not eligible for nothing --
the seed maps the prototype's 'All' sentinel to [], so the opposite reading
would hide every open-to-everyone resource. A non-specific geo_scope matches
every country selection, which is how content rule 10.6 works without a
'Global programmes' filter option.

Both sorts end on id: without a tie-breaker equal rows can reorder between
the server render and the client re-render, which reads as a hydration
mismatch and looks like cards jumping."
```

---

### Task 4: The directory — filters, search, sort, export, and URL state

**Files:**
- Create: `src/lib/public/export.ts`, `tests/unit/export.test.ts`
- Create: `src/components/public/FilterControls.tsx`, `src/components/public/ExportButton.tsx`, `src/components/public/ResourceDirectory.tsx`
- Create: `src/app/(public)/error.tsx`
- Modify: `src/app/(public)/page.tsx`, `src/locales/en.json`, `package.json`

**Interfaces:**
- Consumes: `listPublicResources` from `@/lib/public/readers`; everything from `@/lib/public/filters`; `ResourceCard`.
- Produces:
  ```ts
  // src/lib/public/export.ts
  export const EXPORT_COLUMNS: readonly (keyof PublicResource)[];
  export function toCsvText(rows: readonly PublicResource[], headers: Record<string, string>): string;
  export function toExportRows(rows: readonly PublicResource[]): string[][];
  export async function downloadCsv(rows: readonly PublicResource[]): Promise<void>;
  export async function downloadXlsx(rows: readonly PublicResource[]): Promise<void>;
  // ResourceDirectory({ resources }: { resources: PublicResource[] })  -- 'use client'
  ```

- [ ] **Step 1: Add the Excel writer**

Run: `npm install write-excel-file@4.1.1`

`write-excel-file` rather than `xlsx`: the npm `xlsx` package is frozen at `0.18.5` and carries CVE-2023-30533 and CVE-2024-22363 with no patched release published to npm. `write-excel-file` is write-only — there is no parse path to be vulnerable in — is actively maintained, and pulls in one dependency (`fflate`). Both formats stay client-side and dynamically imported, exactly as the spec's D4 requires; the bundle gets smaller, not larger.

- [ ] **Step 2: Add the locale keys**

Add to `src/locales/en.json`:

```json
  "directory.title": "All resources",
  "directory.count": "{count} resources",
  "directory.countOne": "1 resource",
  "directory.emptyFiltered": "No resources match these filters.",
  "directory.emptyFilteredAction": "Clear the filters to see everything.",
  "directory.emptyAll": "Resources will appear here once the AI Hub team publishes them.",
  "export.label": "Export",
  "export.csv": "Download CSV",
  "export.excel": "Download Excel",
  "export.failed": "The download could not be prepared. Please try again.",
  "column.name": "Resource",
  "column.partnerName": "Partner",
  "column.resourceType": "Type",
  "column.needPrimary": "Primary need",
  "column.needSecondary": "Secondary need",
  "column.subCategory": "Category",
  "column.description": "Description",
  "column.externalUrl": "Link",
  "column.countriesEligible": "Countries",
  "column.sectorsEligible": "Sectors",
  "column.stagesEligible": "Stages",
  "column.geoScope": "Geographic scope",
  "column.deadline": "Deadline",
  "column.addedDate": "Added",
  "error.title": "Something went wrong",
  "error.body": "This page could not be loaded. Please try again.",
  "error.retry": "Try again"
```

- [ ] **Step 3: Write the failing export test**

Create `tests/unit/export.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { EXPORT_COLUMNS, toCsvText, toExportRows } from '@/lib/public/export';
import { RESOURCE_VIEW_COLUMNS, type PublicResource } from '@/lib/public/types';

function resource(overrides: Partial<PublicResource> = {}): PublicResource {
  return {
    id: 'r1',
    name: 'Cloud credits programme',
    partnerName: 'Amazon Web Services',
    partnerLogoUrl: null,
    partnerWebsiteUrl: null,
    partnerTier: 'strategic',
    resourceType: 'Credits',
    needPrimary: 'compute',
    needSecondary: null,
    subCategory: 'Cloud credits',
    description: 'Credits for early-stage teams.',
    actionLabel: null,
    externalUrl: 'https://example.org',
    bannerImageUrl: null,
    countriesEligible: ['Kenya', 'Ghana'],
    sectorsEligible: [],
    stagesEligible: ['Building'],
    geoScope: 'specific',
    deadline: '2026-09-01',
    isFeatured: false,
    exclusivity: null,
    sortOrder: 0,
    addedDate: '2026-01-01',
    isClosed: false,
    daysLeft: 33,
    ...overrides,
  };
}

describe('EXPORT_COLUMNS', () => {
  it('names only real resources_public columns', () => {
    // The subset relation is already a type-level fact: EXPORT_COLUMNS is
    // (keyof PublicResource)[] and RESOURCE_VIEW_COLUMNS maps every one of
    // those to a keyof ResourceRow. This asserts it at runtime too, so a
    // hand-edited literal cannot slip past.
    for (const column of EXPORT_COLUMNS) {
      expect(RESOURCE_VIEW_COLUMNS[column], `${column} is not a public view column`).toBeDefined();
    }
  });

  it('excludes every analytics and internal field', () => {
    // CLAUDE.md and PRD 5.2: the public export must exclude views, clicks,
    // CTR, internal notes and submitter emails. None of them exist on
    // resources_public, so this is a floor that must not be lowered later.
    const columns = EXPORT_COLUMNS.map(String).join(' ').toLowerCase();
    for (const forbidden of ['view', 'click', 'ctr', 'internal', 'note', 'submitter', 'email', 'status']) {
      expect(columns, `${forbidden} reached the public export`).not.toContain(forbidden);
    }
  });

  it('excludes the internal ordering and logo fields nobody exports', () => {
    for (const column of ['id', 'sortOrder', 'partnerLogoUrl', 'bannerImageUrl', 'isFeatured', 'daysLeft']) {
      expect(EXPORT_COLUMNS as readonly string[]).not.toContain(column);
    }
  });
});

describe('toCsvText', () => {
  const headers = Object.fromEntries(EXPORT_COLUMNS.map((c) => [c, String(c)]));

  it('writes a header row followed by one row per resource', () => {
    const lines = toCsvText([resource(), resource({ id: 'r2' })], headers).split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(EXPORT_COLUMNS.join(','));
  });

  it('quotes a field containing a comma', () => {
    const csv = toCsvText([resource({ name: 'Credits, compute and training' })], headers);
    expect(csv).toContain('"Credits, compute and training"');
  });

  it('doubles an embedded quote', () => {
    const csv = toCsvText([resource({ name: 'The "flagship" programme' })], headers);
    expect(csv).toContain('"The ""flagship"" programme"');
  });

  it('quotes a field containing a newline rather than breaking the row', () => {
    const csv = toCsvText([resource({ description: 'Line one\nLine two' })], headers);
    expect(csv).toContain('"Line one\nLine two"');
    // Header + one data row, and the embedded newline did not create a third.
    expect(csv.split('\r\n')).toHaveLength(2);
  });

  it('joins an array field with a semicolon so a comma cannot split it', () => {
    const csv = toCsvText([resource()], headers);
    expect(csv).toContain('Kenya; Ghana');
  });

  it('writes an empty string for a null field, never the word null', () => {
    const csv = toCsvText([resource({ description: null, deadline: null })], headers);
    expect(csv).not.toContain('null');
  });

  it('prefixes a field starting with a formula character', () => {
    // A cell beginning with = + - or @ is executed as a formula by Excel and
    // Sheets. The directory is partner-supplied text on a UN surface; a
    // pasted export must not run anything.
    const csv = toCsvText([resource({ name: '=HYPERLINK("http://x")' })], headers);
    expect(csv).toContain("'=HYPERLINK");
  });
});

describe('toExportRows', () => {
  it('returns a header row plus one row per resource, matching EXPORT_COLUMNS width', () => {
    const rows = toExportRows([resource()]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveLength(EXPORT_COLUMNS.length);
    expect(rows[1]).toHaveLength(EXPORT_COLUMNS.length);
  });

  it('applies the same formula-injection guard as the CSV path', () => {
    const rows = toExportRows([resource({ name: '+1234' })]);
    expect(rows[1]?.[0]).toBe("'+1234");
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx vitest run tests/unit/export.test.ts`
Expected: FAIL with "Failed to resolve import @/lib/public/export".

- [ ] **Step 5: Implement export.ts**

Create `src/lib/public/export.ts`:

```ts
import { t } from '@/lib/i18n';
import type { PublicResource } from './types';

/**
 * The public export's columns.
 *
 * Typed `readonly (keyof PublicResource)[]`, and every `keyof PublicResource`
 * is mapped by `RESOURCE_VIEW_COLUMNS` to a real `resources_public` column.
 * That makes "the export is a subset of the public view" a fact the compiler
 * checks rather than something a reviewer has to verify by eye -- which is
 * what PRD 5.2 and CLAUDE.md require ("exclude views, clicks, CTR, internal
 * notes, submitter emails, and every other internal or analytics field...
 * implement via a dedicated public-safe database view").
 *
 * id, sortOrder, isFeatured, daysLeft and the two image URLs are omitted --
 * not because they are sensitive, but because they are ours, not the
 * reader's, and a narrower export is easier to keep honest.
 */
export const EXPORT_COLUMNS = [
  'name',
  'partnerName',
  'resourceType',
  'needPrimary',
  'needSecondary',
  'subCategory',
  'description',
  'externalUrl',
  'countriesEligible',
  'sectorsEligible',
  'stagesEligible',
  'geoScope',
  'deadline',
  'addedDate',
] as const satisfies readonly (keyof PublicResource)[];

export type ExportColumn = (typeof EXPORT_COLUMNS)[number];

/**
 * A cell beginning with `=`, `+`, `-` or `@` is evaluated as a formula when
 * the file is opened in Excel or Sheets. Resource copy is partner-supplied
 * text on a UN surface, so a downloaded export must not be able to execute
 * anything. Prefixing with an apostrophe is the standard neutralisation and
 * is invisible in the rendered cell.
 */
function neutralise(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function cell(row: PublicResource, column: ExportColumn): string {
  const value = row[column];
  if (value === null || value === undefined) return '';
  // Semicolon, not comma: an array joined with commas is indistinguishable
  // from separate columns once a reader opens the CSV in a spreadsheet that
  // guesses at delimiters.
  if (Array.isArray(value)) return neutralise(value.join('; '));
  return neutralise(String(value));
}

function quote(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** `headers` maps each export column to its localised label. */
export function toCsvText(
  rows: readonly PublicResource[],
  headers: Record<string, string>,
): string {
  const head = EXPORT_COLUMNS.map((c) => quote(headers[c] ?? c)).join(',');
  const body = rows.map((row) =>
    EXPORT_COLUMNS.map((column) => quote(cell(row, column))).join(','),
  );
  // CRLF: the line ending Excel expects on every platform.
  return [head, ...body].join('\r\n');
}

/** Header row plus one row per resource, for the Excel writer. */
export function toExportRows(rows: readonly PublicResource[]): string[][] {
  return [
    EXPORT_COLUMNS.map((c) => t(`column.${c}`)),
    ...rows.map((row) => EXPORT_COLUMNS.map((column) => cell(row, column))),
  ];
}

function save(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function filename(extension: string): string {
  // Date only, no clock time: the file name is a label, not a timestamp, and
  // a name that changes every second makes repeated exports impossible to
  // tell apart in a downloads folder.
  return `askhub-resources-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

export async function downloadCsv(rows: readonly PublicResource[]): Promise<void> {
  const headers = Object.fromEntries(EXPORT_COLUMNS.map((c) => [c, t(`column.${c}`)]));
  // The BOM is what makes Excel read the file as UTF-8 rather than as the
  // system code page, which is the difference between "Côte d'Ivoire" and
  // mojibake for every reader on Windows.
  const blob = new Blob(['﻿', toCsvText(rows, headers)], {
    type: 'text/csv;charset=utf-8',
  });
  save(blob, filename('csv'));
}

export async function downloadXlsx(rows: readonly PublicResource[]): Promise<void> {
  // Dynamically imported so the writer and its zip dependency stay out of the
  // initial bundle: nobody pays for the export until they click it.
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  await writeXlsxFile(toExportRows(rows)).toFile(filename('xlsx'));
}
```

- [ ] **Step 6: Run it to verify it passes**

Run: `npx vitest run tests/unit/export.test.ts`
Expected: PASS. `toCsvText`, `toExportRows` and `EXPORT_COLUMNS` are pure; `downloadCsv`/`downloadXlsx` touch the DOM and are exercised by the acceptance check in Step 12, not by a unit test.

- [ ] **Step 7: Write the filter controls**

Create `src/components/public/FilterControls.tsx`:

```tsx
'use client';

import { t } from '@/lib/i18n';
import { COUNTRIES, SECTORS, STAGES, NEED_KEYS } from '@/lib/reference';
import { DEFAULT_SORT, type FilterCriteria, type SortMode } from '@/lib/public/filters';

/**
 * Every control writes the whole criteria object back through `onChange`.
 * There is no local mirror of URL state and no effect copying one into the
 * other: the URL is the single source of truth, and a second copy is what
 * makes back-button behaviour and shared links disagree.
 */
export default function FilterControls({
  criteria,
  resultCount,
  onChange,
}: {
  criteria: FilterCriteria;
  resultCount: number;
  onChange: (next: FilterCriteria) => void;
}) {
  const isFiltered =
    criteria.need !== null ||
    criteria.sector !== null ||
    criteria.country !== null ||
    criteria.stage !== null ||
    criteria.query !== '' ||
    criteria.sort !== DEFAULT_SORT;

  return (
    <div className="flex flex-col gap-4">
      <label className="block">
        <span className="sr-only">{t('filter.searchHint')}</span>
        <input
          type="search"
          className="w-full rounded-lg border border-hairline px-4 py-3"
          value={criteria.query}
          placeholder={t('filter.search')}
          onChange={(event) => onChange({ ...criteria, query: event.target.value })}
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <Select
          label={t('filter.need')}
          value={criteria.need}
          options={NEED_KEYS.map((key) => ({ value: key, label: t(`need.${key}`) }))}
          onChange={(value) => onChange({ ...criteria, need: value as FilterCriteria['need'] })}
        />
        <Select
          label={t('filter.sector')}
          value={criteria.sector}
          options={SECTORS.map((s) => ({ value: s, label: s }))}
          onChange={(value) => onChange({ ...criteria, sector: value })}
        />
        <Select
          label={t('filter.country')}
          value={criteria.country}
          options={COUNTRIES.map((c) => ({ value: c, label: c }))}
          onChange={(value) => onChange({ ...criteria, country: value })}
        />
        <Select
          label={t('filter.stage')}
          value={criteria.stage}
          options={STAGES.map((s) => ({ value: s, label: s }))}
          onChange={(value) => onChange({ ...criteria, stage: value })}
        />
        <Select
          label={t('sort.label')}
          value={criteria.sort}
          allowAny={false}
          options={[
            { value: 'featured', label: t('sort.featured') },
            { value: 'recent', label: t('sort.recent') },
          ]}
          onChange={(value) =>
            onChange({ ...criteria, sort: (value as SortMode | null) ?? DEFAULT_SORT })
          }
        />
      </div>

      <div className="flex items-center gap-4 text-sm text-muted">
        <span>
          {resultCount === 1
            ? t('directory.countOne')
            : t('directory.count', { count: resultCount })}
        </span>
        {isFiltered ? (
          <button
            type="button"
            className="text-primary underline"
            onClick={() =>
              onChange({
                need: null,
                sector: null,
                country: null,
                stage: null,
                query: '',
                sort: DEFAULT_SORT,
              })
            }
          >
            {t('filter.clear')}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
  allowAny = true,
}: {
  label: string;
  value: string | null;
  options: { value: string; label: string }[];
  onChange: (value: string | null) => void;
  allowAny?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-muted">
      <span>{label}</span>
      <select
        className="rounded-lg border border-hairline bg-surface px-3 py-2 text-navy"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
      >
        {allowAny ? <option value="">{t('filter.any')}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
```

- [ ] **Step 8: Write the export button**

Create `src/components/public/ExportButton.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { t } from '@/lib/i18n';
import type { PublicResource } from '@/lib/public/types';

/**
 * Both writers are dynamically imported inside the click handler, so neither
 * the Excel writer nor its zip dependency is in the initial bundle. PRD 5.2
 * requires both formats; PRD 12.3 requires the page not to pay for them.
 *
 * The exported rows are the filtered rows the visitor is looking at, not the
 * full dataset -- exporting something other than what is on screen is the
 * kind of surprise that makes people distrust the numbers.
 */
export default function ExportButton({ rows }: { rows: readonly PublicResource[] }) {
  const [failed, setFailed] = useState(false);

  async function run(format: 'csv' | 'xlsx') {
    setFailed(false);
    try {
      const mod = await import('@/lib/public/export');
      if (format === 'csv') await mod.downloadCsv(rows);
      else await mod.downloadXlsx(rows);
    } catch {
      // Never a silent no-op: a button that does nothing reads as a broken
      // page, and the visitor has no way to tell whether the file is coming.
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-lg border border-hairline px-3 py-2 text-sm text-navy"
          onClick={() => void run('csv')}
        >
          {t('export.csv')}
        </button>
        <button
          type="button"
          className="rounded-lg border border-hairline px-3 py-2 text-sm text-navy"
          onClick={() => void run('xlsx')}
        >
          {t('export.excel')}
        </button>
      </div>
      {failed ? <p className="text-sm text-danger">{t('export.failed')}</p> : null}
    </div>
  );
}
```

- [ ] **Step 9: Write the directory**

Create `src/components/public/ResourceDirectory.tsx`:

```tsx
'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { t } from '@/lib/i18n';
import ResourceCard from './ResourceCard';
import FilterControls from './FilterControls';
import ExportButton from './ExportButton';
import {
  parseFilters,
  toSearchParams,
  filterResources,
  sortResources,
  type FilterCriteria,
} from '@/lib/public/filters';
import type { PublicResource } from '@/lib/public/types';

/**
 * The directory. Filtering happens here, in the browser, over the full set of
 * live resources the server already sent: one cache entry to invalidate
 * instead of one per filter combination, and no round trip per click.
 *
 * The URL is the single source of filter state. This component holds no
 * `useState` for it and runs no effect syncing state to the URL -- a second
 * copy is what makes the back button and a shared link disagree about what is
 * selected. `router.replace` with `scroll: false` keeps the visitor's place;
 * a filter click that jumps to the top of the page loses their position in a
 * long list.
 *
 * If the live dataset ever grows into the low thousands of substantial rows,
 * shipping every row for browser filtering stops being appropriate and this
 * moves server-side. That threshold is recorded so the decision stays
 * deliberate rather than defaulted.
 */
export default function ResourceDirectory({
  resources,
}: {
  resources: PublicResource[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const criteria = parseFilters(searchParams);

  const visible = useMemo(
    () => sortResources(filterResources(resources, criteria), criteria.sort),
    [resources, criteria],
  );

  function apply(next: FilterCriteria) {
    const params = toSearchParams(next, new URLSearchParams(searchParams.toString()));
    const query = params.toString();
    router.replace(query === '' ? '/#directory' : `/?${query}#directory`, { scroll: false });
  }

  return (
    <section id="directory" className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-2xl font-semibold text-navy">{t('directory.title')}</h2>
        <ExportButton rows={visible} />
      </div>

      <div className="mt-6">
        <FilterControls criteria={criteria} resultCount={visible.length} onChange={apply} />
      </div>

      {/* Three empty cases, deliberately distinct. Telling someone to remove a
          filter when they have not set one is worse than saying nothing. */}
      {resources.length === 0 ? (
        <p className="mt-10 text-muted">{t('directory.emptyAll')}</p>
      ) : visible.length === 0 ? (
        <div className="mt-10 flex flex-col items-start gap-3">
          <p className="text-muted">{t('directory.emptyFiltered')}</p>
          <p className="text-sm text-muted-light">{t('directory.emptyFilteredAction')}</p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((resource) => (
            <li key={resource.id} className="flex">
              <ResourceCard resource={resource} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 10: Wire the home page and add the error boundary**

Replace `src/app/(public)/page.tsx`:

```tsx
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
```

Create `src/app/(public)/error.tsx`:

```tsx
'use client';

import { t } from '@/lib/i18n';

/**
 * A failed read shows an error. It does not fall back to hardcoded copy, to
 * a cached older payload, or to the admin client -- a public page quietly
 * serving invented content is worse than one saying it broke, and on a
 * leadership reporting surface a plausible substitute is the defect.
 */
export default function PublicError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold text-navy">{t('error.title')}</h1>
      <p className="mt-3 text-muted">{t('error.body')}</p>
      <button
        type="button"
        className="mt-6 rounded-lg bg-primary px-5 py-3 text-surface"
        onClick={reset}
      >
        {t('error.retry')}
      </button>
    </div>
  );
}
```

- [ ] **Step 11: Run the full suite and build**

Run: `npm run build && npm test && npm run typecheck && npm run lint`
Expected: PASS, including `tests/structure/no-hardcoded-copy.test.ts` and `tests/structure/routes.test.ts` (the public route set is still exactly `['/']`).

- [ ] **Step 12: Acceptance check against the running app**

Run `npm run dev`, then verify by hand and record the result in the task report:

1. `/` lists the seeded live resources.
2. Selecting a need updates the query string to `/?need=<key>#directory` **without the page jumping to the top**.
3. Reloading that URL reproduces the same result set.
4. Adding `?utm_source=probe` and then changing a filter keeps `utm_source` in the URL.
5. `?need=teleportation` shows everything rather than nothing.
6. Clearing every filter leaves the URL with no `need`/`sector`/`country`/`stage`/`q`/`sort` keys.
7. Both export buttons download a file; open the CSV and confirm the header row matches the localised column labels and that no column named views, clicks, CTR, note, email or status appears.
8. A resource whose deadline has passed still appears in the list with a Closed label.

- [ ] **Step 13: Commit**

```bash
git add src/lib/public/export.ts tests/unit/export.test.ts src/components/public src/app/\(public\)/page.tsx src/app/\(public\)/error.tsx src/locales/en.json package.json package-lock.json
git commit -m "feat(public): the resource directory with URL-backed filters and export

Filtering happens in the browser over the full live set the server already
sent: one cache entry to invalidate instead of one per filter combination,
and no round trip per click. The URL is the only copy of filter state -- no
mirrored useState, no syncing effect -- because a second copy is what makes
the back button and a shared link disagree.

Export uses write-excel-file, not xlsx: the npm xlsx package is frozen at
0.18.5 with CVE-2023-30533 and CVE-2024-22363 and no patched release on npm.
write-excel-file is write-only, so there is no parse path to be vulnerable
in. CSV is hand-written -- it needs no library and the quoting is testable.
Both are dynamically imported on first click.

Cells beginning with = + - or @ are apostrophe-prefixed: resource copy is
partner-supplied text, and a downloaded export must not execute anything.

Three distinct empty states. Telling someone to clear a filter they never set
is worse than saying nothing."
```

---

### Task 5: Resource detail, share pop-up and JSON-LD

**Files:**
- Create: `src/lib/public/jsonld.ts`, `tests/unit/jsonld.test.ts`
- Create: `src/components/public/ShareModal.tsx`
- Create: `src/app/(public)/resources/[id]/page.tsx`
- Modify: `src/locales/en.json`, `tests/structure/routes.test.ts`

**Interfaces:**
- Consumes: `getPublicResource`, `listPublicResources` from `@/lib/public/readers`; `deadlineLabel`; `NeedBadge`.
- Produces:
  ```ts
  // src/lib/public/jsonld.ts
  export interface ResourceJsonLd {
    '@context': 'https://schema.org'; '@type': 'Offer';
    name: string; url: string; availability: string;
    offeredBy: { '@type': 'Organization'; name: string; url?: string };
    description?: string; image?: string; availabilityEnds?: string; eligibleRegion?: string[];
  }
  export function resourceJsonLd(resource: PublicResource, canonicalUrl: string): ResourceJsonLd;
  export function serialiseJsonLd(value: ResourceJsonLd): string;
  // ShareModal({ url, title }: { url: string; title: string })  -- 'use client'
  ```

**The type is `schema.org/Offer`, and that is a decision this task makes explicit.** PRD §12.2 requires `schema.org` structured data on resource detail pages but names no type. `Offer` is chosen because its standard properties cover every field the detail page already carries — across all five need types — without stretching: `availabilityEnds` is the deadline, `eligibleRegion` is the eligible countries, `offeredBy` is the partner, `availability` carries the closed state. Nothing outside the mapping table below enters the object.

- [ ] **Step 1: Add the locale keys**

Add to `src/locales/en.json`:

```json
  "detail.about": "About this resource",
  "detail.eligibility": "Who can apply",
  "detail.countries": "Countries",
  "detail.sectors": "Sectors",
  "detail.stages": "Stages",
  "detail.deadline": "Deadline",
  "detail.partner": "Offered by",
  "detail.backToDirectory": "Back to all resources",
  "share.open": "Share",
  "share.title": "Share this resource",
  "share.message": "Message",
  "share.defaultText": "Thought this might be useful — an opportunity listed on the AI Hub for Sustainable Development.",
  "share.copyLink": "Copy link",
  "share.copied": "Link copied",
  "share.linkedin": "Share on LinkedIn",
  "share.email": "Share by email",
  "share.whatsapp": "Share on WhatsApp",
  "share.close": "Close"
```

The pre-written share text lives in `en.json` so it is policed by `tests/unit/i18n.test.ts` like every other string and is translatable later — the visitor edits it in the modal before sending, per PRD §5.3.

- [ ] **Step 2: Write the failing JSON-LD test**

Create `tests/unit/jsonld.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resourceJsonLd, serialiseJsonLd } from '@/lib/public/jsonld';
import { RESOURCE_VIEW_COLUMNS, type PublicResource } from '@/lib/public/types';

function resource(overrides: Partial<PublicResource> = {}): PublicResource {
  return {
    id: 'r1',
    name: 'Cloud credits programme',
    partnerName: 'Amazon Web Services',
    partnerLogoUrl: null,
    partnerWebsiteUrl: 'https://aws.amazon.com',
    partnerTier: 'strategic',
    resourceType: 'Credits',
    needPrimary: 'compute',
    needSecondary: null,
    subCategory: 'Cloud credits',
    description: 'Credits for early-stage teams.',
    actionLabel: null,
    externalUrl: 'https://example.org/apply',
    bannerImageUrl: 'https://example.org/banner.png',
    countriesEligible: ['Kenya', 'Ghana'],
    sectorsEligible: [],
    stagesEligible: ['Building'],
    geoScope: 'specific',
    deadline: '2026-09-01',
    isFeatured: false,
    exclusivity: null,
    sortOrder: 0,
    addedDate: '2026-01-01',
    isClosed: false,
    daysLeft: 33,
    ...overrides,
  };
}

const CANONICAL = 'https://example.test/resources/r1';

describe('resourceJsonLd', () => {
  it('emits an Offer with the schema.org context', () => {
    const ld = resourceJsonLd(resource(), CANONICAL);
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('Offer');
  });

  it('maps every populated field to its schema.org property', () => {
    expect(resourceJsonLd(resource(), CANONICAL)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Offer',
      name: 'Cloud credits programme',
      description: 'Credits for early-stage teams.',
      url: 'https://example.org/apply',
      image: 'https://example.org/banner.png',
      availabilityEnds: '2026-09-01',
      eligibleRegion: ['Kenya', 'Ghana'],
      availability: 'https://schema.org/InStock',
      offeredBy: {
        '@type': 'Organization',
        name: 'Amazon Web Services',
        url: 'https://aws.amazon.com',
      },
    });
  });

  it('omits an absent optional property rather than emitting null or a placeholder', () => {
    const ld = resourceJsonLd(
      resource({
        description: null,
        externalUrl: null,
        bannerImageUrl: null,
        deadline: null,
        countriesEligible: [],
        partnerWebsiteUrl: null,
      }),
      CANONICAL,
    );
    for (const absent of ['description', 'image', 'availabilityEnds', 'eligibleRegion']) {
      expect(Object.keys(ld), `${absent} should be omitted, not emitted empty`).not.toContain(
        absent,
      );
    }
    // url falls back to the canonical page URL: a resource with no external
    // link still has a page, and an Offer with no url at all is less useful
    // than one pointing at where a reader can actually read about it.
    expect(ld.url).toBe(CANONICAL);
    expect(ld.offeredBy).toEqual({ '@type': 'Organization', name: 'Amazon Web Services' });
  });

  it('marks a closed resource Discontinued', () => {
    expect(resourceJsonLd(resource({ isClosed: true }), CANONICAL).availability).toBe(
      'https://schema.org/Discontinued',
    );
  });

  it('emits only properties derived from public view columns', () => {
    // The exclusion is structural -- resources_public projects no views,
    // clicks, ctr, submitter email or internal note, so none can reach here.
    // This asserts it rather than establishing it, and fails the day someone
    // widens either the view or this builder.
    const ld = resourceJsonLd(resource(), CANONICAL);
    const serialised = JSON.stringify(ld).toLowerCase();
    for (const forbidden of ['click', 'ctr', 'internal', 'submitter', 'notified', 'match_weight', 'status']) {
      expect(serialised, `${forbidden} reached the structured data`).not.toContain(forbidden);
    }
  });

  it('escapes a description that tries to close the script element', () => {
    // JSON.stringify escapes quotes and backslashes but never `<`. Inside a
    // <script> element the HTML parser is still hunting for the closing tag,
    // so an unescaped `</script>` in partner-supplied copy ends the JSON-LD
    // block and starts an executable one. This is the whole reason
    // serialiseJsonLd exists.
    const hostile = resource({ description: '</script><script>alert(1)</script>' });
    const html = serialiseJsonLd(resourceJsonLd(hostile, CANONICAL));
    expect(html).not.toContain('</script>');
    expect(html).not.toContain('<');
    expect(html).toContain('\\u003c');
    // Still valid JSON, and still the original text once parsed.
    expect(JSON.parse(html).description).toBe('</script><script>alert(1)</script>');
  });

  it('escapes ampersands so an HTML entity in copy survives round-trip', () => {
    const html = serialiseJsonLd(
      resourceJsonLd(resource({ name: 'Energy & Water programme' }), CANONICAL),
    );
    expect(html).toContain('\\u0026');
    expect(JSON.parse(html).name).toBe('Energy & Water programme');
  });

  it('draws every field it uses from a real resources_public column', () => {
    for (const field of ['name', 'description', 'externalUrl', 'bannerImageUrl', 'deadline', 'countriesEligible', 'partnerName', 'partnerWebsiteUrl', 'isClosed'] as const) {
      expect(RESOURCE_VIEW_COLUMNS[field], `${field} is not a public view column`).toBeDefined();
    }
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run tests/unit/jsonld.test.ts`
Expected: FAIL with "Failed to resolve import @/lib/public/jsonld".

- [ ] **Step 4: Implement jsonld.ts**

Create `src/lib/public/jsonld.ts`:

```ts
import type { PublicResource } from './types';

/**
 * schema.org structured data for a resource detail page (PRD 12.2).
 *
 * The type is `Offer`. The PRD requires structured data but names no type,
 * so this is where the choice is fixed rather than left to whoever writes
 * the page: `Offer` is the only schema.org type whose standard properties
 * cover every field the detail page carries -- across compute, training,
 * funding, accelerator and partners resources alike -- without inventing
 * anything.
 *
 *   name              <- name
 *   description       <- description
 *   url               <- external_url, falling back to the canonical page
 *   image             <- banner_image_url
 *   availabilityEnds  <- deadline
 *   eligibleRegion    <- countries_eligible
 *   availability      <- is_closed
 *   offeredBy         <- partner_name, partner_website_url
 *
 * Two rules hold this honest. Every value comes from `resources_public`,
 * which projects no analytics or internal column, so nothing private can
 * reach a search engine through this object. And an absent value omits its
 * property rather than emitting null, an empty string or a guess -- a
 * fabricated deadline in structured data is a fabricated deadline, whether
 * or not a human ever reads it.
 */
export interface ResourceJsonLd {
  '@context': 'https://schema.org';
  '@type': 'Offer';
  name: string;
  description?: string;
  url: string;
  image?: string;
  availabilityEnds?: string;
  eligibleRegion?: string[];
  availability: string;
  offeredBy: { '@type': 'Organization'; name: string; url?: string };
}

export function resourceJsonLd(
  resource: PublicResource,
  canonicalUrl: string,
): ResourceJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    name: resource.name,
    ...(resource.description ? { description: resource.description } : {}),
    url: resource.externalUrl ?? canonicalUrl,
    ...(resource.bannerImageUrl ? { image: resource.bannerImageUrl } : {}),
    ...(resource.deadline ? { availabilityEnds: resource.deadline } : {}),
    ...(resource.countriesEligible.length > 0
      ? { eligibleRegion: resource.countriesEligible }
      : {}),
    availability: resource.isClosed
      ? 'https://schema.org/Discontinued'
      : 'https://schema.org/InStock',
    offeredBy: {
      '@type': 'Organization',
      name: resource.partnerName,
      ...(resource.partnerWebsiteUrl ? { url: resource.partnerWebsiteUrl } : {}),
    },
  };
}

/**
 * Serialise the object for injection into a `<script type="application/ld+json">`.
 *
 * `JSON.stringify` alone is **not** safe here, and this is the reason this
 * function exists rather than the page calling stringify directly. Inside a
 * `<script>` element the HTML parser is still looking for the closing tag, so
 * a resource description containing `</script><script>...` ends the JSON-LD
 * block and starts an executable one -- `JSON.stringify` escapes quotes and
 * backslashes but never `<`. Resource copy is partner-supplied and
 * admin-entered, so it is user content by CLAUDE.md's definition, and
 * CLAUDE.md forbids dangerouslySetInnerHTML with user content unescaped.
 *
 * Escaping `<`, `>` and `&` to their \\u form keeps the JSON byte-for-byte
 * equivalent -- a JSON parser reads \\u003c as `<` -- while leaving the HTML
 * parser nothing to act on.
 *
 * React's normal text escaping cannot be used instead: it would emit `&quot;`
 * inside the script element, which is not valid JSON.
 */
export function serialiseJsonLd(value: ResourceJsonLd): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run tests/unit/jsonld.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Write the share modal**

Create `src/components/public/ShareModal.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { t } from '@/lib/i18n';

/**
 * PRD 5.3: copy link, LinkedIn, email and WhatsApp, with editable
 * pre-written text. The default text comes from en.json rather than being
 * written here, so it is policed by the content-rule scan like every other
 * user-facing string and can be translated later.
 */
export default function ShareModal({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(t('share.defaultText'));
  const [copied, setCopied] = useState(false);

  const body = `${message}\n\n${title}\n${url}`;

  async function copy() {
    await navigator.clipboard.writeText(body);
    setCopied(true);
  }

  if (!open) {
    return (
      <button
        type="button"
        className="rounded-lg border border-hairline px-4 py-2 text-sm text-navy"
        onClick={() => setOpen(true)}
      >
        {t('share.open')}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-hairline bg-tint-2 p-4">
      <h2 className="text-sm font-semibold text-navy">{t('share.title')}</h2>
      <label className="mt-3 block text-sm text-muted">
        <span>{t('share.message')}</span>
        <textarea
          className="mt-1 w-full rounded-lg border border-hairline p-3 text-navy"
          rows={3}
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            setCopied(false);
          }}
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <button type="button" className="text-primary underline" onClick={() => void copy()}>
          {copied ? t('share.copied') : t('share.copyLink')}
        </button>
        <a
          className="text-primary underline"
          target="_blank"
          rel="noopener noreferrer"
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
        >
          {t('share.linkedin')}
        </a>
        <a
          className="text-primary underline"
          href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`}
        >
          {t('share.email')}
        </a>
        <a
          className="text-primary underline"
          target="_blank"
          rel="noopener noreferrer"
          href={`https://wa.me/?text=${encodeURIComponent(body)}`}
        >
          {t('share.whatsapp')}
        </a>
        <button
          type="button"
          className="ml-auto text-muted underline"
          onClick={() => setOpen(false)}
        >
          {t('share.close')}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Write the detail page**

Create `src/app/(public)/resources/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { t } from '@/lib/i18n';
import NeedBadge from '@/components/public/NeedBadge';
import ShareModal from '@/components/public/ShareModal';
import { deadlineLabel } from '@/lib/public/deadline-label';
import { resourceJsonLd, serialiseJsonLd } from '@/lib/public/jsonld';
import { getPublicResource, listPublicResources } from '@/lib/public/readers';

/**
 * Pre-generate the detail pages that exist at build time.
 *
 * `dynamicParams` stays at its default of true, deliberately: a resource
 * published from the admin portal after a deploy must resolve without a
 * rebuild. PRD 12.2 wants these pages server-rendered, not that they exist
 * only for rows that happened to be live when the bundle was built.
 */
export async function generateStaticParams() {
  const resources = await listPublicResources();
  return resources.map((resource) => ({ id: resource.id }));
}

function canonicalUrl(id: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  return `${base}/resources/${id}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const resource = await getPublicResource(id);
  if (!resource) return {};
  return {
    title: resource.name,
    ...(resource.description ? { description: resource.description } : {}),
  };
}

export default async function ResourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const resource = await getPublicResource(id);

  // Absent from resources_public means status is not 'live'. It never means
  // the deadline passed: the view filters on status alone, and PRD 4.2 keeps
  // a closed resource listed and reachable -- a past opportunity is still
  // worth reading about, and a 404 on a shared link is a dead end.
  if (!resource) notFound();

  const label = deadlineLabel(resource);
  const jsonLd = resourceJsonLd(resource, canonicalUrl(resource.id));

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      {/* Server-rendered from public view fields only, and serialised by
          `serialiseJsonLd`, which escapes < > & so a description containing
          `</script>` cannot break out of this element. See that function for
          why JSON.stringify alone is not enough. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serialiseJsonLd(jsonLd) }}
      />

      <Link className="text-sm text-primary underline" href="/#directory">
        {t('detail.backToDirectory')}
      </Link>

      {resource.bannerImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- partner banner
        // URLs are arbitrary remote hosts; next/image would need every one
        // allow-listed in next.config.ts, and SP4 owns the image policy.
        <img
          className="mt-6 w-full rounded-lg"
          src={resource.bannerImageUrl}
          alt={resource.name}
        />
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <NeedBadge need={resource.needPrimary} />
        <span className={resource.isClosed ? 'text-sm text-danger' : 'text-sm text-muted-light'}>
          {label}
        </span>
      </div>

      <h1 className="mt-4 text-3xl font-semibold text-navy">{resource.name}</h1>

      <p className="mt-2 text-muted">
        {t('detail.partner')}{' '}
        {resource.partnerWebsiteUrl ? (
          <a
            className="text-primary underline"
            href={resource.partnerWebsiteUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {resource.partnerName}
          </a>
        ) : (
          resource.partnerName
        )}
      </p>

      {resource.description ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-navy">{t('detail.about')}</h2>
          <p className="mt-2 whitespace-pre-line text-muted">{resource.description}</p>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-navy">{t('detail.eligibility')}</h2>
        <dl className="mt-2 grid gap-2 text-sm text-muted">
          <Row
            term={t('detail.countries')}
            value={
              resource.geoScope === 'specific' && resource.countriesEligible.length > 0
                ? resource.countriesEligible.join(', ')
                : t('card.allCountries')
            }
          />
          <Row
            term={t('detail.sectors')}
            value={
              resource.sectorsEligible.length > 0
                ? resource.sectorsEligible.join(', ')
                : t('card.allSectors')
            }
          />
          <Row
            term={t('detail.stages')}
            value={
              resource.stagesEligible.length > 0
                ? resource.stagesEligible.join(', ')
                : t('card.allStages')
            }
          />
          <Row term={t('detail.deadline')} value={label} />
        </dl>
      </section>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        {resource.externalUrl && !resource.isClosed ? (
          <a
            className="rounded-lg bg-primary px-5 py-3 text-surface"
            href={resource.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {resource.actionLabel ?? t('cta.apply')}
          </a>
        ) : null}
        <ShareModal url={canonicalUrl(resource.id)} title={resource.name} />
      </div>

      <p className="mt-10 text-sm text-muted-light">{t('site.curationStatement')}</p>
    </article>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="min-w-32 font-medium text-navy">{term}</dt>
      <dd>{value}</dd>
    </div>
  );
}
```

Note: the "Suggest an update" affordance PRD §5.3 also requires is a write path and belongs to SP2b with the other three endpoints. It is not stubbed here — a button that does nothing is worse than no button.

- [ ] **Step 8: Update the route assertion**

In `tests/structure/routes.test.ts`, replace the `builds no public page beyond the placeholder home` test with:

```ts
  it('serves resource detail from the (public) group at /resources/[id]', () => {
    expect(routes()['/(public)/resources/[id]/page']).toBe('/resources/[id]');
  });

  it('builds only the public pages SP2a owns', () => {
    // Every public route in PRD 5. About, privacy, terms and impact arrive in
    // Task 7; anything else appearing here means scope has crept.
    const publicUrls = Object.entries(routes())
      .filter(([source]) => source.startsWith('/(public)/'))
      .map(([, url]) => url);
    expect(publicUrls.sort()).toEqual(['/', '/resources/[id]']);
  });
```

- [ ] **Step 9: Add the site URL to the env template**

Add to `.env.example`:

```
# Absolute origin of the deployed site, e.g. https://askhub.example.org.
# Used for canonical URLs and the share pop-up's link. Empty locally, which
# yields root-relative URLs — correct for dev, wrong for a shared link.
NEXT_PUBLIC_SITE_URL=
```

Then add `'NEXT_PUBLIC_SITE_URL'` to the name list in `tests/structure/env-contract.test.ts`.

- [ ] **Step 10: Run the full suite and build**

Run: `npm run build && npm test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 11: Acceptance check against the running app**

Record the result of each in the task report:

1. `/resources/<a live id>` renders; view source and confirm one `application/ld+json` block whose `@type` is `Offer`.
2. That block contains no `views`, `clicks`, `ctr`, `status` or any partner-internal field.
3. A resource with no deadline omits `availabilityEnds` entirely rather than emitting `null`.
4. `/resources/<a pipeline id>` returns 404.
5. `/resources/<a live id whose deadline has passed>` renders with a Closed label, **no apply button**, and does **not** 404.
6. The share pop-up opens, the message is editable, and copy link puts the edited message plus the URL on the clipboard.

- [ ] **Step 12: Commit**

```bash
git add src/lib/public/jsonld.ts tests/unit/jsonld.test.ts src/components/public/ShareModal.tsx "src/app/(public)/resources" tests/structure/routes.test.ts tests/structure/env-contract.test.ts .env.example src/locales/en.json
git commit -m "feat(public): resource detail with share pop-up and Offer JSON-LD

The PRD requires schema.org structured data but names no type, so this fixes
it as Offer -- the only type whose standard properties cover every field the
detail page carries across all five need types without inventing anything.
An absent value omits its property rather than emitting null or a guess: a
fabricated deadline in structured data is still a fabricated deadline.

notFound() fires only when a row is absent from resources_public, which means
its status is not live. It never fires on a passed deadline: the view filters
on status alone, and a 404 on a shared link to a closed opportunity is a dead
end where a Closed badge is an answer.

generateStaticParams pre-generates what exists at build time; dynamicParams
stays true so a resource published after deploy resolves without a rebuild."
```

---

### Task 6: The seven home bands

**Files:**
- Create: `src/components/public/WelcomeBand.tsx`, `StatsBand.tsx`, `HeroSearch.tsx`, `BrowseByNeed.tsx`, `FeaturedCarousel.tsx`, `PartnerRow.tsx`, `RecentlyAddedRail.tsx`
- Create: `tests/components/bands.test.tsx`
- Modify: `src/app/(public)/page.tsx`, `src/locales/en.json`, `package.json`, `vitest.config.ts`

**Interfaces:**
- Consumes: every reader from `@/lib/public/readers`; `ResourceCard`; `sortResources`.
- Produces: seven default-exported presentational components, each taking its rows as props and returning `null` when it has none.

**Why the bands take props instead of fetching:** an `async` server component cannot be rendered by a test renderer, so a band that fetched its own data could only be verified by loading a page. Taking rows as props makes each band a synchronous pure function of its input — the page awaits every reader in parallel and passes the results down. That is also the cheaper render: seven bands fetching independently would serialise seven round trips.

- [ ] **Step 1: Add the component test environment**

Run: `npm install --save-dev @testing-library/react@16.3.2 jsdom@30.0.1`

Add to `vitest.config.ts` inside `test`, immediately after the `include` entry:

```ts
    // The DB suites assert on Postgres row visibility and must run in node.
    // Component suites opt into jsdom per file with a
    // `// @vitest-environment jsdom` docblock, so this default stays node.
    environment: 'node',
```

- [ ] **Step 2: Add the locale keys**

Add to `src/locales/en.json`:

```json
  "home.searchHeading": "Find what you need",
  "home.browseHeading": "Browse by need",
  "home.browseCount": "{count} live",
  "home.featuredHeading": "Featured opportunities",
  "home.partnersHeading": "Our partners",
  "home.recentHeading": "Recently added",
  "home.statsHeading": "The AI Hub for Sustainable Development in numbers"
```

There is deliberately no `home.statsEmpty` key. When no figure has been attested the band does not render at all — an empty stats band with an apology is still a stats band inviting someone to fill it in.

- [ ] **Step 3: Write the failing band test**

Create `tests/components/bands.test.tsx`:

```tsx
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
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx vitest run tests/components/bands.test.tsx`
Expected: FAIL with unresolved imports for the four band components.

- [ ] **Step 5: Write the bands**

Create `src/components/public/StatsBand.tsx`:

```tsx
import { t } from '@/lib/i18n';
import type { PublicStat } from '@/lib/public/types';

/** PRD 5.1 item 2: the first four hero stats. */
const HERO_LIMIT = 4;

/**
 * The headline reach strip.
 *
 * Renders exactly the figures that exist and nothing in place of the ones
 * that do not. `headline_stats` cannot hold a row without `source`,
 * `attested_by` and `attested_on` -- all NOT NULL and non-blank since
 * migration 0015 -- so a row here means a named person vouched for that
 * number against a named dataset. No rows means nobody has yet, and the band
 * disappears rather than showing zeros, dashes or a "coming soon".
 *
 * This is not a stylistic empty state. CLAUDE.md: this is a leadership
 * reporting surface for a UN programme, and a plausible fake number is a
 * launch-blocking defect. A partial set is expected -- the client supplies
 * the fifteen figures over time, not in one delivery -- so the band must
 * never wait for a complete set before rendering any of them.
 */
export default function StatsBand({ stats }: { stats: PublicStat[] }) {
  const hero = stats.filter((s) => s.isHero).slice(0, HERO_LIMIT);
  const shown = hero.length > 0 ? hero : stats.slice(0, HERO_LIMIT);
  if (shown.length === 0) return null;

  return (
    <section className="bg-tint-1">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="sr-only">{t('home.statsHeading')}</h2>
        <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((s) => (
            <div key={s.id}>
              <dt className="text-3xl font-semibold text-primary">{s.value}</dt>
              <dd className="mt-1 text-sm text-muted">{s.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
```

Note the roles the test asserts on: `<dt>` has the implicit ARIA role `term`, which is why `getAllByRole('term')` counts figures without touching a class name.

Create `src/components/public/PartnerRow.tsx`:

```tsx
import { t } from '@/lib/i18n';
import type { PublicPartner } from '@/lib/public/types';

/**
 * PRD 5.1 item 6: each logo links to the partner's own official site.
 *
 * Content rule 10.10 is enforced in the database as a CHECK
 * (`logo_url is null or website_url is not null`), so a logo without a site
 * to link to cannot exist. Logos and URLs are a client deliverable; until
 * they arrive a partner renders as its name, which is a complete row rather
 * than a gap -- the band only disappears when there are no partners at all.
 */
export default function PartnerRow({ partners }: { partners: PublicPartner[] }) {
  if (partners.length === 0) return null;

  return (
    <section className="border-y border-hairline bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-light">
          {t('home.partnersHeading')}
        </h2>
        <ul className="mt-6 flex flex-wrap items-center gap-8">
          {partners.map((partner) => (
            <li key={partner.name}>
              {partner.websiteUrl ? (
                <a
                  href={partner.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-navy"
                >
                  {partner.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- partner
                    // logos are arbitrary remote hosts; SP4 owns the image policy.
                    <img className="h-8 w-auto" src={partner.logoUrl} alt={partner.name} />
                  ) : (
                    partner.name
                  )}
                </a>
              ) : (
                <span className="text-navy">{partner.name}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

Create `src/components/public/BrowseByNeed.tsx`:

```tsx
import Link from 'next/link';
import { t } from '@/lib/i18n';
import type { NeedCount } from '@/lib/public/types';

/**
 * PRD 5.1 item 4: five need types with live counts. The counts come from
 * `need_counts_public`, a `count(*) where status = 'live'` grouped in
 * Postgres -- a true number, not a stored one, so it needs no attestation
 * and cannot drift from the directory beneath it.
 *
 * Each chip links into the directory rather than to a route of its own:
 * there is no /directory, and the query string is the shareable state.
 */
export default function BrowseByNeed({ counts }: { counts: NeedCount[] }) {
  const withResources = counts.filter((c) => c.liveCount > 0);
  if (withResources.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h2 className="text-xl font-semibold text-navy">{t('home.browseHeading')}</h2>
      <ul className="mt-4 flex flex-wrap gap-3">
        {withResources.map((count) => (
          <li key={count.need}>
            <Link
              href={`/?need=${count.need}#directory`}
              className="flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-sm text-navy"
            >
              <span>{t(`need.${count.need}`)}</span>
              <span className="text-muted-light">
                {t('home.browseCount', { count: count.liveCount })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

Create `src/components/public/FeaturedCarousel.tsx`:

```tsx
import { t } from '@/lib/i18n';
import ResourceCard from './ResourceCard';
import { sortResources } from '@/lib/public/filters';
import type { PublicResource } from '@/lib/public/types';

/**
 * PRD 5.1 item 5. A horizontally scrolling rail rather than an auto-advancing
 * carousel: auto-advance is an accessibility problem (WCAG 2.2.2) and hides
 * content from anyone who does not watch it happen.
 */
export default function FeaturedCarousel({ resources }: { resources: PublicResource[] }) {
  const featured = sortResources(
    resources.filter((r) => r.isFeatured),
    'featured',
  );
  if (featured.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h2 className="text-xl font-semibold text-navy">{t('home.featuredHeading')}</h2>
      <ul className="mt-6 flex snap-x gap-6 overflow-x-auto pb-4">
        {featured.map((resource) => (
          <li key={resource.id} className="w-80 shrink-0 snap-start">
            <ResourceCard resource={resource} />
          </li>
        ))}
      </ul>
    </section>
  );
}
```

Create `src/components/public/RecentlyAddedRail.tsx`:

```tsx
import { t } from '@/lib/i18n';
import ResourceCard from './ResourceCard';
import { sortResources } from '@/lib/public/filters';
import type { PublicResource } from '@/lib/public/types';

const RECENT_LIMIT = 6;

/** PRD 5.1 item 7. */
export default function RecentlyAddedRail({ resources }: { resources: PublicResource[] }) {
  const recent = sortResources(resources, 'recent').slice(0, RECENT_LIMIT);
  if (recent.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h2 className="text-xl font-semibold text-navy">{t('home.recentHeading')}</h2>
      <ul className="mt-6 flex snap-x gap-6 overflow-x-auto pb-4">
        {recent.map((resource) => (
          <li key={resource.id} className="w-80 shrink-0 snap-start">
            <ResourceCard resource={resource} />
          </li>
        ))}
      </ul>
    </section>
  );
}
```

Create `src/components/public/WelcomeBand.tsx`:

```tsx
/**
 * PRD 5.1 item 1. The copy is editable from admin, so it comes from
 * `site_content` rather than `en.json` -- these are the keys the seed writes
 * (`welcome_title`, `welcome_body`, `welcome_cta`) and the keys SP3's Site
 * Content editor will write. An editor's change must appear without a
 * rebuild, which is what the `site-content` cache tag is for.
 *
 * Because every string here is editor-supplied at runtime, there is no
 * hardcoded copy for the JSX guard to catch and nothing to route through
 * t(). If a key is missing the element is omitted rather than falling back
 * to a default sentence: invented copy on the home page of a UN programme is
 * the same defect class as an invented number.
 */
export default function WelcomeBand({ content }: { content: Record<string, string> }) {
  const title = content.welcome_title;
  const body = content.welcome_body;
  const cta = content.welcome_cta;
  if (!title && !body) return null;

  return (
    <section className="mx-auto max-w-4xl px-4 py-16 text-center">
      {title ? <h1 className="text-4xl font-semibold text-navy">{title}</h1> : null}
      {body ? <p className="mt-4 text-lg text-muted">{body}</p> : null}
      {cta ? (
        <a
          href="#directory"
          className="mt-8 inline-block rounded-lg bg-primary px-6 py-3 text-surface"
        >
          {cta}
        </a>
      ) : null}
    </section>
  );
}
```

Create `src/components/public/HeroSearch.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n';

/**
 * PRD 5.1 item 3: prominent search above the fold. It writes `?q=` and jumps
 * to the directory, which owns the filtering -- there is one implementation
 * of search on this page, not two.
 *
 * This component calls useRouter but not useSearchParams, so it needs no
 * Suspense boundary and the band above it still prerenders.
 */
export default function HeroSearch() {
  const router = useRouter();
  const [value, setValue] = useState('');

  return (
    <section className="mx-auto max-w-3xl px-4 pb-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const query = value.trim();
          router.replace(query === '' ? '/#directory' : `/?q=${encodeURIComponent(query)}#directory`);
        }}
      >
        <label className="block">
          <span className="sr-only">{t('home.searchHeading')}</span>
          <input
            type="search"
            className="w-full rounded-lg border border-hairline px-5 py-4 text-lg"
            placeholder={t('filter.search')}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
      </form>
    </section>
  );
}
```

- [ ] **Step 6: Run the band test to verify it passes**

Run: `npx vitest run tests/components/bands.test.tsx`
Expected: PASS (10 tests).

- [ ] **Step 7: Assemble the home page**

Replace `src/app/(public)/page.tsx`:

```tsx
import { Suspense } from 'react';
import WelcomeBand from '@/components/public/WelcomeBand';
import StatsBand from '@/components/public/StatsBand';
import HeroSearch from '@/components/public/HeroSearch';
import BrowseByNeed from '@/components/public/BrowseByNeed';
import FeaturedCarousel from '@/components/public/FeaturedCarousel';
import PartnerRow from '@/components/public/PartnerRow';
import RecentlyAddedRail from '@/components/public/RecentlyAddedRail';
import ResourceDirectory from '@/components/public/ResourceDirectory';
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
 * directory on the same page.
 *
 * Every band hides itself when it has no rows, so the page reads as finished
 * rather than broken while the client's data is still arriving. The five
 * readers are awaited together rather than in sequence: five sequential
 * round trips would be five times the latency for no benefit.
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
      <HeroSearch />
      <BrowseByNeed counts={needCounts} />
      <FeaturedCarousel resources={resources} />
      <PartnerRow partners={partners} />
      <RecentlyAddedRail resources={resources} />
      {/* Only this subtree calls useSearchParams(), so only this subtree
          needs the boundary — everything above still prerenders. */}
      <Suspense fallback={null}>
        <ResourceDirectory resources={resources} />
      </Suspense>
    </>
  );
}
```

- [ ] **Step 8: Run everything**

Run: `npm run build && npm test && npm run typecheck && npm run lint`
Expected: PASS, including the copy guard — `WelcomeBand` renders only editor-supplied strings and every other band goes through `t()`.

- [ ] **Step 9: Acceptance check against the running app**

1. `/` renders the welcome band, browse-by-need with true counts, featured, partners (names, since no logo has been uploaded), recently added, and the directory.
2. The stats band is **absent**, because `headline_stats` has no rows. Confirm with `select count(*) from headline_stats;` → 0.
3. Insert one attested row with `source`, `attested_by` and `attested_on`, call the reader again (restart dev or wait out the tag), and confirm the band appears with **exactly that one figure** and nothing standing in for the other fourteen. Delete the row afterwards.
4. Clicking a need chip lands on `/?need=<key>#directory` with the directory filtered.
5. The browse counts match the number of cards shown when that need is selected.

- [ ] **Step 10: Commit**

```bash
git add src/components/public tests/components src/app/\(public\)/page.tsx src/locales/en.json vitest.config.ts package.json package-lock.json
git commit -m "feat(public): the seven home bands

Every band hides when it has no rows, so the page reads as finished rather
than broken while the client's data is still arriving.

The stats band is the one that matters: headline_stats cannot hold a row
without source, attested_by and attested_on, so no rows means nobody has
vouched for a number yet and the honest response is no band -- not zeros, not
a placeholder, not an apology. A partial set is the expected state, since the
fifteen figures arrive over time, so the band renders exactly what exists and
never waits for a complete set.

Bands take rows as props rather than fetching: an async server component
cannot be rendered by a test renderer, and seven independent fetches would
serialise seven round trips. The page awaits all five readers together."
```

---

### Task 7: About, Privacy, Terms, and the Impact gate

**Files:**
- Create: `src/app/(public)/about/page.tsx`, `privacy/page.tsx`, `terms/page.tsx`, `impact/page.tsx`
- Create: `tests/components/impact-gate.test.ts`
- Modify: `src/locales/en.json`, `tests/structure/routes.test.ts`

**Interfaces:**
- Consumes: `getSiteContent`, `listHeadlineStats`, `listImpactStories`, `isFeatureEnabled` from `@/lib/public/readers`.
- Produces: four routes. `/impact` calls `notFound()` while its flag is off.

- [ ] **Step 1: Add the locale keys**

Add to `src/locales/en.json`:

```json
  "about.title": "About the AI Hub for Sustainable Development",
  "about.statsHeading": "By the numbers",
  "about.contactHeading": "Contact",
  "privacy.title": "Privacy",
  "privacy.pending": "The privacy notice is being finalised. For any question about how the AI Hub for Sustainable Development handles your data, write to the address below.",
  "terms.title": "Terms",
  "terms.pending": "The terms of use are being finalised. For any question, write to the address below.",
  "impact.title": "Impact",
  "impact.empty": "Impact stories will appear here once they are published."
```

The Privacy and Terms pages ship with a factual holding sentence and render `site_content` over it when the legal-reviewed copy arrives (PRD §5.8: "copy minimal and factual pending legal review"). They do not invent a policy, and they do not ship blank — a blank legal page on a UN surface is worse than one saying the notice is being finalised.

- [ ] **Step 2: Write the failing gate test**

Create `tests/components/impact-gate.test.ts`:

```ts
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
  it('is linked from no component and no page', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const files: string[] = [];
    (function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx$/.test(entry) && !full.includes(join('impact'))) files.push(full);
      }
    })('src');

    const offenders = files.filter((file) => /["'`]\/impact\b/.test(readFileSync(file, 'utf8')));
    expect(
      offenders,
      'PRD 5.7: no navigation links to /impact while feature_public_impact_page is off',
    ).toEqual([]);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run tests/components/impact-gate.test.ts`
Expected: FAIL with an unresolved import for `@/app/(public)/impact/page`.

- [ ] **Step 4: Write the Impact page**

Create `src/app/(public)/impact/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { t } from '@/lib/i18n';
import { isFeatureEnabled, listImpactStories } from '@/lib/public/readers';

/**
 * PRD 5.7. Built now, dark until the flag flips.
 *
 * CLAUDE.md: build the flag, not the feature -- but this page IS the feature
 * the flag gates, and the PRD says explicitly it is built and returns 404
 * while off. That is different from the innovator profiles, which are not
 * built at all.
 *
 * The gate short-circuits before any read: a 404 that still queried would
 * leak load and timing for a page nobody is supposed to reach. There is also
 * deliberately no `generateMetadata` here -- metadata for a 404 is metadata
 * for a page that does not exist.
 */
export default async function ImpactPage() {
  if (!(await isFeatureEnabled('feature_public_impact_page'))) notFound();

  const stories = await listImpactStories();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold text-navy">{t('impact.title')}</h1>
      {stories.length === 0 ? (
        <p className="mt-6 text-muted">{t('impact.empty')}</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-8">
          {stories.map((story) => (
            <li key={story.id}>
              <h2 className="text-lg font-semibold text-navy">{story.organisation}</h2>
              {story.country ? <p className="text-sm text-muted-light">{story.country}</p> : null}
              {story.description ? <p className="mt-2 text-muted">{story.description}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run the gate test to verify it passes**

Run: `npx vitest run tests/components/impact-gate.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Write the About page**

Create `src/app/(public)/about/page.tsx`:

```tsx
import { t } from '@/lib/i18n';
import { getSiteContent, listHeadlineStats } from '@/lib/public/readers';

/**
 * PRD 5.6: editable identity copy plus all headline stats, and the single
 * mailbox.
 *
 * Unlike the home strip this renders every attested figure, not the first
 * four heroes -- but the rule is the same: only figures that exist, nothing
 * standing in for the ones that do not, and no band at all when there are
 * none. The client supplies the fifteen figures over time, so the partial
 * state is the normal state, not an error condition.
 *
 * The compute snapshot is not here. PRD 10 places `compute_metrics` on the
 * admin Reach and Engagement screen; the prototype showed it publicly, and
 * the PRD is authoritative over the prototype.
 */
export default async function AboutPage() {
  const [content, stats] = await Promise.all([getSiteContent(), listHeadlineStats()]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold text-navy">{t('about.title')}</h1>

      {content.identity_lead ? (
        <p className="mt-6 text-lg text-muted">{content.identity_lead}</p>
      ) : null}
      {content.identity_align ? (
        <p className="mt-4 text-muted">{content.identity_align}</p>
      ) : null}

      {stats.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-navy">{t('about.statsHeading')}</h2>
          <dl className="mt-6 grid gap-6 sm:grid-cols-2">
            {stats.map((stat) => (
              <div key={stat.id}>
                <dt className="text-2xl font-semibold text-primary">{stat.value}</dt>
                <dd className="mt-1 text-sm text-muted">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-navy">{t('about.contactHeading')}</h2>
        <p className="mt-2 text-muted">
          <a className="text-primary underline" href={`mailto:${t('site.contactEmail')}`}>
            {t('site.contactEmail')}
          </a>
        </p>
      </section>

      <p className="mt-12 text-sm text-muted-light">{t('site.footer')}</p>
    </div>
  );
}
```

The contact **form** PRD §5.6 also names is a write path and ships in SP2b with the other three endpoints; the mailbox link works today and needs nothing from SP4.

- [ ] **Step 7: Write Privacy and Terms**

Create `src/app/(public)/privacy/page.tsx`:

```tsx
import { t } from '@/lib/i18n';
import { getSiteContent } from '@/lib/public/readers';

/**
 * PRD 5.8: copy minimal and factual pending legal review. The page renders
 * `site_content.privacy_body` the moment SP3's editor supplies the reviewed
 * text; until then it states plainly that the notice is being finalised and
 * points at the one mailbox.
 *
 * It does not invent a policy. It also does not ship blank: a blank legal
 * page on a UN programme surface reads as an oversight, where a sentence
 * saying the notice is pending is simply true.
 */
export default async function PrivacyPage() {
  const content = await getSiteContent();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold text-navy">{t('privacy.title')}</h1>
      <p className="mt-6 whitespace-pre-line text-muted">
        {content.privacy_body ?? t('privacy.pending')}
      </p>
      <p className="mt-6">
        <a className="text-primary underline" href={`mailto:${t('site.contactEmail')}`}>
          {t('site.contactEmail')}
        </a>
      </p>
    </div>
  );
}
```

Create `src/app/(public)/terms/page.tsx` identically, substituting `terms.title`, `content.terms_body` and `t('terms.pending')`.

- [ ] **Step 8: Update the route assertion**

In `tests/structure/routes.test.ts`, extend the public route list:

```ts
  it('builds only the public pages SP2a owns', () => {
    // PRD 5. /impact is built and returns 404 at runtime while
    // feature_public_impact_page is off (PRD 5.7), so it is correct for it to
    // appear here — the gate is in the page, not in the route table.
    const publicUrls = Object.entries(routes())
      .filter(([source]) => source.startsWith('/(public)/'))
      .map(([, url]) => url);
    expect(publicUrls.sort()).toEqual([
      '/',
      '/about',
      '/impact',
      '/privacy',
      '/resources/[id]',
      '/terms',
    ]);
  });
```

- [ ] **Step 9: Run everything**

Run: `npm run build && npm test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 10: Acceptance check against the running app**

1. `/about` renders the identity copy and the mailbox, with **no** stats section (no attested figures exist).
2. `/privacy` and `/terms` render the pending sentence and the mailbox.
3. `/impact` returns **404**.
4. Flip the flag with `update settings set value = 'true'::jsonb where key = 'feature_public_impact_page';`, restart dev, and confirm `/impact` renders with its empty state. Flip it back to `false` and confirm the 404 returns.
5. Search the rendered HTML of `/`, `/about`, `/privacy` and `/terms` for `/impact` — it must not appear.
6. Every page returns `X-Robots-Tag: noindex, nofollow` (`curl -sI localhost:3000/about | grep -i robots`).

- [ ] **Step 11: Commit**

```bash
git add "src/app/(public)/about" "src/app/(public)/privacy" "src/app/(public)/terms" "src/app/(public)/impact" tests/components/impact-gate.test.ts tests/structure/routes.test.ts src/locales/en.json
git commit -m "feat(public): about, privacy, terms and the 404-gated impact page

/impact is built and dark: the gate short-circuits before any read, because
a 404 that still queried would leak load and timing for a page nobody is
supposed to reach. It has no generateMetadata -- metadata for a 404 is
metadata for a page that does not exist -- and a source scan asserts nothing
links to it while the flag is off.

About renders every attested figure rather than the home strip's first four,
and no section at all when there are none. The compute snapshot is not here:
the prototype showed it publicly, PRD 10 puts it on the admin Reach screen,
and the PRD is authoritative over the prototype.

Privacy and Terms carry a factual holding sentence and render site_content
over it when the reviewed copy arrives. They invent no policy and they do not
ship blank."
```

---

### Task 8: The gated Vercel deploy

**Files:**
- Create: `docs/deployment.md`
- Modify: `.env.example` (already carries every name; verify), `README.md` if one exists

**Interfaces:**
- Consumes: everything above.
- Produces: a reachable, protected, `noindex` deployment and the DNS record documentation Definition-of-Done item 15 requires.

**This task needs operator credentials.** Connecting a Vercel project and setting environment variables cannot be done by an implementer subagent. The implementable half is the documentation and the verification checklist; the connection steps are for the human. Write the doc first, then walk the checklist together.

- [ ] **Step 1: Write the deployment document**

Create `docs/deployment.md` covering, in this order:

1. **What is deployed and what is not.** SP2a is the read surface only. There are no write endpoints, so there is no form to abuse — which is why this can go up before SP4's Turnstile, honeypots, rate limiting, CSP and HSTS land.
2. **Why it is gated.** Vercel Deployment Protection is on, and `next.config.ts` sends `X-Robots-Tag: noindex, nofollow` on every route while the root layout sets `robots: { index: false, follow: false }`. Both stay until the client dataset replaces the placeholder seed — real innovators must not apply to placeholder opportunities.
3. **Environment variables**, by name only, never by value: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. State that the service role key is set on Vercel for SP3's server actions and must never gain a `NEXT_PUBLIC_` prefix.
4. **DNS records** for the eventual subdomain: the `CNAME` target Vercel issues, and a note that SPF/DKIM for the digest sender is SP5's, not this task's.
5. **The launch checklist that must run before protection comes off**: client dataset seeded, the fifteen figures attested with sources, partner logos and URLs uploaded, legal-reviewed Privacy and Terms copy in `site_content`, SP4 merged, `noindex` removed from both places, sitemap and `robots.txt` added by SP6.

- [ ] **Step 2: Connect the project (operator)**

Import the repository into Vercel, set the four environment variables above for the Preview and Production environments, and enable Deployment Protection for both.

- [ ] **Step 3: Verify the deployed site**

Against the deployed URL, confirm and record each:

1. The site requires the protection bypass to load at all.
2. `curl -sI <url>/ | grep -i x-robots-tag` returns `noindex, nofollow`; same for `/about` and a resource detail URL.
3. `/` renders the bands that have data.
4. A resource detail page resolves.
5. `/impact` returns 404.
6. The page source contains no `service_role` key and no `sb-` service token — search the built JS for `service_role`.
7. Publish a resource in the database, invalidate, and confirm its detail page resolves on the deployed site **without a redeploy**. This is the `dynamicParams` behaviour Task 5 relies on, and a build-time-only route table would fail it silently.

- [ ] **Step 4: Commit**

```bash
git add docs/deployment.md
git commit -m "docs: gated deploy runbook and the pre-launch checklist

Records what must be true before Deployment Protection comes off: the client
dataset in place of the placeholder seed, the fifteen figures attested with
sources, partner logos and URLs uploaded, legal-reviewed privacy and terms
copy, SP4 merged, and noindex removed from both places it is set.

Real innovators applying to placeholder opportunities is the failure this
gate exists to prevent."
```

---

## Verification

After Task 8, the whole of SP2a:

```bash
npm run db:reset && npm run build && npm test && npm run typecheck && npm run lint
```

Then, against the running application:

- Every `*_public` view queried **as `anon`** returns the expected columns; no base table is reachable
- `/` renders the bands that have data and omits those that do not
- A filter click updates the query string without a scroll jump; reloading that URL reproduces the same result set
- Export produces CSV and Excel whose columns are a subset of `resources_public`
- A resource whose deadline is today shows as open with zero days left; yesterday shows Closed; **both remain listed and reachable**
- Publishing a resource after deploy makes `/resources/[id]` resolve without a rebuild; unpublishing returns 404
- `/impact` returns 404 and appears in no navigation or link
- Every page serves `noindex` while gated

## What SP2a deliberately does not do

- **SP2b:** the four write endpoints, the alerts and suggest-a-resource modals, suggest-an-update, the contact form, and event capture. Capture waits because nothing is public before SP4, so there is no reach to lose.
- **SP3:** every admin screen, including the Site Content editor and the `revalidateTag` call sites. SP2a exports `CACHE_TAGS` and the reader signatures as the interface and contains no editing UI, no write workflow and no `revalidateTag` call of its own.
- **SP4:** CSP, HSTS, Turnstile, honeypots, rate limiting, payload caps, and the image-host policy that `next/image` would need.
- **SP6:** sitemap, `robots.txt`, GA4 read-back, the locale switcher, the WCAG audit, and Core Web Vitals verification.
