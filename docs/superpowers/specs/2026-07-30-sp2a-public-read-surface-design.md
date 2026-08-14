# SP2a: Public read surface — design

Date: 2026-07-30
Status: approved, ready for an implementation plan
Supersedes for SP2: the single-row description of "Public surface" in
`docs/superpowers/specs/2026-07-26-askhub-decomposition-design.md` §4

## Context

SP1 delivered the data spine: 14 migrations, 17 base tables with RLS on every one, eight
`*_public` views that are the entire anonymous read surface, a schema-wide security guard
suite, design tokens, the self-hosted Outfit font, and placeholder content. 246 tests pass.
There is no user interface beyond placeholder pages.

**The target is a real public launch**, not the gated stakeholder review the decomposition doc
assumed. That assumption predates the prototype changing and the client dataset being late.
Two things follow immediately:

- **The placeholder seed cannot go public.** Real innovators would apply to placeholder
  opportunities. The client dataset must replace it before launch.
- **SP2 alone is not shippable.** Turnstile, honeypots, rate limiting, CSP and HSTS are SP4,
  and a public launch needs them.

Because the write endpoints cannot safely go public without SP4, SP2 splits at that seam:

- **SP2a (this spec)** — the read surface. Reads the `*_public` views, writes nothing, has no
  abuse surface. Deploys gated with `noindex` for stakeholder review.
- **SP2b (later, sequenced with SP4)** — the four write endpoints, the alerts and
  suggest-a-resource modals, suggest-an-update, and event capture.

**Event capture waits for SP2b, and that costs nothing.** PRD §8.1 makes capture a launch
requirement because unrecorded reach cannot be recovered retroactively — but nothing is public
before SP4, so there is no reach to lose. Capture goes live with the first real traffic.

## Decisions

| # | Decision | Reason |
|---|---|---|
| D1 | Home and directory are **one page**; filter state lives in `/`'s query string | PRD §5.1 item 8 puts the directory on the home page; §5.2 needs shareable URLs. One canonical URL, one page to make responsive. Matches the prototype. |
| D2 | Fetch all live resources once server-side, **filter in the browser** | One cache entry to invalidate rather than one per filter combination; instant filtering; four-field free-text search is trivial in memory. The directory is curated — tens to low hundreds of rows. |
| D3 | A band with **no rows hides entirely** | The page reads as finished rather than broken. One rule, no special cases. |
| D4 | Export ships **SheetJS client-side** for CSV and Excel, **dynamically imported** on first click | PRD §5.2 mandates both formats. Dynamic import keeps ~400KB out of the initial bundle, so no Core Web Vitals cost. |
| D5 | **SQL owns deadline state; TypeScript formats it** | Otherwise two implementations of the same closure rule. |
| D6 | JSON-LD is built in SP2a with the detail page | It belongs to that page and is a few lines. Revisiting every detail page in SP6 costs more. The sitemap stays SP6. |

## Architecture and data flow

### Routes

```
/                     home: seven bands + the directory
/?need=compute        filtered directory, shareable
/resources/[id]       resource detail
/about  /privacy  /terms
/impact               built, returns notFound() while the flag is off
```

There is no `/directory` route. Browse-by-need chips scroll to the directory band and set the
query string.

The seven bands, in PRD §5.1's order, then the directory as item 8 on the same page:

1. Welcome and orientation — heading, body, CTA, from `site_content`
2. Headline reach strip — the first four hero stats from `headline_stats_public`
3. Search
4. Browse by need — five need types with live counts from `need_counts_public`
5. Featured opportunities carousel — `is_featured` rows
6. Partner logo row — each logo links to the partner's own site (rule 10.10)
7. Recently added rail — by `added_date`
8. The full directory

### Reads use the anon client, never the admin client

`service_role` has **no SELECT** on the eight `*_public` views — the grant is
`to anon, authenticated` only. A server component reaching for the admin client gets `42501`.

Public reads therefore use a **dedicated no-cookie anon client**, not the request-scoped server
client carrying an admin's session. This is also the correct security posture: the views *are*
the public contract.

**No public component may fall back to the admin client when an anonymous query fails.** A read
failure surfaces as an error; it never silently re-reads with more privilege.

The views are `security_invoker = false` **deliberately**, and this is recorded rather than
inherited: `anon` holds zero privileges on every base table, so the views must read as owner for
the public site to work at all. Every column is enumerated explicitly so a later `select *`
cannot silently widen exposure.

### Cached readers and dependency-specific tags

`src/lib/public-data.ts` exposes one cached reader per dataset. Each carries the smallest
accurate tag set. SP3's editor saves call `revalidateTag` against these tags after a successful
transaction — the tags must exist now even though nothing invalidates them until SP3.

| Reader | Tag | Time-based revalidate |
|---|---|---|
| `resources_public` | `resources` | **yes — `RESOURCE_TTL`** |
| `need_counts_public` | `resources` | no |
| `partners_public` | `partners` | no |
| `site_content_public` | `site-content` | no |
| `headline_stats_public` | `headline-stats` | no |
| `impact_stories_public` | `impact-stories` | no |

Two of the eight views have **no public reader in SP2a**, and that is deliberate rather than an
omission. `programmes_public` carries internal programme records (PRD §4.8) and
`compute_metrics_public` feeds the admin Reach and Engagement screen (PRD §10) — neither
renders on a public page. The views exist and stay in the anonymous security tests; no reader
is written for them.

`impact_stories_public` has a reader but no reachable caller while
`feature_public_impact_page` is off. It is built so the page works the day the flag flips.

**`resources_public` needs time-based revalidation because time passes without a database
edit.** `is_closed` and `days_left` are computed with `CURRENT_DATE`, so a page cached at 23:50
with `days_left = 1` keeps serving that after midnight — no editor touched anything, so no tag
is invalidated. Tag invalidation alone is insufficient for clock-dependent data.

`need_counts_public` is resource-derived but **not** deadline-derived — it groups by
`need_primary` where `status = 'live'`, with no `CURRENT_DATE` in it. It needs the `resources`
tag but not a TTL.

`RESOURCE_TTL` is a single named constant. **The maximum deadline-display staleness is
`RESOURCE_TTL` after UTC midnight**, and that bound is documented at the constant.

**The authoritative timezone is UTC.** `show timezone` returns UTC and `CURRENT_DATE` is
evaluated there, so the day boundary is UTC midnight. This is a product decision, not a session
default, and is recorded as such.

### Deadline state: SQL owns the rule, TypeScript formats

`resources_public` supplies `{ deadline, is_closed, days_left }`. A pure formatter turns those
into a label:

```ts
export function deadlineLabel(input: {
  deadline: string | null; isClosed: boolean; daysLeft: number | null;
}): string
```

It **never reads a clock** and never decides whether a deadline has passed. `deadlineInfo()` in
`src/lib/deadline.ts` stays for SP3's admin "expiring soon" flagging, which legitimately
computes — but it does not appear anywhere in the public card path.

### Closed resources stay listed and reachable

`resources_public` filters on `status = 'live'` **only**, never on deadline. Closed resources
remain in the view with `is_closed = true` and render with a Closed badge. This is PRD §4.2 as
specified: a past deadline changes the display, never the status.

Listing eligibility and detail visibility are therefore **the same rule**, and it is
deadline-independent. `notFound()` fires only when a row is absent from `resources_public` —
i.e. its status is not `live`.

### Detail pages must work without a rebuild

`generateStaticParams` pre-generates known detail pages, but a resource published after
deployment must still resolve. The deploy mode must permit runtime generation of paths not
known at build time. Verified by acceptance test, not assumed.

### URL as the single source of filter state

The URL is authoritative. Controls write a normalised `URLSearchParams`; there are **not** two
synchronisation effects copying state back and forth. Search input may hold transient local
state for debouncing, but committed filter state comes from the URL.

- Unknown or invalid values fall back to defaults
- Empty and default parameters are removed rather than serialised
- Unrelated parameters are preserved when one filter changes
- Sorting carries a stable tie-breaker (resource id)
- `router.replace(..., { scroll: false })`
- The smallest subtree calling `useSearchParams()` is wrapped in `Suspense`

**Documented trigger for revisiting D2:** if the live dataset grows into the low thousands of
substantial rows, shipping every row for browser filtering stops being appropriate and
filtering moves server-side. Not a problem now; recorded so the decision is deliberate later.

## The shared component layer

Task 2 of the breakdown below. Five pieces, all pure functions over data, testable without
rendering:

- **`deadlineLabel(input)`** — formats supplied SQL state, as above
- **`ResourceCard`** — consumes a `resources_public` row; badges, partner, need, eligibility,
  deadline label, apply link with `rel="noopener noreferrer"` and `target="_blank"`
- **`filterResources(rows, criteria)`** — four facets plus free-text across name, partner,
  description, sub-category
- **`parseFilters(searchParams)` / `toSearchParams(criteria)`** — the normalised round trip
- **`sortResources(rows, mode)`** — Featured first, Recently added, stable tie-breaker

Isolating these in their own task means the riskiest logic is reviewed on its own and later
tasks compose verified pieces rather than reinventing them inline where they would only be
reachable through a rendered page.

## Error handling and empty states

Three empty cases, deliberately distinct:

1. **A band with no rows** — hides entirely (D3)
2. **Directory with zero matches after filtering** — stays visible with a recovery path; the
   user caused this and needs a way back
3. **Directory with no live resources at all** — a different message; a content problem, not a
   filter problem. Conflating the two would tell someone to remove a filter when none is set

**A failed read shows an error, never a plausible substitute.** Route-level `error.tsx` per
segment. No fallback to the admin client. No fallback to hardcoded copy. This mirrors the
metric-attestation principle: an honest gap beats a plausible fake, and a public page quietly
serving invented content is worse than one saying it broke.

## Content rules and the guards that hold them

`tests/unit/i18n.test.ts` already scans every key in `src/locales/en.json` for all content
rules — co-led attribution, never "the Hub" alone, one mailbox, no per-resource "Verified", no
"Global programmes", "Democratic Republic of the Congo" in full, the exact §10.1 footer. SP2a
adds roughly 40–60 keys and every one is scanned automatically.

**This inverts how seriously the no-hardcoded-strings convention must be taken. It is not
style — it is the mechanism that makes the content rules enforceable.** A string written
directly into a `.tsx` file escapes every check.

### The JSX text-literal guard

A new AST-based structure test, `tests/structure/no-hardcoded-copy.test.ts`. **AST, not regex** —
a regex over JSX cannot reliably distinguish a text node from a class name.

Flags:
- `JSXText` nodes and string children
- User-facing attributes: `aria-label`, `title`, `placeholder`, `alt`

Allows only clearly non-user-facing literals: punctuation, URLs, technical identifiers, schema
keys, `className`, `data-*`.

Failures report **file and line**. **No broad file-level exemptions** — an exemption is
per-occurrence with a stated reason, visible in the diff.

Two rules land structurally rather than by vigilance: the country filter draws from
`reference.ts`'s 18 partner countries, which has no "Global programmes" entry, and there is no
per-resource `verified` column in the schema for a badge to read.

### Share pop-up

Pre-written text lives in `en.json` — so it is rule-policed and localisable — and the user edits
it in the modal before sending. Four channels: copy link, LinkedIn, email, WhatsApp.

## Structured data (JSON-LD)

Built with the detail page, per D6.

- Generated **server-side**, using **only fields from `resources_public`**
- **Optional properties are omitted when data is absent, never invented**
- No private or analytics field can enter it — structurally true, since the view carries none
- A focused semantic test asserts the expected public fields and the exclusions

**Type: `schema.org/Offer`.** PRD §12.2 requires `schema.org` structured data on resource
detail pages but names no type, so SP2a picks one and fixes it here rather than leaving it to
the implementer. `Offer` is chosen because it is the only type whose standard properties cover
every field the detail page already carries, across all five need types — funding, compute,
training, accelerator and partners — without stretching. The mapping:

| `Offer` property | Source column | Omitted when |
|---|---|---|
| `name` | `name` | never — `NOT NULL` |
| `description` | `description` | absent |
| `url` | `external_url` | absent |
| `offeredBy` (`Organization` with `name`, optional `url`) | `partner_name`, `partner_website_url` | `url` omitted when the partner has none |
| `image` | `banner_image_url` | absent |
| `availabilityEnds` | `deadline` | no deadline |
| `eligibleRegion` | `countries_eligible` | empty array |
| `availability` | `is_closed` → `Discontinued`, else `InStock` | never |

Nothing outside that table enters the object. Because the source is `resources_public`, which
projects no `views`, `clicks`, `ctr`, submitter email or internal note, the exclusion is
structural — the test asserts it rather than establishing it.

The sitemap stays SP6. The site is `noindex` while gated, so this is inert until launch, but it
will be correct when the flag flips.

## Testing

Test the security boundary and the logic, not the presentation.

| What | How |
|---|---|
| Anonymous read scope | Query all 8 `*_public` views **as `anon`**; assert exact columns and row visibility |
| Public export field exclusion | Export column set is a subset of `resources_public`'s **and** contains no `views`/`clicks`/`ctr`/submitter email/internal note |
| SQL deadline boundary | `deadline = current_date` → `is_closed = false`; `current_date - 1` → `true` |
| `deadlineLabel` | Injected `{deadline, isClosed, daysLeft}`: null, closed, 0, 1, n |
| `filterResources` | Each facet, combinations, free-text across all four fields, no-match |
| `parseFilters` / `toSearchParams` | Round-trip stability, unknown → default, empties dropped, unrelated preserved |
| `sortResources` | Both modes, tie-breaker determinism |
| Publish / unpublish reachability | Publish post-deploy, invalidate, hit `/resources/[id]`; unpublish → `notFound()` |
| Partial attested stats | 0 rows → the band is absent; N rows → exactly those N render and nothing stands in for the missing ones |
| JSON-LD | Expected public fields present, private/analytics fields absent, optionals omitted when data absent |
| No hardcoded copy | The AST guard above |

**Not tested:** markup snapshots, class names, whether a button looks right. Responsive
behaviour and WCAG are SP6's verification.

**One honest boundary.** The deadline *rule* is ours and is tested by the SQL row above. The
*cache expiry* is Next's revalidation contract; we configure `RESOURCE_TTL` and document the
staleness bound. No test sleeps across midnight, and asserting the constant's value would test
configuration rather than behaviour.

## Scope

### In SP2a

The seven home bands, the directory, resource detail with share pop-up and JSON-LD, about,
privacy, terms, `/impact` built and 404-gated, the shared component layer, the AST copy guard,
and the gated Vercel deploy (Definition-of-Done item 15).

**Capability is in scope even where content is client-blocked.** The distinction matters:

| Content (blocked) | Capability (SP2a must deliver) |
|---|---|
| Partner logos and URLs | Logo rendering and linking, so a logo works the day it arrives; name-only row until then |
| The fifteen attested figures | The stats band rendering a **partial** set — only attested figures show, the rest are hidden, and the band never blocks on a complete set |
| Legal-reviewed Privacy and Terms | The pages exist and render `site_content`, ready to receive copy |
| The real client dataset | Everything renders from `resources_public` regardless of which rows are in it |
| — | Empty-state handling for every one of the above |
| — | The **public half** of the portal-editing mechanism: tagged cached readers that respond to invalidation. The admin UI that triggers it is SP3. |

**The SP2a / SP3 seam, stated precisely.** SP2a builds public-side capability only: the schema
fields and public views (already delivered by SP1 — SP2a consumes them and adds none), typed
readers, cache tags, rendering for logos and partially attested statistics, legal-page shells,
and the ability for those readers to reflect invalidation. SP3 owns the admin-side mutation
capability: editing screens, validation, save actions, permissions, and the calls that
invalidate or update the relevant tags after a successful write.

SP2a **may** export reusable tag names and helper contracts for SP3 to call — a single
`CACHE_TAGS` constant and the reader signatures are the interface. SP2a must **not** contain an
editing UI, an admin write workflow, or any `revalidateTag` call site of its own.

### Not in SP2a

- **SP2b:** the four write endpoints, alerts and suggest-a-resource modals, suggest-an-update,
  event capture
- **SP4:** CSP, HSTS, Turnstile, honeypots, rate limiting, payload caps
- **SP6:** sitemap, GA4 read-back, locale switcher, WCAG audit, Core Web Vitals verification
- **SP3:** every admin screen, including the Site Content editor

`/impact` returns `notFound()` while `feature_public_impact_page` is off, and carries **no
navigation link, no internal link, no sitemap entry and no generated metadata** while it is off.

## Task breakdown

Eight tasks. The order is a dependency order: each builds on verified pieces from the last, and
the riskiest logic lands in task 3 where it is reviewed on its own. See
`docs/superpowers/plans/2026-07-30-sp2a-public-read-surface.md` for the step-by-step version.

1. **The cached data layer** — the no-cookie anon client, the six readers, `CACHE_TAGS` and
   `RESOURCE_TTL`, the domain types and mappers, and migration `0016_settings_public.sql`
2. **The AST copy guard and the layout shell** — header and footer with no login link or admin
   reference (PRD §5.8)
3. **Shared logic** — `deadlineLabel`, `filterResources`, `parseFilters` / `toSearchParams`,
   `sortResources`, `ResourceCard`
4. **The directory** — filters, search, sort, count, export, URL state, the three distinct empty
   states
5. **Resource detail** — banner through apply button, share pop-up, JSON-LD, `notFound()` for a
   row absent from `resources_public`
6. **Home bands** — the seven bands in PRD §5.1 order, each hiding when it has no rows
7. **Static pages and the Impact gate** — About, Privacy, Terms, and `/impact` built and
   404-gated with no link to it
8. **Gated Vercel deploy** — DoD item 15, reachable, `noindex`, DNS records documented

The copy guard is written in task 2, alongside the first component that has anything to catch,
so every later task is held to it as it is written rather than retrofitted at the end.

**One planning correction to record here.** This document says SP2a adds no views. It has to add
one: `/impact` is gated on `settings.feature_public_impact_page`, and `anon` holds nothing on
`public.settings`, so there is no anonymous path to the flag. Migration `0016` projects **only**
the two `feature_*` keys. The alternative — rendering a public page through the `service_role`
client — is the pattern the "never fall back to the admin client" rule above exists to prevent.

## Verification

Per task, the SDD loop enforces TDD red-then-green, the full suite, typecheck, lint, and a task
review that verifies claims against the running application rather than the diff.

End to end for SP2a:

```bash
npm run db:reset && npm test && npm run typecheck && npm run lint && npm run build
```

Then, against the running app:

- Every `*_public` view queried as `anon` returns the expected columns; no base table is
  reachable
- `/` renders the bands that have data and omits those that do not
- A filter click updates the query string without a scroll jump; reloading that URL reproduces
  the same result set
- Export produces CSV and Excel whose columns are a subset of `resources_public`
- A resource whose deadline is today shows as open with zero days left; yesterday shows Closed;
  both remain listed and reachable
- Publishing a resource after deploy makes `/resources/[id]` resolve without a rebuild;
  unpublishing returns 404
- `/impact` returns 404 and appears in no navigation or link
- Every page serves `noindex` while gated
