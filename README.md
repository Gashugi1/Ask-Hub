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

This repository is an application **skeleton**. It deliberately contains no
pages, no database schema and no admin screens: every `page.tsx` renders its
own route path and nothing else, and each one is deleted by the sub-project
that builds the real surface. The schema and RLS policies are SP1, the public
site is SP2, the admin portal is SP3.

Design tokens are also deliberately absent — `src/app/globals.css` only imports
Tailwind. A test asserts that no colour value in any notation appears anywhere
under `src/`; the `@theme` block that makes that assertion obsolete is SP1
Task 2, which must narrow the guard rather than delete it.

**This build is not a public go-live.** It ships behind Vercel Deployment
Protection for a gated stakeholder review, and it declares itself
non-indexable in two places:

- `next.config.ts` sends `X-Robots-Tag: noindex, nofollow` on every route.
- `src/app/layout.tsx` sets `robots: { index: false, follow: false }` in the
  root metadata, which renders the equivalent `<meta name="robots">`.

SP1 Task 14 adds a third, `public/robots.txt` with `Disallow: /`.

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
