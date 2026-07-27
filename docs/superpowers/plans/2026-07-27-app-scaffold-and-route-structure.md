# AskHub App Scaffold and Route Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up an empty but complete AskHub application skeleton — Next.js App Router with strict TypeScript, Tailwind, the three Supabase clients, and the `(public)` / `(admin)/admin` / `api` route structure — so that the schema tasks and the two surface sub-projects have somewhere to land.

**Architecture:** One Next.js deployable serves both surfaces, separated by route groups rather than by two apps. `src/app/(public)` holds the anonymous site and `src/app/(admin)/admin` holds the authenticated portal; each group owns its own layout, so the admin chrome never renders on a public page and vice versa. Route handlers live under `src/app/api`. `src/proxy.ts` refreshes the Supabase session cookie on every request and redirects unauthenticated `/admin` traffic to the login route — that redirect is UX only, and never the authorization boundary. Three Supabase client factories keep the key boundary explicit: a browser client and a request-scoped server client both on the anon key and therefore subject to RLS, and a `server-only` `service_role` client that bypasses it.

**Tech Stack:** Next.js 16.2.12 (App Router, Turbopack), React 19.2.4, TypeScript 5 strict, Tailwind CSS v4 (CSS-first, via `@tailwindcss/postcss`), `@supabase/supabase-js` 2.x, `@supabase/ssr` 0.12.x, Zod, Vitest 4, Supabase CLI.

**No pages are built.** Every `page.tsx` in this plan renders its own route path and nothing else. The real pages are SP2 (public) and SP3 (admin).

---

## Relationship to the existing plans

This plan **supersedes Tasks 1 and 2 of** `docs/superpowers/plans/2026-07-26-sp1-foundation-data-spine.md`, and takes the client-module half of that plan's Task 13. Read this section before starting, and do not run SP1 Task 1.

| SP1 plan task | Status after this plan |
| --- | --- |
| Task 1 (repo scaffold, Supabase CLI, test loop) | **Replaced** by Tasks 1 and 3 here. SP1 Task 1 Step 1 uses `--no-turbopack`, a flag `create-next-app` no longer accepts, and its `"lint": "next lint"` script names a CLI command Next 16 removed. |
| Task 2 (design tokens, Outfit font, i18n) | **Split.** The localisation half — `src/locales/*.json`, `src/lib/i18n.ts`, `t()`, and the content-rule assertions over `en.json` — moves **into Task 1 here** (decision below). What remains in SP1 Task 2 is design tokens and the self-hosted Outfit font: its Steps 1–5 and 12–15, minus the i18n steps 6–11. Task 1 here writes a deliberately token-free `globals.css` whose only job is to import Tailwind. |
| Tasks 3–12 (migrations, seed) | Unchanged. |
| Task 13 (Supabase clients, `src/lib/auth.ts`, admin provisioning) | Client factories move **into Task 4 here**. What remains in SP1 Task 13 is regenerating `database.types.ts` from the real schema, writing `src/lib/auth.ts` (`getCurrentUser`, `requireRole`), and `scripts/provision-admins.ts` — all of which need the `profiles` table to exist first. |
| Task 14 (bundle secret audit, protected deploy) | Unchanged. Task 4 here adds a source-level check; Task 14's built-bundle audit still applies. |

Design authority: `docs/askhub-prd.md` §2 (stack) and §4 (data model) for what the scaffold must be able to hold, and `docs/superpowers/specs/2026-07-26-askhub-decomposition-design.md` §5.1 and §5.7 for the skeleton and deploy decisions.

---

## Global Constraints

Every task's requirements implicitly include this section. Values are copied verbatim from `docs/askhub-prd.md` and `CLAUDE.md`.

**Never fabricate data.** No seeded, hardcoded, or approximated metric. Metric panels show true values or explicit empty states. A plausible fake number is a launch-blocking defect.

**Security invariants:**
- RLS enabled on every table, deny by default. A new table without RLS is a defect.
- `service_role` key is server-only. It must never appear in a client bundle.
- Every mutating server action re-checks the caller's role. Middleware gating is UX, not security.
- Anonymous reads go through public-safe views that exclude views, clicks, CTR, submitter emails and internal notes.
- `viewer` role has no write policy on any table, and sees no write affordances in the UI.
- Zod at every server boundary. No string-built SQL. No `dangerouslySetInnerHTML` with user content.
- Reject SVG uploads and SVG image URLs.
- `audit_log` is append-only for all roles.

**Configuration (PRD §13.5):** All secrets in environment variables, nothing secret committed. Anything prefixed `NEXT_PUBLIC_` is public by definition and must contain no secret.

**Conventions:**
- No hardcoded user-facing strings. Everything goes to `src/locales/en.json`. Stubs exist for `fr`, `pt`, `ar`. **This is binding from Task 1 of this plan** — `en.json` and `t()` are built here, not deferred.
- No hardcoded colours or type values. Use design tokens. (Tokens arrive in SP1 Task 2; this plan writes no colours, and a test enforces that.)
- No login link or admin reference anywhere in public navigation (PRD §5.8). The route-group split is what makes that structurally easy.

**How the no-hardcoded-strings rule applies to a scaffold with no pages.** Two rules, both enforced by tests:

1. Anything that reaches a user — page copy, `<title>`, `<meta description>`, button labels, error text — comes from `t()`. The root layout's metadata is the only such content in this plan, and it uses `t('site.name')` and `t('site.tagline')`.
2. Placeholder pages render **no text at all**. They carry a `data-route` attribute naming their route and nothing else. An HTML attribute is not user-facing copy, so it needs no locale key, and it gives Task 2 a stable machine-checkable hook that a blank page would not. Every one of these files is deleted by SP2 or SP3.

A reviewer should treat a visible string outside `t()` as a defect, and should **not** treat `data-route="/admin"` as one.

**Deploy posture (design doc §5.7):** this build ships behind Vercel Deployment Protection and serves `noindex`. It is a gated stakeholder review, not a public go-live. CSP, HSTS, Turnstile and rate limiting are SP4 and deliberately absent.

**Verified environment facts.** Every command and file in this plan was executed against a throwaway scaffold on 27 July 2026. Do not "correct" these to older conventions:
- `create-next-app` no longer has `--no-turbopack`; Turbopack is the default bundler.
- Next 16's CLI has `dev`, `build`, `start`, `info`, `telemetry`, `typegen`. **There is no `next lint`.** The lint script is `eslint`.
- Next 16 deprecates the `middleware.ts` convention in favour of **`proxy.ts` exporting a `proxy` function**. `middleware.ts` still builds but prints a deprecation warning.
- `create-next-app` refuses a non-empty target directory unless every entry is on its allowlist. That allowlist includes `.git`, `.gitignore`, `.DS_Store` and `docs`, but **not `.claude`** — so scaffolding in place will fail here. Task 1 scaffolds to a temp directory and copies in.
- The generated `.gitignore` contains `.env*`, which ignores `.env.example` too. Task 1 adds a `!.env.example` negation.
- **TypeScript must stay on `^5`.** Next 16.2.12 rejects TypeScript 6 and newer outright: `TypeScript 7.0.2 does not provide the compiler API required by Next.js`. `create-next-app` pins `^5`. Never run a bare `npm install -D typescript`, which now resolves to 7.x and breaks the build.
- At the end of Task 1 — root layout, no `page.tsx` — the build prints `Route (app) / ─ ○ /_not-found`. The app router is not empty even without a page, because `src/app/favicon.ico` is itself an app route (`/favicon.ico/route` in the manifest). A project with a layout, no page **and** no favicon instead falls back to a pages-router `Route (pages) / ─ ○ /404` table; that is not this project's state.
- `npx supabase start` needs a running Docker daemon. Confirm `docker info` succeeds before starting Task 3.

---

## File Structure

```
package.json                              deps + scripts (lint is `eslint`, not `next lint`)
tsconfig.json                             strict + noUncheckedIndexedAccess + verbatimModuleSyntax
next.config.ts                            noindex + two cheap security headers
postcss.config.mjs                        @tailwindcss/postcss (generated, unmodified)
eslint.config.mjs                         generated, unmodified
vitest.config.ts                          @ alias, fileParallelism off for the later DB suites
.env.example                              documented names, no values, committed
.gitignore                                .env* plus a !.env.example negation
README.md                                 versions, infrastructure, scope boundary

src/app/layout.tsx                        root layout: <html>, <body>, noindex metadata via t()
src/app/globals.css                       `@import "tailwindcss"` only — tokens are SP1 Task 2
src/lib/i18n.ts                           t() lookup, missing key returns the key
src/locales/en.json                       every user-facing string, flat dotted keys
src/locales/fr.json                       stub: {}
src/locales/pt.json                       stub: {}
src/locales/ar.json                       stub: {}
src/app/(public)/layout.tsx               public chrome slot; header/footer are SP2
src/app/(public)/page.tsx                 placeholder for `/`
src/app/(admin)/layout.tsx                admin group shell, separate from public chrome
src/app/(admin)/admin/layout.tsx          sidebar slot; the nine-item sidebar is SP3
src/app/(admin)/admin/page.tsx            placeholder for `/admin`
src/app/(admin)/admin/login/page.tsx      placeholder for `/admin/login`
src/app/api/health/route.ts               the one live route handler; proves the pattern
src/app/api/README.md                     which endpoint each sub-project adds here
src/proxy.ts                              session refresh + /admin redirect (Next 16 convention)

src/lib/supabase/browser.ts               anon key, RLS applies
src/lib/supabase/server.ts                anon key + cookies, RLS applies, server-only
src/lib/supabase/admin.ts                 service_role, bypasses RLS, server-only
src/lib/supabase/database.types.ts        placeholder; `npm run db:types` overwrites it
src/lib/actions/README.md                 why server actions live outside the route tree

supabase/config.toml                      CLI config, public signup disabled

tests/structure/app-structure.test.ts     required files exist, forbidden ones do not
tests/structure/routes.test.ts            build manifest maps route groups to clean URLs
tests/structure/env-contract.test.ts      no NEXT_PUBLIC_ secret, .env.example committable
tests/unit/i18n.test.ts                   t() behaviour plus the PRD 10 content rules
tests/unit/supabase-clients.test.ts       key boundary at the source level
tests/smoke.test.ts                       local Postgres reachable with the anon key
```

**Why route groups rather than two Next apps or a `/admin` path prefix alone:** the public site and the admin portal share nothing above `<body>` — different chrome, different fonts weights in use, different caching posture — but must be one deployable (PRD §2). A route group gives each its own layout subtree while keeping one build, and `(public)` / `(admin)` never appear in a URL. The verification in Task 2 asserts exactly that.

**Why server actions are not under `src/app/api`:** `src/app/api` is part of the route tree, where Next reserves the `route.ts` filename and treats directories as URL segments. A `'use server'` module is imported, never routed, so putting it there means shipping importable-only files inside the URL namespace and inviting a name collision. They live in `src/lib/actions/` instead, with `src/app/api/` holding route handlers only. If you would rather have both under one folder it is a directory move and an import-path update, nothing more.

---

## Task 1: Next.js scaffold, strict TypeScript, and the Vitest harness

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `.gitignore`, `README.md`, `.env.example` (empty here; Task 3 fills it)
- Create: `src/app/layout.tsx`, `src/app/globals.css`
- Create: `src/lib/i18n.ts`, `src/locales/en.json`, `src/locales/fr.json`, `src/locales/pt.json`, `src/locales/ar.json`
- Delete: `src/app/page.tsx` (generated), `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg`
- Test: `tests/structure/app-structure.test.ts`, `tests/unit/i18n.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `npm run build`, `npm test`, `npm run lint`, `npm run typecheck`
  - the `@/*` import alias resolving to `src/`
  - a root layout exporting `metadata` with `robots: { index: false, follow: false }`
  - `t(key: string, vars?: Record<string, string | number>, locale?: string): string` and `DEFAULT_LOCALE` from `@/lib/i18n`

The localisation scaffolding is here rather than in SP1 Task 2 because this plan's root layout has user-facing metadata, and the no-hardcoded-strings rule has no useful "start later" point — the first component that ships a bare string sets the precedent. **When SP1 Task 2 runs, skip its i18n steps (6 through 11) and add only its tokens and font.**

- [ ] **Step 1: Scaffold to a temp directory**

Scaffolding in place fails: `create-next-app` allowlists `.git`, `.gitignore`, `.DS_Store` and `docs`, but not `.claude`, which this repo has. Scaffold outside and copy in.

```bash
rm -rf /tmp/askhub-scaffold
npx create-next-app@latest /tmp/askhub-scaffold \
  --typescript --tailwind --app --eslint --src-dir \
  --import-alias "@/*" --no-agents-md --disable-git --yes
```

`--no-agents-md` suppresses a generic Next.js `AGENTS.md` at the repo root; this project's rules live in `CLAUDE.md` at the repo root and a second competing instruction file is worse than none. `--disable-git` keeps a nested repo out of the copy.

- [ ] **Step 2: Copy into the repo**

```bash
cd /Users/Itanzi/Projects/AskHub
rsync -a --exclude .git --exclude node_modules /tmp/askhub-scaffold/ .
npm install
rm -rf /tmp/askhub-scaffold
```

Run: `git status --short`
Expected: new untracked entries including `package.json`, `tsconfig.json`, `src/app/`, and no modifications to anything under `docs/`.

- [ ] **Step 3: Record the versions actually installed**

```bash
node -p "const p=require('./package.json'); JSON.stringify({next:p.dependencies.next, react:p.dependencies.react, tailwindcss:p.devDependencies.tailwindcss, typescript:p.devDependencies.typescript},null,2)"
```

Create `README.md` with those values filled in:

```markdown
# AskHub

Public curated directory for the AI Hub for Sustainable Development, co-led by
MIMIT and UNDP. Specification: `docs/askhub-prd.md`. Build decomposition:
`docs/superpowers/specs/2026-07-26-askhub-decomposition-design.md`.

## Versions

| Package | Version |
| --- | --- |
| next | <fill from the command above> |
| react | <fill> |
| tailwindcss | <fill> |
| typescript | <fill> |

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

## Infrastructure

Supabase project ref: <recorded in SP1 Task 14>
Supabase region: <confirmed EU region, recorded in SP1 Task 14>
```

If the installed Next major is below 16, stop and say so rather than adapting silently — this plan's `proxy.ts` convention and the absent `next lint` command are both Next 16 specifics.

- [ ] **Step 4: Tighten `tsconfig.json`**

The generated config already sets `"strict": true`. Add the four options that catch the mistakes strict mode alone does not, and raise the target. Apply with a script so the rest of the generated config — `paths`, `plugins`, `include` — is preserved exactly:

```bash
node -e '
const fs = require("fs");
const j = JSON.parse(fs.readFileSync("tsconfig.json", "utf8"));
Object.assign(j.compilerOptions, {
  target: "ES2022",
  strict: true,
  noUncheckedIndexedAccess: true,
  noImplicitOverride: true,
  noFallthroughCasesInSwitch: true,
  forceConsistentCasingInFileNames: true,
  verbatimModuleSyntax: true,
});
fs.writeFileSync("tsconfig.json", JSON.stringify(j, null, 2) + "\n");
'
node -p "JSON.stringify(require('./tsconfig.json').compilerOptions, null, 2)"
```

`noUncheckedIndexedAccess` is the one that matters most here: the seed, the filter code and the locale lookup all index into arrays and records, and without it those all silently type as non-nullable. `verbatimModuleSyntax` forces `import type` for type-only imports, which keeps `server-only` modules from being pulled into a client graph by an accidental value import.

- [ ] **Step 5: Install the remaining dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr zod server-only
npm install -D vitest dotenv tsx supabase
```

- [ ] **Step 6: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

// Loaded here rather than in a setup file so the DB suites added by the
// schema tasks see credentials before their module-level client factories run.
config({ path: '.env.test' });

export default defineConfig({
  test: {
    // The RLS suites added later share one Postgres instance and assert on
    // row visibility. Parallel files would interleave writes and go flaky.
    fileParallelism: false,
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
});
```

- [ ] **Step 7: Set the scripts in `package.json`**

Replace the `scripts` block with:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:types": "supabase gen types typescript --local > src/lib/supabase/database.types.ts",
    "seed": "tsx scripts/seed.ts"
  }
}
```

`seed` points at a script the SP1 seed task creates; it is listed now so the SP1 plan's commands work unmodified.

- [ ] **Step 8: Fix the `.gitignore` env negation**

The generated file contains `.env*`, which ignores `.env.example` along with the real secrets. Append:

```bash
cat >> .gitignore <<'EOF'

# .env* above ignores every env file including the documented template.
# The template carries names only, never values, and must be committed.
!.env.example

# Supabase CLI local state
/supabase/.branches
/supabase/.temp
EOF
```

- [ ] **Step 9: Verify the ignore rules with a dry-run add**

`git check-ignore` is misleading on a negated pattern — it exits 0 and prints the negation rule, which reads like a match. Use a dry-run add instead:

```bash
touch .env.example .env.test
git add -n .env.example
git add -n .env.test
```

Expected: the first prints `add '.env.example'`. The second prints `The following paths are ignored by one of your .gitignore files: .env.test`. If `.env.test` is addable, stop and fix `.gitignore` before writing any credential into it.

```bash
rm .env.test
```

`.env.example` is filled in by Task 3 and stays for now.

- [ ] **Step 10: Strip the boilerplate that violates project rules**

```bash
rm -f public/file.svg public/globe.svg public/next.svg public/vercel.svg public/window.svg
rm -f src/app/page.tsx
ls public
```

Expected: `public` is empty, or holds nothing but directories you created. The five SVGs are Next.js marketing assets; PRD §14.5 rejects SVG as an active-content vector and none of them belong to this product. `src/app/page.tsx` is deleted because `/` moves into the `(public)` group in Task 2 — leaving both would make two files claim the same route and fail the build.

`src/app/favicon.ico` stays for now; SP2 replaces it with the AI Hub mark.

- [ ] **Step 11: Write the failing i18n test**

`tests/unit/i18n.test.ts`. The content-rule cases matter more than the lookup cases: PRD §10 is set by K&S and non-negotiable, and asserting it over `en.json` means every string the site ever renders is checked in one place rather than page by page.

```ts
import { describe, it, expect } from 'vitest';
import { t, DEFAULT_LOCALE } from '@/lib/i18n';
import en from '@/locales/en.json';
import fr from '@/locales/fr.json';
import pt from '@/locales/pt.json';
import ar from '@/locales/ar.json';

const dictionary = en as Record<string, string>;

describe('t()', () => {
  it('resolves a known key', () => {
    expect(t('site.name')).toBe('AI Hub for Sustainable Development');
  });

  it('returns the key itself for a missing lookup so gaps are visible', () => {
    // A blank string would hide the gap; the key renders as an obvious token.
    expect(t('does.not.exist')).toBe('does.not.exist');
  });

  it('interpolates named variables', () => {
    expect(t('deadline.daysLeft', { count: 6 })).toBe('6 days left');
  });

  it('leaves an unsupplied placeholder visibly intact', () => {
    expect(t('deadline.daysLeft')).toBe('{count} days left');
  });

  it('falls back to English for an unknown locale', () => {
    expect(t('site.name', undefined, 'xx')).toBe(dictionary['site.name']);
  });

  it('defaults to English', () => {
    expect(DEFAULT_LOCALE).toBe('en');
  });
});

describe('en.json hygiene', () => {
  it('is flat — no nested objects', () => {
    for (const [key, value] of Object.entries(dictionary)) {
      expect(typeof value, `${key} is not a string`).toBe('string');
    }
  });

  it('has no empty values', () => {
    for (const [key, value] of Object.entries(dictionary)) {
      expect(value, `empty value for ${key}`).not.toBe('');
    }
  });

  it('ships fr, pt and ar stubs', () => {
    // PRD 12.4: adding a locale file makes that locale selectable with no
    // code change. The switcher itself is SP6.
    for (const stub of [fr, pt, ar]) {
      expect(typeof stub).toBe('object');
    }
  });
});

describe('PRD 10 content rules', () => {
  const all = JSON.stringify(en);

  it('uses the co-led attribution', () => {
    expect(all).toContain('co-led by MIMIT and UNDP');
  });

  it('never says "powered by" or "implemented by"', () => {
    expect(all).not.toMatch(/powered by|implemented by/i);
  });

  it('carries the exact footer wording from rule 10.1', () => {
    expect(dictionary['site.footer']).toBe(
      'Co-led by the Ministry of Enterprises and Made in Italy and the United Nations Development Programme.',
    );
  });

  it('never says "the Hub" alone', () => {
    // Rule 10.2: always "AI Hub" or "AI Hub for Sustainable Development".
    expect(all).not.toMatch(/\bthe Hub\b(?! for)/);
  });

  it('uses one mailbox only', () => {
    expect(dictionary['site.contactEmail']).toBe('aihubfordevelopment@undp.org');
    expect(all).not.toMatch(/info@|partnerships@/i);
  });

  it('states curation once, globally, with no per-resource Verified badge', () => {
    // Rule 10.8 and PRD 16.1.
    expect(dictionary['site.curationStatement']).toBe(
      'Every resource is curated and verified by the AI Hub team.',
    );
    expect(all).not.toMatch(/"[^"]*\bVerified\b[^"]*"/);
  });

  it('offers no "Global programmes" country filter value', () => {
    // Rule 10.6.
    expect(all).not.toMatch(/Global programmes/i);
  });

  it('carries no fabricated metric from the prototype GADATA block', () => {
    // PRD 8.4: a plausible fake number reaching production is a
    // launch-blocking defect. These are the prototype's invented figures.
    for (const figure of ['14,698', '12,840', '17,650', '2,583']) {
      expect(all, `fabricated figure ${figure}`).not.toContain(figure);
    }
  });
});
```

- [ ] **Step 12: Run it to confirm it fails**

Run: `npm test -- tests/unit/i18n.test.ts`
Expected: FAIL — `@/lib/i18n` does not exist.

- [ ] **Step 13: Write `src/locales/en.json`**

Flat dotted keys. SP2 and SP3 add to this file; this task seeds the strings the content rules police plus the labels the schema enums need display names for.

```json
{
  "site.name": "AI Hub for Sustainable Development",
  "site.shortName": "AI Hub",
  "site.tagline": "Compute, training, funding, accelerators and partnerships for African AI innovators.",
  "site.attribution": "co-led by MIMIT and UNDP",
  "site.footer": "Co-led by the Ministry of Enterprises and Made in Italy and the United Nations Development Programme.",
  "site.contactEmail": "aihubfordevelopment@undp.org",
  "site.curationStatement": "Every resource is curated and verified by the AI Hub team.",
  "need.compute": "Compute",
  "need.training": "Training",
  "need.funding": "Funding",
  "need.accelerator": "Accelerator",
  "need.partners": "Partners",
  "deadline.rolling": "Rolling",
  "deadline.closed": "Closed",
  "deadline.autoClosed": "Auto-closed, past deadline",
  "deadline.daysLeft": "{count} days left",
  "status.live": "Live",
  "status.pipeline": "Pipeline",
  "status.reference": "Reference",
  "stage.prospecting": "Prospecting",
  "stage.in_discussion": "In discussion",
  "stage.active": "Active",
  "stage.delivered": "Delivered",
  "empty.noData": "Data will appear here as traffic accumulates.",
  "empty.ga4NotConnected": "Not connected, add your GA4 Measurement ID"
}
```

The two `empty.*` keys are PRD §8.4 in string form: a metric panel with no data says so rather than showing a plausible number.

- [ ] **Step 14: Write the three stub locale files**

`src/locales/fr.json`, `src/locales/pt.json`, `src/locales/ar.json` — each containing exactly:

```json
{}
```

- [ ] **Step 15: Write `src/lib/i18n.ts`**

```ts
import en from '@/locales/en.json';
import fr from '@/locales/fr.json';
import pt from '@/locales/pt.json';
import ar from '@/locales/ar.json';

export const DEFAULT_LOCALE = 'en';

export const LOCALES = ['en', 'fr', 'pt', 'ar'] as const;

export type Locale = (typeof LOCALES)[number];

const dictionaries: Record<string, Record<string, string>> = {
  en: en as Record<string, string>,
  fr: fr as Record<string, string>,
  pt: pt as Record<string, string>,
  ar: ar as Record<string, string>,
};

/**
 * Look up a user-facing string.
 *
 * Returns the key itself when missing, so a gap shows up in the UI as an
 * obvious token rather than as blank space. Falls back to English per key,
 * not per file, which is what lets the fr/pt/ar stubs ship empty and be
 * filled in a string at a time (PRD 12.4).
 *
 * The locale switcher is SP6. Callers pass no locale until then.
 */
export function t(
  key: string,
  vars?: Record<string, string | number>,
  locale: string = DEFAULT_LOCALE,
): string {
  const fallback = dictionaries[DEFAULT_LOCALE]!;
  const raw = dictionaries[locale]?.[key] ?? fallback[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
```

- [ ] **Step 16: Run the i18n test**

Run: `npm test -- tests/unit/i18n.test.ts`
Expected: PASS, every case. A failure in the `PRD 10 content rules` block means a string in `en.json` was altered — fix the string, never the assertion.

- [ ] **Step 17: Rewrite `src/app/layout.tsx`**

The generated layout imports Geist from `next/font/google`. Design doc §5.1 self-hosts Outfit specifically to keep a Google Fonts round trip off the critical path, so the Geist import goes now rather than being replaced later.

```tsx
import type { Metadata } from 'next';
import './globals.css';
import { t } from '@/lib/i18n';

export const metadata: Metadata = {
  // From the locale file, not inline: <title> and <meta description> are
  // user-facing. SP1 Task 2 adds the self-hosted Outfit preload below.
  title: t('site.name'),
  description: t('site.tagline'),
  // Design doc 5.7: this build ships behind Vercel Deployment Protection
  // with no CSP, no Turnstile and no rate limiting. It must not be indexed.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
```

- [ ] **Step 18: Reduce `src/app/globals.css` to the Tailwind import**

The generated file declares a light/dark `--background` / `--foreground` pair and an Arial fallback stack. All three are hardcoded design values, which `CLAUDE.md` forbids, and all three are superseded by the token block in SP1 Task 2. Replace the whole file with:

```css
@import "tailwindcss";

/*
 * Design tokens intentionally absent.
 *
 * The full @theme block — palette, need colour keys, card shadow and the
 * self-hosted Outfit @font-face rules — is SP1 Task 2 in
 * docs/superpowers/plans/2026-07-26-sp1-foundation-data-spine.md.
 *
 * Do not add a colour or a font-size here. CLAUDE.md: no hardcoded
 * colours or type values, use design tokens.
 */
```

- [ ] **Step 19: Add the noindex and low-cost security headers**

`next.config.ts`:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Design doc 5.7. The full header set — CSP, HSTS with
          // includeSubDomains, frame-ancestors, Permissions-Policy — is SP4.
          // These three cost nothing and need no GA4 compatibility work.
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 20: Write the failing structure test**

`tests/structure/app-structure.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const REQUIRED = [
  'src/app/layout.tsx',
  'src/app/globals.css',
  'src/lib/i18n.ts',
  'src/locales/en.json',
  'src/locales/fr.json',
  'src/locales/pt.json',
  'src/locales/ar.json',
  'tsconfig.json',
  'vitest.config.ts',
  'next.config.ts',
  '.env.example',
];

// Deleting these is the point of Task 1 Step 10, and a future
// `create-next-app` rerun would quietly bring them back.
const FORBIDDEN = [
  'src/app/page.tsx',
  'public/next.svg',
  'public/vercel.svg',
  'public/file.svg',
  'public/globe.svg',
  'public/window.svg',
  'tailwind.config.ts',
  'tailwind.config.js',
  'AGENTS.md',
];

describe('app skeleton', () => {
  for (const file of REQUIRED) {
    it(`has ${file}`, () => {
      expect(existsSync(file), `${file} is missing`).toBe(true);
    });
  }

  for (const file of FORBIDDEN) {
    it(`does not have ${file}`, () => {
      expect(existsSync(file), `${file} should have been removed`).toBe(false);
    });
  }
});

describe('typescript configuration', () => {
  const tsconfig = JSON.parse(readFileSync('tsconfig.json', 'utf8')) as {
    compilerOptions: Record<string, unknown>;
  };

  it('enables strict mode', () => {
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });

  it('enables noUncheckedIndexedAccess', () => {
    expect(tsconfig.compilerOptions.noUncheckedIndexedAccess).toBe(true);
  });

  it('maps the @ alias to src', () => {
    expect(tsconfig.compilerOptions.paths).toMatchObject({ '@/*': ['./src/*'] });
  });
});

describe('globals.css', () => {
  const css = readFileSync('src/app/globals.css', 'utf8');

  it('imports tailwind', () => {
    expect(css).toContain('@import "tailwindcss"');
  });

  it('declares no colour value — tokens are SP1 Task 2', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('does not round-trip to google fonts', () => {
    expect(css).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
  });
});

describe('root layout', () => {
  const layout = readFileSync('src/app/layout.tsx', 'utf8');

  it('sets noindex metadata for the gated review deploy', () => {
    expect(layout).toMatch(/robots:\s*\{\s*index:\s*false/);
  });

  it('does not import a font from next/font/google', () => {
    expect(layout).not.toContain('next/font/google');
  });

  it('takes its title and description from the locale file', () => {
    // <title> and <meta description> are user-facing, so they go through t().
    expect(layout).toMatch(/title:\s*t\(/);
    expect(layout).toMatch(/description:\s*t\(/);
  });
});
```

- [ ] **Step 21: Run it, then prove it has teeth**

This test codifies a contract that Steps 4 through 13 already satisfy, so it passes on the first run rather than failing first. That makes it worth checking it can actually fail — a structure assertion that never goes red is decoration.

```bash
npm test -- tests/structure/app-structure.test.ts
```

Expected: PASS, every case.

Now break each class of assertion once and confirm the matching case goes red:

```bash
touch public/next.svg
npm test -- tests/structure/app-structure.test.ts 2>&1 | grep -c "does not have public/next.svg"
rm public/next.svg

printf '\n.probe { color: #ff0000; }\n' >> src/app/globals.css
npm test -- tests/structure/app-structure.test.ts 2>&1 | grep -c "declares no colour value"
git checkout -- src/app/globals.css 2>/dev/null || node -e '
const fs=require("fs");const p="src/app/globals.css";
fs.writeFileSync(p, fs.readFileSync(p,"utf8").replace(/\n\.probe \{ color: #ff0000; \}\n/, ""));'
```

Expected: each `grep -c` prints a non-zero count, and the final `npm test -- tests/structure/app-structure.test.ts` is back to PASS. If the colour probe does not trip the test, the regex in the test is wrong — fix it, because SP1 Task 2 depends on that guard to catch a token being hardcoded instead of declared.

```bash
npm test -- tests/structure/app-structure.test.ts
```

Expected: PASS.

- [ ] **Step 22: Verify the build, the types and the lint all pass**

```bash
npm run build
npm run typecheck
npm run lint
```

Expected: the build **succeeds** and its route table reads exactly this:

```
Route (app)
─ ○ /_not-found
```

`/_not-found` is the only entry because there is no `page.tsx` yet. The table says `Route (app)` rather than falling back to a pages-router `/404` because `src/app/favicon.ico` is itself an app route, so the app router has something in it. Both are correct and expected at this point — Task 2 adds the real pages. Do not add a page here to make the table look more normal.

`typecheck` prints nothing. `lint` prints nothing.

If the build errors with `Couldn't find any pages or app directory`, the `src/app/layout.tsx` write in Step 11 did not land.

If the build fails with `TypeScript <version> does not provide the compiler API required by Next.js`, the installed TypeScript is 6 or newer. Next 16.2.12 needs TypeScript 5; `create-next-app` pins `^5` for exactly this reason. Reinstall with `npm install -D "typescript@^5"` and do not widen that range.

- [ ] **Step 23: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with strict TypeScript, Tailwind v4, and Vitest"
```

---

## Task 2: Route groups — `(public)`, `(admin)/admin`, and `api`

**Files:**
- Create: `src/app/(public)/layout.tsx`, `src/app/(public)/page.tsx`
- Create: `src/app/(admin)/layout.tsx`, `src/app/(admin)/admin/layout.tsx`, `src/app/(admin)/admin/page.tsx`, `src/app/(admin)/admin/login/page.tsx`
- Create: `src/app/api/health/route.ts`, `src/app/api/README.md`
- Create: `src/lib/actions/README.md`
- Test: `tests/structure/routes.test.ts`

**Interfaces:**
- Consumes: Task 1's root layout and build
- Produces: routes `/`, `/admin`, `/admin/login`, `/api/health`; layout slots that SP2 fills with the public header and footer and SP3 fills with the admin sidebar

Every page here renders **no text**. Each carries a `data-route` attribute naming its route and nothing else. An HTML attribute is not user-facing copy, so it needs no locale key and does not violate the no-hardcoded-strings rule; it also gives the verification steps a stable machine-checkable hook that a blank page would not. SP2 and SP3 delete every one of these files.

- [ ] **Step 1: Write the failing route contract test**

`tests/structure/routes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MANIFEST = '.next/app-path-routes-manifest.json';

/**
 * Next writes this manifest on every build, mapping the source path —
 * route groups included — to the public URL. It is the only artifact that
 * proves a route group does not leak into the URL, which is the whole
 * reason for using one here.
 */
function routes(): Record<string, string> {
  if (!existsSync(MANIFEST)) {
    throw new Error(`${MANIFEST} is missing — run \`npm run build\` first`);
  }
  return JSON.parse(readFileSync(MANIFEST, 'utf8')) as Record<string, string>;
}

/** Every file under dir, recursively. Returns [] when dir does not exist. */
function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

describe('route structure', () => {
  it('serves the home page from the (public) group at /', () => {
    expect(routes()['/(public)/page']).toBe('/');
  });

  it('serves the admin dashboard from the (admin) group at /admin', () => {
    expect(routes()['/(admin)/admin/page']).toBe('/admin');
  });

  it('serves the admin login at /admin/login', () => {
    expect(routes()['/(admin)/admin/login/page']).toBe('/admin/login');
  });

  it('exposes the health route handler at /api/health', () => {
    expect(routes()['/api/health/route']).toBe('/api/health');
  });

  it('never leaks a route group name into a public URL', () => {
    for (const url of Object.values(routes())) {
      expect(url, `${url} contains a route group segment`).not.toMatch(/\(|\)/);
    }
  });

  it('builds no public page beyond the placeholder home', () => {
    // PRD 5 lists directory, resource detail, about, contact, privacy,
    // terms and impact. All are SP2. If one appears here, scope has crept.
    const publicUrls = Object.entries(routes())
      .filter(([source]) => source.startsWith('/(public)/'))
      .map(([, url]) => url);
    expect(publicUrls.sort()).toEqual(['/']);
  });
});

describe('placeholder pages', () => {
  const PLACEHOLDERS = [
    'src/app/(public)/page.tsx',
    'src/app/(admin)/admin/page.tsx',
    'src/app/(admin)/admin/login/page.tsx',
  ];

  for (const file of PLACEHOLDERS) {
    it(`${file} renders no text`, () => {
      const code = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      // A self-closing element structurally cannot contain a text node, so
      // these two assertions together are exact rather than heuristic: the
      // only JSX is <main data-route="..." />, and nothing has children.
      // Any text node here would be an unlocalised user-facing string.
      expect(code).toMatch(/<main data-route="[^"]+" \/>/);
      expect(code, 'placeholder renders an element with children').not.toMatch(/<\/[a-zA-Z]/);
    });
  }
});

describe('route handler and server action placement', () => {
  it('keeps server actions out of the route tree', () => {
    // src/app/api reserves the route.ts filename and treats directories as
    // URL segments, so a 'use server' module has no business there. Asserted
    // against the tree itself rather than against the README that explains
    // it — a doc-exists check would name this invariant without guarding it.
    const offenders = walk('src/app/api')
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .filter((file) => /['"]use server['"]/.test(readFileSync(file, 'utf8')));
    expect(
      offenders,
      `'use server' found under src/app/api: ${offenders.join(', ')}`,
    ).toEqual([]);
  });

  it('documents why server actions live outside the route tree', () => {
    expect(existsSync('src/lib/actions/README.md')).toBe(true);
  });

  it('documents which sub-project adds each api endpoint', () => {
    const readme = readFileSync('src/app/api/README.md', 'utf8');
    for (const endpoint of ['events', 'contact', 'submissions', 'subscribers']) {
      expect(readme, `README does not mention ${endpoint}`).toContain(endpoint);
    }
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npm run build
npm test -- tests/structure/routes.test.ts
```

Expected: FAIL — `/(public)/page` is `undefined`, because no page exists yet.

- [ ] **Step 3: Create the public group**

`src/app/(public)/layout.tsx`:

```tsx
/**
 * Public surface layout. PRD 5: no authentication anywhere here, every page
 * fully usable anonymously, and PRD 5.8: no login link or admin reference in
 * public navigation. The route-group split is what keeps that structural —
 * the admin sidebar lives in a sibling subtree and cannot render here.
 *
 * SP2 fills this with the header, the footer carrying the exact 10.1
 * attribution, and the alerts and suggest-a-resource modals.
 */
export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="flex min-h-full flex-col">{children}</div>;
}
```

`src/app/(public)/page.tsx`:

```tsx
/**
 * Placeholder for `/`. The storefront home — welcome band, headline reach
 * strip, search, browse by need, featured carousel, partner logo row,
 * recently added rail and the full directory — is PRD 5.1 and belongs to SP2.
 */
export default function PublicHomePage() {
  return <main data-route="/" />;
}
```

- [ ] **Step 4: Create the admin group**

`src/app/(admin)/layout.tsx`:

```tsx
/**
 * Admin group shell. Exists so the admin subtree can diverge from the public
 * one — its own chrome, its own error and loading boundaries — without either
 * leaking into the other.
 *
 * Authorization is NOT here. src/proxy.ts redirects unauthenticated /admin
 * traffic, which is UX; the real boundary is RLS plus a role re-check inside
 * every mutating server action (PRD 3, 14.4).
 */
export default function AdminGroupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-full">{children}</div>;
}
```

`src/app/(admin)/admin/layout.tsx`:

```tsx
/**
 * Layout for the signed-in portal. SP3 fills this with the PRD 6 sidebar —
 * Dashboard, Resources, Review Queue, Reach & Engagement, Partnerships,
 * Alerts & Subscribers, Site Content, Updates, Audit Log — and the footer
 * showing signed-in name, display label, View site and Sign out.
 *
 * PRD 3: a viewer must not be shown write affordances at all, so SP3 reads
 * the role here and passes it down rather than each screen guessing.
 */
export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="flex min-h-full">{children}</div>;
}
```

`src/app/(admin)/admin/page.tsx`:

```tsx
/**
 * Placeholder for `/admin`. The PRD 6.1 leadership dashboard is SP3, and
 * every stat card on it shows a true value or an explicit empty state —
 * PRD 8.4 makes a fabricated figure a launch-blocking defect.
 */
export default function AdminDashboardPage() {
  return <main data-route="/admin" />;
}
```

`src/app/(admin)/admin/login/page.tsx`:

```tsx
/**
 * Placeholder for `/admin/login`. Email and password against Supabase Auth,
 * built in SP3.
 *
 * PRD 3 and 14.3: there is no sign-up route, and public signup is disabled at
 * the Supabase project level so one cannot be added by application code.
 * Users are created by an admin.
 */
export default function AdminLoginPage() {
  return <main data-route="/admin/login" />;
}
```

Login sits at `/admin/login` rather than a bare `/login`. PRD §6 says "Routes under `/admin`, with `/login`" without settling which; nesting it means one path prefix covers the whole portal, so the proxy matcher and the "not linked from public navigation" rule each have a single condition to express. Flag it if the client wants `/login` at the root — it is a directory move.

- [ ] **Step 5: Create the api folder with one working route handler**

`src/app/api/health/route.ts`:

```ts
import { NextResponse } from 'next/server';

// Never prerendered: a cached health check reports the build, not the service.
export const dynamic = 'force-dynamic';

/**
 * Deploy liveness only. Deliberately reveals nothing — no version, no commit,
 * no database state, no environment names. PRD 14.8 wants generic responses to
 * clients with detail server-side only, and this endpoint is unauthenticated.
 */
export function GET() {
  return NextResponse.json({ ok: true });
}
```

`src/app/api/README.md`:

```markdown
# Route handlers

Route handlers only. Server actions live in `src/lib/actions/` — see the README
there for why.

`/api/health` is the only endpoint in the scaffold. Everything below is added by
the sub-project named against it, and each one is a **public write endpoint**,
so each needs Zod validation, a payload size cap, and — from SP4 — Cloudflare
Turnstile, a honeypot field, and per-IP plus per-session rate limiting
(PRD 14.6).

| Endpoint | Adds | Sub-project | Notes |
| --- | --- | --- | --- |
| `POST /api/events` | First-party engagement event write | SP2 | PRD 8.3. Fire-and-forget from the client, must never block or degrade rendering. Bot user agents flagged `is_bot = true`. No IP addresses stored. |
| `POST /api/contact` | Contact form | SP2 | PRD 9.1. Persists to `contact_messages`; delivery to `aihubfordevelopment@undp.org` is SP5, blocked on SPF/DKIM. |
| `POST /api/submissions` | Suggest a resource, suggest an update | SP2 | PRD 5.5, 5.3. Lands in `submissions` as `pending`. |
| `POST /api/subscribers` | Alerts subscribe | SP2 | PRD 5.4, 9.2. Writes an unconfirmed row with `consent_text_version`; the confirmation email is SP5. |

All four write through the `service_role` client in `src/lib/supabase/admin.ts`
after validation. The anonymous Postgres role holds **no insert policy on any
base table** (design doc 5.4.1), so there is no anonymous write path to
misconfigure — but that also means these handlers are the only way in, and a
missing validation here has no second line of defence behind it.
```

- [ ] **Step 6: Document the server action location**

`src/lib/actions/README.md`:

```markdown
# Server actions

`'use server'` modules. Grouped by the entity they mutate, one file each, added
by SP2 and SP3.

## Why these are not in `src/app/api`

`src/app/api` is part of the route tree: Next reserves the `route.ts` filename
there and treats every directory as a URL segment. A server action is imported,
never routed, so placing it there means importable-only modules inside the URL
namespace and a live risk of colliding with a real endpoint. Route handlers go
in `src/app/api`, server actions go here.

## Non-negotiable for every action in this folder

- `await requireRole([...])` from `@/lib/auth` as the first statement of every
  mutating action. PRD 3 and 14.4: the proxy redirect is UX, not security, and
  an action reached directly has had no gate applied to it.
- Zod parse at the boundary; use the parsed result, never the raw input.
- Ownership and target checks on every record access, to prevent IDOR.
- Write the matching `audit_log` row inside the same action, with `actor_name`
  and `entity_label` denormalised at write time and `change_summary` rendered as
  prose (PRD 4.15).
- `revalidateTag` or `revalidatePath` on every content and resource mutation.
  PRD 6.7 and 13.4: an editor's save must appear on the public site with no
  rebuild.
```

- [ ] **Step 7: Build and run the route contract test**

```bash
npm run build
npm test -- tests/structure/routes.test.ts
```

Expected: PASS, all twelve cases. The build's route table should read:

```
Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /admin
├ ○ /admin/login
└ ƒ /api/health
```

If `/` is missing, `src/app/page.tsx` was recreated and is competing with the group — Task 1 Step 10 deletes it.

- [ ] **Step 8: Confirm the routes serve by hand**

```bash
npm run dev
```

In another shell:

```bash
curl -s localhost:3000/ | grep -o 'data-route="[^"]*"'
curl -s localhost:3000/admin | grep -o 'data-route="[^"]*"'
curl -s localhost:3000/admin/login | grep -o 'data-route="[^"]*"'
curl -s localhost:3000/api/health
curl -sI localhost:3000/ | grep -i x-robots-tag
curl -s localhost:3000/ | grep -o "<title>[^<]*</title>"
```

Expected: `data-route="/"`, `data-route="/admin"`, `data-route="/admin/login"`, `{"ok":true}`, `x-robots-tag: noindex, nofollow`, and a `<title>AI Hub for Sustainable Development</title>` proving the locale lookup reaches the rendered page.

Note that `/admin` and `/admin/login` both serve here because Task 3 has not yet created the Supabase env, so `src/proxy.ts` does not exist until Task 4. Task 4 Step 8 re-checks `/admin` and expects a 307 redirect at that point.

Also confirm the group names 404: `curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/\(public\)` must print `404`.

Stop the dev server.

- [ ] **Step 9: Run the whole suite and commit**

```bash
npm test
git add -A
git commit -m "feat: route groups for the public and admin surfaces, api folder, health route"
```

---

## Task 3: Supabase CLI, local stack, and the environment contract

**Files:**
- Create: `supabase/config.toml` (generated, then edited), `.env.example`, `.env.test` (untracked)
- Test: `tests/smoke.test.ts`, `tests/structure/env-contract.test.ts`

**Interfaces:**
- Consumes: Task 1's `npm test` and the `supabase` devDependency
- Produces: a local Postgres at `http://127.0.0.1:54321`; `.env.test` carrying `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; `.env.local` carrying the `NEXT_PUBLIC_*` pair plus the service key; `npm run db:reset` reapplying migrations from scratch

- [ ] **Step 1: Write the failing environment contract test**

`tests/structure/env-contract.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

describe('.env.example', () => {
  const example = readFileSync('.env.example', 'utf8');

  it('documents every name the app and tests read', () => {
    for (const name of [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
    ]) {
      expect(example, `${name} is undocumented`).toContain(name);
    }
  });

  it('never prefixes a secret with NEXT_PUBLIC_', () => {
    // PRD 13.5: anything NEXT_PUBLIC_ is public by definition.
    expect(example).not.toMatch(/NEXT_PUBLIC_\w*SERVICE_ROLE/);
    expect(example).not.toMatch(/NEXT_PUBLIC_\w*SECRET/);
  });

  it('carries names only, no values', () => {
    const assignments = example
      .split('\n')
      .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line));
    expect(assignments.length).toBeGreaterThan(0);
    for (const line of assignments) {
      const value = line.slice(line.indexOf('=') + 1).trim();
      expect(value, `${line} has a value committed`).toBe('');
    }
  });

  it('contains no JWT', () => {
    // A Supabase anon or service key is a JWT starting `eyJ`.
    expect(example).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
  });
});

describe('supabase local config', () => {
  const config = readFileSync('supabase/config.toml', 'utf8');

  it('disables public signup at the project level', () => {
    // PRD 3 and 14.3: no public sign-up route can exist regardless of
    // application code. Enforced by config, not by omitting a page.
    const authSection = config.slice(config.indexOf('[auth]'));
    expect(authSection).toMatch(/enable_signup\s*=\s*false/);
  });
});

describe('secrets are not committed', () => {
  it('tracks no env file other than the template', () => {
    // Presence on disk is fine and expected — .env.local and .env.test both
    // hold a real service_role key. What must never be true is git knowing
    // about them. Asked of git directly rather than of .gitignore, because
    // a file already tracked stays tracked no matter what the ignore rules
    // say afterwards.
    const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
      .split('\n')
      .filter((file) => file.startsWith('.env'));
    const offenders = tracked.filter((file) => file !== '.env.example');
    expect(offenders, `tracked env files: ${offenders.join(', ')}`).toEqual([]);
  });

  it('keeps the template itself present', () => {
    expect(existsSync('.env.example')).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- tests/structure/env-contract.test.ts`
Expected: FAIL — `.env.example` is empty and `supabase/config.toml` does not exist.

- [ ] **Step 3: Initialise the Supabase CLI**

```bash
npx supabase init
ls supabase
```

Expected: `config.toml` and a `migrations` directory. If the CLI asks about generating VS Code or IntelliJ settings, decline both.

- [ ] **Step 4: Disable public signup in `supabase/config.toml`**

Find the `[auth]` section and set:

```toml
[auth]
enable_signup = false

[auth.email]
enable_signup = false
enable_confirmations = false
```

`enable_confirmations = false` applies to Supabase Auth's own email, which needs a provider this project does not yet have; admins are provisioned with `email_confirm: true` server-side instead. This is unrelated to the subscriber double opt-in in PRD §9.2, which is application-level and lives in SP5.

- [ ] **Step 5: Write `.env.example`**

```
# Public by definition (PRD 13.5). Safe in a client bundle.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Server-only. Bypasses RLS entirely. Must never reach a client bundle,
# and must never be given a NEXT_PUBLIC_ prefix.
SUPABASE_SERVICE_ROLE_KEY=

# Test-only, read by tests/helpers and vitest.config.ts from .env.test.
# Point these at the local CLI stack, never at production.
SUPABASE_URL=
SUPABASE_ANON_KEY=

# Copy to .env.local for `npm run dev`, and to .env.test for `npm test`.
# Local values come from `npx supabase status`.
# Both files are gitignored. This template carries names only.
```

- [ ] **Step 6: Start the local stack and capture credentials**

```bash
npx supabase start
npx supabase status
```

Write `.env.test` from the printed values:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<anon key from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase status>
```

And `.env.local` for the dev server:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase status>
```

Then re-run the dry-run add from Task 1 Step 9 on both:

```bash
git add -n .env.test .env.local
```

Expected: both reported as ignored. If either is addable, stop — a service_role key is one `git commit -A` from being published.

- [ ] **Step 7: Write the smoke test**

`tests/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

describe('local supabase stack', () => {
  it('accepts a connection with the anon key', async () => {
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
    );
    // No tables exist yet. A missing-relation error still proves the
    // PostgREST endpoint is reachable and the key was accepted — which is
    // the whole claim. Once the schema lands this becomes a real query.
    const { error } = await client.from('profiles').select('id').limit(1);
    expect(error?.code).toBe('42P01');
  });
});
```

- [ ] **Step 8: Run both tests**

```bash
npm test -- tests/smoke.test.ts tests/structure/env-contract.test.ts
```

Expected: PASS. A network error on the smoke test means the stack is not running — `npx supabase start`. A `42501` instead of `42P01` means a `profiles` table already exists, which it should not at this point.

- [ ] **Step 9: Commit**

```bash
git add supabase/config.toml .env.example tests/smoke.test.ts tests/structure/env-contract.test.ts
git status --short
git commit -m "chore: supabase CLI config with signup disabled, documented env contract"
```

Confirm `git status --short` shows no `.env.test` or `.env.local` before committing.

---

## Task 4: Supabase client modules and the proxy session gate

**Files:**
- Create: `src/lib/supabase/browser.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts`, `src/lib/supabase/database.types.ts`
- Create: `src/proxy.ts`
- Test: `tests/unit/supabase-clients.test.ts`

**Interfaces:**
- Consumes: Task 3's environment names, Task 2's `/admin` routes
- Produces:
  - `createBrowserSupabase(): SupabaseClient<Database>` from `@/lib/supabase/browser`
  - `createServerSupabase(): Promise<SupabaseClient<Database>>` from `@/lib/supabase/server`
  - `createAdminSupabase(): SupabaseClient<Database>` from `@/lib/supabase/admin`
  - `type Database`, `type Json` from `@/lib/supabase/database.types`
  - `proxy(request: NextRequest): Promise<NextResponse>` and `config.matcher` from `src/proxy.ts`

`src/lib/auth.ts` — `getCurrentUser` and `requireRole` — is **not** in this task. It queries `profiles`, which does not exist until the schema tasks run, and would not typecheck against the placeholder `Database`. It stays in SP1 Task 13.

- [ ] **Step 1: Write the failing client boundary test**

`tests/unit/supabase-clients.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const browser = readFileSync('src/lib/supabase/browser.ts', 'utf8');
const server = readFileSync('src/lib/supabase/server.ts', 'utf8');
const admin = readFileSync('src/lib/supabase/admin.ts', 'utf8');
const proxy = readFileSync('src/proxy.ts', 'utf8');

describe('browser client', () => {
  it('uses the anon key', () => {
    expect(browser).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  });

  it('never names the service_role key', () => {
    expect(browser).not.toMatch(/SERVICE_ROLE/);
  });
});

describe('server client', () => {
  it('is marked server-only so a client import is a build error', () => {
    expect(server).toMatch(/^import 'server-only';/m);
  });

  it('uses the anon key so RLS still applies to the caller', () => {
    expect(server).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    expect(server).not.toMatch(/SERVICE_ROLE/);
  });

  it('reads the session from cookies, never localStorage', () => {
    // PRD 14.3: httpOnly, Secure, SameSite cookies. Never localStorage.
    expect(server).toContain("from 'next/headers'");
    expect(server).not.toContain('localStorage');
  });
});

describe('admin client', () => {
  it('is marked server-only', () => {
    expect(admin).toMatch(/^import 'server-only';/m);
  });

  it('reads the service_role key from a non-public name', () => {
    expect(admin).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(admin).not.toMatch(/NEXT_PUBLIC_\w*SERVICE_ROLE/);
  });

  it('fails loudly when the key is absent rather than falling back', () => {
    expect(admin).toMatch(/throw new Error/);
  });

  it('does not persist or auto-refresh a session', () => {
    expect(admin).toMatch(/persistSession:\s*false/);
    expect(admin).toMatch(/autoRefreshToken:\s*false/);
  });
});

describe('proxy', () => {
  it('exports a proxy function, the Next 16 convention', () => {
    // middleware.ts still builds but prints a deprecation warning.
    expect(proxy).toMatch(/export async function proxy\(/);
  });

  it('redirects unauthenticated admin traffic to the login route', () => {
    expect(proxy).toContain('/admin/login');
  });

  it('never touches the service_role key', () => {
    // The proxy runs on every request with no role check of its own.
    expect(proxy).not.toMatch(/SERVICE_ROLE/);
  });

  it('states that route gating is UX and not the security boundary', () => {
    expect(proxy.toLowerCase()).toContain('not security');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- tests/unit/supabase-clients.test.ts`
Expected: FAIL with `ENOENT` — none of the four modules exist.

- [ ] **Step 3: Write the placeholder database types**

`src/lib/supabase/database.types.ts`:

```ts
/**
 * PLACEHOLDER.
 *
 * `npm run db:types` overwrites this file wholesale once the migrations
 * exist. Do not hand-write table definitions here — a hand-edited type that
 * disagrees with the schema is worse than no type, because it typechecks.
 *
 * Empty schema members are what make the client factories generic over
 * `Database` compile today. Every `.from('...')` call is therefore a type
 * error until the types are generated, which is the intended pressure:
 * generate first, query second.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
```

- [ ] **Step 4: Write the three client factories**

`src/lib/supabase/browser.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

/**
 * Client-component Supabase client on the anon key. Every query it makes is
 * subject to RLS as the signed-in user, or as `anon` when there is no session.
 *
 * The anon key is public by design (PRD 13.5) — it is safe in the bundle
 * precisely because RLS, not key secrecy, is the authorization boundary.
 */
export function createBrowserSupabase() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

`src/lib/supabase/server.ts`:

```ts
import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from './database.types';

/**
 * Request-scoped client carrying the caller's session from httpOnly cookies
 * (PRD 14.3 — never localStorage). On the anon key, so every query is subject
 * to RLS as that user. This is what server components and server actions use
 * to read on a user's behalf.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            for (const { name, value, options } of toSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Thrown when called during a Server Component render, where the
            // cookie store is read-only. Swallowing it is correct: src/proxy.ts
            // refreshes the session on every request, so the write is redundant
            // here rather than lost.
          }
        },
      },
    },
  );
}
```

`src/lib/supabase/admin.ts`:

```ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * service_role client. Bypasses RLS entirely.
 *
 * Only for:
 *  - the four public write endpoints, after Zod validation (design doc 5.4.1)
 *  - audit_log writes, which no role has an insert policy for (design doc 5.4.3)
 *  - admin user provisioning
 *
 * Never for reading on a user's behalf — that is createServerSupabase, so RLS
 * still applies. A service_role read is how a viewer ends up seeing something
 * their policies deny.
 *
 * `import 'server-only'` turns an import from a client component into a build
 * error rather than a leaked key. PRD 14.9 check 6 verifies the built bundle.
 */
export function createAdminSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

- [ ] **Step 5: Write the proxy**

`src/proxy.ts` — Next 16's replacement for `middleware.ts`. The file must sit at `src/proxy.ts` (beside `app`, not inside it) and export a function named `proxy`.

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const LOGIN_PATH = '/admin/login';

/**
 * Runs on every matched request. Two jobs:
 *
 *  1. Refresh the Supabase session cookie. Server components get a read-only
 *     cookie store, so this is the only place the rotated refresh token can
 *     actually be written back.
 *  2. Redirect unauthenticated /admin traffic to the login page.
 *
 * The redirect is UX and NOT security. PRD 3 and 14.4: middleware route gating
 * is UX, not security. The real boundary is RLS in the database plus a
 * `requireRole` re-check inside every mutating server action. Anything that
 * relies on this redirect having run is a vulnerability, because a server
 * action invoked directly never passes through here.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser, not getSession: it validates the token with the auth server
  // instead of trusting whatever the cookie claims.
  const { data } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');

  if (isAdminRoute && pathname !== LOGIN_PATH && !data.user) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    // No `next` or `redirect` query parameter is carried. PRD 14.5 forbids
    // open redirects: no route accepts a user-supplied destination.
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Everything except static assets. Public pages are matched too, so an
  // expiring session refreshes while browsing rather than only at /admin.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|fonts/|robots.txt|sitemap.xml).*)',
  ],
};
```

- [ ] **Step 6: Run the boundary test**

Run: `npm test -- tests/unit/supabase-clients.test.ts`
Expected: PASS, all thirteen cases.

- [ ] **Step 7: Verify types, build, and that the proxy is recognised without a deprecation warning**

```bash
npm run typecheck
npm run build 2>&1 | tee /tmp/askhub-build.log
grep -i "deprecated" /tmp/askhub-build.log || echo "no deprecation warnings"
grep -i "Proxy" /tmp/askhub-build.log
```

Expected: `typecheck` prints nothing; the build succeeds; no deprecation warning; and the route table is followed by a `ƒ Proxy (Middleware)` line. If you see `The "middleware" file convention is deprecated`, a `middleware.ts` was written instead of `proxy.ts` — delete it.

- [ ] **Step 8: Confirm the admin redirect works**

```bash
npm run dev
```

In another shell:

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" localhost:3000/admin
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/admin/login
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/
```

Expected: `/admin` returns `307` with a redirect to `http://localhost:3000/admin/login`; `/admin/login` returns `200`; `/` returns `200`. Stop the dev server.

The local stack must be running for this — the proxy calls the auth server on every request.

- [ ] **Step 9: Confirm the service_role key is absent from the client bundle**

```bash
npm run build
grep -rl "SUPABASE_SERVICE_ROLE_KEY" .next/static 2>/dev/null && echo "LEAK" || echo "clean"
```

Expected: `clean`. If it prints `LEAK`, an `admin.ts` import has reached a client component — trace the import chain and move the call into a server action. Do not weaken the check. SP1 Task 14 turns this into a committed test that also greps for the key's literal value and its encoded JWT payload.

- [ ] **Step 10: Run the whole suite and commit**

```bash
npm test
git add -A
git status --short
git commit -m "feat: supabase browser/server/admin clients and proxy session gate"
```

Expected: every test passes. Confirm `git status --short` lists no `.env.local` or `.env.test`.

---

## Scope boundary

**Delivered:** a Next.js 16 App Router deployable with strict TypeScript and Tailwind v4 wired, the `(public)` / `(admin)/admin` / `api` route structure with placeholder pages and one health route handler, the three Supabase client factories with the key boundary asserted at the source level, a session-refreshing proxy that gates `/admin` as UX, the Supabase CLI with public signup disabled, and a documented environment contract with the secret-leak checks that catch the two easy mistakes (`NEXT_PUBLIC_` on a secret, `.env.example` swallowed by `.env*`).

**Deliberately not delivered — do not add it here:**

| Not built | Owner |
| --- | --- |
| Design tokens and the self-hosted Outfit `@font-face` rules | SP1 Task 2 (its i18n steps 6–11 are delivered here instead — skip them) |
| Every migration, RLS policy, public-safe view, and the seed | SP1 Tasks 3–12 |
| Real `database.types.ts`, `src/lib/auth.ts` (`getCurrentUser`, `requireRole`), `scripts/provision-admins.ts` | SP1 Task 13 |
| Bundle secret audit as a committed test, `public/robots.txt`, the protected Vercel deploy | SP1 Task 14 |
| Every public page: home, directory, resource detail, about, contact, privacy, terms, gated impact | SP2 |
| The four public write route handlers and first-party event capture | SP2 |
| All nine admin screens and the login form | SP3 |
| CSP, HSTS, `frame-ancestors`, `Permissions-Policy`, Turnstile, honeypots, rate limiting, payload caps | SP4 |
| Transactional email — contact delivery, double opt-in, digests | SP5, externally blocked on SPF/DKIM |
| GA4 Data API read-back, aggregation views, WCAG AA audit, Core Web Vitals, sitemap, structured data, locale switcher | SP6 |

**Two decisions worth a second opinion:**
1. Admin login sits at `/admin/login`, not `/login`. PRD §6 reads "Routes under `/admin`, with `/login`" and does not settle it. Nesting keeps one path prefix for the whole portal.
2. Server actions live in `src/lib/actions/`, not `src/app/api/`, because `src/app/api` is the route tree. The request asked for `/api` to hold both; the reasoning is in `src/lib/actions/README.md` and reversing it is a directory move.

---

## Verification: the scaffold exit gate

Run all of these. Do not report completion on any that has not been run.

```bash
npx supabase start        # local stack up (needs a running Docker daemon)
npm run build             # app compiles, route table as expected
npm run typecheck         # strict mode clean
npm run lint              # eslint clean
npm test                  # every test passes
```

Then confirm by hand:

- [ ] The build's route table lists exactly `/`, `/_not-found`, `/admin`, `/admin/login`, `/api/health`, followed by a `ƒ Proxy (Middleware)` line
- [ ] The build prints no deprecation warning about the `middleware` file convention
- [ ] `curl -sI localhost:3000/ | grep -i x-robots-tag` returns `noindex, nofollow`
- [ ] `curl -s -o /dev/null -w "%{http_code}" localhost:3000/admin` returns `307` to `/admin/login`
- [ ] `curl -s -o /dev/null -w "%{http_code}" "localhost:3000/(public)"` returns `404`
- [ ] `grep -rl "SUPABASE_SERVICE_ROLE_KEY" .next/static` finds nothing
- [ ] `git ls-files | grep -E "^\.env"` returns `.env.example` and nothing else
- [ ] `grep -rn "#[0-9a-fA-F]\{6\}" src` returns nothing — no colour has been hardcoded ahead of SP1 Task 2
- [ ] `README.md` records the installed Next, React, Tailwind and TypeScript versions
- [ ] `grep -rn "data-route" src/app` shows exactly three placeholder pages, and none of them renders a text node
- [ ] `npm test -- tests/unit/i18n.test.ts` passes, including every PRD §10 content rule
- [ ] `curl -s localhost:3000/ | grep -o "<title>[^<]*</title>"` returns the title from `en.json`, proving `t()` reaches rendered output
