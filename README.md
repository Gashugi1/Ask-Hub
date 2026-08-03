# AskHub

Public curated directory for the AI Hub for Sustainable Development, co-led by
MIMIT and UNDP. Specification: `docs/askhub-prd.md`. Build decomposition:
`docs/superpowers/specs/2026-07-26-askhub-decomposition-design.md`.

## Versions

| Package | Version |
| --- | --- |
| next | 16.2.12 |
| react | 19.2.4 |
| tailwindcss | 4.3.3 |
| typescript | 5.9.3 |

Tailwind is v4: tokens are declared in `src/app/globals.css` under `@theme`,
not in a `tailwind.config.ts`. There is no `tailwind.config.ts` in this repo.

## Commands

| Command | Does |
| --- | --- |
| `npm run dev` | Next dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint (Next 16 removed `next lint`) |
| `npm test` | Vitest, once |
| `npm run db:start` | Local Supabase stack |
| `npm run db:reset` | Reapply every migration from scratch |
| `npm run db:types` | Regenerate `src/lib/supabase/database.types.ts` |

## Running the tests

`npm test` alone is not enough from a clean checkout. Two prerequisites, both
of which fail in a way that looks like a broken test rather than a missing
setup step:

**Run `npm run build` first.** `tests/structure/routes.test.ts` asserts the
route structure against `.next/app-path-routes-manifest.json`, which is a build
artifact and is gitignored. Without a build those cases throw. Worse, a
*stale* manifest makes them pass against a route table that no longer exists,
so the suite fails loudly when the manifest is older than the newest file under
`src/app` — if you see that message, rebuild rather than working around it.

**Docker must be running and the local stack up** for `tests/smoke.test.ts`,
which talks to PostgREST on the local Supabase instance. Start it with
`npm run db:start`. The credentials come from `.env.test`, which is gitignored;
copy the names from `.env.example` and fill them from `npx supabase status`.

**`npm run build` itself needs no Supabase credentials**, even though every
`/admin` route reads the caller's session and, on the Dashboard, live rows.
`src/app/(admin)/admin/layout.tsx` declares `export const dynamic =
'force-dynamic'`, which the whole subtree inherits, so Next's build never
attempts to render these pages ahead of a real request — only a live deploy
does, and that is exactly where `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` must be set for `/admin` to work at all (as
build *and* runtime env vars on Vercel; there is no separate CI workflow in
this repository to catch a missing one earlier). Locally, `npm run dev` still
needs them the same way `npm test` needs `.env.test` — copy `.env.example` to
`.env.local` and fill it from `npx supabase status`, exactly as for
`.env.test`, and never commit either file.

```bash
npm run db:start   # Docker must already be running
npm run build
npm test
```

## Scope boundary and deploy posture

This repository began as an application **skeleton**, with every `page.tsx`
rendering its own route path and nothing else, each to be replaced in turn by
the sub-project that builds the real surface. SP1's database schema and RLS
policies have since landed, and SP2 is landing the public site page by page.
The admin portal landed with SP3, merged into this branch: sign-in, the
role-aware shell, Dashboard, Resources (list and edit), Site Content, Settings,
Users and a read-only Audit Log. Five of PRD §6's nine screens are deliberately
not built — Review queue, Alerts &amp; subscribers, Partnerships, Reach &amp;
engagement, and Updates — and do not exist at any layer.

Design tokens landed with SP1 Task 2: `src/app/globals.css` carries the full
`@theme` block, and the guard that once asserted no colour value appeared
anywhere under `src/` was narrowed to that block rather than deleted, so a hex
literal outside it still fails.

**This build is not a public go-live.** It ships behind Vercel Deployment
Protection for a gated stakeholder review, and it declares itself
non-indexable in two places:

- `next.config.ts` sends `X-Robots-Tag: noindex, nofollow` on every route.
- `src/app/layout.tsx` sets `robots: { index: false, follow: false }` in the
  root metadata, which renders the equivalent `<meta name="robots">`.

SP6 adds a third before launch, `public/robots.txt` with `Disallow: /` (see
`docs/deployment.md`'s pre-launch checklist) — it does not exist in this
repository yet.

> **All three must be removed or replaced at go-live.** A public directory
> that is still `noindex` is invisible to search, which for a discovery
> product is a silent, total failure of its purpose — and it fails silently,
> because the site looks perfectly healthy to anyone who has the URL. Removing
> only the header while the layout metadata stays is the same failure.
> Deployment Protection must come off at the same time.

CSP, HSTS, Turnstile and rate limiting are SP4 and are deliberately absent
from this build.

## Infrastructure

Supabase project ref: <recorded in SP1 Task 14>
Supabase region: <confirmed EU region, recorded in SP1 Task 14>
