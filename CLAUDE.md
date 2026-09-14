# AskHub

Public curated directory for the AI Hub for Sustainable Development, co-led by MIMIT and UNDP. Open browsing with no account. Authenticated admin portal at `/admin` for curation, review, subscribers, partnerships, site content and reach reporting.

Full specification: `docs/askhub-prd.md`. Read the relevant section before implementing any feature. This file holds only the rules that must never be violated.

## Stack

Next.js (App Router, TypeScript strict), Supabase (Postgres + Auth + RLS), Tailwind with design tokens, Vercel, GA4 plus first-party event log.

## Hard rules

**Never fabricate data.** The prototypes contain invented metrics (total reach, users, per-resource views and clicks, weekly trends, a digest send log, subscriber emails). None of it may be seeded, hardcoded, or approximated. Metric panels show true values or explicit empty states. This is a leadership reporting surface for a UN programme; a plausible fake number is a launch-blocking defect.

**Content rules, no exceptions:**
- Attribution is always "co-led by MIMIT and UNDP". Never "powered by" or "implemented by".
- Always "AI Hub" or "AI Hub for Sustainable Development". Never "the Hub" alone.
- One mailbox only: `aihubfordevelopment@undp.org`.
- No per-resource "Verified" badge. Curation is stated once globally.
- "Democratic Republic of the Congo" in full. No "Global programmes" country filter option.

**Security invariants:**
- RLS enabled on every table, deny by default. A new table without RLS is a defect.
- `service_role` key is server-only. It must never appear in a client bundle.
- Every mutating server action re-checks the caller's role. Middleware gating is UX, not security.
- Anonymous reads go through public-safe views that exclude views, clicks, CTR, submitter emails and internal notes.
- `viewer` role has no write policy on any table, and sees no write affordances in the UI.
- Zod at every server boundary. No string-built SQL. No `dangerouslySetInnerHTML` with user content.
- Reject SVG uploads and SVG image URLs.
- `audit_log` is append-only for all roles.

## Conventions

- No hardcoded user-facing strings. Everything goes to `locales/en.json`. Stubs exist for `fr`, `pt`, `ar`. This rule is **not** relaxed by the prototype port below: styles are transcribed verbatim, copy never is.
- Colour and type values are transcribed verbatim from the approved prototype at https://fluffy-puffpuff-acb4db.netlify.app/ — the sole reference. (An in-repo copy under `docs/prototype/` was removed on 2026-09-14 because it had fallen behind the deployed build and was being transcribed from by mistake.) Design tokens remain in `globals.css` for anything it does not cover.
- **Accessibility outranks prototype fidelity.** The prototype's `need-training` (`#0E7A8A`) and `need-funding` (`#B4691F`) fail WCAG AA on badge text, so they are deliberately darkened to `#0E7685` and `#9E5C1B`. `tests/unit/tokens.test.ts` computes the contrast ratios and must never be relaxed to make a transcription match.
- Public pages are cached and revalidated on write (`revalidateTag` / `revalidatePath`). Site Content edits must appear without a rebuild.
- GA4 event names are fixed: `resource_view`, `apply_click`, `search_performed`, `filter_used`, `export_clicked`. Every event also writes to `engagement_events`.
- Deadline past means the resource leaves the public listings — directory, search, browse counts, rail and export — but keeps its own detail page, which shows it as Closed so shared links still resolve. It stays visible in admin under the Closed tab, flagged "Auto-closed, past deadline". Its `status` does not change: auto-close is still a display state, not a status transition.
- Feature flags `feature_innovator_profiles` and `feature_public_impact_page` are both off at launch. Build the flag, not the innovator profiles feature.

## Testing

Test the security boundary and the logic, not the presentation. Required coverage: RLS policies per role, anonymous read scope, role enforcement on server actions, digest subscriber matching, deadline and expiring-soon computation, public export field exclusion.
