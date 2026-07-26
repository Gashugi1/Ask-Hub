# AskHub: Build Decomposition and SP1 Design

**Date:** 26 July 2026
**Status:** Approved design. Supersedes nothing; sits under `docs/askhub-prd.md`, which remains the product specification.
**Scope of this document:** How the PRD is split into buildable sub-projects, and the full design for sub-project 1.

---

## 1. Why this document exists

`docs/askhub-prd.md` specifies an entire platform: a public directory, a nine-screen admin portal, an analytics pipeline, a double-opt-in email system, row-level security across sixteen tables, WCAG 2.1 AA, and a thirteen-step security verification list. That is more than one design spec or one implementation plan can carry honestly.

This document decomposes it, fixes the build order, and specifies sub-project 1 in full.

## 2. Constraints as of 26 July 2026

| Constraint | State |
| --- | --- |
| Deploy date | Tuesday 28 July 2026. Hard. Scope flexes, the date does not. |
| Audience for the Tuesday deploy | Leadership and stakeholder review. A small named audience clicks through to approve. Not a public go-live, no real traffic expected. |
| Codebase | Empty. One commit containing the PRD and `docs/CLAUDE.md`. |
| Supabase | Project created, EU region. Settled. |
| Vercel | Not provisioned. Self-serve, minutes. |
| Transactional email + SPF/DKIM | Not provisioned. **Externally blocked** — requires DNS on a UNDP-controlled domain, measured in days (PRD §9.4). |
| GA4 | No property. Self-serve for the Measurement ID; the Data API needs a service account and numeric property ID, which is a client dependency. |
| Subdomain `askhub.aihubfordevelopment.org` | Not provisioned. Tuesday runs on a `*.vercel.app` URL. |

### 2.1 What the blocked dependencies cost

Because SPF/DKIM cannot land by Tuesday, three PRD features drop out of the launch slice: contact-form delivery (§9.1), double opt-in confirmation (§9.2), and digests (§9.3).

The design response is **persist now, deliver later**. All three write correct, complete database rows from Tuesday onward; only the sending is deferred. Nothing submitted in the gap is lost. Subscribers sitting unconfirmed is the honest §9.2 state, not a defect.

Because the GA4 Data API is not provisioned, the Site engagement panels ship in their "Not connected, add your GA4 Measurement ID" state — which §6.4 already specifies as correct behaviour, so this costs nothing.

## 3. Prototype recovery

PRD §1 states two working prototypes constitute the functional specification. Both surfaces were found in a single deployed bundle at `https://incandescent-florentine-2aa0ad.netlify.app/#/`, built with Claude's design tool and deployed to Netlify.

The source is fully recoverable: the deployed HTML is a Claude `dc` bundle whose inline `script[type="text/x-dc"]` island holds 1,424 lines of readable JSX — a single React class component extending `DCLogic`, using hash routing and `localStorage` (key `askhub_store_v5`), with React 18.3.1 UMD and SheetJS vendored alongside two self-hosted Outfit woff2 files.

**Pages found:** home, directory, resource, about, contact, privacy, terms, impact, innovators, signin.
**Admin tabs found:** dashboard, resources, queue, analytics, partnerships, alerts, content, updates, auditlog, profiles, tickets.

### 3.1 The prototype is a specification, not code to port

A single class component with inline styles, `localStorage` persistence and hash routing does not become a Next.js App Router application with Supabase and database-level authorization by refactoring. It is rebuilt.

What ports verbatim is the content and the derived logic: copy strings, the seed records, the palette, layout structure, and the computation helpers — `dlInfo` (deadline and closed state), `filtered`, `countryMatch`, `textMatch`, `alertMatchCount`, `badges`, `exportRows`.

### 3.2 Three findings from the recovered source

**`tickets` is out of scope.** The tab filters on `t.profileId === innovator.id`, and the home CTA reads "Your matched resources and help tickets are on your dashboard." Tickets are a sub-feature of innovator profiles, not an eleventh admin screen. PRD §7 and §18 put innovator profiles in Phase 2 — build the flag, not the feature. Tickets ride behind `feature_innovator_profiles` and are not built. No client decision is required.

**`GADATA` must be deleted, not ported.** The prototype carries a hardcoded fabricated-analytics block keyed by 7/30/90-day range: 12,840 users, 17,650 sessions, per-resource view and click counts, top-country and top-source tables, search and filter frequencies. This is exactly the launch-blocking defect PRD §8.4 describes. It is removed, and no part of it reaches a migration, a fixture, or a fallback value.

**`#1F5FBF` is confirmed.** It is the most frequent colour in the prototype at 34 occurrences, serving as both primary brand blue and the Compute need key. PRD §16.4 question 4 asked for the exact hex; the prototype answers it consistently. Worth a client nod, no longer blocking design tokens.

## 4. Decomposition

Six sub-projects. The sequence is a dependency order.

| # | Sub-project | Owns | Depends on |
| --- | --- | --- | --- |
| 1 | **Foundation & data spine** | App skeleton, design tokens, localisation scaffolding, schema for all sixteen tables plus `contact_messages`, RLS on every table, public-safe views, auth and three roles, seed migration, deploy pipeline | Nothing |
| 2 | **Public surface** | Home, directory, resource detail, about, contact, privacy, terms; Impact built and 404-gated; event capture live | SP1 |
| 3 | **Admin surface** | Nine sidebar screens on real data, role-gated, honest empty states, audit and updates write path | SP1 |
| 4 | **Security hardening & launch verification** | CSP, HSTS and headers, Turnstile, honeypots, rate limiting, payload caps, preview branch databases, the §14.9 checklist, tested backup restore | SP1–3 |
| 5 | **Email delivery layer** | Contact delivery, double opt-in, digest matching, send log | **Externally blocked** |
| 6 | **Reporting completeness & quality bar** | GA4 Data API read-back, aggregation views and rollups, apply-CTR and featured CTR, WCAG AA pass, Core Web Vitals, sitemap and structured data, locale switcher | SP2–3 |

SP2 and SP3 are independent of each other and can run in parallel once SP1 lands.

### 4.1 Two decisions deliberately pulled forward into SP1

**RLS on every table from the first migration.** `docs/CLAUDE.md` states a new table without RLS is a defect, and PRD §14.4 names it the single most likely serious defect in a Supabase build. Retrofitting policies across sixteen tables is a different and worse job than writing them alongside the schema.

**String externalisation to `locales/en.json` from the first component.** Near-free at the start, a mechanical rewrite of every component later.

### 4.2 Event capture ships with the surfaces, not with the reporting

PRD §8.1 is explicit: capture is a launch requirement, display may arrive later, because unrecorded reach cannot be recovered retroactively. So `engagement_events` writes go live in SP2 and SP3. The panels that read them can be thin, and SP6 makes them complete.

### 4.3 What Tuesday actually is

SP1, plus a deliberately thin SP2 and SP3.

SP4 and SP6 are not done. Stated plainly, that means at review time: no CSP or security headers, no Turnstile or honeypots, no rate limiting, no tested backup restore, no WCAG audit, no Core Web Vitals verification, no sitemap or structured data, no GA4 read-back, and no preview branch databases. Definition-of-done items 6, 7 (partially), 12, 13 and 15 are outstanding, and most of the §14.9 verification list with them.

This is appropriate for a gated stakeholder review. It is **not** a public go-live, and the deploy is protected accordingly (see §5.7).

## 5. SP1: Foundation & data spine

### 5.1 Repo and app skeleton

Next.js App Router, TypeScript strict mode, Tailwind CSS with centralised design tokens. No hardcoded colour or type values in components (PRD §11).

Tokens lifted from the recovered prototype:

| Token | Value |
| --- | --- |
| Primary blue | `#1F5FBF` |
| Deep navy | `#1A2332` |
| Deep blue | `#003D60` |
| Orange accent | `#F06428` |
| Hairline border | `#DDE5EE` |
| Muted text | `#42506E`, `#5B6B8C` |
| Surface tints | `#EEF2FB`, `#F1F4FA`, `#C9D3E8` |
| Danger | `#C0392B` on `#FBEAE8` |

Need colour keys, foreground and tint pairs:

| Need | Foreground | Tint |
| --- | --- | --- |
| Compute | `#1F5FBF` | `#EAEFFB` |
| Training | `#0E7A8A` | `#E6F3F5` |
| Funding | `#B4691F` | `#F9F0E4` |
| Accelerator | `#6C3FA8` | `#F1EAF9` |
| Partners | `#0E7A54` | `#E7F4EE` |

These values are used identically in public cards and admin charts (PRD §11).

Typography: Outfit, self-hosted from the two woff2 files extracted from the prototype bundle, preloaded. No Google Fonts round-trip — this protects Largest Contentful Paint and removes a third-party dependency from the critical path.

Localisation: every user-facing string in `locales/en.json`, with empty `fr`, `pt` and `ar` stubs present. The switcher itself is SP6; the externalisation is SP1.

### 5.2 Supabase project

Already created, EU region. Confirm the specific region and record it in the repo README, since it is effectively permanent without a migration (PRD §13.2).

Migrations managed by the Supabase CLI and committed to the repo from the first schema change. Local development against the CLI's local stack.

### 5.3 Schema

Every table carries `id uuid default gen_random_uuid() primary key`, `created_at timestamptz default now()`, and `updated_at timestamptz` maintained by one shared trigger function.

Postgres enums for `app_role`, `resource_status`, `need_type`, `geo_scope`, `partner_tier`, `submission_type`, `submission_status`, `partnership_stage`, and `audit_action`.

Tables per PRD §4.1–4.16: `profiles`, `resources`, `partners`, `partnerships`, `submissions`, `subscribers`, `digest_sends`, `programmes`, `impact_stories`, `headline_stats`, `compute_metrics`, `site_content`, `settings`, `updates_log`, `audit_log`, `engagement_events`.

#### 5.3.1 `resources.partner` is a foreign key

PRD §4.2 permits "text or FK to `partners`". This design uses `partner_id uuid not null references partners(id)`.

The prototype's `LOGOS` map already names fifteen partners and the seed is roughly twenty resources, so populating `partners` properly costs almost nothing and yields the partner logo row, tier, and official-site links from a single source of truth. A text column alongside a nullable FK invites the two to drift, and partner tier feeds `partner_tier` on the resource.

Because the column is `not null`, every distinct partner named anywhere in the seed gets a `partners` row — including any that do not appear in `LOGOS` and therefore have no logo. `logo_url` is nullable for exactly that case.

#### 5.3.2 Deadline state stays computed

PRD §4.2 requires Closed and expiring-soon to be derived, never stored, and requires that a past deadline does not transition `status`.

Implemented in two places that must agree: the public view exposes the computed display state, and a shared TypeScript helper ported from the prototype's `dlInfo` computes it client-side. No column, no scheduled job mutating `status`. The null deadline case renders as "Rolling".

#### 5.3.3 `engagement_events` is indexed for its read pattern now

Indexes on `(occurred_at)`, `(event_name, occurred_at)`, `(resource_id)`, and a partial index `where is_bot = false`. PRD §8.3 forbids a full table scan per page load, and adding indexes to a table that already carries traffic is materially more disruptive than creating them with it.

The table stores no IP addresses, no raw user agents, and no personal identifiers (PRD §4.16).

#### 5.3.4 New table: `contact_messages`

**This is a deliberate addition beyond the PRD and should be flagged to whoever owns that document.**

PRD §9.1 specifies only that the contact form delivers to `aihubfordevelopment@undp.org`. That assumes a working mail provider. With SPF/DKIM externally blocked, a delivery-only contact form silently discards every message sent between Tuesday and whenever DNS lands.

Fields: `name`, `email`, `message`, `submitted_at`, `source_ip_hash` (abuse handling only, never displayed), `delivered_at` (nullable), `delivery_error` (nullable). SP5 drains the undelivered rows once the provider is live.

Access follows the same rule as every other public write: no anonymous policy, insert through a server route. Read access matches `submissions`, which also carries submitter email addresses and which PRD §3 makes readable by all three roles.

### 5.4 RLS model

Deny by default on every table without exception.

#### 5.4.1 The anonymous role holds zero policies on any base table

Anonymous **reads** go through dedicated public-safe views — `resources_public` and equivalents for published content — created with `security_invoker = false` so they read base tables as their owner. Each view bakes in `where status = 'live'` and enumerates its columns explicitly. Views, clicks, CTR, submitter emails and internal notes are therefore absent by construction, and a later `select *` cannot widen the exposure.

Anonymous **writes** — contact, suggest a resource, alerts subscribe, and the event log — go through server routes holding `service_role`, after Zod validation. PRD §8.3 already requires the event log to be written through a server route; this applies the same shape to all four.

The consequence is that PRD §14.9 checks 2 and 5 become structural properties of the schema rather than behaviour to remember. There is no anonymous insert policy to misconfigure.

#### 5.4.2 Authenticated roles follow the §3 matrix

| Capability | admin | editor | viewer |
| --- | --- | --- | --- |
| Read every table | Yes | Yes | Yes |
| Write resources, submissions, subscribers, partnerships, site content, headline stats, compute metrics, programmes, impact stories, updates log, digest sends | Yes | Yes | **No policy at all** |
| Write `settings` | Yes | No | No |
| Write `profiles` | Yes | No | No |
| Write `audit_log` | No policy | No policy | No policy |

`viewer` has no write policy on any table — not a restrictive policy, no policy. PRD §3 and §14.4.

#### 5.4.3 `audit_log` is append-only, twice over

SELECT for all three roles per PRD §3. **No INSERT, UPDATE or DELETE policy for any role, including `admin`.**

Audit rows are written by server actions using `service_role`, inside the same action as the mutation they record. That is not merely a convenience: PRD §4.15 requires `actor_name` and `entity_label` to be denormalised at write time, and `change_summary` to be generated by a formatter keyed on entity type and action. None of that can be trusted to a client-side insert, so there is no reason to grant one.

`service_role` bypasses RLS but not triggers, so a `before update or delete` trigger that raises an exception makes append-only hold against every path into the table, including the server's own. Policy absence alone would be sufficient for the three application roles; the trigger is what makes the guarantee survive both `service_role` and a future migration that adds a policy carelessly.

#### 5.4.4 The recursion trap

The role-lookup helper used by policies must be `security definer` and `stable`. A plain function that selects from `profiles` will be subject to the RLS policy on `profiles`, which calls the function, which selects from `profiles`. It is the standard Supabase footgun and it fails with a confusing error rather than an obvious one.

### 5.5 Authentication

Supabase Auth, email and password. Public signup disabled at the project level, so no signup route can exist regardless of application code (PRD §3, §14.3).

Users are invited by an admin through `service_role`. A `handle_new_user` trigger creates the `profiles` row on `auth.users` insert, defaulting `role` to `viewer` — least privilege, with an admin promoting explicitly. `display_label` is free text and independent of `role`; the two are never inferred from one another (PRD §3).

Sessions via `@supabase/ssr` on httpOnly, Secure, SameSite cookies. Never `localStorage`.

At least two admin accounts provisioned before Tuesday, so a single lockout does not lock out the team (PRD §3).

MFA enabled where the provider supports it. Rate limiting, progressive backoff, breached-password rejection and the non-disclosing reset flow are SP4.

### 5.6 Seeding

Seeded from the prototype's `seed()` block: `resources` (roughly twenty; eleven live, the remainder pipeline and reference), `partners`, `programmes`, `impact_stories`, `headline_stats`, `compute_metrics`, `site_content`.

External URLs verified by hand wherever an automated HEAD request is ambiguous. A failed HEAD is not proof of a dead link — many live sites reject bots. Where a URL cannot be confirmed, the resource is seeded as `pipeline` rather than published with a broken link (PRD §15).

Where no partner image exists, a clean branded placeholder banner is generated carrying partner name and title, coloured to the need key. No fabricated event flyers, no invented imagery.

**Not seeded under any circumstances:** `subscribers`, `submissions`, `digest_sends`, `engagement_events`, or any analytics figure. The prototype's subscriber emails and send log are fixtures; seeding them would place fabricated personal data and a false reporting history into a production UNDP system (PRD §15, §8.4).

Content rules from PRD §10 hold in all seeded copy, including the §16.1 overrides: "co-led by MIMIT and UNDP", never "the Hub" alone, the single mailbox, "Democratic Republic of the Congo" in full, "CINECA Leonardo" with no "Mattei Plan", no per-resource Verified badge, no "Global programmes" country filter value.

### 5.7 Deployment

Vercel, on the `*.vercel.app` URL. The subdomain and its DNS records are SP4 or later, and the documentation of those records must preserve existing records on the parent domain, MX in particular (PRD §13.3).

**Vercel Deployment Protection is enabled, and the site serves `noindex`.** Tuesday is a gated stakeholder review of a build with no CSP, no Turnstile, no rate limiting and no security-header verification. It must not be publicly reachable or indexable in that state.

Rendering strategy per PRD §13.4: cached dynamic rendering or ISR with on-demand invalidation via `revalidateTag` and `revalidatePath` on every content and resource mutation. Build-time-only static generation does not satisfy the Site Content requirement that editor saves appear without a rebuild.

Environments: local via the Supabase CLI, production against the existing EU project. Preview branch databases (PRD §13.1) are deferred to SP4, stated explicitly rather than assumed.

All secrets in environment variables. Nothing prefixed `NEXT_PUBLIC_` contains a secret. `service_role` is server-only and must never reach a client bundle.

### 5.8 What SP1 must prove

Tests run against the database directly, not through the UI, because the UI-mediated version of these tests does not demonstrate the property being claimed.

1. An anonymous read returns only live resources and published public content. `pipeline` and `reference` resources, `submissions`, `subscribers`, `settings`, `contact_messages` and `audit_log` are all unreachable.
2. A `viewer` session writes to no table. Verified table by table.
3. An `editor` session cannot write `settings` or `profiles`.
4. The public views expose no views, clicks, CTR, submitter emails or internal notes.
5. `audit_log` rejects UPDATE and DELETE when attempted as `admin`, and also when attempted as `service_role` — the trigger, not the policy, is what makes that second case pass.
6. Deadline and expiring-soon computation is correct, including the null-deadline rolling case, the past-deadline closed case, and the boundary at fourteen days.
7. The built client bundle contains no `service_role` key and no secrets.

Items 1 through 6 are PRD §14.9 checks 1, 2, 3, 4 and 5, and item 7 is check 6. They land in SP1 rather than SP4 because they are properties of the schema and its policies, not behaviour added later.

## 6. Decisions record

| Decision | Choice | Rationale |
| --- | --- | --- |
| Prototype treatment | Rebuild against it as specification; lift content and derived logic only | Single class component with inline styles, hash routing and `localStorage` does not refactor into App Router plus Supabase plus RLS |
| `tickets` admin tab | Not built | Keyed to `innovator.id`; a sub-feature of Phase 2 innovator profiles (PRD §7, §18) |
| `GADATA` block | Deleted | Fabricated metrics; PRD §8.4 makes any of it in production a launch-blocking defect |
| Primary blue | `#1F5FBF` | 34 occurrences in the prototype, consistent; answers PRD §16.4 q4 |
| Supabase region | EU, project already created | PRD §13.2 residency hedge; public pages are edge-cached so DB latency mostly affects the admin portal, used by a small non-African team |
| `resources.partner` | Foreign key to `partners`, not null | Single source of truth for logo, tier and official site; text alongside a nullable FK drifts |
| Deadline state | Computed in view and shared helper | PRD §4.2 requires derived, and requires `status` unchanged |
| Anonymous database access | Zero policies on base tables; definer views for reads, `service_role` server routes for writes | Makes PRD §14.9 checks 2 and 5 structural; no anonymous insert policy to misconfigure |
| `contact_messages` table | Added beyond the PRD | §9.1 assumes working mail; without it, messages sent before SPF/DKIM lands are silently discarded |
| Email | Persist now, deliver in SP5 | SPF/DKIM is an external dependency measured in days (PRD §9.4) |
| Tuesday deploy exposure | Deployment Protection on, `noindex` | Unhardened build; SP4 owns CSP, Turnstile, rate limits and header verification |
| Preview branch databases | Deferred to SP4 | PRD §13.1 requirement, not achievable in the launch slice; deferral stated rather than assumed |

## 7. Open items

| # | Item | Blocks | Owner |
| --- | --- | --- | --- |
| 1 | Real email addresses and roles for the two initial admin accounts (PRD §16.4 q7) | Auth provisioning, RLS role testing. A single admin is the lockout §3 warns against | Client |
| 2 | Transactional email provider, and DNS access for SPF and DKIM | SP5 in full | Client / UNDP IT |
| 3 | GA4 property ownership, service account, numeric property ID | SP6 Site engagement panels | Client |
| 4 | Confirmation of the specific EU region on the created project, recorded in the README | Nothing; documentation | Build |
| 5 | Partnership stage labels — brief says `lead`/`exploring`/`negotiating`/`agreement`, prototype says Prospecting/In discussion/Active/Delivered (PRD §16.3) | SP3 Partnerships. Prototype labels implemented pending confirmation | Client |
| 6 | Footer logo order from the official AI Hub site (PRD §16.4 q5) | SP2 footer | Client |
| 7 | Confirmation that PRD §16.2 items are in scope | Scope and schedule | Client |
| 8 | Whether double opt-in is acceptable (PRD §16.4 q9) | SP5 alerts | Client |
| 9 | DNS ownership for the parent domain, and MX preservation | Subdomain go-live | Client |
| 10 | Flag `contact_messages` as an addition to the PRD | Nothing; document hygiene | Build |

## 8. Out of scope

Innovator profiles and matching, and the tickets feature that belongs to them. Only `feature_innovator_profiles` is built, and it is off. No profile creation, no matched shortlists, no profile prompts, and `profile_prompt_shown` and `profile_prompt_result` never fire (PRD §7, §18).

The public Impact page is built and gated behind `feature_public_impact_page`, off at launch, returning 404 with no navigation entry. Admin CRUD for impact stories remains fully available.

Scope is locked to the PRD. No features beyond it.
