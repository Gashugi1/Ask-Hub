# Deployment

This is the runbook for the first Vercel deployment of AskHub: a gated,
non-indexable stakeholder preview of SP2a, the public read surface only. It
covers what is deployed, why it is gated, the environment variables it needs,
the DNS records the eventual subdomain will need, and — most importantly —
the checklist that must be fully satisfied before Deployment Protection and
`noindex` come off and the site goes public.

Nothing in this document is a claim that a deployment exists. Connecting a
Vercel project and setting its environment variables requires operator
credentials this repository's automation does not have; see "Operator steps"
at the end.

## 1. What is deployed and what is not

This build is SP2a: the public read surface. It contains browsing, search,
filtering, resource detail pages, the About page, and export — all read-only.

It contains **no write endpoints**. `src/app/api/README.md` records that
`/api/events`, `/api/contact`, `/api/submissions` and `/api/subscribers` are
each added later, by SP2 proper, and each is called out there as "a public
write endpoint" needing Zod validation, a payload size cap, and — from SP4 —
Cloudflare Turnstile, a honeypot field, and rate limiting. None of that exists
yet in this build, and none of it needs to: with no form to submit, there is
nothing on this deployment for that hardening to protect. That is precisely
why this build can go up ahead of SP4 (CSP, HSTS, Turnstile, honeypots, rate
limiting) — the attack surface those defend does not exist here yet.

The admin portal at `/admin` is out of scope for this deployment's read-only
premise in spirit — it is a real authenticated write surface — but SP4's
hardening is written for the public write endpoints, not for admin, so gating
the whole deployment behind Vercel Deployment Protection (below) is what
keeps `/admin` covered in the meantime, not an assumption that admin is safe
on its own.

## 2. Why it is gated

Two independent mechanisms keep this build out of search, plus one operator
setting that keeps it out of the public's hands entirely. All three must
stay on together — removing one while the others remain is still a failure
if the intent was to go public, and removing the header while the metadata
stays (or vice versa) leaves the page half-declared.

**Vercel Deployment Protection.** Enabled for both the Preview and Production
environments (see "Operator steps"). Without a valid bypass, the deployment
does not render for anyone. This is the only one of the three that stops a
visitor from reaching content at all — the two below only ask search engines
not to index what they can already reach.

**`X-Robots-Tag` header.** `next.config.ts` returns this header on every
route via the `headers()` function:

```
X-Robots-Tag: noindex, nofollow
```

Verified in `next.config.ts`: the `headers()` function matches `source:
'/(.*)'` (every route) and sets exactly that value, alongside
`X-Content-Type-Options: nosniff` and `Referrer-Policy:
strict-origin-when-cross-origin`. A comment there marks the fuller header set
— CSP, HSTS with `includeSubDomains`, `frame-ancestors`, `Permissions-Policy`
— as SP4's, not this build's.

**`robots` metadata.** `src/app/layout.tsx` sets, in the root layout's
exported `metadata`:

```ts
robots: { index: false, follow: false }
```

This renders the equivalent `<meta name="robots" content="noindex,
nofollow">` tag on every page that uses the root layout, which is all of
them.

All three — protection, header, metadata — stay in place until the launch
checklist in Section 5 is fully satisfied. The database currently holds
placeholder content transcribed from a prototype, not the client's dataset
(`scripts/seed-data.ts` says so in its own header); if protection comes off
before that placeholder content is replaced, a real visitor can apply to an
opportunity that does not exist.

## 3. Environment variables

Names only, taken from `.env.example`, which is the committed source of
truth and carries names with no values (enforced by
`tests/structure/env-contract.test.ts`, which fails the build if a value is
committed or if a required name goes missing):

| Name | Public, secret, or test-only | Set on Vercel for this deployment? | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | **Yes** — Preview and Production | Supabase project URL. `NEXT_PUBLIC_`-prefixed variables are inlined into the client bundle by Next.js at build time — public by definition, per PRD 13.5. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | **Yes** — Preview and Production | Supabase anonymous key. Also inlined into the client bundle; it only ever grants what RLS policies allow the `anon` role. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** | **No — not for this deployment.** Add it when SP2b/SP3 lands; see below for why. | Bypasses Row Level Security entirely. Server-only. **Must never be given a `NEXT_PUBLIC_` prefix** — `tests/structure/env-contract.test.ts` asserts `.env.example` contains no such name, and that assertion is what makes this invariant structural rather than a matter of discipline. |
| `SUPABASE_URL` | Test-only | **No, never.** | Read directly by test helpers and `tests/smoke.test.ts` from `.env.test`, against the local Supabase CLI stack. Not a deployment variable under any circumstance. |
| `SUPABASE_ANON_KEY` | Test-only | **No, never.** | Same as above — a local-stack test credential, not something a Vercel project ever needs. |

Set the two `NEXT_PUBLIC_` variables on Vercel for both the Preview and
Production environments (see "Operator steps"). Do not set
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` or `SUPABASE_ANON_KEY` on this
deployment — the disposition column above is the checklist; the reasoning
for the service-role key follows because a credential that bypasses RLS
entirely is worth explaining, not just flagging.

**Why the service-role key is deliberately absent from this deployment.**
`createAdminSupabase()` in `src/lib/supabase/admin.ts` is defined and, as of
this build, called nowhere under `src/`. The only other reference to it in
this repository is `src/app/api/README.md`, which records that the four
public write endpoints will use it once they exist — and those endpoints are
SP2b and SP4's work, not SP2a's. So for the deployment this runbook covers,
there is no code path that reads this key at all: setting it anyway would
mean a credential that bypasses Row Level Security entirely sits in a live
deployment's environment for no corresponding benefit. `admin.ts`'s own
docstring is direct about the risk such a key exists to avoid: a
service-role client is "[n]ever for reading on a user's behalf — that is
`createServerSupabase`, so RLS still applies. A service_role read is how a
viewer ends up seeing something their policies deny." An earlier draft of
this table justified setting the key here anyway with "for SP3's server
actions and for any server-side reader that needs it" — that second clause
was invented, evidenced nowhere, and directly contradicts the docstring just
quoted plus this project's own invariant that anonymous reads go through
public-safe views. It has been removed.

**When the key becomes required, and why.** `public.audit_log` (migration
`supabase/migrations/0007_logs.sql`) has exactly one RLS policy,
`audit_log_select_authenticated`, and it is `SELECT`-only. There is no
INSERT policy for any role, including admin — while `authenticated`
separately holds INSERT, UPDATE and DELETE table grants that RLS renders
unusable without a policy. The consequence: a server action running on the
caller's own authenticated session cannot write its own audit row. Every
mutating admin action will need the service-role client for that one
insert, which is exactly the second bullet in `admin.ts`'s own docstring.
That makes the key required the moment SP2b/SP3 lands, not before. **Add
`SUPABASE_SERVICE_ROLE_KEY` to Vercel as part of that deployment**, and
expect every admin write to fail on a missing-audit-insert error until it is
added.

`.env.example` may also carry `NEXT_PUBLIC_SITE_URL` by the time this
deployment happens; check the file as it stands rather than trusting this
list, and if it names something not covered above with a `NEXT_PUBLIC_`
prefix, set it too — it would be public by the same rule.

No value for any of these belongs in this document, in a commit, or in any
other file `git` tracks. The service role key in particular is the one
credential in this list that must never be pasted anywhere a client bundle,
a log, or a chat transcript could pick it up.

## 4. DNS records

PRD 13.3 anticipates a subdomain such as `askhub.aihubfordevelopment.org`
(the PRD's own example — the exact hostname is the client's to confirm, not
this document's to invent). Once Vercel issues its target for that
subdomain, record it here:

- **Record type:** `CNAME`
- **Host:** `<subdomain — client-confirmed, e.g. askhub>`
- **Target:** `<CNAME value Vercel issues when the domain is added to the project — operator to fill in>`

Two things this task does not cover:

- **Who manages DNS for the parent domain, and whether existing MX records
  survive the change** is PRD open question 8 — unanswered as of this
  writing, and it blocks pointing the subdomain regardless of what Vercel
  issues.
- **SPF and DKIM** for the digest and contact-form sending domain are SP5's
  concern, not this deployment's. PRD 9's schedule risk note is explicit that
  sending from an `@undp.org` or `aihubfordevelopment.org` address needs
  those records on a domain controlled by UNDP IT, and that this is an
  external dependency measured in days — start it early, independent of this
  runbook.

## 5. The pre-launch checklist

**This is the gate.** Every item below must be true before Deployment
Protection comes off and `noindex` is removed. The database right now holds
placeholder content transcribed from a prototype the client reviewed, not
the client's real dataset — `scripts/seed-data.ts`'s header says this in its
own words. Skipping any item here means a real innovator can apply to an
opportunity, a partnership, or a figure that was never real. Do not skim
this list; do not remove protection with any box unchecked.

- [ ] **The client's real dataset replaces the placeholder seed.** Resources,
      partners and any other seeded content currently come from
      `scripts/seed-data.ts`, transcribed from the prototype. None of it is
      the client's confirmed content. See `docs/client-deliverables-request.md`
      for exactly what the client must supply and in what shape — this
      checklist does not restate that list, only gates on it being done.
- [ ] **The fifteen headline figures are attested, each with a source and a
      named attester.** `headline_stats` (and `compute_metrics`) enforce this
      structurally, not just by convention: migration `0015_stat_provenance.sql`
      adds `source`, `attested_by` and `attested_on` as `not null` with a
      non-blank check on `source` and `attested_by`, so a row cannot exist
      without them. That constraint guarantees provenance is recorded; it
      does not by itself guarantee all fifteen have arrived — confirm the
      full set against `docs/client-deliverables-request.md` before treating
      this item as done. Partial delivery is expected and tolerated by the
      product (the stats band renders whatever subset exists), but this
      checklist item is about whether launch content is complete, not about
      whether the mechanism works.
- [ ] **Partner logos and their link-out URLs are uploaded.** Content rule 10
      of PRD Section 10 requires "Partner and institution logos link to
      their official sites"; the `partners` table's `website_url` is
      `not null` and constrained to `https://`, and `logo_url` (nullable) is
      constrained to `https://` and rejects SVG when present — but a
      constraint only stops a bad value, it does not supply a missing one.
      Confirm every partner intended for launch has a real logo and a real
      official-site URL, not a placeholder.
- [ ] **Legal-reviewed Privacy and Terms copy is in `site_content`.** PRD
      content rule 9 states privacy copy stays "minimal and factual pending
      legal review" — that review has to have happened, and the reviewed
      copy has to be the copy actually stored under the `privacy_copy` and
      `terms_copy` keys, not the placeholder that shipped with the seed.
- [ ] **SP4 is merged**: CSP, HSTS (with `includeSubDomains`), Turnstile,
      honeypots, rate limiting, payload caps, and the image-host policy
      `next/image` needs. This deployment intentionally predates all of it;
      going public without it does not.
- [ ] **`noindex` is removed from both places it is set**, together, not one
      at a time:
  - the `X-Robots-Tag` header in `next.config.ts`
  - the `robots` metadata in `src/app/layout.tsx`

      Removing only one leaves the page half-declared to search engines and
      is not a smaller version of done.
- [ ] **Deployment Protection is turned off** in the Vercel project settings,
      at the same time as the two `noindex` removals above — not before, not
      long after.
- [ ] **Sitemap and `robots.txt` are added.** This is SP6's work, not SP2a's
      or this task's, but a public site with neither is discoverable in
      theory and unfindable in practice. Confirm they exist and are correct
      before or at the same moment protection comes off.

**What this checklist deliberately excludes:** total reach, growth, session
counts, and user counts. Those are Google Analytics' to report at runtime —
no column in this schema stores them, by design (see the note in
`supabase/migrations/0015_stat_provenance.sql`, which draws this line
explicitly: `headline_stats` and `compute_metrics` hold only client-supplied,
attested figures, "never a cache of anything GA4 supplies"). If a number like
that is ever proposed for this checklist or for the site, it is being
fabricated, not reported — GA4's dashboards are where it belongs, not a
database column, and not this document.

## Operator steps (not automatable, not executed here)

The remainder of this runbook is for the human operator; no credentials or
external-service access exist in the environment that authors this
document, and none were used or attempted while writing it.

1. **Connect the project.** Import this repository into Vercel. Set the
   environment variables from Section 3 for both the Preview and Production
   environments. Enable Deployment Protection for both.
2. **Verify the deployed site.** Against the real deployed URL, execute and
   record the result of each of the following — this is a checklist to run,
   not a set of claims already confirmed:
   - [ ] The site requires the Deployment Protection bypass to load at all
         (try it in a fresh private-browsing window with no bypass cookie).
   - [ ] `curl -sI <deployed-url>/ | grep -i x-robots-tag` returns
         `noindex, nofollow`. Repeat against `/about` and against one
         resource detail URL.
   - [ ] `/` renders the bands that currently have data, and omits the ones
         that do not.
   - [ ] A resource detail page resolves.
   - [ ] `/impact` returns 404 (the feature flag `feature_public_impact_page`
         is off at launch).
   - [ ] The rendered page source and the built client JS contain no
         `service_role` string and no Supabase service-role token. Search the
         built JS bundles specifically, not just the HTML.
   - [ ] Publish a resource directly in the database, let the relevant tag or
         path revalidate, and confirm its detail page resolves on the
         deployed site **without a redeploy**. This exercises the
         `dynamicParams` behaviour that `src/app/(public)/resources/[id]/page.tsx`
         (added by Task 5) depends on for `generateStaticParams` — a
         route table that only ever worked at build time would fail this
         check silently, by 404ing instead of resolving. That file did not
         exist in the worktree this document was written from; confirm it
         exists and exposes `dynamicParams` before relying on this check.

Steps 1 and 2 above are the human's to run together with an assistant, not
something this document certifies as already done.
