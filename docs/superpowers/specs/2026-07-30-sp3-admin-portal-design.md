# SP3: Admin portal — design

Date: 2026-07-30
Status: **draft — three decisions need the human before this becomes a plan**
Branch: `sp3-admin-design`, cut from `sp2a/public-read-surface` at `f44c7d4`

## Why this exists now

SP2a is mid-flight. This document was written in parallel to buy schedule, and it
touches no source file. Everything in it is grounded in what the repository
actually contains at `f44c7d4` — every claim below was checked against a
migration, a policy, or a source file, and the ones I could not check are marked.

## What SP3 inherits, verified

| Dependency | State | Where |
|---|---|---|
| `requireRole(allowed: Role[])` | Built, returns `CurrentUser`, throws `UNAUTHENTICATED` / `FORBIDDEN` | `src/lib/auth.ts:70` |
| `getCurrentUser()` | Built; returns `null` for a deactivated account, so `is_active: false` is indistinguishable from no account | `src/lib/auth.ts:38` |
| 17 base tables, RLS on every one | Built | migrations `0001`–`0016` |
| `CACHE_TAGS` | Built and exported precisely so SP3's saves have tag names to invalidate | `src/lib/public/cache.ts:11-16` |
| `deadlineInfo()` | Deliberately kept for SP3's "expiring soon" flag; it computes from a clock, which is correct here and wrong on the public card path | `src/lib/deadline.ts` |
| Server-action contract | Written and binding | `src/lib/actions/README.md` |
| JSX copy guard | Active, scans **all** of `src/`, so every admin screen is policed as it is written | `tests/structure/no-hardcoded-copy.test.ts` |

That last row is worth stating plainly: SP3 starting after SP2a Task 2 rather
than before it means the admin screens cannot accumulate hardcoded copy that
someone has to audit later. The guard flags JSX text, string children, template
literals, both ternary branches, string concatenation, and eight user-facing
attributes.

## The role matrix, read off the actual policies

Not from the PRD's prose — from `grep 'create policy'` across the migrations:

| Table group | Write policy | Who |
|---|---|---|
| `resources`, `partners`, `partnerships`, `submissions`, `subscribers`, `site_content`, `headline_stats`, `compute_metrics`, `programmes`, `impact_stories`, `updates_log`, `digest_sends`, `contact_messages` | `*_write_staff` / `*_insert_staff` | admin **and** editor |
| `settings` | `settings_write_admin` | **admin only** |
| `profiles` | `profiles_insert_admin`, `profiles_update_admin`, `profiles_delete_admin` | **admin only** |
| `audit_log` | **none, for any role** | nobody |

Three consequences the UI must honour:

1. **`viewer` has no write policy anywhere.** It must see no write affordance on
   any screen — not a disabled button, no affordance at all. RLS would reject
   the write, but a viewer discovering a control that always errors is a defect
   in its own right.

2. **The Site Content screen has mixed permissions inside one screen.** PRD §6.7
   lists eight panels. Panels 1 and 2 — the GA4 Measurement ID and the two
   feature flags — write `settings`, which is **admin-only**. Panels 3–8 —
   welcome copy, identity copy, headline stats, compute snapshot, programmes,
   impact stories — are editor-writable. So an editor opening Site Content must
   see six editable panels and two they cannot change. This is the screen most
   likely to be built with a single screen-level role check and get it wrong.

3. **Team access is admin-only, and the prototype got this wrong.** Its Settings
   tab was `roles: ['admin','editor']` and included role changes, so an editor
   could promote themselves to admin. RLS already prevents it. SP3's UI must not
   reintroduce the affordance.

## The finding that most affects SP3's shape

**`audit_log` has no insert policy for any role, including admin.**
`authenticated` holds the INSERT *grant*, and RLS denies it anyway
(`supabase/migrations/0007_logs.sql:62-65`, whose own comment says "NO insert,
update or delete policy for ANY role, including admin"). Two triggers,
`audit_log_no_update` and `audit_log_no_delete`, raise on the other two verbs —
and `service_role` bypasses RLS but **not** triggers, which is what makes
append-only hold even against a key that ignores policies.

So a server action running on the caller's session **cannot write its own audit
row**. Every mutating action needs the `service_role` client for that one insert.

Consequences to carry forward:

- `src/lib/actions/README.md` says to "write the matching `audit_log` row inside
  the same action". That intent stands; the mechanism has to be the admin
  client, and the README should say so rather than leaving each implementer to
  rediscover it.
- **`createAdminSupabase()` finally gets a caller.** As of `f44c7d4` it is
  defined in `src/lib/supabase/admin.ts` and called nowhere under `src/`
  (verified by grep). SP2a's deployment runbook accordingly says SP2a needs no
  `SUPABASE_SERVICE_ROLE_KEY`. **That note must be updated when SP3 lands**, or
  the deployment will be missing a variable every admin write depends on.
- The audit write must not be able to succeed while the mutation it describes
  fails, or vice versa. Two clients means two connections, so a single
  transaction is not available. The honest options are: write the audit row
  last and treat its failure as a failed action, or move both into a
  `security definer` function. **This is decision 3 below.**

## Screens, and what each actually has data for

PRD §6's sidebar order: Dashboard, Resources, Review Queue, Reach & Engagement,
Partnerships, Alerts & Subscribers, Site Content, Updates, Audit Log.

**The hard rule collides with the schedule on two of these.** CLAUDE.md: metric
panels show true values or explicit empty states; a plausible fake number is a
launch-blocking defect on a UN leadership surface. And:

- `engagement_events` is empty and stays empty until **SP2b** ships event
  capture. So Dashboard's "Total reach", "Growth this week" and "Most-clicked
  resources", and most of Reach & Engagement's first-party section, have no data
  to show.
- `headline_stats` and `compute_metrics` are empty by construction — a row
  cannot exist without `source`, `attested_by` and `attested_on`, all `NOT NULL`
  and non-blank since migration `0015`.
- GA4 is unconfigured (`ga4_measurement_id` seeded `""`), which is what drives
  the "Not connected" state PRD §6.4 requires.

Which means: **Dashboard and Reach & Engagement are mostly empty states at
launch, and that is correct rather than unfinished.** The build must be the
empty-state rendering plus the queries that will fill it — not placeholder
numbers, and not a screen held back until data exists.

What genuinely has data now: Resources (20 placeholder rows), Site Content (5
keys), Partnerships (schema only), Audit Log (accumulates from the first admin
write), Updates (same), Review Queue (empty until SP2b's submission endpoint),
Alerts & Subscribers (empty until SP2b's signup endpoint).

## Architecture

Follows SP2a's shape, inverted:

- **Reads** use `createServerSupabase()` — the request-scoped client carrying the
  caller's cookies, so every admin query is subject to RLS *as that user*. Not
  the no-cookie anon client, which is SP2a's, and not `service_role`, whose
  reads would show a viewer rows their policies deny (`admin.ts`'s own docstring
  says exactly this).
- **Writes** are server actions in `src/lib/actions/`, one file per entity,
  each opening with `await requireRole([...])`, then a Zod parse, then the
  mutation on the caller's client, then the audit row on the admin client, then
  `revalidateTag`.
- **`revalidateTag` call sites live here and nowhere else.** SP2a deliberately
  shipped `CACHE_TAGS` and the tagged readers with no invalidation caller. PRD
  §6.7 and §13.4 make "an editor's save appears on the public site with no
  rebuild" binding, and that is only true if every write path calls it.
- Middleware (`src/proxy.ts`) already redirects unauthenticated `/admin`
  traffic. That is UX. The `requireRole` call inside each action is the boundary.

## Testing

Per CLAUDE.md: the security boundary and the logic, not the presentation.

| What | How |
|---|---|
| Role enforcement per action | Each action called as admin, editor, viewer, and unauthenticated; assert `FORBIDDEN` / `UNAUTHENTICATED` for the roles that must not pass |
| `viewer` sees no write affordance | Assert on the rendered control set, not on styling |
| Site Content mixed permissions | An editor gets panels 3–8 editable and 1–2 not; an admin gets all eight |
| Audit row per mutation | Every mutating action writes exactly one row, with `actor_name` and `entity_label` denormalised and `change_summary` rendered as prose |
| `audit_log` stays append-only | Update and delete rejected for every role including `service_role` (the triggers, not the policies) |
| Revalidation | Each write path calls `revalidateTag` with the tag its entity maps to |
| Expiring-soon computation | `deadlineInfo()` boundaries at 0, 1, 14 and 15 days |
| Digest subscriber matching | Named in CLAUDE.md as required coverage |

## Three decisions needed before this becomes a plan

**1. Scope: which screens are launch-blocking?** Nine screens is a large
sub-project, and two of them are mostly empty states until SP2b. A defensible
launch-minimum is **Resources + Site Content + Audit Log** — enough to curate
the directory, edit public copy, and have an accountability record — with Review
Queue, Alerts & Subscribers, Partnerships, Dashboard and Reach & Engagement
following. That would let SP3 split the way SP2 did.

**2. Does SP3 wait on SP2b, or interleave?** Review Queue has nothing to review
and Alerts has nobody subscribed until SP2b's write endpoints exist. Building
those screens against permanently-empty tables risks shipping UI nobody has
exercised with real rows.

**3. How does the audit write stay consistent with its mutation?** Two clients,
so no shared transaction. Either the audit insert goes last and its failure
fails the whole action (simple, but a mutation can succeed with no audit row if
the process dies between them), or both move into a `security definer` function
(atomic, but puts business logic in SQL). This is a real architectural choice
and it affects every mutating action, so it should be settled once, here, rather
than per task.

## Not in SP3

- The innovator profiles feature. `feature_innovator_profiles` is off at launch
  and CLAUDE.md says build the flag, not the feature. SP3 builds the flag's
  toggle in Site Content panel 2 and nothing behind it.
- Event capture and the four public write endpoints — SP2b.
- CSP, HSTS, Turnstile, honeypots, rate limiting — SP4.
- The digest *sender* — SP5. SP3 builds the preview and the send log; whether it
  builds the Send action depends on decision 2.
- Sitemap, GA4 read-back, locale switcher, WCAG audit — SP6.
