# AskHub Product Requirements Document

**Product:** AskHub, the open resource directory of the AI Hub for Sustainable Development (co-led by MIMIT and UNDP)
**Version:** 1.0, 25 July 2026
**Target deploy:** Tuesday 28 July 2026
**Status of this document:** Implementation specification. Design and behaviour are settled. This document supersedes the client technical brief wherever the two conflict, and records those conflicts explicitly in Section 16.

---

## 1. Purpose and context

AskHub is a public, curated directory where African AI innovators, students, researchers and entrepreneurs discover compute, training, funding, accelerator and partnership opportunities. Browsing is fully open: no account, no sign-up wall. Behind the public site sits an authenticated admin portal where the AI Hub team curates resources, reviews community submissions, manages alert subscribers, tracks partner relationships, edits site content, and reads reach and engagement reporting.

Two working prototypes exist (public site and admin portal) and together constitute the functional specification. This build ports them onto production infrastructure with real authentication, a persistent database, database-level authorization, and instrumented analytics.

### 1.1 Primary success measure

Reach and engagement are the metrics the AI Hub reports upward. Analytics is therefore not a secondary admin convenience, it is a primary product function. Event capture must be correct and complete from the first minute the site is live, because unrecorded reach cannot be recovered retroactively.

---

## 2. Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js (App Router), TypeScript, strict mode | Public pages and admin in one deployable |
| Database | Supabase Postgres | Region chosen deliberately, see 13.2 |
| Auth | Supabase Auth, email and password | Admin-provisioned users only, no public sign-up |
| Authorization | Postgres Row Level Security | Enforced at the database layer, not only in UI |
| Styling | Tailwind CSS with centralised design tokens | See Section 11 |
| Hosting | Vercel | Subdomain, see 13.3 |
| Analytics | Google Analytics 4 plus first-party event log | See Section 8 |
| Transactional email | Provider required, not yet chosen | See 9.4 and Section 16 |

---

## 3. Roles and permissions

Three roles. `display_label` is free text shown in the sidebar and is **independent of `role`**. Do not infer one from the other. The prototype shows a user labelled "Leadership" who, per the audit log and updates log, edits headline reach numbers; that person therefore holds `editor` or `admin`, not `viewer`. Role assignment per named user must come from the client, see 16.4.

| Capability | admin | editor | viewer (displays as "Leadership") |
| --- | --- | --- | --- |
| View all admin screens and reporting | Yes | Yes | Yes |
| Resources: create, edit, delete, change status, feature | Yes | Yes | No |
| Review queue: approve, edit, reject | Yes | Yes | No |
| Subscribers: view, filter, remove, send digest | Yes | Yes | No |
| Partnerships: create, edit, move stage | Yes | Yes | No |
| Site content: copy, stats, compute metrics, programmes, impact stories | Yes | Yes | No |
| Updates log: add note | Yes | Yes | No |
| Settings: GA4 ID, contact email, feature flags | Yes | No | No |
| Users: invite, change role, deactivate | Yes | No | No |
| Audit log: read | Yes | Yes | Yes |

Requirements:

- Every capability above is enforced by RLS policy, independently of the UI.
- A `viewer` must not be shown write affordances at all. No Add, Edit, Delete, status dropdowns, star toggles, Send digest, or note inputs. The prototype shows these controls in the "Leadership" session, which is correct behaviour for that user because that user is not a viewer; it is not licence to show write controls to an actual viewer.
- Server-side authorization check on every mutating server action and route handler. Middleware route gating is UX, not security.
- No public sign-up route exists. Users are created by an admin.
- At least two admin accounts must be provisioned before launch so that a single lockout does not lock out the team.

---

## 4. Data model

All tables: `id` (uuid, default generated), `created_at`, `updated_at` (trigger-maintained). RLS enabled on every table without exception, deny by default.

### 4.1 `profiles`
Mirrors `auth.users`. Fields: `user_id` (FK to auth.users), `email`, `full_name`, `role` (enum: `admin` | `editor` | `viewer`), `display_label` (text, e.g. "Leadership"), `is_active` (bool), `invited_by`, `last_sign_in_at`.

### 4.2 `resources`
The core entity.

- Identity: `name`, `partner` (text or FK to `partners`), `partner_tier` (enum: `strategic` | `network` | `institutional` | `other`)
- Classification: `resource_type` (e.g. Credits, Programme, Course, Network), `need_primary` (enum: `compute` | `training` | `funding` | `accelerator` | `partners`), `need_secondary` (same enum, nullable), `sub_category` (text, e.g. "Cloud credits", "HPC allocation", "Curriculum", "Community")
- Content: `description`, `action_label`, `external_url`, `banner_image_url`
- Eligibility: `countries_eligible` (text array), `sectors_eligible` (text array), `stages_eligible` (text array), `geo_scope` (enum: `global` | `all_africa` | `partner_countries` | `specific`)
- Lifecycle: `deadline` (date, nullable; null means rolling and displays as "Rolling"), `status` (enum: `live` | `pipeline` | `reference`), `is_featured` (bool), `is_exclusive` (bool)
- Localisation: optional per-language columns (`description_fr`, `description_pt`, `description_ar`) with English fallback
- Ordering: `sort_order` (int, nullable), `added_date` (date, drives "Recently added")

Derived behaviour, computed and not stored:

- A resource whose `deadline` is in the past displays as **Closed** on the public site and is flagged in admin as "Auto-closed, past deadline". Its `status` is unchanged: auto-close is a display state, not a status transition.
- Resources with a `deadline` within 14 days surface in the admin "Expiring soon" view and show a "N days left" indicator.
- Only `status = 'live'` resources appear publicly.
- `geo_scope` of `global`, `all_africa` or `partner_countries` matches any country filter selection. There is no "Global programmes" option in the country filter (content rule 10.6).

### 4.3 `partners`
`name`, `logo_url`, `website_url`, `tier`, `sort_order`. Logos link to official sites.

### 4.4 `partnerships`
AskHub's own partner pipeline, scoped to AskHub partners only. This is not an organisation-wide CRM.

Fields: `organisation` (text or FK to `partners`), `summary`, `note`, `stage` (enum with stable keys `prospecting` | `in_discussion` | `active` | `delivered`), `owner` (FK to profiles, nullable), `sort_order`.

Stage display labels: Prospecting, In discussion, Active, Delivered. See Section 16 for the conflict with the client brief.

### 4.5 `submissions`
Community input awaiting review. Handles two distinct types.

Fields: `type` (enum: `new_resource` | `update_suggestion`), `target_resource_id` (FK to resources, required when type is `update_suggestion`, null otherwise), `resource_name`, `organisation`, `need`, `link`, `description`, `submitter_email`, `status` (enum: `pending` | `approved` | `rejected`), `reviewed_by`, `reviewed_at`, `rejection_reason` (nullable), `source_ip_hash` (nullable, for abuse handling only, never displayed).

Behaviour:

- `new_resource` approval creates a `resources` row. "Approve and publish" creates it with `status = 'live'`. "Edit first" opens a prefilled resource form and creates on save.
- `update_suggestion` cannot be auto-applied. The only action is "Open resource to edit", which navigates to the target resource with the suggestion visible alongside, plus Reject.
- Rejection is soft: the row is retained with `status = 'rejected'`, never hard-deleted.

### 4.6 `subscribers`
Alert opt-in. Distinct from user accounts.

Fields: `email` (unique, case-insensitive), `categories` (text array of need types), `country` (nullable), `sector` (nullable), `consent_at` (timestamp), `consent_text_version` (text), `confirm_token`, `confirmed_at` (nullable), `unsubscribe_token`, `unsubscribed_at` (nullable).

### 4.7 `digest_sends`
Send log. Fields: `sent_at`, `sent_by`, `resource_ids` (uuid array), `recipient_count`, `subject`, `notes`.

### 4.8 `programmes`
The AI Hub programme portfolio, internal records. Fields: `title`, `timeframe` (text, e.g. "Nov 2025 to Jun 2026, 6-month flagship"), `description`, `sort_order`.

### 4.9 `impact_stories`
Shown on the public Impact page when that feature flag is on. Fields: `organisation`, `country`, `description`, `sort_order`.

### 4.10 `headline_stats`
Reach figures for the home page strip and About page. Fields: `value` (text, e.g. "7,000+"), `label`, `is_hero` (bool), `sort_order`.

Behaviour: the first four `is_hero` stats in sort order render in the home page strip. All stats render on About.

### 4.11 `compute_metrics`
The compute snapshot shown on the admin Reach and Engagement screen. Fields: `value` (text), `label`, `sub_note` (nullable), `sort_order`.

### 4.12 `site_content`
Editable copy blocks, keyed. Keys at minimum: `welcome_band_heading`, `welcome_band_body`, `welcome_band_cta_label`, `about_intro`, `about_alignment`, `privacy_copy`, `terms_copy`. Fields: `key`, `value`, `locale` (default `en`).

### 4.13 `settings`
Key/value configuration, admin-only write. Keys at minimum: `ga4_measurement_id`, `ga4_property_id`, `contact_email`, `feature_innovator_profiles` (bool, default false), `feature_public_impact_page` (bool, default false).

### 4.14 `updates_log`
Human-readable "what's new" for the team. Fields: `occurred_at`, `actor` (FK to profiles), `text`, `is_automatic` (bool).

Behaviour: resource and site content changes append entries automatically with a generated summary. Team members can add manual notes.

### 4.15 `audit_log`
System record, separate from `updates_log`.

Fields: `actor` (FK to profiles, nullable for system), `actor_name` (denormalised at write time so the log survives a user being deactivated or renamed), `action` (enum, see below), `entity_type`, `entity_id`, `entity_label` (denormalised human label at write time), `change_summary` (text, rendered sentence), `diff` (jsonb, before and after for changed fields), `occurred_at` (timestamp, displayed to the minute), `ip_hash`, `user_agent`.

`action` enum with display badge: `published` (green), `edited` (blue), `created` (blue), `deleted` (red), `approved` (green), `rejected` (red), `role_changed` (amber), `digest_sent` (neutral).

Two fields carry deliberate denormalisation. `actor_name` and `entity_label` are captured at write time rather than joined at read time, because an audit record must remain readable after the referenced user or entity is deleted. A log that goes blank when a resource is removed is not an audit log.

`change_summary` is generated at write time by a formatter keyed on `entity_type` and `action`, producing prose rather than a JSON dump. Examples the UI must reproduce: "Status Pipeline to Live", "Updated 'extended network' stat to 150+", "Stage In discussion". The raw `diff` is retained alongside for forensic use but is not what the table displays.

`entity_label` convention: resources appear by bare name; every other entity type is prefixed with its type, for example "Partnership: NVIDIA" or "Headline reach numbers".

Append-only. No update or delete policy for any role, including admin.

### 4.16 `engagement_events`
First-party event log. See Section 8.3. Fields: `event_name`, `resource_id` (nullable), `need` (nullable), `is_featured` (nullable), `search_term` (nullable), `filter_key` (nullable), `filter_value` (nullable), `country_code` (nullable, coarse from edge geolocation), `occurred_at`, `session_hash`, `is_bot` (bool).

Contains no IP addresses, no user agents in raw form, and no personal identifiers.

---

## 5. Public site

No authentication anywhere on the public site. Every page fully usable anonymously.

### 5.1 Home, functioning as a storefront

Immediately usable on landing, in this order:

1. Welcome and orientation band (heading, body, CTA), copy editable from admin
2. Headline reach strip, first four hero stats
3. Prominent search
4. Persistent browse by need (five need types with live counts)
5. Featured opportunities carousel
6. Scrolling partner logo row, each logo linking to the partner's official site
7. Recently added rail
8. The full resource directory, flowing on the same page

### 5.2 Directory

- Filters: need (five), sector (six), country (18 partner countries), stage (New to AI, Getting started, Building, Scaling)
- Natural-language free-text search across name, partner, description, sub-category
- Sort: Featured first, Recently added
- Resource count displayed
- Export to CSV and Excel. **The public export must exclude views, clicks, CTR, internal notes, submitter emails, and every other internal or analytics field.** Implement via a dedicated public-safe database view.
- Filters and search reflected in the URL so results are shareable and linkable

### 5.3 Resource detail

Banner, title, partner, description, eligibility (countries, sectors, stages), deadline or status badge, apply button to the verified external URL, and a share pop-up (copy link, LinkedIn, email, WhatsApp) with editable pre-written text.

- Apply links: `rel="noopener noreferrer"`, `target="_blank"`, `https` scheme validated on save.
- Each detail page carries a "Suggest an update" affordance that creates an `update_suggestion` submission for that resource.
- Detail pages are indexable and carry structured data (Section 12.2).

### 5.4 Alerts signup

Modal. Email plus category multi-select, optional country and sector, explicit consent checkbox naming MIMIT and UNDP as the parties who may email, and an unsubscribe statement. No account required. Consent text version recorded with each subscription.

### 5.5 Suggest a resource

Modal. Fields: resource name, organisation or partner, need (select), link, one or two lines on what it offers, submitter email. Copy states that the AI Hub team reviews every submission before it goes live. Lands in `submissions` as `pending`.

### 5.6 About and Contact

Single mailbox: `aihubfordevelopment@undp.org`. Contact form (name, email, message) delivers to that mailbox. About page renders editable identity copy plus all headline stats.

### 5.7 Public Impact page

Built, renders `impact_stories`, and gated behind `feature_public_impact_page`, which is **off at launch**. When off, the page returns 404 and no navigation links to it.

### 5.8 Cross-cutting

- Fully mobile-responsive at every breakpoint
- Privacy and Terms pages, copy minimal and factual pending legal review
- No login link or admin reference anywhere in public navigation

---

## 6. Admin portal

Routes under `/admin`, with `/login`. Not linked from public navigation.

Sidebar, in order: Dashboard, Resources, Review Queue, Reach & Engagement, Partnerships, Alerts & Subscribers, Site Content, Updates, Audit Log. Footer shows signed-in name, display label, "View site", "Sign out".

### 6.1 Dashboard

Leadership view giving the full reach and engagement picture.

- Stat cards: Resources live (with pipeline count), Total reach (views and clicks), Growth this week (engagement events, percentage change), Coverage (countries covered of 18, sectors of 6)
- Live resources by need, horizontal bars with counts, colour-keyed per need
- Most-clicked resources, ranked list
- Partnership pipeline summary, count per stage
- Bottom summary strip: country coverage, sector coverage, pending review, alert subscribers, expiring within 14 days

### 6.2 Resources

- Header count: total resources, with the note that live items appear on the public directory
- Tabs: All, Expiring soon, Closed
- Search by name or partner; filter by status; filter by need
- Table columns: Resource (name, then partner, tier, type, sub-category), Need (primary and secondary), Eligibility (geo, sectors, stages), Deadline (Rolling, or date with "N days left", or "Auto-closed, past deadline"), Status (inline dropdown for immediate change), Actions (featured star toggle, Edit, Delete)
- Add resource, with an identical field set to Edit
- Required-field validation on both create and edit
- Delete requires confirmation and writes to the audit log

### 6.3 Review queue

Header shows pending count and states that the queue holds community submissions and update suggestions.

- `new_resource` card: NEW RESOURCE badge, title, description, link, submitter email, submitted date. Actions: Approve and publish, Edit first, Reject.
- `update_suggestion` card: UPDATE badge, target resource name, the suggested change, submitter email, submitted date. Actions: Open resource to edit, Reject.

### 6.4 Reach and Engagement

Date range selector: Last 7 days, Last 30 days (default), Last 90 days.

Hero band: total people reached in the period, alert subscriptions in the period, apply-clicks to partner programmes.

Two clearly separated sections, per Section 8:

**Site engagement (Google Analytics 4).** Shows a prominent "Not connected, add your GA4 Measurement ID" state until configured. Panels: Users, Sessions, Average engagement time, each with period-over-period change; Top resources viewed; Top apply-clicks; Traffic by country; Traffic by source. Footnote: search impressions come from Google Search Console and paid and social reach from the ad platforms, separate sources not part of GA4.

**Countable reach and directory reporting (first-party data).** Panels: Alert subscribers with breakdown by category, country and sector; Most common searches with counts; Most used filters with counts; Live resources and pipeline count; Total views; Total clicks out; Growth this week; Resources by need; Weekly engagement over the trailing eight weeks; Coverage across the 18 partner countries; Coverage across the six priority sectors; per-resource table of Views, Clicks and CTR.

Compute snapshot renders `compute_metrics`, labelled as editable under Site Content.

Named metrics, computed explicitly:

- Apply click-through rate = `apply_click` ÷ `resource_view`, both overall and per resource
- Featured CTR = clicks on featured placements ÷ featured impressions

### 6.5 Partnerships

Kanban board, four columns: Prospecting, In discussion, Active, Delivered, each with a count. Cards show organisation, summary, an italic note, an inline stage dropdown, and Edit. Add partnership.

### 6.6 Alerts and subscribers

- Header: subscriber count across categories, countries and sectors
- "Recently published, notify subscribers" panel: live resources added in the last 14 days, matched to subscriber categories
- Subscriber table: email, categories, scope (country and sector), joined date, remove action
- Digest preview for the current period, listing matched resources with need and date, plus a Send digest action
- Send log, newest first

### 6.7 Site Content

Header states that everything here feeds the public site and reporting, and that edits apply everywhere immediately with no rebuild. This is a binding requirement, see 13.4.

Panels:

1. Analytics: GA4 Measurement ID input with connection state, and an explanatory note listing the custom events fired
2. Feature flags: Innovator profiles and matching (off at launch, hidden for launch and review), Public Impact page (off at launch, hidden from the public site)
3. Welcome band home page copy: heading, body, CTA label, marked as draft pending K&S approval, edits publish immediately
4. Identity, About page copy: two editable blocks
5. Headline reach numbers: value, label, Hero toggle, delete, add. Note that Hero pins a stat to the home page strip where the first four show, and that all appear on About
6. Compute snapshot: value, label, sub-note, delete, add
7. Programmes: cards with title, timeframe, description, edit, delete, add
8. Impact stories: cards with organisation, country chip, description, edit, delete, add

### 6.8 Updates, what's new

Running change log. Resource and content changes are logged automatically; a note input allows manual entries. Entries show date, text, and author.

### 6.9 Audit log

Header shows the entry count and states plainly that this is a read-only record of who did what.

Filters, all combinable, with a Clear action that resets every one:
- User (all users, or a specific actor)
- Action (all actions, or a specific action from the enum)
- Date range (start and end date)

Table columns:

| Column | Content |
| --- | --- |
| WHEN | Date and time to the minute |
| USER | Actor's full name, not email address |
| ACTION | Colour-coded badge from the action enum |
| ITEM | `entity_label`, per the prefixing convention in 4.15 |
| CHANGE | `change_summary`, the rendered sentence |

The log spans every entity type: resources, site content, headline stats, compute metrics, partnerships, submissions, subscribers, users and digest sends. It is not resource-only.

Read access for all three roles. No write, edit or delete path for any role. Newest first by default. Paginate rather than loading the full table.

---

## 7. Feature flags

Two flags in `settings`, both **off at launch**, both admin-only.

| Flag | Off behaviour | Notes |
| --- | --- | --- |
| `feature_innovator_profiles` | No profile creation, no matched shortlists, no profile prompts, `profile_prompt` events never fire | Phase 2. Build the flag only. Do not build the feature. |
| `feature_public_impact_page` | Public Impact page returns 404, no navigation entry. Admin CRUD for stories remains fully available | Build the page, gate it |

Flags are read server-side. A flag that is off must not ship dead client code paths that reveal the unbuilt feature.

---

## 8. Analytics and instrumentation

### 8.1 Principle

Capture is a launch requirement. Reporting display is allowed to arrive later. Missing capture is unrecoverable; a missing chart is not.

### 8.2 GA4

Loaded only when `ga4_measurement_id` is set. Fires page views plus these custom events, named exactly:

| Event | Parameters |
| --- | --- |
| `resource_view` | `resource_id`, `resource_name`, `need_primary`, `is_featured`, `partner` |
| `apply_click` | `resource_id`, `resource_name`, `need_primary`, `is_featured`, `partner`, `destination_domain` |
| `search_performed` | `search_term`, `results_count` |
| `filter_used` | `filter_key`, `filter_value` |
| `export_clicked` | `format`, `result_count`, `active_filters` |
| `profile_prompt_shown` / `profile_prompt_result` | Reserved. Never fires while the innovator profiles flag is off. |

Reading GA4 data back into the admin dashboard requires the **GA4 Data API**, which needs a service account and the numeric property ID, not the Measurement ID. Both must be provisioned. Until they are, the Site engagement section shows the not-connected state.

### 8.3 First-party event log

Every event in 8.2 is also written to `engagement_events` through a server route. This exists so that the reporting panels the AI Hub cares about most work on day one with real numbers, independent of GA4 configuration, Data API access, and GA4's own processing latency.

Requirements:

- Rate limited per session and per IP
- Bot filtering: known crawler user agents flagged `is_bot = true` and excluded from all reported figures
- `session_hash` is a rotating, non-reversible value. No IP addresses stored. No cross-session identity.
- Writes are fire-and-forget from the client and must never block or degrade page rendering
- Aggregation for dashboard panels runs as a database view or scheduled rollup, not a full table scan per page load

### 8.4 Launch-state honesty (mandatory)

The prototype screenshots contain fabricated figures (for example 14,698 total reach, 12,840 users, 2,583 apply-clicks, per-resource view and click counts, an eight-week engagement trend, and a monthly digest send log). **None of these may be seeded, hardcoded, or approximated in production.**

At launch every metric panel shows either a true zero, a genuine partial figure, or an explicit empty state reading that data will appear as traffic accumulates. Where the client brief calls for figures labelled illustrative, that label must be visible and unambiguous.

Rationale: this is a leadership reporting surface for a UNDP and MIMIT programme. A plausible-looking fabricated number on this screen can be reported upward as fact. Treat any fabricated metric reaching production as a launch-blocking defect.

---

## 9. Notifications and email

### 9.1 Contact form
Delivers to `aihubfordevelopment@undp.org`. Sets `reply-to` to the submitter. Validated, rate limited, spam protected.

### 9.2 Alerts subscription
Double opt-in: subscription creates an unconfirmed row and sends a confirmation email carrying a single-use, expiring token. Only confirmed subscribers receive digests and only confirmed subscribers count in reported subscriber figures.

### 9.3 Digest
Manual send from admin, matching resources published in the last 14 days against each confirmed subscriber's categories, country and sector. Preview before send. Every send writes to `digest_sends`. Every digest email carries a working one-click unsubscribe link backed by `unsubscribe_token`.

### 9.4 Provider dependency
Supabase Auth covers only authentication email (invite, password reset). A transactional provider is required for contact, confirmation and digest email. Provider choice is open, see Section 16.

**Schedule risk:** sending from an `@undp.org` or `aihubfordevelopment.org` address requires SPF and DKIM records on a domain controlled by UNDP IT. That is an external dependency measured in days, not hours. Start it immediately, and be prepared to launch sending from the AskHub subdomain instead.

---

## 10. Content rules (non-negotiable, set by K&S)

1. Attribution is always "co-led by MIMIT and UNDP". Never "powered by" or "implemented by". Footer reads: "Co-led by the Ministry of Enterprises and Made in Italy and the United Nations Development Programme."
2. Always "AI Hub" or "AI Hub for Sustainable Development". Never "the Hub" alone.
3. One mailbox only: `aihubfordevelopment@undp.org`.
4. "Democratic Republic of the Congo" written in full.
5. CINECA resource titled "CINECA Leonardo". No "Mattei Plan" in the title.
6. No "Global programmes" option in the country filter.
7. Cyber4Africa partners are Cyber 4.0 and Cisco.
8. **No per-resource "Verified" badge.** Quality assurance is stated once globally: "Every resource is curated by the AI Hub team."
9. No claims about "UNDP or MIMIT data-protection standards". Privacy copy stays minimal and factual pending legal review.
10. Partner and institution logos link to their official sites. Footer logo order matches the official AI Hub website.

These rules override the public prototype wherever they conflict. See Section 16.

---

## 11. Branding

Centralise everything below as design tokens. No hardcoded colour or type values in components.

**Typography.** Outfit (Google Fonts). Headings ExtraBold 800; H2 approximately 37px, line-height approximately 1.15, letter-spacing 0. Body regular 400. Buttons and labels medium to semibold, frequently uppercase with letter-spacing. Section eyebrow labels: bright cyan-blue, small, uppercase, letter-spaced. Self-host or preload the font to protect Largest Contentful Paint.

**Colour.**

| Token | Value |
| --- | --- |
| Deep navy | `#1A2332` |
| Deep blue | `#003D60` |
| Orange accent (sparingly: high-emphasis bands, pull-quotes) | `#F06428` |
| Hairline border | `#DDE5EE` |
| Card shadow | `#003C64` at 8%, x0 y2 blur 20 |
| Surface | `#FFFFFF` |
| Primary button blue | AI Hub mid-blue, approximately `#1F5FBF`, exact value to confirm |

**Navigation.** White, approximately 68px tall, 1px `#DDE5EE` bottom border, logo left, links centre, primary action right.

**Buttons.** Primary: solid brand blue, white text. Secondary: white with brand-blue border and text.

**Need colour keys** (used in cards, bars and accents): Compute blue, Training teal, Funding amber, Accelerator purple, Partners green. Derive exact values from the tokens and keep them consistent between public cards and admin charts.

---

## 12. Quality requirements

### 12.1 Accessibility
WCAG 2.1 Level AA across the public site, the admin portal, and every form and modal. Keyboard navigable throughout, visible focus states, correct heading order, alt text on all images, labelled form fields, adequate contrast, modals with focus trap and Escape to close, live regions for filter result updates. This is a UN-facing site; treat AA as a requirement, not an aspiration.

### 12.2 SEO
Per-page meta and Open Graph tags, canonical URLs, `sitemap.xml`, `robots.txt`, and `schema.org` structured data on resource detail pages. Filter and search state in the URL. Server-rendered content, never client-only rendering of directory data.

### 12.3 Performance
Core Web Vitals in the green on mobile. Optimised and correctly sized banner and logo images with explicit dimensions. No layout shift from font loading. Directory filtering feels instant.

### 12.4 Localisation scaffolding (structure only, English at launch)
All user-facing strings externalised to `locales/en.json` with stubs for `fr`, `pt` and `ar`. No hardcoded user-facing strings in components. Language switcher present in navigation, English-only live, and adding a locale file makes that locale selectable with no code changes. Locale-aware date and number formatting. Layout tolerates strings roughly 25% longer than English.

---

## 13. Infrastructure and configuration

### 13.1 Environments
Local, preview (per pull request), production. Separate Supabase projects or branch databases. Production data never reachable from preview.

### 13.2 Database region
Chosen deliberately at project creation and effectively permanent without a migration. Legal review of privacy copy is still pending and this is a UNDP and Italy programme, so an EU region is the low-cost hedge against a data-residency requirement arriving after launch. Confirm before creating the project.

### 13.3 Deployment
Vercel. Prepared for a subdomain such as `askhub.aihubfordevelopment.org`. Document the exact DNS records required so whoever manages the parent domain can point it, and preserve all existing records on that domain, MX in particular.

### 13.4 Rendering strategy
Site Content states that edits apply everywhere immediately with no rebuild. Build-time-only static generation therefore does not satisfy the requirement. Use cached dynamic rendering or incremental static regeneration with on-demand invalidation (`revalidateTag` / `revalidatePath`) triggered by every content and resource mutation. Public pages stay fast and cacheable, and an editor's save is visible without a deploy.

### 13.5 Configuration
All secrets in environment variables, nothing secret committed. Anything prefixed `NEXT_PUBLIC_` is public by definition and must contain no secret. GA4 Measurement ID and contact email are configurable through admin settings, not hardcoded.

---

## 14. Security

### 14.1 Standard and honest framing
No engineer can certify zero vulnerabilities, and this document does not claim to. What is committed to is a defined standard, a specific control set, and explicit verification. The target is OWASP ASVS Level 2 for an application of this exposure, with the controls below implemented and tested before launch.

### 14.2 Assets worth protecting
Subscriber email addresses and their stated interests. Submitter email addresses. Admin credentials and sessions. Content integrity on a site carrying UN and government attribution. Reported figures, whose integrity matters because they are reported upward.

### 14.3 Authentication
- Supabase Auth, email and password, admin-provisioned only, no public sign-up route
- Strong password policy, breached-password rejection where available
- MFA enabled for admin accounts where the provider supports it
- Rate limiting with progressive backoff and lockout on login and password reset
- Reset tokens single-use and expiring; reset and invite flows must not disclose whether an account exists
- Sessions: httpOnly, Secure, SameSite cookies, short-lived with refresh. Never in `localStorage`
- Documented break-glass procedure and at least two admins

### 14.4 Authorization
- RLS enabled on **every** table, deny by default, verified table by table. A newly added table with RLS left off is the single most likely serious defect in a Supabase build.
- Anonymous role reads only `status = 'live'` resources and published public content, through dedicated public-safe views that omit internal and analytics fields entirely
- Role capabilities from Section 3 expressed as policies. `viewer` has no write policy on any table.
- `audit_log` append-only for all roles
- The `service_role` key is used only in server contexts and must never reach the browser or a client bundle
- Every mutating server action re-checks the caller's role. Ownership and target checks on every record access to prevent IDOR.

### 14.5 Input and output
- Zod validation at every server boundary; parse then use the typed result
- Parameterised queries or the client library only; no string-built SQL
- Payload size caps on every write endpoint
- Rely on React escaping. No `dangerouslySetInnerHTML` with user or submitter content. Sanitise with a vetted library if rich text is ever introduced.
- `external_url` and `banner_image_url` validated to `https` scheme on save, with a host allowlist for images
- **Reject SVG uploads and SVG image URLs.** SVG is an active-content XSS vector.
- Outbound links carry `rel="noopener noreferrer"`
- No open redirects: no route accepts a user-supplied destination and redirects to it
- No server-side fetching of user-supplied URLs at request time (SSRF). If link checking is used, it runs offline during seeding, against an allowlist, never on user input.

### 14.6 Public write endpoints
Three exist: contact, suggest a resource, alerts subscribe. Plus the event-log write. Each requires: Zod validation, Cloudflare Turnstile, a honeypot field, per-IP and per-session rate limiting, and no reflection of submitted content back into a page without escaping.

### 14.7 Headers
CSP, HSTS with `includeSubDomains`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `frame-ancestors 'none'`, and a `Permissions-Policy` disabling unused features.

**CSP and GA4 interact.** A strict CSP silently breaks analytics, which is this product's primary success measure. `script-src` must allow the Google Tag domain and `connect-src` must allow the Analytics collection endpoint. Verify events actually arrive with CSP enforced, not merely that the page loads.

### 14.8 Data protection
- Data minimisation: collect only what the forms specify
- No secrets, tokens, passwords, email addresses or other personal data in application logs
- Subscriber deletion path that genuinely removes the record
- Automated backups with point-in-time recovery, and **one restore actually tested before launch**
- Generic error messages to clients; detail server-side only
- Dependency scanning clean of high and critical findings, with Dependabot or Renovate enabled

### 14.9 Verification before launch
Each item is a test, not an assertion:

1. Anonymous request to every `/admin` route and every admin server action returns 401 or 403
2. Anonymous database read returns only live resources and public content; pipeline, reference, submissions, subscribers, settings, and audit log are all unreachable
3. A `viewer` session cannot write to any table, verified against the database directly, not only through the UI
4. An `editor` session cannot alter settings or users
5. Public export contains no views, clicks, CTR, submitter emails or internal notes
6. Client bundle inspected: no `service_role` key, no secrets
7. Security headers verified by external scanner, and GA4 events confirmed arriving with CSP enforced
8. Rate limits demonstrated on login and all public write endpoints
9. Turnstile and honeypot demonstrated to reject automated submissions
10. Backup restore performed successfully
11. `npm audit` clean of high and critical
12. Automated accessibility scan plus manual keyboard pass on directory, a resource, the admin, and every modal
13. No fabricated metric anywhere in production, per 8.4

---

## 15. Seeding

- Seed the curated resources with real titles, partners, descriptions, and verified working external URLs. Approximately 20 records: 11 live, the remainder pipeline and reference.
- Where a URL cannot be confirmed working, set that resource to `pipeline` rather than publishing a broken link. Do not treat a failed automated HEAD request as proof of a dead link; many live sites reject bots. Verify ambiguous cases by hand.
- Where no partner image exists, generate a clean branded placeholder banner (partner name and title, colour keyed to need type). **Never fabricate event flyers or invent imagery.**
- Seed `programmes`, `impact_stories`, `headline_stats`, `compute_metrics` and `partners` from the values in the prototype, which are real programme records.
- **Do not seed:** subscribers, submissions, digest send history, engagement events, or any analytics figure. The prototype's subscriber emails and send log are fixtures, and seeding them would place fabricated personal data and false reporting history into a production UNDP system.
- Seed the initial admin users by invitation, using real team addresses supplied by the client.

---

## 16. Conflicts and open decisions

### 16.1 Where this document overrides the prototypes

The public prototype predates the content rules. Section 10 wins in all of these cases:

| Prototype shows | Required |
| --- | --- |
| Per-resource "Verified" badge on every card | Removed. One global curation statement. |
| Footer "powered by MIMIT, implemented by UNDP's Digital Office" | "Co-led by MIMIT and UNDP", exact footer wording per 10.1 |
| Two mailboxes, `info@` and `partnerships@` | Single mailbox `aihubfordevelopment@undp.org` |
| "CINECA Leonardo (Mattei Plan)" | "CINECA Leonardo" |
| "Global" as a country-filter value | No "Global programmes" filter option; `geo_scope` matches all country selections instead |
| Write controls visible to a Leadership user | Viewer sees no write affordances |
| Populated analytics figures | True values or explicit empty states, per 8.4 |

### 16.2 Where the admin prototype extends the client brief

These appear in the screenshots but not in the brief's data model or scope list. They are treated as in scope, and should be confirmed: `programmes`, `impact_stories`, `headline_stats` with hero pinning, `compute_metrics`, a separate `audit_log` alongside `updates_log`, the two feature flags, update-suggestion submissions as a second review-queue type, and the public Impact page.

### 16.3 Direct conflict requiring a client decision

**Partnership stage names.** The brief specifies `lead` → `exploring` → `negotiating` → `agreement`. The admin prototype and dashboard both show Prospecting → In discussion → Active → Delivered. This document implements the prototype's labels, since they appear consistently in two places and are the later artifact. Confirm before build.

### 16.4 Open questions blocking or de-risking the build

| # | Question | Blocks |
| --- | --- | --- |
| 1 | Transactional email provider, and DNS access for SPF and DKIM on the sending domain | Contact form, double opt-in, digests |
| 2 | GA4: who owns the property, plus service account and numeric property ID for the Data API | Site engagement panels |
| 3 | Supabase region, and whether any data-residency requirement applies | Project creation, effectively irreversible |
| 4 | Exact primary blue hex (brief says approximately `#1F5FBF`) | Design tokens |
| 5 | Footer logo order from the official AI Hub site | Footer |
| 6 | Confirmation of 16.3, partnership stage labels | Partnerships |
| 7 | Real email addresses, display labels and **roles** for initial admin users. Specifically: does anyone actually need read-only `viewer`, or do all named users need `editor` or above? The prototype's "Leadership" user edits content, so `viewer` may have no occupant at launch | Auth provisioning, RLS policy testing |
| 8 | Who manages DNS for the parent domain, and confirmation that existing MX records are preserved | Go-live |
| 9 | Is double opt-in acceptable, given it reduces raw subscriber numbers but is the defensible default | Alerts |
| 10 | Confirmation that 16.2 items are in scope for this build | Scope and schedule |

---

## 17. Definition of done

1. Public site fully usable with no account: browse, search, filter, view detail, apply, export, subscribe to alerts, suggest a resource, suggest an update, contact.
2. Real authentication: an admin creates users, all three roles enforced by RLS at the database layer, sessions and password reset function, no public sign-up exists.
3. A viewer session can read everything and write nothing, proven against the database.
4. Admin performs full CRUD on all content types; publishing status controls what is public; deadline automation drives Expiring soon and the auto-closed display state.
5. Review queue handles both submission types; approval publishes; rejection is soft.
6. Reach and Engagement shows both sections with apply-CTR and featured CTR as named metrics, first-party panels populated with true data, and GA4 panels either connected or showing the not-connected state.
7. GA4 events fire with the exact names and parameters in 8.2, verified arriving with CSP enforced, and every event is also captured first-party.
8. No fabricated metric, subscriber, or send-log entry exists in production.
9. Branding matches the AI Hub identity exactly: Outfit, the specified palette, nav, button and card styling, all via tokens.
10. Every content rule in Section 10 holds everywhere on the site, including the overrides in 16.1.
11. Data persists across sessions and refreshes; editor saves appear on the public site without a rebuild.
12. WCAG 2.1 AA verified; mobile-responsive throughout.
13. All 13 security verification steps in 14.9 pass.
14. Localisation scaffolding in place: no hardcoded user-facing strings, `fr`/`pt`/`ar` stubs present, switcher renders English-only.
15. Deployed on Vercel, reachable, and ready for the subdomain with DNS records documented.

## 18. Scope constraint

Scope is locked to this document. Innovator profiles and matching are explicitly out of scope and deferred to Phase 2; only the feature flag is built. Do not add features beyond this specification.
