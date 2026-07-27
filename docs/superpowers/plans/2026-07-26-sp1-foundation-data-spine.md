# SP1: Foundation & Data Spine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the AskHub application skeleton, the complete sixteen-table Supabase schema with row-level security on every table, authentication with three roles, public-safe views, and a real seed — such that sub-projects 2 and 3 can build the public and admin surfaces on top in parallel.

**Architecture:** A single Next.js App Router deployable talks to Supabase Postgres. Authorization lives in the database as RLS policies, not in application code. The anonymous role holds **zero policies on any base table**: anonymous reads go through `security_invoker = false` views that enumerate their columns and bake in `where status = 'live'`, and anonymous writes go through server routes holding `service_role` after Zod validation. Every table's RLS policies ship in the same migration as the table itself, so a table cannot be added without them.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript strict, Tailwind CSS v4 (CSS-first `@theme`), Supabase (Postgres + Auth + RLS), `@supabase/ssr`, Vitest, Supabase CLI for migrations, Vercel.

## Global Constraints

Every task's requirements implicitly include this section. Values are copied verbatim from `docs/askhub-prd.md` and `CLAUDE.md`.

**Never fabricate data.** No seeded, hardcoded, or approximated metric. Metric panels show true values or explicit empty states. A plausible fake number is a launch-blocking defect. The prototype's `GADATA` block must not reach a migration, a fixture, or a fallback value.

**Content rules, no exceptions:**
- Attribution is always "co-led by MIMIT and UNDP". Never "powered by" or "implemented by".
- Footer reads exactly: "Co-led by the Ministry of Enterprises and Made in Italy and the United Nations Development Programme."
- Always "AI Hub" or "AI Hub for Sustainable Development". Never "the Hub" alone.
- One mailbox only: `aihubfordevelopment@undp.org`.
- No per-resource "Verified" badge. Global statement only: "Every resource is curated and verified by the AI Hub team."
- "Democratic Republic of the Congo" in full.
- "CINECA Leonardo" with no "Mattei Plan".
- No "Global programmes" country filter option.
- Cyber4Africa partners are Cyber 4.0 and Cisco.
- Partner and institution logos link to their official sites.

**Security invariants:**
- RLS enabled on every table, deny by default. A new table without RLS is a defect.
- `service_role` key is server-only. It must never appear in a client bundle.
- Every mutating server action re-checks the caller's role. Middleware gating is UX, not security.
- Anonymous reads go through public-safe views that exclude views, clicks, CTR, submitter emails and internal notes.
- `viewer` role has no write policy on any table.
- Zod at every server boundary. No string-built SQL. No `dangerouslySetInnerHTML` with user content.
- Reject SVG uploads and SVG image URLs.
- `audit_log` is append-only for all roles.

**Conventions:**
- No hardcoded user-facing strings. Everything goes to `src/locales/en.json`. Stubs exist for `fr`, `pt`, `ar`.
- No hardcoded colours or type values. Use design tokens.
- Deadline past means the resource displays as Closed and is flagged in admin. Its `status` does not change.

**Design tokens** (exact values, from the recovered prototype):

| Token | Value |
| --- | --- |
| `--color-primary` | `#1F5FBF` |
| `--color-navy` | `#1A2332` |
| `--color-deep-blue` | `#003D60` |
| `--color-orange` | `#F06428` |
| `--color-hairline` | `#DDE5EE` |
| `--color-muted` | `#42506E` |
| `--color-muted-light` | `#5B6B8C` |
| `--color-tint-1` | `#EEF2FB` |
| `--color-tint-2` | `#F1F4FA` |
| `--color-tint-3` | `#C9D3E8` |
| `--color-danger` | `#C0392B` |
| `--color-danger-bg` | `#FBEAE8` |
| `--color-need-compute` / `-bg` | `#1F5FBF` / `#EAEFFB` |
| `--color-need-training` / `-bg` | `#0E7A8A` / `#E6F3F5` |
| `--color-need-funding` / `-bg` | `#B4691F` / `#F9F0E4` |
| `--color-need-accelerator` / `-bg` | `#6C3FA8` / `#F1EAF9` |
| `--color-need-partners` / `-bg` | `#0E7A54` / `#E7F4EE` |

**Reference data** (exact values, from the recovered prototype):

- 18 partner countries: Algeria, Angola, Egypt, Ethiopia, Gabon, Ghana, Côte d'Ivoire, Democratic Republic of the Congo, Kenya, Mauritania, Morocco, Mozambique, Republic of the Congo, Rwanda, Senegal, Tanzania, Tunisia, Zambia
- 6 sectors: Energy, Agriculture, Health, Water, Education & Training, Infrastructure
- 4 stages: New to AI, Getting started, Building, Scaling
- 5 needs: Compute, Training, Funding, Accelerator, Partners

**Two deliberate deviations from the spec, both intentional:**
1. `audit_log` and `engagement_events` carry `created_at` only, **no `updated_at`**. They are append-only; a column that can never change is misleading.
2. `contact_messages` is a new table not in the PRD. Reason recorded in the design doc §5.3.4.

---

## File Structure

```
package.json                              deps + scripts
tsconfig.json                             strict mode
next.config.ts                            noindex headers for SP1
vitest.config.ts                          fileParallelism: false (DB tests share state)
.env.example                              documented, no secrets
.gitignore
src/app/layout.tsx                        root layout, Outfit preload
src/app/page.tsx                          placeholder home (SP2 replaces)
src/app/globals.css                       Tailwind v4 import + @theme tokens
src/lib/supabase/browser.ts               browser client (anon key)
src/lib/supabase/server.ts                server client (cookies, anon key)
src/lib/supabase/admin.ts                 service_role client, server-only
src/lib/supabase/database.types.ts        generated
src/lib/reference.ts                      countries/sectors/stages/needs constants
src/lib/deadline.ts                       deadline + expiring-soon computation
src/lib/i18n.ts                           t() lookup
src/locales/en.json                       all user-facing strings
src/locales/{fr,pt,ar}.json               stubs
public/fonts/outfit-latin.woff2           extracted from prototype bundle
public/fonts/outfit-latin-ext.woff2       extracted from prototype bundle
supabase/config.toml                      CLI config, signups disabled
supabase/migrations/0001_extensions.sql   pgcrypto, set_updated_at()
supabase/migrations/0002_enums.sql        nine enums
supabase/migrations/0003_profiles.sql     profiles + current_app_role() + handle_new_user + RLS
supabase/migrations/0004_resources.sql    partners, resources + constraints + RLS
supabase/migrations/0005_community.sql    partnerships, submissions, subscribers, digest_sends, contact_messages + RLS
supabase/migrations/0006_site.sql         programmes, impact_stories, headline_stats, compute_metrics, site_content, settings + RLS
supabase/migrations/0007_logs.sql         updates_log, audit_log + append-only triggers + RLS
supabase/migrations/0008_events.sql       engagement_events + indexes + RLS
supabase/migrations/0009_public_views.sql public-safe views + anon grants
scripts/seed.ts                           idempotent content seed
scripts/provision-admins.ts               invite initial admins
tests/helpers/clients.ts                  role-scoped Supabase clients
tests/rls/profiles.test.ts
tests/rls/resources.test.ts
tests/rls/community.test.ts
tests/rls/site.test.ts
tests/rls/audit-log.test.ts
tests/rls/events.test.ts
tests/rls/public-views.test.ts
tests/unit/deadline.test.ts
tests/build/no-secrets.test.ts
```

**Why policies live with their tables rather than in one `rls.sql`:** `CLAUDE.md` makes a table without RLS a defect, and PRD §14.4 calls it the single most likely serious defect in a Supabase build. Co-locating means the reviewer of any future table migration sees the missing policies in the same diff.

---

## Task 1: Repo scaffold, Supabase CLI, and a working test loop

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.env.example`, `.gitignore`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Create: `supabase/config.toml`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `npm test` runs Vitest; `npx supabase start` yields a local Postgres with `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` in `.env.test`

- [ ] **Step 1: Scaffold the Next.js app in place**

```bash
cd /Users/Itanzi/Projects/AskHub
npx create-next-app@latest . --typescript --tailwind --app --eslint \
  --src-dir --import-alias "@/*" --no-turbopack --yes
```

If it refuses because the directory is non-empty, scaffold to a temp dir and move:

```bash
npx create-next-app@latest /tmp/askhub-scaffold --typescript --tailwind --app \
  --eslint --src-dir --import-alias "@/*" --no-turbopack --yes
rsync -a --exclude .git /tmp/askhub-scaffold/ /Users/Itanzi/Projects/AskHub/
rm -rf /tmp/askhub-scaffold
```

- [ ] **Step 2: Record the versions actually installed**

Run: `node -p "const p=require('./package.json'); JSON.stringify({next:p.dependencies.next, react:p.dependencies.react, tw:p.devDependencies?.tailwindcss||p.dependencies?.tailwindcss},null,2)"`

Write the three values into `README.md` under a `## Versions` heading. Later tasks assume Tailwind v4 syntax (`@import "tailwindcss"` plus `@theme`). If the installed Tailwind is v3, the token task uses `tailwind.config.ts` instead — note which in the README.

- [ ] **Step 3: Enforce TypeScript strict mode**

`tsconfig.json` — confirm and add:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 4: Install the remaining dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr zod
npm install -D vitest dotenv tsx supabase
```

- [ ] **Step 5: Write the Vitest config**

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

config({ path: '.env.test' });

export default defineConfig({
  test: {
    // Database tests share one Postgres instance and assert on row visibility.
    // Parallel files would interleave writes and produce flaky failures.
    fileParallelism: false,
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
});
```

- [ ] **Step 6: Add scripts to `package.json`**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:start": "supabase start",
    "db:reset": "supabase db reset",
    "db:types": "supabase gen types typescript --local > src/lib/supabase/database.types.ts",
    "seed": "tsx scripts/seed.ts"
  }
}
```

- [ ] **Step 7: Initialise Supabase and disable public signup**

```bash
npx supabase init
```

In `supabase/config.toml`, set:

```toml
[auth]
enable_signup = false

[auth.email]
enable_signup = false
enable_confirmations = false
```

`enable_signup = false` is PRD §3 and §14.3: no public sign-up route can exist regardless of application code.

- [ ] **Step 8: Start the local stack and capture credentials**

```bash
npx supabase start
npx supabase status
```

Create `.env.test` from the printed values:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<anon key from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase status>
```

Create `.env.example` documenting the same three names plus `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, with no values.

- [ ] **Step 9: Confirm `.env.test` and `.env.local` are ignored**

`.gitignore` must contain:

```
.env
.env.local
.env.test
.env*.local
```

Run: `git check-ignore -v .env.test`
Expected: a line naming `.gitignore` as the source. If it prints nothing, the file is not ignored — fix before continuing.

- [ ] **Step 10: Write the smoke test**

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
    const { error } = await client.from('profiles').select('id').limit(1);
    // No tables exist yet; a table-not-found error still proves the
    // PostgREST endpoint is reachable and the key is accepted. Modern
    // PostgREST answers from its own schema cache with PGRST205 and never
    // reaches Postgres; older versions surface Postgres's 42P01.
    expect(error).not.toBeNull();
    expect(['PGRST205', '42P01']).toContain(error!.code);
  });
});
```

- [ ] **Step 11: Run the smoke test**

Run: `npm test -- tests/smoke.test.ts`
Expected: PASS. If it fails with a network error, the local stack is not running — `npx supabase start`.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app, Supabase CLI, and Vitest harness"
```

---

## Task 2: Design tokens, Outfit font, and localisation scaffolding

**Files:**
- Create: `src/app/globals.css`, `src/lib/i18n.ts`, `src/locales/en.json`, `src/locales/fr.json`, `src/locales/pt.json`, `src/locales/ar.json`, `src/lib/reference.ts`
- Create: `public/fonts/outfit-latin.woff2`, `public/fonts/outfit-latin-ext.woff2`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`
- Test: `tests/unit/tokens.test.ts`, `tests/unit/i18n.test.ts`

**Interfaces:**
- Consumes: Task 1's app skeleton
- Produces: `t(key: string): string` from `@/lib/i18n`; `COUNTRIES: readonly string[]`, `SECTORS: readonly string[]`, `STAGES: readonly string[]`, `NEEDS: readonly string[]`, `NEED_KEYS: readonly NeedKey[]`, `type NeedKey = 'compute'|'training'|'funding'|'accelerator'|'partners'` from `@/lib/reference`

- [ ] **Step 1: Extract the Outfit font files from the prototype bundle**

The two woff2 files are already decoded in the scratchpad from the prototype recovery:

```bash
mkdir -p public/fonts
cp "/private/tmp/claude-502/-Users-Itanzi-Projects-AskHub/4709eb89-b6a5-4988-80ae-c0f1933a2664/scratchpad/assets/39e05888-9c14-4eb8-926f-799a8396f2ca.woff2" public/fonts/outfit-latin.woff2
cp "/private/tmp/claude-502/-Users-Itanzi-Projects-AskHub/4709eb89-b6a5-4988-80ae-c0f1933a2664/scratchpad/assets/d0f8f53e-186b-43e3-946f-a0a96ae22eee.woff2" public/fonts/outfit-latin-ext.woff2
ls -l public/fonts
```

Expected: `outfit-latin.woff2` about 32KB, `outfit-latin-ext.woff2` about 15KB.

If the scratchpad has been cleaned, download instead — Outfit is SIL Open Font License:

```bash
curl -sSL -o public/fonts/outfit-latin.woff2 \
  "https://fonts.gstatic.com/s/outfit/v11/QGYyz_MVcBeNP4NjuGObqx1XmO1I4TC0C4G-EiAou6Y.woff2"
```

- [ ] **Step 2: Write the failing token test**

`tests/unit/tokens.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/app/globals.css', 'utf8');

const REQUIRED_TOKENS: Record<string, string> = {
  '--color-primary': '#1F5FBF',
  '--color-navy': '#1A2332',
  '--color-deep-blue': '#003D60',
  '--color-orange': '#F06428',
  '--color-hairline': '#DDE5EE',
  '--color-need-compute': '#1F5FBF',
  '--color-need-training': '#0E7A8A',
  '--color-need-funding': '#B4691F',
  '--color-need-accelerator': '#6C3FA8',
  '--color-need-partners': '#0E7A54',
};

describe('design tokens', () => {
  for (const [token, value] of Object.entries(REQUIRED_TOKENS)) {
    it(`defines ${token} as ${value}`, () => {
      expect(css).toMatch(new RegExp(`${token}\\s*:\\s*${value}`, 'i'));
    });
  }

  it('self-hosts Outfit rather than fetching from Google Fonts', () => {
    expect(css).toContain('/fonts/outfit-latin.woff2');
    expect(css).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npm test -- tests/unit/tokens.test.ts`
Expected: FAIL — the tokens are not defined yet.

- [ ] **Step 4: Write `src/app/globals.css`**

```css
@import "tailwindcss";

@font-face {
  font-family: 'Outfit';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url('/fonts/outfit-latin.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6,
    U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122,
    U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

@font-face {
  font-family: 'Outfit';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url('/fonts/outfit-latin-ext.woff2') format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7,
    U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F,
    U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F,
    U+A720-A7FF;
}

@theme {
  --font-sans: 'Outfit', ui-sans-serif, system-ui, sans-serif;

  --color-primary: #1F5FBF;
  --color-navy: #1A2332;
  --color-deep-blue: #003D60;
  --color-orange: #F06428;
  --color-hairline: #DDE5EE;
  --color-muted: #42506E;
  --color-muted-light: #5B6B8C;
  --color-tint-1: #EEF2FB;
  --color-tint-2: #F1F4FA;
  --color-tint-3: #C9D3E8;
  --color-danger: #C0392B;
  --color-danger-bg: #FBEAE8;

  --color-need-compute: #1F5FBF;
  --color-need-compute-bg: #EAEFFB;
  --color-need-training: #0E7A8A;
  --color-need-training-bg: #E6F3F5;
  --color-need-funding: #B4691F;
  --color-need-funding-bg: #F9F0E4;
  --color-need-accelerator: #6C3FA8;
  --color-need-accelerator-bg: #F1EAF9;
  --color-need-partners: #0E7A54;
  --color-need-partners-bg: #E7F4EE;

  --shadow-card: 0 2px 20px rgb(0 60 100 / 0.08);
}

body {
  font-family: var(--font-sans);
  background: #FFFFFF;
  color: var(--color-navy);
}
```

The card shadow is PRD §11's "`#003C64` at 8%, x0 y2 blur 20".

- [ ] **Step 5: Run the token test**

Run: `npm test -- tests/unit/tokens.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing i18n test**

`tests/unit/i18n.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { t } from '@/lib/i18n';
import en from '@/locales/en.json';
import fr from '@/locales/fr.json';

describe('i18n', () => {
  it('resolves a known key', () => {
    expect(t('site.name')).toBe('AI Hub for Sustainable Development');
  });

  it('returns the key itself for a missing lookup so gaps are visible', () => {
    expect(t('does.not.exist')).toBe('does.not.exist');
  });

  it('has no empty English values', () => {
    for (const [key, value] of Object.entries(en as Record<string, string>)) {
      expect(value, `empty value for ${key}`).not.toBe('');
    }
  });

  it('ships stub locale files', () => {
    expect(typeof fr).toBe('object');
  });

  it('never says "the Hub" alone', () => {
    const all = JSON.stringify(en);
    expect(all).not.toMatch(/\bthe Hub\b(?! for)/);
  });

  it('uses the co-led attribution and the single mailbox', () => {
    const all = JSON.stringify(en);
    expect(all).toContain('co-led by MIMIT and UNDP');
    expect(all).toContain('aihubfordevelopment@undp.org');
    expect(all).not.toMatch(/powered by|implemented by/i);
  });
});
```

- [ ] **Step 7: Run it to confirm it fails**

Run: `npm test -- tests/unit/i18n.test.ts`
Expected: FAIL — `@/lib/i18n` does not exist.

- [ ] **Step 8: Write `src/locales/en.json`**

Flat dotted keys. SP2 and SP3 add to this file; SP1 seeds the strings the content rules police.

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

- [ ] **Step 9: Write the three stub locale files**

`src/locales/fr.json`, `src/locales/pt.json`, `src/locales/ar.json` — each exactly:

```json
{}
```

PRD §12.4: adding a locale file makes that locale selectable with no code changes. The switcher is SP6.

- [ ] **Step 10: Write `src/lib/i18n.ts`**

```ts
import en from '@/locales/en.json';

const dictionaries: Record<string, Record<string, string>> = {
  en: en as Record<string, string>,
};

export const DEFAULT_LOCALE = 'en';

/**
 * Look up a user-facing string. Returns the key itself when missing so a
 * gap shows up in the UI as an obvious token rather than as blank space.
 */
export function t(
  key: string,
  vars?: Record<string, string | number>,
  locale: string = DEFAULT_LOCALE,
): string {
  const dict = dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE]!;
  const raw = dict[key] ?? dictionaries[DEFAULT_LOCALE]![key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}
```

- [ ] **Step 11: Run the i18n test**

Run: `npm test -- tests/unit/i18n.test.ts`
Expected: PASS.

- [ ] **Step 12: Write `src/lib/reference.ts`**

```ts
export const COUNTRIES = [
  'Algeria', 'Angola', 'Egypt', 'Ethiopia', 'Gabon', 'Ghana',
  "Côte d'Ivoire", 'Democratic Republic of the Congo', 'Kenya',
  'Mauritania', 'Morocco', 'Mozambique', 'Republic of the Congo',
  'Rwanda', 'Senegal', 'Tanzania', 'Tunisia', 'Zambia',
] as const;

export const SECTORS = [
  'Energy', 'Agriculture', 'Health', 'Water',
  'Education & Training', 'Infrastructure',
] as const;

export const STAGES = [
  'New to AI', 'Getting started', 'Building', 'Scaling',
] as const;

export const NEED_KEYS = [
  'compute', 'training', 'funding', 'accelerator', 'partners',
] as const;

export type NeedKey = (typeof NEED_KEYS)[number];

export const NEEDS = ['Compute', 'Training', 'Funding', 'Accelerator', 'Partners'] as const;

/**
 * PRD content rule 10.6: the country filter has no "Global programmes"
 * option. geo_scope of global, all_africa or partner_countries matches
 * every country selection instead.
 */
export const COUNTRY_FILTER_OPTIONS = COUNTRIES;
```

- [ ] **Step 13: Wire the layout and replace the scaffold home page**

`src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import './globals.css';
import { t } from '@/lib/i18n';

export const metadata: Metadata = {
  title: t('site.name'),
  description: t('site.tagline'),
  // SP1 ships behind Vercel Deployment Protection and must not be indexed.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/fonts/outfit-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:

```tsx
import { t } from '@/lib/i18n';

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-10">
      <h1 className="text-4xl font-extrabold text-navy">{t('site.name')}</h1>
      <p className="mt-4 text-muted">{t('site.tagline')}</p>
      <p className="mt-10 border-t border-hairline pt-6 text-sm text-muted-light">
        {t('site.footer')}
      </p>
    </main>
  );
}
```

- [ ] **Step 14: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds. If Tailwind reports unknown utilities like `text-navy`, the installed Tailwind is v3 — move the tokens into `tailwind.config.ts` under `theme.extend.colors` and note it in the README.

- [ ] **Step 15: Run the whole suite and commit**

Run: `npm test`
Expected: all PASS.

```bash
git add -A
git commit -m "feat: design tokens, self-hosted Outfit, localisation scaffolding"
```

---

## Task 3: Extensions, shared trigger, and enums

**Files:**
- Create: `supabase/migrations/0001_extensions.sql`, `supabase/migrations/0002_enums.sql`
- Test: `tests/rls/enums.test.ts`

**Interfaces:**
- Consumes: Task 1's local stack
- Produces: `public.set_updated_at()` trigger function; enums `app_role`, `resource_status`, `need_type`, `geo_scope`, `partner_tier`, `submission_type`, `submission_status`, `partnership_stage`, `audit_action`

- [ ] **Step 1: Write the failing test**

`tests/rls/enums.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { serviceClient } from '../helpers/clients';

const EXPECTED: Record<string, string[]> = {
  app_role: ['admin', 'editor', 'viewer'],
  resource_status: ['live', 'pipeline', 'reference'],
  need_type: ['compute', 'training', 'funding', 'accelerator', 'partners'],
  geo_scope: ['global', 'all_africa', 'partner_countries', 'specific'],
  partner_tier: ['strategic', 'network', 'institutional', 'other'],
  submission_type: ['new_resource', 'update_suggestion'],
  submission_status: ['pending', 'approved', 'rejected'],
  partnership_stage: ['prospecting', 'in_discussion', 'active', 'delivered'],
  audit_action: [
    'published', 'edited', 'created', 'deleted',
    'approved', 'rejected', 'role_changed', 'digest_sent',
  ],
};

describe('enums', () => {
  it('defines every enum with exactly the specified labels', async () => {
    const svc = serviceClient();
    const { data, error } = await svc.rpc('enum_labels');
    expect(error).toBeNull();
    const actual = data as { enum_name: string; labels: string[] }[];
    for (const [name, labels] of Object.entries(EXPECTED)) {
      const row = actual.find((r) => r.enum_name === name);
      expect(row, `missing enum ${name}`).toBeDefined();
      expect(row!.labels).toEqual(labels);
    }
  });
});
```

- [ ] **Step 2: Write the test helper**

`tests/helpers/clients.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const anonKey = process.env.SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export type Role = 'admin' | 'editor' | 'viewer';

export const TEST_USERS: Record<Role, { email: string; password: string }> = {
  admin: { email: 'rls-admin@askhub.test', password: 'Rls-Test-Passw0rd-A!' },
  editor: { email: 'rls-editor@askhub.test', password: 'Rls-Test-Passw0rd-E!' },
  viewer: { email: 'rls-viewer@askhub.test', password: 'Rls-Test-Passw0rd-V!' },
};

export function anonClient(): SupabaseClient {
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

export function serviceClient(): SupabaseClient {
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/**
 * Create the three role users if absent and force their profile role.
 * Idempotent: safe to call from every suite's beforeAll.
 */
export async function ensureTestUsers(): Promise<void> {
  const svc = serviceClient();
  for (const role of Object.keys(TEST_USERS) as Role[]) {
    const { email, password } = TEST_USERS[role];
    const created = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    const userId =
      created.data.user?.id ??
      (await findUserId(svc, email));
    if (!userId) throw new Error(`could not resolve test user ${email}`);
    const { error } = await svc
      .from('profiles')
      .update({ role, is_active: true })
      .eq('user_id', userId);
    if (error) throw error;
  }
}

async function findUserId(
  svc: SupabaseClient,
  email: string,
): Promise<string | undefined> {
  const { data } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
  return data.users.find((u) => u.email === email)?.id;
}

/** A client authenticated as the given role. */
export async function roleClient(role: Role): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword(TEST_USERS[role]);
  if (error) throw error;
  return client;
}
```

- [ ] **Step 3: Run the test to confirm it fails**

Run: `npm test -- tests/rls/enums.test.ts`
Expected: FAIL — the `enum_labels` function does not exist.

- [ ] **Step 4: Write `supabase/migrations/0001_extensions.sql`**

```sql
create extension if not exists pgcrypto;

-- Shared updated_at maintenance. Append-only tables (audit_log,
-- engagement_events) deliberately do not use this and carry no
-- updated_at column at all.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Test-only introspection helper, callable by service_role for the
-- enum contract test. Not granted to anon or authenticated.
create or replace function public.enum_labels()
returns table (enum_name text, labels text[])
language sql
stable
as $$
  select t.typname::text,
         array_agg(e.enumlabel::text order by e.enumsortorder)
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
  group by t.typname
$$;

-- Revoking from public also strips service_role's implicit grant, so
-- it must be granted back explicitly or the contract tests fail with
-- "permission denied for function".
revoke all on function public.enum_labels() from public, anon, authenticated;
grant execute on function public.enum_labels() to service_role;
```

- [ ] **Step 5: Write `supabase/migrations/0002_enums.sql`**

```sql
create type public.app_role as enum ('admin', 'editor', 'viewer');

create type public.resource_status as enum ('live', 'pipeline', 'reference');

create type public.need_type as enum
  ('compute', 'training', 'funding', 'accelerator', 'partners');

create type public.geo_scope as enum
  ('global', 'all_africa', 'partner_countries', 'specific');

create type public.partner_tier as enum
  ('strategic', 'network', 'institutional', 'other');

create type public.submission_type as enum ('new_resource', 'update_suggestion');

create type public.submission_status as enum ('pending', 'approved', 'rejected');

-- Stable keys; display labels live in locales/en.json (stage.*).
-- PRD 16.3 records the unresolved conflict with the client brief's
-- lead/exploring/negotiating/agreement. Prototype labels implemented.
create type public.partnership_stage as enum
  ('prospecting', 'in_discussion', 'active', 'delivered');

create type public.audit_action as enum
  ('published', 'edited', 'created', 'deleted',
   'approved', 'rejected', 'role_changed', 'digest_sent');
```

- [ ] **Step 6: Apply and run the test**

```bash
npm run db:reset
npm test -- tests/rls/enums.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0001_extensions.sql supabase/migrations/0002_enums.sql tests/helpers/clients.ts tests/rls/enums.test.ts
git commit -m "feat(db): extensions, shared updated_at trigger, and nine enums"
```

---

## Task 4: `profiles`, the role helper, and the new-user trigger

**Files:**
- Create: `supabase/migrations/0003_profiles.sql`
- Test: `tests/rls/profiles.test.ts`

**Interfaces:**
- Consumes: Task 3's `app_role` enum and `set_updated_at()`
- Produces: table `public.profiles`; function `public.current_app_role() returns public.app_role`; trigger `on_auth_user_created` on `auth.users`

- [ ] **Step 1: Write the failing test**

`tests/rls/profiles.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { anonClient, roleClient, serviceClient, ensureTestUsers } from '../helpers/clients';

describe('profiles', () => {
  beforeAll(async () => {
    await ensureTestUsers();
  });

  it('creates a profile row automatically, defaulting to viewer', async () => {
    const svc = serviceClient();
    const email = `default-role-${Date.now()}@askhub.test`;
    const { data, error } = await svc.auth.admin.createUser({
      email,
      password: 'Default-Role-Passw0rd!',
      email_confirm: true,
    });
    expect(error).toBeNull();

    const { data: profile } = await svc
      .from('profiles')
      .select('role, is_active, email')
      .eq('user_id', data.user!.id)
      .single();

    expect(profile!.role).toBe('viewer');
    expect(profile!.is_active).toBe(true);
    expect(profile!.email).toBe(email);
  });

  it('is unreadable anonymously', async () => {
    const { data, error } = await anonClient().from('profiles').select('id');
    expect(data ?? []).toHaveLength(0);
    if (error) expect(error.code).not.toBe('42P01');
  });

  it('is readable by all three authenticated roles', async () => {
    for (const role of ['admin', 'editor', 'viewer'] as const) {
      const client = await roleClient(role);
      const { data, error } = await client.from('profiles').select('id');
      expect(error, `${role} read failed`).toBeNull();
      expect((data ?? []).length).toBeGreaterThan(0);
    }
  });

  it('lets admin change a role', async () => {
    const client = await roleClient('admin');
    const { error } = await client
      .from('profiles')
      .update({ display_label: 'Leadership' })
      .eq('email', 'rls-viewer@askhub.test');
    expect(error).toBeNull();
  });

  it('does not let editor change a role', async () => {
    const client = await roleClient('editor');
    const { error } = await client
      .from('profiles')
      .update({ role: 'admin' })
      .eq('email', 'rls-editor@askhub.test');
    // RLS denies via missing policy: either an explicit error or zero
    // rows affected. Assert the row did not actually change.
    const svc = serviceClient();
    const { data } = await svc
      .from('profiles')
      .select('role')
      .eq('email', 'rls-editor@askhub.test')
      .single();
    expect(data!.role).toBe('editor');
    if (error) expect(error.code).toBe('42501');
  });

  it('does not let viewer change anything', async () => {
    const client = await roleClient('viewer');
    await client
      .from('profiles')
      .update({ display_label: 'hacked' })
      .eq('email', 'rls-viewer@askhub.test');
    const svc = serviceClient();
    const { data } = await svc
      .from('profiles')
      .select('display_label')
      .eq('email', 'rls-viewer@askhub.test')
      .single();
    expect(data!.display_label).not.toBe('hacked');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- tests/rls/profiles.test.ts`
Expected: FAIL — relation `profiles` does not exist.

- [ ] **Step 3: Write `supabase/migrations/0003_profiles.sql`**

```sql
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  -- display_label is free text shown in the admin sidebar and is
  -- INDEPENDENT of role (PRD 3). Never infer one from the other.
  display_label text not null default '',
  role public.app_role not null default 'viewer',
  is_active boolean not null default true,
  invited_by uuid references public.profiles(id) on delete set null,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_user_id_idx on public.profiles (user_id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon;

-- MUST be security definer. A plain function selecting from profiles is
-- itself subject to the RLS policy on profiles, which calls this
-- function, which selects from profiles — infinite recursion, reported
-- as a confusing error rather than an obvious one.
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.user_id = auth.uid()
    and p.is_active
$$;

revoke all on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated;

-- All three roles read every profile (PRD 3: view all admin screens).
create policy profiles_select_authenticated
  on public.profiles
  for select
  to authenticated
  using (public.current_app_role() is not null);

-- Only admin writes. editor and viewer get no insert, update or delete
-- policy on this table at all.
create policy profiles_insert_admin
  on public.profiles for insert to authenticated
  with check (public.current_app_role() = 'admin');

create policy profiles_update_admin
  on public.profiles for update to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create policy profiles_delete_admin
  on public.profiles for delete to authenticated
  using (public.current_app_role() = 'admin');

-- Mint the profile row on user creation, at least privilege. An admin
-- promotes explicitly afterwards.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'viewer'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 4: Apply and run the test**

```bash
npm run db:reset
npm test -- tests/rls/profiles.test.ts
```

Expected: PASS, all six cases.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0003_profiles.sql tests/rls/profiles.test.ts
git commit -m "feat(db): profiles table, security-definer role helper, new-user trigger"
```

---

## Task 5: `partners` and `resources`

**Files:**
- Create: `supabase/migrations/0004_resources.sql`
- Test: `tests/rls/resources.test.ts`

**Interfaces:**
- Consumes: Task 3 enums, Task 4's `current_app_role()`
- Produces: tables `public.partners`, `public.resources`

- [ ] **Step 1: Write the failing test**

`tests/rls/resources.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { anonClient, roleClient, serviceClient, ensureTestUsers } from '../helpers/clients';

let partnerId: string;

describe('partners and resources', () => {
  beforeAll(async () => {
    await ensureTestUsers();
    const svc = serviceClient();
    const { data, error } = await svc
      .from('partners')
      .insert({
        name: `Test Partner ${Date.now()}`,
        website_url: 'https://example.org',
        tier: 'network',
      })
      .select('id')
      .single();
    if (error) throw error;
    partnerId = data.id;
  });

  it('rejects a non-https external_url', async () => {
    const svc = serviceClient();
    const { error } = await svc.from('resources').insert({
      name: 'Insecure', partner_id: partnerId, resource_type: 'Course',
      need_primary: 'training', description: 'x',
      external_url: 'http://example.org/apply',
    });
    expect(error?.code).toBe('23514');
  });

  it('rejects an SVG banner image url', async () => {
    const svc = serviceClient();
    const { error } = await svc.from('resources').insert({
      name: 'Svg banner', partner_id: partnerId, resource_type: 'Course',
      need_primary: 'training', description: 'x',
      external_url: 'https://example.org/apply',
      banner_image_url: 'https://example.org/logo.svg',
    });
    expect(error?.code).toBe('23514');
  });

  it('is not readable anonymously on the base table', async () => {
    const { data } = await anonClient().from('resources').select('id');
    expect(data ?? []).toHaveLength(0);
  });

  it('lets editor create a resource', async () => {
    const client = await roleClient('editor');
    const { data, error } = await client
      .from('resources')
      .insert({
        name: 'Editor created', partner_id: partnerId,
        resource_type: 'Credits', need_primary: 'compute',
        description: 'Created by editor in the RLS test.',
        external_url: 'https://example.org/apply',
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    expect(data!.id).toBeTruthy();
  });

  it('does not let viewer create a resource', async () => {
    const client = await roleClient('viewer');
    const { error } = await client.from('resources').insert({
      name: 'Viewer created', partner_id: partnerId,
      resource_type: 'Credits', need_primary: 'compute',
      description: 'Should never persist.',
      external_url: 'https://example.org/apply',
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe('42501');
  });

  it('does not let viewer update or delete a resource', async () => {
    const client = await roleClient('viewer');
    const svc = serviceClient();
    const { data: seeded } = await svc
      .from('resources')
      .insert({
        name: 'Untouchable', partner_id: partnerId,
        resource_type: 'Credits', need_primary: 'compute',
        description: 'original', external_url: 'https://example.org/apply',
      })
      .select('id')
      .single();

    await client.from('resources').update({ description: 'tampered' }).eq('id', seeded!.id);
    await client.from('resources').delete().eq('id', seeded!.id);

    const { data: after } = await svc
      .from('resources')
      .select('description')
      .eq('id', seeded!.id)
      .single();
    expect(after!.description).toBe('original');
  });

  it('defaults status to pipeline so nothing publishes by accident', async () => {
    const svc = serviceClient();
    const { data } = await svc
      .from('resources')
      .insert({
        name: 'Default status', partner_id: partnerId,
        resource_type: 'Course', need_primary: 'training',
        description: 'x', external_url: 'https://example.org/apply',
      })
      .select('status')
      .single();
    expect(data!.status).toBe('pipeline');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- tests/rls/resources.test.ts`
Expected: FAIL — relation `partners` does not exist.

- [ ] **Step 3: Write `supabase/migrations/0004_resources.sql`**

```sql
create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  -- Nullable: every distinct partner named in the seed gets a row,
  -- including those with no logo available.
  logo_url text,
  website_url text not null,
  tier public.partner_tier not null default 'other',
  sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partners_website_https
    check (website_url ~* '^https://'),
  constraint partners_logo_https
    check (logo_url is null or logo_url ~* '^https://'),
  -- PRD 14.5: SVG is an active-content XSS vector. Reject it.
  constraint partners_logo_not_svg
    check (logo_url is null or logo_url !~* '\.svg($|\?|#)')
);

create trigger partners_set_updated_at
  before update on public.partners
  for each row execute function public.set_updated_at();

alter table public.partners enable row level security;
revoke all on table public.partners from anon;

create policy partners_select_authenticated
  on public.partners for select to authenticated
  using (public.current_app_role() is not null);

create policy partners_insert_staff
  on public.partners for insert to authenticated
  with check (public.current_app_role() in ('admin', 'editor'));

create policy partners_update_staff
  on public.partners for update to authenticated
  using (public.current_app_role() in ('admin', 'editor'))
  with check (public.current_app_role() in ('admin', 'editor'));

create policy partners_delete_staff
  on public.partners for delete to authenticated
  using (public.current_app_role() in ('admin', 'editor'));


create table public.resources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- FK rather than text (design doc 5.3.1): one source of truth for
  -- logo, tier and official site.
  partner_id uuid not null references public.partners(id) on delete restrict,
  partner_tier public.partner_tier not null default 'other',
  resource_type text not null,
  need_primary public.need_type not null,
  need_secondary public.need_type,
  sub_category text,
  description text not null,
  action_label text not null default 'Apply',
  external_url text not null,
  banner_image_url text,
  countries_eligible text[] not null default '{}',
  sectors_eligible text[] not null default '{}',
  stages_eligible text[] not null default '{}',
  geo_scope public.geo_scope not null default 'specific',
  -- null means rolling and displays as "Rolling" (PRD 4.2).
  deadline date,
  -- Default pipeline: publishing is always an explicit act.
  status public.resource_status not null default 'pipeline',
  is_featured boolean not null default false,
  is_exclusive boolean not null default false,
  description_fr text,
  description_pt text,
  description_ar text,
  sort_order integer,
  added_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resources_external_url_https
    check (external_url ~* '^https://'),
  constraint resources_banner_https
    check (banner_image_url is null or banner_image_url ~* '^https://'),
  constraint resources_banner_not_svg
    check (banner_image_url is null or banner_image_url !~* '\.svg($|\?|#)')
);

create index resources_status_idx on public.resources (status);
create index resources_need_primary_idx on public.resources (need_primary);
create index resources_deadline_idx on public.resources (deadline);
create index resources_added_date_idx on public.resources (added_date desc);
create index resources_partner_idx on public.resources (partner_id);

create trigger resources_set_updated_at
  before update on public.resources
  for each row execute function public.set_updated_at();

alter table public.resources enable row level security;
revoke all on table public.resources from anon;

create policy resources_select_authenticated
  on public.resources for select to authenticated
  using (public.current_app_role() is not null);

create policy resources_insert_staff
  on public.resources for insert to authenticated
  with check (public.current_app_role() in ('admin', 'editor'));

create policy resources_update_staff
  on public.resources for update to authenticated
  using (public.current_app_role() in ('admin', 'editor'))
  with check (public.current_app_role() in ('admin', 'editor'));

create policy resources_delete_staff
  on public.resources for delete to authenticated
  using (public.current_app_role() in ('admin', 'editor'));
```

- [ ] **Step 4: Apply and run the test**

```bash
npm run db:reset
npm test -- tests/rls/resources.test.ts
```

Expected: PASS, all seven cases.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0004_resources.sql tests/rls/resources.test.ts
git commit -m "feat(db): partners and resources with https/SVG constraints and RLS"
```

---

## Task 6: Deadline and expiring-soon computation

**Files:**
- Create: `src/lib/deadline.ts`
- Test: `tests/unit/deadline.test.ts`

**Interfaces:**
- Consumes: Task 2's `t()`
- Produces: `type DeadlineState = 'rolling' | 'open' | 'expiring' | 'closed'`; `deadlineInfo(deadline: string | null, today?: Date): { state: DeadlineState; daysLeft: number | null; label: string }`; `EXPIRING_SOON_DAYS = 14`

This is a port of the prototype's `dlInfo`. PRD §4.2: a past deadline displays as Closed and is flagged in admin, and `status` is unchanged. PRD §6.2: a deadline within 14 days surfaces in "Expiring soon" with an "N days left" indicator.

- [ ] **Step 1: Write the failing test**

`tests/unit/deadline.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { deadlineInfo, EXPIRING_SOON_DAYS } from '@/lib/deadline';

const TODAY = new Date('2026-07-26T12:00:00Z');

describe('deadlineInfo', () => {
  it('treats a null deadline as rolling', () => {
    const r = deadlineInfo(null, TODAY);
    expect(r.state).toBe('rolling');
    expect(r.daysLeft).toBeNull();
    expect(r.label).toBe('Rolling');
  });

  it('marks a past deadline closed', () => {
    const r = deadlineInfo('2026-07-25', TODAY);
    expect(r.state).toBe('closed');
    expect(r.label).toBe('Closed');
  });

  it('marks today as expiring with zero days left, not closed', () => {
    const r = deadlineInfo('2026-07-26', TODAY);
    expect(r.state).toBe('expiring');
    expect(r.daysLeft).toBe(0);
  });

  it('marks a deadline 14 days out as expiring — the boundary is inclusive', () => {
    const r = deadlineInfo('2026-08-09', TODAY);
    expect(r.daysLeft).toBe(EXPIRING_SOON_DAYS);
    expect(r.state).toBe('expiring');
  });

  it('marks a deadline 15 days out as open', () => {
    const r = deadlineInfo('2026-08-10', TODAY);
    expect(r.daysLeft).toBe(15);
    expect(r.state).toBe('open');
  });

  it('renders the days-left label from the locale file', () => {
    expect(deadlineInfo('2026-08-01', TODAY).label).toBe('6 days left');
  });

  it('is not fooled by a time component on today', () => {
    const lateInDay = new Date('2026-07-26T23:59:59Z');
    expect(deadlineInfo('2026-07-26', lateInDay).state).toBe('expiring');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- tests/unit/deadline.test.ts`
Expected: FAIL — `@/lib/deadline` does not exist.

- [ ] **Step 3: Write `src/lib/deadline.ts`**

```ts
import { t } from '@/lib/i18n';

export const EXPIRING_SOON_DAYS = 14;

export type DeadlineState = 'rolling' | 'open' | 'expiring' | 'closed';

export interface DeadlineInfo {
  state: DeadlineState;
  daysLeft: number | null;
  label: string;
}

/** Whole days between two dates, ignoring time of day and timezone drift. */
function daysBetween(fromISO: string, to: Date): number {
  const [y, m, d] = fromISO.split('-').map(Number) as [number, number, number];
  const target = Date.UTC(y, m - 1, d);
  const base = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((target - base) / 86_400_000);
}

/**
 * Display state for a resource deadline. Never mutates or implies a
 * status change: PRD 4.2 makes auto-close a display state only.
 */
export function deadlineInfo(
  deadline: string | null,
  today: Date = new Date(),
): DeadlineInfo {
  if (!deadline) {
    return { state: 'rolling', daysLeft: null, label: t('deadline.rolling') };
  }

  const daysLeft = daysBetween(deadline, today);

  if (daysLeft < 0) {
    return { state: 'closed', daysLeft, label: t('deadline.closed') };
  }

  const state: DeadlineState =
    daysLeft <= EXPIRING_SOON_DAYS ? 'expiring' : 'open';

  return { state, daysLeft, label: t('deadline.daysLeft', { count: daysLeft }) };
}
```

- [ ] **Step 4: Run the test**

Run: `npm test -- tests/unit/deadline.test.ts`
Expected: PASS, all seven cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/deadline.ts tests/unit/deadline.test.ts
git commit -m "feat: deadline and expiring-soon computation ported from prototype dlInfo"
```

---

## Task 7: Community tables — partnerships, submissions, subscribers, digest sends, contact messages

**Files:**
- Create: `supabase/migrations/0005_community.sql`
- Test: `tests/rls/community.test.ts`

**Interfaces:**
- Consumes: Task 3 enums, Task 4's `current_app_role()`, Task 5's `resources`
- Produces: tables `public.partnerships`, `public.submissions`, `public.subscribers`, `public.digest_sends`, `public.contact_messages`

- [ ] **Step 1: Write the failing test**

`tests/rls/community.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { anonClient, roleClient, serviceClient, ensureTestUsers } from '../helpers/clients';

const PROTECTED = [
  'submissions',
  'subscribers',
  'digest_sends',
  'contact_messages',
  'partnerships',
] as const;

describe('community tables', () => {
  beforeAll(async () => {
    await ensureTestUsers();
  });

  it('is entirely unreachable anonymously, for read and for write', async () => {
    const anon = anonClient();
    for (const table of PROTECTED) {
      const { data } = await anon.from(table).select('id');
      expect(data ?? [], `${table} readable anonymously`).toHaveLength(0);

      const { error } = await anon.from(table).insert({} as never);
      expect(error, `${table} insertable anonymously`).not.toBeNull();
    }
  });

  it('stores subscriber email case-insensitively unique', async () => {
    const svc = serviceClient();
    const email = `Case-${Date.now()}@askhub.test`;
    const first = await svc.from('subscribers').insert({
      email, categories: ['training'], consent_text_version: 'v1',
      confirm_token: `t-${Date.now()}`, unsubscribe_token: `u-${Date.now()}`,
    });
    expect(first.error).toBeNull();

    const second = await svc.from('subscribers').insert({
      email: email.toLowerCase(), categories: ['training'],
      consent_text_version: 'v1', confirm_token: `t2-${Date.now()}`,
      unsubscribe_token: `u2-${Date.now()}`,
    });
    expect(second.error?.code).toBe('23505');
  });

  it('leaves new subscribers unconfirmed', async () => {
    const svc = serviceClient();
    const { data } = await svc
      .from('subscribers')
      .insert({
        email: `unconfirmed-${Date.now()}@askhub.test`,
        categories: ['funding'], consent_text_version: 'v1',
        confirm_token: `tc-${Date.now()}`, unsubscribe_token: `uc-${Date.now()}`,
      })
      .select('confirmed_at')
      .single();
    expect(data!.confirmed_at).toBeNull();
  });

  it('requires target_resource_id on an update_suggestion and forbids it otherwise', async () => {
    const svc = serviceClient();
    const missing = await svc.from('submissions').insert({
      type: 'update_suggestion', resource_name: 'x', description: 'y',
      submitter_email: 'a@b.test',
    });
    expect(missing.error?.code).toBe('23514');

    const spurious = await svc.from('submissions').insert({
      type: 'new_resource', resource_name: 'x', description: 'y',
      submitter_email: 'a@b.test',
      target_resource_id: '00000000-0000-0000-0000-000000000000',
    });
    expect(spurious.error).not.toBeNull();
  });

  it('lets editor read and write submissions, and viewer only read', async () => {
    const editor = await roleClient('editor');
    const { error: editorErr } = await editor.from('submissions').insert({
      type: 'new_resource', resource_name: 'Editor sub',
      description: 'y', submitter_email: 'a@b.test',
    });
    expect(editorErr).toBeNull();

    const viewer = await roleClient('viewer');
    const { data: readable, error: readErr } = await viewer
      .from('submissions')
      .select('id');
    expect(readErr).toBeNull();
    expect((readable ?? []).length).toBeGreaterThan(0);

    const { error: writeErr } = await viewer.from('submissions').insert({
      type: 'new_resource', resource_name: 'Viewer sub',
      description: 'y', submitter_email: 'a@b.test',
    });
    expect(writeErr?.code).toBe('42501');
  });

  it('lets viewer read contact messages but never write them', async () => {
    const svc = serviceClient();
    await svc.from('contact_messages').insert({
      name: 'Test', email: 'contact@askhub.test', message: 'Hello',
    });

    const viewer = await roleClient('viewer');
    const { data, error } = await viewer.from('contact_messages').select('id');
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);

    const { error: writeErr } = await viewer.from('contact_messages').insert({
      name: 'x', email: 'y@z.test', message: 'no',
    });
    expect(writeErr?.code).toBe('42501');
  });

  it('records contact messages as undelivered so SP5 can drain them', async () => {
    const svc = serviceClient();
    const { data } = await svc
      .from('contact_messages')
      .insert({ name: 'Drain', email: 'drain@askhub.test', message: 'Queued' })
      .select('delivered_at, delivery_error')
      .single();
    expect(data!.delivered_at).toBeNull();
    expect(data!.delivery_error).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- tests/rls/community.test.ts`
Expected: FAIL — relation `partnerships` does not exist.

- [ ] **Step 3: Write `supabase/migrations/0005_community.sql`**

```sql
-- AskHub's own partner pipeline, scoped to AskHub partners only.
-- Not an organisation-wide CRM (PRD 4.4).
create table public.partnerships (
  id uuid primary key default gen_random_uuid(),
  organisation text not null,
  partner_id uuid references public.partners(id) on delete set null,
  summary text not null default '',
  note text not null default '',
  stage public.partnership_stage not null default 'prospecting',
  owner uuid references public.profiles(id) on delete set null,
  sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index partnerships_stage_idx on public.partnerships (stage);

create trigger partnerships_set_updated_at
  before update on public.partnerships
  for each row execute function public.set_updated_at();

alter table public.partnerships enable row level security;
revoke all on table public.partnerships from anon;

create policy partnerships_select_authenticated
  on public.partnerships for select to authenticated
  using (public.current_app_role() is not null);

create policy partnerships_insert_staff
  on public.partnerships for insert to authenticated
  with check (public.current_app_role() in ('admin', 'editor'));

create policy partnerships_update_staff
  on public.partnerships for update to authenticated
  using (public.current_app_role() in ('admin', 'editor'))
  with check (public.current_app_role() in ('admin', 'editor'));

create policy partnerships_delete_staff
  on public.partnerships for delete to authenticated
  using (public.current_app_role() in ('admin', 'editor'));


create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  type public.submission_type not null,
  target_resource_id uuid references public.resources(id) on delete cascade,
  resource_name text not null,
  organisation text,
  need public.need_type,
  link text,
  description text not null,
  submitter_email text not null,
  status public.submission_status not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  -- Abuse handling only. Never displayed (PRD 4.5).
  source_ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- PRD 4.5: target required when update_suggestion, null otherwise.
  constraint submissions_target_matches_type check (
    (type = 'update_suggestion' and target_resource_id is not null)
    or (type = 'new_resource' and target_resource_id is null)
  ),
  constraint submissions_link_https
    check (link is null or link ~* '^https://')
);

create index submissions_status_idx on public.submissions (status);
create index submissions_type_idx on public.submissions (type);

create trigger submissions_set_updated_at
  before update on public.submissions
  for each row execute function public.set_updated_at();

alter table public.submissions enable row level security;
revoke all on table public.submissions from anon;

create policy submissions_select_authenticated
  on public.submissions for select to authenticated
  using (public.current_app_role() is not null);

create policy submissions_insert_staff
  on public.submissions for insert to authenticated
  with check (public.current_app_role() in ('admin', 'editor'));

create policy submissions_update_staff
  on public.submissions for update to authenticated
  using (public.current_app_role() in ('admin', 'editor'))
  with check (public.current_app_role() in ('admin', 'editor'));

-- Deliberately no delete policy for any role: PRD 4.5 requires
-- rejection to be soft, retaining the row.


create table public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  categories text[] not null default '{}',
  country text,
  sector text,
  consent_at timestamptz not null default now(),
  consent_text_version text not null,
  confirm_token text not null unique,
  confirmed_at timestamptz,
  unsubscribe_token text not null unique,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscribers_confirmed_idx on public.subscribers (confirmed_at);

create trigger subscribers_set_updated_at
  before update on public.subscribers
  for each row execute function public.set_updated_at();

alter table public.subscribers enable row level security;
revoke all on table public.subscribers from anon;

create policy subscribers_select_authenticated
  on public.subscribers for select to authenticated
  using (public.current_app_role() is not null);

create policy subscribers_insert_staff
  on public.subscribers for insert to authenticated
  with check (public.current_app_role() in ('admin', 'editor'));

create policy subscribers_update_staff
  on public.subscribers for update to authenticated
  using (public.current_app_role() in ('admin', 'editor'))
  with check (public.current_app_role() in ('admin', 'editor'));

-- PRD 14.8 requires a deletion path that genuinely removes the record.
create policy subscribers_delete_staff
  on public.subscribers for delete to authenticated
  using (public.current_app_role() in ('admin', 'editor'));


create table public.digest_sends (
  id uuid primary key default gen_random_uuid(),
  sent_at timestamptz not null default now(),
  sent_by uuid references public.profiles(id) on delete set null,
  resource_ids uuid[] not null default '{}',
  recipient_count integer not null default 0,
  subject text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger digest_sends_set_updated_at
  before update on public.digest_sends
  for each row execute function public.set_updated_at();

alter table public.digest_sends enable row level security;
revoke all on table public.digest_sends from anon;

create policy digest_sends_select_authenticated
  on public.digest_sends for select to authenticated
  using (public.current_app_role() is not null);

create policy digest_sends_insert_staff
  on public.digest_sends for insert to authenticated
  with check (public.current_app_role() in ('admin', 'editor'));


-- NOT IN THE PRD. Added deliberately: PRD 9.1 specifies only that the
-- contact form delivers to the mailbox, which assumes a working mail
-- provider. SPF/DKIM is externally blocked, so a delivery-only form
-- would silently discard every message sent before DNS lands. SP5
-- drains the undelivered rows. See design doc 5.3.4.
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  submitted_at timestamptz not null default now(),
  -- Abuse handling only. Never displayed.
  source_ip_hash text,
  delivered_at timestamptz,
  delivery_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contact_messages_undelivered_idx
  on public.contact_messages (submitted_at)
  where delivered_at is null;

create trigger contact_messages_set_updated_at
  before update on public.contact_messages
  for each row execute function public.set_updated_at();

alter table public.contact_messages enable row level security;
revoke all on table public.contact_messages from anon;

-- Read access matches submissions, which also carries submitter email
-- addresses and which PRD 3 makes readable by all three roles.
create policy contact_messages_select_authenticated
  on public.contact_messages for select to authenticated
  using (public.current_app_role() is not null);

-- Public inserts arrive through a server route holding service_role.
-- Staff may mark delivery outcomes.
create policy contact_messages_update_staff
  on public.contact_messages for update to authenticated
  using (public.current_app_role() in ('admin', 'editor'))
  with check (public.current_app_role() in ('admin', 'editor'));
```

- [ ] **Step 4: Add the `citext` extension**

`subscribers.email` uses `citext` for case-insensitive uniqueness (PRD §4.6). Append to `supabase/migrations/0001_extensions.sql`:

```sql
create extension if not exists citext;
```

- [ ] **Step 5: Apply and run the test**

```bash
npm run db:reset
npm test -- tests/rls/community.test.ts
```

Expected: PASS, all seven cases.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0001_extensions.sql supabase/migrations/0005_community.sql tests/rls/community.test.ts
git commit -m "feat(db): partnerships, submissions, subscribers, digest sends, contact messages"
```

---

## Task 8: Site content tables and settings

**Files:**
- Create: `supabase/migrations/0006_site.sql`
- Test: `tests/rls/site.test.ts`

**Interfaces:**
- Consumes: Task 4's `current_app_role()`
- Produces: tables `public.programmes`, `public.impact_stories`, `public.headline_stats`, `public.compute_metrics`, `public.site_content`, `public.settings`

- [ ] **Step 1: Write the failing test**

`tests/rls/site.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { anonClient, roleClient, serviceClient, ensureTestUsers } from '../helpers/clients';

describe('site content and settings', () => {
  beforeAll(async () => {
    await ensureTestUsers();
  });

  it('does not expose settings anonymously', async () => {
    const { data } = await anonClient().from('settings').select('key');
    expect(data ?? []).toHaveLength(0);
  });

  it('lets editor write site content', async () => {
    const editor = await roleClient('editor');
    const { error } = await editor
      .from('site_content')
      .upsert({ key: 'welcome_band_heading', value: 'Edited by editor', locale: 'en' },
              { onConflict: 'key,locale' });
    expect(error).toBeNull();
  });

  it('does NOT let editor write settings — admin only', async () => {
    const editor = await roleClient('editor');
    const { error } = await editor
      .from('settings')
      .update({ value: '"G-HACKED"' })
      .eq('key', 'ga4_measurement_id');

    const svc = serviceClient();
    const { data } = await svc
      .from('settings')
      .select('value')
      .eq('key', 'ga4_measurement_id')
      .single();
    expect(data!.value).not.toBe('"G-HACKED"');
    if (error) expect(error.code).toBe('42501');
  });

  it('lets admin write settings', async () => {
    const admin = await roleClient('admin');
    const { error } = await admin
      .from('settings')
      .update({ value: '"G-TESTONLY"' })
      .eq('key', 'ga4_measurement_id');
    expect(error).toBeNull();
  });

  it('does not let viewer write any site table', async () => {
    const viewer = await roleClient('viewer');
    for (const table of ['programmes', 'impact_stories', 'headline_stats', 'compute_metrics', 'site_content', 'settings'] as const) {
      const { error } = await viewer.from(table).insert({} as never);
      expect(error, `viewer wrote to ${table}`).not.toBeNull();
    }
  });

  it('ships both feature flags off', async () => {
    const svc = serviceClient();
    const { data } = await svc
      .from('settings')
      .select('key, value')
      .in('key', ['feature_innovator_profiles', 'feature_public_impact_page']);
    expect(data).toHaveLength(2);
    for (const row of data!) {
      expect(row.value, `${row.key} is not false`).toBe(false);
    }
  });

  it('defaults contact_email to the single mailbox', async () => {
    const svc = serviceClient();
    const { data } = await svc
      .from('settings')
      .select('value')
      .eq('key', 'contact_email')
      .single();
    expect(data!.value).toBe('aihubfordevelopment@undp.org');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- tests/rls/site.test.ts`
Expected: FAIL — relation `settings` does not exist.

- [ ] **Step 3: Write `supabase/migrations/0006_site.sql`**

```sql
create table public.programmes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  timeframe text not null default '',
  description text not null default '',
  sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.impact_stories (
  id uuid primary key default gen_random_uuid(),
  organisation text not null,
  country text not null default '',
  description text not null default '',
  sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- value is text, not numeric: PRD 4.10 examples include "7,000+".
create table public.headline_stats (
  id uuid primary key default gen_random_uuid(),
  value text not null,
  label text not null,
  is_hero boolean not null default false,
  sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.compute_metrics (
  id uuid primary key default gen_random_uuid(),
  value text not null,
  label text not null,
  sub_note text,
  sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.site_content (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  value text not null default '',
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (key, locale)
);

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at triggers
create trigger programmes_set_updated_at before update on public.programmes
  for each row execute function public.set_updated_at();
create trigger impact_stories_set_updated_at before update on public.impact_stories
  for each row execute function public.set_updated_at();
create trigger headline_stats_set_updated_at before update on public.headline_stats
  for each row execute function public.set_updated_at();
create trigger compute_metrics_set_updated_at before update on public.compute_metrics
  for each row execute function public.set_updated_at();
create trigger site_content_set_updated_at before update on public.site_content
  for each row execute function public.set_updated_at();
create trigger settings_set_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- RLS: editor and admin write the content tables; settings is admin-only.
alter table public.programmes enable row level security;
alter table public.impact_stories enable row level security;
alter table public.headline_stats enable row level security;
alter table public.compute_metrics enable row level security;
alter table public.site_content enable row level security;
alter table public.settings enable row level security;

revoke all on table public.programmes from anon;
revoke all on table public.impact_stories from anon;
revoke all on table public.headline_stats from anon;
revoke all on table public.compute_metrics from anon;
revoke all on table public.site_content from anon;
revoke all on table public.settings from anon;

create policy programmes_select_authenticated on public.programmes
  for select to authenticated using (public.current_app_role() is not null);
create policy programmes_write_staff on public.programmes
  for all to authenticated
  using (public.current_app_role() in ('admin', 'editor'))
  with check (public.current_app_role() in ('admin', 'editor'));

create policy impact_stories_select_authenticated on public.impact_stories
  for select to authenticated using (public.current_app_role() is not null);
create policy impact_stories_write_staff on public.impact_stories
  for all to authenticated
  using (public.current_app_role() in ('admin', 'editor'))
  with check (public.current_app_role() in ('admin', 'editor'));

create policy headline_stats_select_authenticated on public.headline_stats
  for select to authenticated using (public.current_app_role() is not null);
create policy headline_stats_write_staff on public.headline_stats
  for all to authenticated
  using (public.current_app_role() in ('admin', 'editor'))
  with check (public.current_app_role() in ('admin', 'editor'));

create policy compute_metrics_select_authenticated on public.compute_metrics
  for select to authenticated using (public.current_app_role() is not null);
create policy compute_metrics_write_staff on public.compute_metrics
  for all to authenticated
  using (public.current_app_role() in ('admin', 'editor'))
  with check (public.current_app_role() in ('admin', 'editor'));

create policy site_content_select_authenticated on public.site_content
  for select to authenticated using (public.current_app_role() is not null);
create policy site_content_write_staff on public.site_content
  for all to authenticated
  using (public.current_app_role() in ('admin', 'editor'))
  with check (public.current_app_role() in ('admin', 'editor'));

-- PRD 3: Settings is admin-only. editor gets no write policy here.
create policy settings_select_authenticated on public.settings
  for select to authenticated using (public.current_app_role() is not null);
create policy settings_write_admin on public.settings
  for all to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

-- Baseline configuration. Both feature flags off at launch (PRD 7).
-- GA4 ids are empty: the admin Site engagement section shows its
-- not-connected state until they are set, which is correct per 6.4.
insert into public.settings (key, value) values
  ('ga4_measurement_id',          '""'::jsonb),
  ('ga4_property_id',             '""'::jsonb),
  ('contact_email',               '"aihubfordevelopment@undp.org"'::jsonb),
  ('feature_innovator_profiles',  'false'::jsonb),
  ('feature_public_impact_page',  'false'::jsonb);
```

- [ ] **Step 4: Apply and run the test**

```bash
npm run db:reset
npm test -- tests/rls/site.test.ts
```

Expected: PASS, all seven cases.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0006_site.sql tests/rls/site.test.ts
git commit -m "feat(db): site content tables and admin-only settings with flags off"
```

---

## Task 9: `updates_log` and append-only `audit_log`

**Files:**
- Create: `supabase/migrations/0007_logs.sql`
- Test: `tests/rls/audit-log.test.ts`

**Interfaces:**
- Consumes: Task 3's `audit_action`, Task 4's `current_app_role()`
- Produces: tables `public.updates_log`, `public.audit_log`; triggers `audit_log_no_update`, `audit_log_no_delete`

- [ ] **Step 1: Write the failing test**

`tests/rls/audit-log.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { anonClient, roleClient, serviceClient, ensureTestUsers } from '../helpers/clients';

let rowId: string;

describe('audit_log is append-only', () => {
  beforeAll(async () => {
    await ensureTestUsers();
    const svc = serviceClient();
    const { data, error } = await svc
      .from('audit_log')
      .insert({
        actor_name: 'RLS Test',
        action: 'published',
        entity_type: 'resource',
        entity_label: 'Test Resource',
        change_summary: 'Status Pipeline to Live',
        diff: { status: { before: 'pipeline', after: 'live' } },
      })
      .select('id')
      .single();
    if (error) throw error;
    rowId = data.id;
  });

  it('is unreadable anonymously', async () => {
    const { data } = await anonClient().from('audit_log').select('id');
    expect(data ?? []).toHaveLength(0);
  });

  it('is readable by all three roles', async () => {
    for (const role of ['admin', 'editor', 'viewer'] as const) {
      const client = await roleClient(role);
      const { data, error } = await client.from('audit_log').select('id');
      expect(error, `${role} could not read audit_log`).toBeNull();
      expect((data ?? []).length).toBeGreaterThan(0);
    }
  });

  it('grants no insert policy even to admin — writes go through service_role', async () => {
    const admin = await roleClient('admin');
    const { error } = await admin.from('audit_log').insert({
      actor_name: 'Admin direct', action: 'edited',
      entity_type: 'resource', entity_label: 'x', change_summary: 'y',
    });
    expect(error?.code).toBe('42501');
  });

  it('rejects UPDATE as admin', async () => {
    const admin = await roleClient('admin');
    const { error } = await admin
      .from('audit_log')
      .update({ change_summary: 'rewritten' })
      .eq('id', rowId);
    expect(error).not.toBeNull();

    const svc = serviceClient();
    const { data } = await svc
      .from('audit_log')
      .select('change_summary')
      .eq('id', rowId)
      .single();
    expect(data!.change_summary).toBe('Status Pipeline to Live');
  });

  it('rejects UPDATE as service_role — the trigger, not the policy, does this', async () => {
    const svc = serviceClient();
    const { error } = await svc
      .from('audit_log')
      .update({ change_summary: 'rewritten by service_role' })
      .eq('id', rowId);
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/append-only/i);
  });

  it('rejects DELETE as service_role', async () => {
    const svc = serviceClient();
    const { error } = await svc.from('audit_log').delete().eq('id', rowId);
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/append-only/i);

    const { data } = await svc.from('audit_log').select('id').eq('id', rowId);
    expect(data).toHaveLength(1);
  });

  it('keeps actor_name readable after the referencing profile is removed', async () => {
    const svc = serviceClient();
    const { data: created } = await svc.auth.admin.createUser({
      email: `doomed-${Date.now()}@askhub.test`,
      password: 'Doomed-Passw0rd!', email_confirm: true,
    });
    const { data: profile } = await svc
      .from('profiles')
      .select('id')
      .eq('user_id', created.user!.id)
      .single();

    const { data: entry } = await svc
      .from('audit_log')
      .insert({
        actor: profile!.id, actor_name: 'Doomed User', action: 'created',
        entity_type: 'resource', entity_label: 'Survives deletion',
        change_summary: 'Created resource',
      })
      .select('id')
      .single();

    await svc.auth.admin.deleteUser(created.user!.id);

    const { data: after } = await svc
      .from('audit_log')
      .select('actor, actor_name, entity_label')
      .eq('id', entry!.id)
      .single();
    expect(after!.actor).toBeNull();
    expect(after!.actor_name).toBe('Doomed User');
    expect(after!.entity_label).toBe('Survives deletion');
  });
});
```

The last case is PRD §4.15's reason for denormalising: "A log that goes blank when a resource is removed is not an audit log."

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- tests/rls/audit-log.test.ts`
Expected: FAIL — relation `audit_log` does not exist.

- [ ] **Step 3: Write `supabase/migrations/0007_logs.sql`**

```sql
-- Human-readable "what's new" for the team (PRD 4.14).
create table public.updates_log (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor uuid references public.profiles(id) on delete set null,
  actor_name text not null default '',
  text text not null,
  is_automatic boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index updates_log_occurred_at_idx on public.updates_log (occurred_at desc);

create trigger updates_log_set_updated_at
  before update on public.updates_log
  for each row execute function public.set_updated_at();

alter table public.updates_log enable row level security;
revoke all on table public.updates_log from anon;

create policy updates_log_select_authenticated on public.updates_log
  for select to authenticated using (public.current_app_role() is not null);

create policy updates_log_insert_staff on public.updates_log
  for insert to authenticated
  with check (public.current_app_role() in ('admin', 'editor'));


-- System record, separate from updates_log (PRD 4.15).
-- No updated_at: the table is append-only, so a column that can never
-- change would be misleading.
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor uuid references public.profiles(id) on delete set null,
  -- Denormalised at write time so the record stays readable after the
  -- referenced user is deactivated, renamed or deleted (PRD 4.15).
  actor_name text not null,
  action public.audit_action not null,
  entity_type text not null,
  entity_id uuid,
  -- Denormalised human label. Resources appear by bare name; every
  -- other entity type is prefixed, e.g. "Partnership: NVIDIA".
  entity_label text not null,
  -- Rendered sentence, generated at write time by a formatter keyed on
  -- entity_type and action. Not a JSON dump.
  change_summary text not null,
  diff jsonb,
  occurred_at timestamptz not null default now(),
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index audit_log_occurred_at_idx on public.audit_log (occurred_at desc);
create index audit_log_actor_idx on public.audit_log (actor);
create index audit_log_action_idx on public.audit_log (action);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);

alter table public.audit_log enable row level security;
revoke all on table public.audit_log from anon;

-- Read for all three roles (PRD 3, 6.9).
create policy audit_log_select_authenticated on public.audit_log
  for select to authenticated using (public.current_app_role() is not null);

-- NO insert, update or delete policy for ANY role, including admin.
-- Rows are written by server actions using service_role, inside the
-- same action as the mutation they record: PRD 4.15 requires
-- actor_name and entity_label denormalised at write time and
-- change_summary generated by a formatter, none of which can be
-- trusted to a client-side insert.

-- service_role bypasses RLS but NOT triggers. This is what makes
-- append-only hold against every path into the table, including the
-- server's own, and survive a future migration that adds a policy
-- carelessly.
create or replace function public.audit_log_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only; % is not permitted', tg_op;
end;
$$;

create trigger audit_log_no_update
  before update on public.audit_log
  for each row execute function public.audit_log_append_only();

create trigger audit_log_no_delete
  before delete on public.audit_log
  for each row execute function public.audit_log_append_only();
```

- [ ] **Step 4: Apply and run the test**

```bash
npm run db:reset
npm test -- tests/rls/audit-log.test.ts
```

Expected: PASS, all seven cases.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0007_logs.sql tests/rls/audit-log.test.ts
git commit -m "feat(db): updates_log and append-only audit_log guarded by triggers"
```

---

## Task 10: `engagement_events`

**Files:**
- Create: `supabase/migrations/0008_events.sql`
- Test: `tests/rls/events.test.ts`

**Interfaces:**
- Consumes: Task 3's `need_type`, Task 4's `current_app_role()`, Task 5's `resources`
- Produces: table `public.engagement_events` with its read-pattern indexes

- [ ] **Step 1: Write the failing test**

`tests/rls/events.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { anonClient, roleClient, serviceClient, ensureTestUsers } from '../helpers/clients';

describe('engagement_events', () => {
  beforeAll(async () => {
    await ensureTestUsers();
  });

  it('cannot be written anonymously — writes go through a server route', async () => {
    const { error } = await anonClient().from('engagement_events').insert({
      event_name: 'resource_view', session_hash: 'anon-attempt',
    });
    expect(error).not.toBeNull();
  });

  it('cannot be read anonymously', async () => {
    const { data } = await anonClient().from('engagement_events').select('id');
    expect(data ?? []).toHaveLength(0);
  });

  it('accepts the five specified event names through service_role', async () => {
    const svc = serviceClient();
    for (const name of ['resource_view', 'apply_click', 'search_performed', 'filter_used', 'export_clicked']) {
      const { error } = await svc.from('engagement_events').insert({
        event_name: name, session_hash: `sess-${name}`,
      });
      expect(error, `${name} rejected`).toBeNull();
    }
  });

  it('defaults is_bot to false', async () => {
    const svc = serviceClient();
    const { data } = await svc
      .from('engagement_events')
      .insert({ event_name: 'resource_view', session_hash: 'bot-default' })
      .select('is_bot')
      .single();
    expect(data!.is_bot).toBe(false);
  });

  it('is readable by all three roles for reporting', async () => {
    for (const role of ['admin', 'editor', 'viewer'] as const) {
      const client = await roleClient(role);
      const { error } = await client.from('engagement_events').select('id').limit(1);
      expect(error, `${role} could not read events`).toBeNull();
    }
  });

  it('stores no ip address or raw user agent column', async () => {
    const svc = serviceClient();
    const { data } = await svc.rpc('column_names', { table_name: 'engagement_events' });
    const columns = (data as string[]).map((c) => c.toLowerCase());
    for (const forbidden of ['ip', 'ip_address', 'ip_hash', 'user_agent']) {
      expect(columns, `engagement_events must not have ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('has the indexes the dashboard read pattern needs', async () => {
    const svc = serviceClient();
    const { data } = await svc.rpc('index_names', { table_name: 'engagement_events' });
    const names = data as string[];
    expect(names).toContain('engagement_events_occurred_at_idx');
    expect(names).toContain('engagement_events_name_time_idx');
    expect(names).toContain('engagement_events_resource_idx');
    expect(names).toContain('engagement_events_human_idx');
  });
});
```

- [ ] **Step 2: Add the two introspection helpers**

Append to `supabase/migrations/0001_extensions.sql`:

```sql
-- Test-only introspection helpers. service_role only.
create or replace function public.column_names(table_name text)
returns text[]
language sql
stable
as $$
  select array_agg(c.column_name::text order by c.ordinal_position)
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = column_names.table_name
$$;

create or replace function public.index_names(table_name text)
returns text[]
language sql
stable
as $$
  select array_agg(i.indexname::text order by i.indexname)
  from pg_indexes i
  where i.schemaname = 'public' and i.tablename = index_names.table_name
$$;

revoke all on function public.column_names(text) from public, anon, authenticated;
revoke all on function public.index_names(text) from public, anon, authenticated;
grant execute on function public.column_names(text) to service_role;
grant execute on function public.index_names(text) to service_role;
```

- [ ] **Step 3: Run the test to confirm it fails**

Run: `npm test -- tests/rls/events.test.ts`
Expected: FAIL — relation `engagement_events` does not exist.

- [ ] **Step 4: Write `supabase/migrations/0008_events.sql`**

```sql
-- First-party event log (PRD 4.16, 8.3). Contains no IP addresses, no
-- user agents in raw form, and no personal identifiers.
-- No updated_at: append-only event stream.
create table public.engagement_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  resource_id uuid references public.resources(id) on delete set null,
  need public.need_type,
  is_featured boolean,
  search_term text,
  filter_key text,
  filter_value text,
  -- Coarse, from edge geolocation. Not an identifier.
  country_code text,
  occurred_at timestamptz not null default now(),
  -- Rotating, non-reversible. No cross-session identity (PRD 8.3).
  session_hash text not null,
  is_bot boolean not null default false,
  created_at timestamptz not null default now(),
  constraint engagement_events_country_code_shape
    check (country_code is null or country_code ~ '^[A-Z]{2}$')
);

-- PRD 8.3 forbids a full table scan per dashboard page load. Creating
-- these with the table is materially less disruptive than adding them
-- once it carries traffic.
create index engagement_events_occurred_at_idx
  on public.engagement_events (occurred_at desc);
create index engagement_events_name_time_idx
  on public.engagement_events (event_name, occurred_at desc);
create index engagement_events_resource_idx
  on public.engagement_events (resource_id);
-- Bot rows are excluded from every reported figure, so the reporting
-- path only ever reads this partial index.
create index engagement_events_human_idx
  on public.engagement_events (occurred_at desc)
  where is_bot = false;

alter table public.engagement_events enable row level security;
revoke all on table public.engagement_events from anon;

-- Read for all three roles: the reporting screens are visible to
-- viewer per PRD 3.
create policy engagement_events_select_authenticated
  on public.engagement_events for select to authenticated
  using (public.current_app_role() is not null);

-- No insert policy for any role. Client events are posted to a server
-- route that validates, rate limits, flags bots and writes with
-- service_role (PRD 8.3).
```

- [ ] **Step 5: Apply and run the test**

```bash
npm run db:reset
npm test -- tests/rls/events.test.ts
```

Expected: PASS, all seven cases.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0001_extensions.sql supabase/migrations/0008_events.sql tests/rls/events.test.ts
git commit -m "feat(db): engagement_events with read-pattern indexes and no client insert path"
```

---

## Task 11: Public-safe views

**Files:**
- Create: `supabase/migrations/0009_public_views.sql`
- Test: `tests/rls/public-views.test.ts`

**Interfaces:**
- Consumes: Tasks 5, 6, 8
- Produces: views `public.resources_public`, `public.partners_public`, `public.headline_stats_public`, `public.site_content_public`, `public.impact_stories_public`, `public.programmes_public`, `public.need_counts_public`

- [ ] **Step 1: Write the failing test**

`tests/rls/public-views.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { anonClient, serviceClient } from '../helpers/clients';

const FORBIDDEN_COLUMNS = [
  'views', 'clicks', 'ctr', 'submitter_email', 'internal_notes',
  'note', 'source_ip_hash', 'status', 'ip_hash', 'user_agent',
];

let livePartnerId: string;

describe('public-safe views', () => {
  beforeAll(async () => {
    const svc = serviceClient();
    const { data: partner } = await svc
      .from('partners')
      .insert({
        name: `Public View Partner ${Date.now()}`,
        website_url: 'https://example.org', tier: 'strategic',
      })
      .select('id')
      .single();
    livePartnerId = partner!.id;

    await svc.from('resources').insert([
      {
        name: 'Live and visible', partner_id: livePartnerId,
        resource_type: 'Credits', need_primary: 'compute',
        description: 'live', external_url: 'https://example.org/a',
        status: 'live',
      },
      {
        name: 'Pipeline and hidden', partner_id: livePartnerId,
        resource_type: 'Credits', need_primary: 'compute',
        description: 'pipeline', external_url: 'https://example.org/b',
        status: 'pipeline',
      },
      {
        name: 'Reference and hidden', partner_id: livePartnerId,
        resource_type: 'Credits', need_primary: 'compute',
        description: 'reference', external_url: 'https://example.org/c',
        status: 'reference',
      },
    ]);
  });

  it('exposes only live resources anonymously', async () => {
    const { data, error } = await anonClient()
      .from('resources_public')
      .select('name');
    expect(error).toBeNull();
    const names = (data ?? []).map((r) => r.name as string);
    expect(names).toContain('Live and visible');
    expect(names).not.toContain('Pipeline and hidden');
    expect(names).not.toContain('Reference and hidden');
  });

  it('exposes no internal or analytics column', async () => {
    const svc = serviceClient();
    const { data } = await svc.rpc('column_names', { table_name: 'resources_public' });
    const columns = (data as string[]).map((c) => c.toLowerCase());
    for (const forbidden of FORBIDDEN_COLUMNS) {
      expect(columns, `resources_public exposes ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('computes closed state and days left without exposing status', async () => {
    const svc = serviceClient();
    await svc.from('resources').insert({
      name: 'Past deadline', partner_id: livePartnerId,
      resource_type: 'Course', need_primary: 'training',
      description: 'closed', external_url: 'https://example.org/d',
      status: 'live', deadline: '2020-01-01',
    });

    const { data } = await anonClient()
      .from('resources_public')
      .select('name, is_closed, days_left')
      .eq('name', 'Past deadline')
      .single();
    expect(data!.is_closed).toBe(true);
    expect(data!.days_left as number).toBeLessThan(0);
  });

  it('reports rolling resources with a null days_left', async () => {
    const { data } = await anonClient()
      .from('resources_public')
      .select('days_left, is_closed')
      .eq('name', 'Live and visible')
      .single();
    expect(data!.days_left).toBeNull();
    expect(data!.is_closed).toBe(false);
  });

  it('leaves the base tables unreachable anonymously', async () => {
    const anon = anonClient();
    for (const table of ['resources', 'partners', 'submissions', 'subscribers', 'settings', 'audit_log'] as const) {
      const { data } = await anon.from(table).select('id');
      expect(data ?? [], `${table} readable anonymously`).toHaveLength(0);
    }
  });

  it('cannot be written through anonymously', async () => {
    const { error } = await anonClient().from('resources_public').insert({
      name: 'Injected',
    } as never);
    expect(error).not.toBeNull();
  });

  it('counts live resources per need for the home page browse band', async () => {
    const { data, error } = await anonClient()
      .from('need_counts_public')
      .select('need_primary, live_count');
    expect(error).toBeNull();
    const compute = (data ?? []).find((r) => r.need_primary === 'compute');
    expect((compute!.live_count as number)).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- tests/rls/public-views.test.ts`
Expected: FAIL — relation `resources_public` does not exist.

- [ ] **Step 3: Write `supabase/migrations/0009_public_views.sql`**

```sql
-- Anonymous reads go exclusively through these views. The anon role
-- holds zero policies on any base table, so this file is the entire
-- public read surface.
--
-- security_invoker = false means the view reads its base tables as its
-- owner, bypassing their RLS. That is the mechanism, and it is why
-- every column is enumerated explicitly: a later "select *" cannot
-- silently widen the exposure, and PRD 14.9 checks 2 and 5 become
-- structural properties rather than behaviour to remember.

create view public.partners_public
with (security_invoker = false) as
select p.id, p.name, p.logo_url, p.website_url, p.tier, p.sort_order
from public.partners p;

create view public.resources_public
with (security_invoker = false) as
select
  r.id,
  r.name,
  p.name        as partner_name,
  p.logo_url    as partner_logo_url,
  p.website_url as partner_website_url,
  r.partner_tier,
  r.resource_type,
  r.need_primary,
  r.need_secondary,
  r.sub_category,
  r.description,
  r.description_fr,
  r.description_pt,
  r.description_ar,
  r.action_label,
  r.external_url,
  r.banner_image_url,
  r.countries_eligible,
  r.sectors_eligible,
  r.stages_eligible,
  r.geo_scope,
  r.deadline,
  r.is_featured,
  r.is_exclusive,
  r.sort_order,
  r.added_date,
  -- Display state only. PRD 4.2: a past deadline never transitions
  -- status, so status itself is deliberately absent from this view.
  (r.deadline is not null and r.deadline < current_date) as is_closed,
  (r.deadline - current_date)                           as days_left
from public.resources r
join public.partners p on p.id = r.partner_id
where r.status = 'live';

create view public.headline_stats_public
with (security_invoker = false) as
select h.id, h.value, h.label, h.is_hero, h.sort_order
from public.headline_stats h;

create view public.compute_metrics_public
with (security_invoker = false) as
select c.id, c.value, c.label, c.sub_note, c.sort_order
from public.compute_metrics c;

create view public.site_content_public
with (security_invoker = false) as
select s.key, s.value, s.locale
from public.site_content s;

create view public.programmes_public
with (security_invoker = false) as
select p.id, p.title, p.timeframe, p.description, p.sort_order
from public.programmes p;

-- Gating is done in the application from the feature flag, which is
-- read server-side (PRD 7). The view exists so the page can be built
-- and tested while the flag is off.
create view public.impact_stories_public
with (security_invoker = false) as
select i.id, i.organisation, i.country, i.description, i.sort_order
from public.impact_stories i;

-- Live counts for the home page "browse by need" band (PRD 5.1).
-- Aggregated in the database rather than by fetching every row.
create view public.need_counts_public
with (security_invoker = false) as
select r.need_primary, count(*)::integer as live_count
from public.resources r
where r.status = 'live'
group by r.need_primary;

grant select on
  public.partners_public,
  public.resources_public,
  public.headline_stats_public,
  public.compute_metrics_public,
  public.site_content_public,
  public.programmes_public,
  public.impact_stories_public,
  public.need_counts_public
to anon, authenticated;
```

- [ ] **Step 4: Apply and run the test**

```bash
npm run db:reset
npm test -- tests/rls/public-views.test.ts
```

Expected: PASS, all seven cases.

- [ ] **Step 5: Run the whole suite — this is the RLS gate**

Run: `npm test`
Expected: every test PASSES. This covers PRD §14.9 checks 1 through 5.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0009_public_views.sql tests/rls/public-views.test.ts
git commit -m "feat(db): public-safe views as the entire anonymous read surface"
```

---

## Task 12: Content seed

**Files:**
- Create: `scripts/seed.ts`, `scripts/seed-data.ts`
- Test: `tests/seed.test.ts`

**Interfaces:**
- Consumes: every table from Tasks 4–8
- Produces: `seed(): Promise<void>` from `scripts/seed.ts`, idempotent

**Source of the data:** the prototype's `seed()` block, lines 83–217 of the extracted `app.jsx`. Re-extract if the scratchpad is gone:

```bash
curl -sSL -o /tmp/proto.html "https://incandescent-florentine-2aa0ad.netlify.app/"
node -e '
const fs=require("fs");
const h=fs.readFileSync("/tmp/proto.html","utf8");
const g=t=>{const o=h.indexOf(`<script type="__bundler/${t}"`);const s=h.indexOf(">",o)+1;return h.slice(s,h.indexOf("</script>",s));};
const tpl=JSON.parse(g("template"));
const o=tpl.indexOf("<script type=\"text/x-dc\"");
const s=tpl.indexOf(">",o)+1;
fs.writeFileSync("/tmp/app.jsx", tpl.slice(s, tpl.indexOf("</script>",s)));
'
sed -n '83,217p' /tmp/app.jsx
```

- [ ] **Step 1: Write the failing test**

`tests/seed.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { serviceClient, anonClient } from './helpers/clients';
import { seed } from '../scripts/seed';

describe('content seed', () => {
  beforeAll(async () => {
    await seed();
  });

  it('is idempotent — a second run does not duplicate', async () => {
    const svc = serviceClient();
    const before = await svc.from('resources').select('id', { count: 'exact', head: true });
    await seed();
    const after = await svc.from('resources').select('id', { count: 'exact', head: true });
    expect(after.count).toBe(before.count);
  });

  it('seeds roughly twenty resources, eleven of them live', async () => {
    const svc = serviceClient();
    const total = await svc.from('resources').select('id', { count: 'exact', head: true });
    expect(total.count!).toBeGreaterThanOrEqual(18);
    const live = await svc
      .from('resources')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'live');
    expect(live.count).toBe(11);
  });

  it('gives every resource a partner row', async () => {
    const svc = serviceClient();
    const { data } = await svc.from('resources').select('partner_id');
    for (const row of data ?? []) {
      expect(row.partner_id).toBeTruthy();
    }
  });

  it('seeds NO subscribers, submissions, digest sends or events', async () => {
    const svc = serviceClient();
    for (const table of ['subscribers', 'submissions', 'digest_sends', 'engagement_events'] as const) {
      const { count } = await svc
        .from(table)
        .select('id', { count: 'exact', head: true });
      expect(count, `${table} must not be seeded`).toBe(0);
    }
  });

  it('honours the content rules in seeded copy', async () => {
    const svc = serviceClient();
    const { data: resources } = await svc.from('resources').select('name, description');
    const blob = JSON.stringify(resources);
    expect(blob).not.toMatch(/Mattei Plan/);
    expect(blob).not.toMatch(/\bVerified\b/);
    expect(blob).not.toMatch(/\bDRC\b/);

    const { data: cineca } = await svc
      .from('resources')
      .select('name')
      .ilike('name', '%CINECA%');
    if ((cineca ?? []).length > 0) {
      expect(cineca![0]!.name).toBe('CINECA Leonardo');
    }

    const { data: content } = await svc.from('site_content').select('value');
    const copy = JSON.stringify(content);
    expect(copy).not.toMatch(/powered by|implemented by/i);
  });

  it('uses only https external urls', async () => {
    const svc = serviceClient();
    const { data } = await svc.from('resources').select('name, external_url');
    for (const row of data ?? []) {
      expect(row.external_url as string, `${row.name}`).toMatch(/^https:\/\//);
    }
  });

  it('publishes the seed to the anonymous public view', async () => {
    const { data } = await anonClient().from('resources_public').select('id');
    expect((data ?? []).length).toBe(11);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- tests/seed.test.ts`
Expected: FAIL — `../scripts/seed` does not exist.

- [ ] **Step 3: Write `scripts/extract-seed.ts`**

**Do not hand-transcribe.** The prototype's seed block carries 57 occurrences of `views:`, `clicks:` and `match_weight:` — fabricated per-resource metrics that PRD §8.4 names explicitly as launch-blocking. Hand transcription is exactly how one of them survives into a migration. Extract programmatically and strip by allow-list.

The block is `seed()` at lines 83–216 of the extracted `app.jsx`. It references only `this.STAGES`, so it can be evaluated with a stub context.

```ts
import { writeFileSync } from 'node:fs';

const PROTOTYPE_URL = 'https://incandescent-florentine-2aa0ad.netlify.app/';

// Prototype label -> PRD 4.2 enum value.
const TIER: Record<string, string> = {
  Strategic: 'strategic',
  Network: 'network',
  Academic: 'institutional',
  Government: 'institutional',
  'Development partner': 'institutional',
};

const SCOPE: Record<string, string> = {
  Global: 'global',
  'All Africa': 'all_africa',
  '18 priority countries': 'partner_countries',
  Selected: 'specific',
};

const STATUS: Record<string, string> = {
  Live: 'live', Pipeline: 'pipeline', Reference: 'reference',
};

const NEED: Record<string, string> = {
  Compute: 'compute', Training: 'training', Funding: 'funding',
  Accelerator: 'accelerator', Partners: 'partners',
};

const SECTORS = [
  'Energy', 'Agriculture', 'Health', 'Water',
  'Education & Training', 'Infrastructure',
];

// Official sites. Content rule 10.10 requires partner logos to link to
// official sites, so every one of these is verified by hand in Step 7.
// The four marked UNVERIFIED are inferred and MUST be confirmed.
const PARTNER_SITE: Record<string, string> = {
  'African Development Bank': 'https://afdb.org',
  'AfriLabs': 'https://afrilabs.com',
  'Air Street Capital': 'https://airstreet.com',            // UNVERIFIED
  'Amazon Web Services': 'https://aws.amazon.com',
  'CINECA / AI Hub': 'https://cineca.it',
  'Cyber 4.0 and Cisco': 'https://cyber40.it',              // UNVERIFIED
  'Deep Learning Indaba': 'https://deeplearningindaba.com', // UNVERIFIED
  'European Commission': 'https://ec.europa.eu',            // UNVERIFIED
  'Google / Kaggle': 'https://kaggle.com',
  'Google': 'https://google.com',
  'GSMA': 'https://gsma.com',
  'Mercy Corps': 'https://mercycorpsventures.org',
  'Meta': 'https://meta.com',
  'Microsoft': 'https://microsoft.com',
  'NVIDIA': 'https://nvidia.com',
  'Orange': 'https://orange.com',
  'Safaricom': 'https://safaricom.co.ke',
  'Stanford / Coursera': 'https://coursera.org',
  'Zindi': 'https://zindi.africa',
};

interface ProtoResource {
  name: string; partner: string; partner_tier: string;
  resource_type: string; need_primary: string; need_secondary: string;
  sub_category: string; description: string; action_label: string;
  external_url: string; scope: string; countries: string[];
  sectors: string[] | 'All'; stages: string[]; deadline: string;
  status: string; featured: boolean; exclusive: string;
  added: string; image: string;
  // Present in the prototype and deliberately never read:
  views?: number; clicks?: number; match_weight?: number;
  verified?: boolean; notified?: boolean; id?: string;
}

async function extract(): Promise<void> {
  const html = await (await fetch(PROTOTYPE_URL)).text();

  const grab = (tag: string): string => {
    const open = html.indexOf(`<script type="__bundler/${tag}"`);
    const start = html.indexOf('>', open) + 1;
    return html.slice(start, html.indexOf('</script>', start));
  };

  const template = JSON.parse(grab('template')) as string;
  const open = template.indexOf('<script type="text/x-dc"');
  const start = template.indexOf('>', open) + 1;
  const app = template.slice(start, template.indexOf('</script>', start));

  const seedStart = app.indexOf('  seed() {');
  const seedEnd = app.indexOf('\n  ga(name', seedStart);
  const body = app
    .slice(seedStart, seedEnd)
    .replace(/^\s*seed\(\)\s*\{/, '')
    .replace(/\}\s*$/, '');

  const STAGES = ['New to AI', 'Getting started', 'Building', 'Scaling'];
  const seeded = new Function(body).call({ STAGES }) as {
    resources: ProtoResource[];
    programmes: { title: string; timeframe: string; description: string }[];
    stories: { org: string; country: string; text: string }[];
    settings: { stats: { value: string; label: string; hero: boolean }[] };
    computeStats: { value: string; label: string; sub: string }[];
  };

  const partnerNames = [...new Set(seeded.resources.map((r) => r.partner))].sort();
  for (const name of partnerNames) {
    if (!PARTNER_SITE[name]) {
      throw new Error(`no official site recorded for partner "${name}"`);
    }
  }

  const partners = partnerNames.map((name, i) => ({
    name,
    website_url: PARTNER_SITE[name]!,
    logo_url: null,
    tier:
      TIER[
        seeded.resources.find((r) => r.partner === name)!.partner_tier
      ] ?? 'other',
    sort_order: i + 1,
  }));

  // Allow-list. Anything not named here is dropped, which is how the
  // fabricated views/clicks/match_weight fields are guaranteed gone.
  const resources = seeded.resources.map((r, i) => ({
    name: r.name,
    partner_name: r.partner,
    partner_tier: TIER[r.partner_tier] ?? 'other',
    resource_type: r.resource_type,
    need_primary: NEED[r.need_primary]!,
    need_secondary: r.need_secondary ? NEED[r.need_secondary]! : null,
    sub_category: r.sub_category || null,
    description: r.description,
    action_label: r.action_label,
    external_url: r.external_url,
    banner_image_url: r.image || null,
    countries_eligible: r.countries ?? [],
    sectors_eligible: r.sectors === 'All' ? SECTORS : (r.sectors ?? []),
    stages_eligible: r.stages ?? STAGES,
    geo_scope: SCOPE[r.scope] ?? 'specific',
    deadline: r.deadline || null,
    status: STATUS[r.status] ?? 'pipeline',
    is_featured: Boolean(r.featured),
    is_exclusive: Boolean(r.exclusive),
    added_date: r.added,
    sort_order: i + 1,
  }));

  const banned = ['views', 'clicks', 'match_weight', 'verified', 'notified'];
  const serialised = JSON.stringify(resources);
  for (const field of banned) {
    if (serialised.includes(`"${field}"`)) {
      throw new Error(`fabricated field "${field}" survived extraction`);
    }
  }

  const file = `// GENERATED by scripts/extract-seed.ts — do not edit by hand.
// Fabricated metric fields (views, clicks, match_weight) are stripped
// by allow-list at extraction. PRD 8.4.

export type Tier = 'strategic' | 'network' | 'institutional' | 'other';
export type Need = 'compute' | 'training' | 'funding' | 'accelerator' | 'partners';
export type Scope = 'global' | 'all_africa' | 'partner_countries' | 'specific';
export type Status = 'live' | 'pipeline' | 'reference';

export const SEED_PARTNERS = ${JSON.stringify(partners, null, 2)} as const;
export const SEED_RESOURCES = ${JSON.stringify(resources, null, 2)} as const;
export const SEED_PROGRAMMES = ${JSON.stringify(
    seeded.programmes.map((p, i) => ({ ...p, sort_order: i + 1 })), null, 2)} as const;
export const SEED_IMPACT_STORIES = ${JSON.stringify(
    seeded.stories.map((s, i) => ({
      organisation: s.org, country: s.country,
      description: s.text, sort_order: i + 1,
    })), null, 2)} as const;
export const SEED_HEADLINE_STATS = ${JSON.stringify(
    seeded.settings.stats.map((s, i) => ({
      value: s.value, label: s.label, is_hero: s.hero, sort_order: i + 1,
    })), null, 2)} as const;
export const SEED_COMPUTE_METRICS = ${JSON.stringify(
    seeded.computeStats.map((c, i) => ({
      value: c.value, label: c.label, sub_note: c.sub || null, sort_order: i + 1,
    })), null, 2)} as const;

export const SEED_SITE_CONTENT = [
  { key: 'welcome_band_heading', value: '' },
  { key: 'welcome_band_body', value: '' },
  { key: 'welcome_band_cta_label', value: '' },
  { key: 'about_intro', value: '' },
  { key: 'about_alignment', value: '' },
  { key: 'privacy_copy', value: '' },
  { key: 'terms_copy', value: '' },
];
`;

  writeFileSync('scripts/seed-data.ts', file);
  console.log(
    `extracted ${partners.length} partners, ${resources.length} resources ` +
    `(${resources.filter((r) => r.status === 'live').length} live)`,
  );
}

extract().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: Run the extraction and review its output**

```bash
npx tsx scripts/extract-seed.ts
```

Expected: `extracted 19 partners, 20 resources (12 live)`.

**Reconcile two things before continuing:**

1. **PRD §15 says 11 live; the prototype yields 12.** The prototype's `R()` helper defaults `status` to `'Live'`, and only 8 records override it. Resolve by hand-verifying URLs in Step 7: any resource whose URL cannot be confirmed drops to `pipeline`, which is the mechanism §15 prescribes. If all twelve verify, keep twelve and note the discrepancy against §15 rather than deleting a real resource to hit a number.
2. **Four partner sites are marked UNVERIFIED** in `PARTNER_SITE` — Air Street Capital, Cyber 4.0 and Cisco, Deep Learning Indaba, European Commission. Content rule 10.10 requires official sites. Confirm each by hand and correct the map. Note that content rule 10.7 fixes the Cyber4Africa partners as Cyber 4.0 and Cisco, so that entry names a joint programme rather than one organisation — pick the canonical programme site.

Then read `scripts/seed-data.ts` and confirm no `views`, `clicks` or `match_weight` key appears anywhere:

```bash
grep -nE '"(views|clicks|match_weight|verified|notified)"' scripts/seed-data.ts
```

Expected: no output. The extraction throws if any survive, but check anyway — this is the §8.4 defect class.

- [ ] **Step 5: Write the type declarations the seed consumes**

`scripts/seed-data.ts` is generated and self-contained — it deliberately does **not** import from `src/`, because `tsx` does not resolve the `@/*` tsconfig alias for files outside `src/`. The generated file exports its own `Tier`, `Need`, `Scope` and `Status` unions.

```ts
import type { NeedKey } from '@/lib/reference';

export interface SeedPartner {
  name: string;
  website_url: string;
  logo_url: string | null;
  tier: 'strategic' | 'network' | 'institutional' | 'other';
  sort_order: number;
}

export interface SeedResource {
  name: string;
  partner_name: string;
  partner_tier: 'strategic' | 'network' | 'institutional' | 'other';
  resource_type: string;
  need_primary: NeedKey;
  need_secondary: NeedKey | null;
  sub_category: string | null;
  description: string;
  action_label: string;
  external_url: string;
  banner_image_url: string | null;
  countries_eligible: string[];
  sectors_eligible: string[];
  stages_eligible: string[];
  geo_scope: 'global' | 'all_africa' | 'partner_countries' | 'specific';
  deadline: string | null;
  status: 'live' | 'pipeline' | 'reference';
  is_featured: boolean;
  is_exclusive: boolean;
  added_date: string;
  sort_order: number;
}

// Partner websites come from the prototype's LOGOS map, which records
// the official site for each partner (content rule 10.10).
export const SEED_PARTNERS: SeedPartner[] = [
  { name: 'Microsoft', website_url: 'https://microsoft.com', logo_url: null, tier: 'strategic', sort_order: 1 },
  { name: 'Amazon Web Services', website_url: 'https://aws.amazon.com', logo_url: null, tier: 'strategic', sort_order: 2 },
  { name: 'CINECA', website_url: 'https://cineca.it', logo_url: null, tier: 'institutional', sort_order: 3 },
  { name: 'NVIDIA', website_url: 'https://nvidia.com', logo_url: null, tier: 'strategic', sort_order: 4 },
  { name: 'AfriLabs', website_url: 'https://afrilabs.com', logo_url: null, tier: 'network', sort_order: 5 },
  { name: 'Zindi', website_url: 'https://zindi.africa', logo_url: null, tier: 'network', sort_order: 6 },
  { name: 'Google', website_url: 'https://google.com', logo_url: null, tier: 'strategic', sort_order: 7 },
  { name: 'Stanford', website_url: 'https://coursera.org', logo_url: null, tier: 'institutional', sort_order: 8 },
  { name: 'Kaggle', website_url: 'https://kaggle.com', logo_url: null, tier: 'network', sort_order: 9 },
  { name: 'African Development Bank', website_url: 'https://afdb.org', logo_url: null, tier: 'institutional', sort_order: 10 },
  { name: 'Meta', website_url: 'https://meta.com', logo_url: null, tier: 'strategic', sort_order: 11 },
  { name: 'Mercy Corps', website_url: 'https://mercycorpsventures.org', logo_url: null, tier: 'other', sort_order: 12 },
  { name: 'Orange', website_url: 'https://orange.com', logo_url: null, tier: 'strategic', sort_order: 13 },
  { name: 'Safaricom', website_url: 'https://safaricom.co.ke', logo_url: null, tier: 'strategic', sort_order: 14 },
  { name: 'GSMA', website_url: 'https://gsma.com', logo_url: null, tier: 'network', sort_order: 15 },
];

// Transcribe every record from the prototype's this.seed() resources
// array. Exactly 11 carry status 'live'. Where a URL cannot be
// confirmed working by hand, set status 'pipeline' rather than
// publishing a broken link (PRD 15).
export const SEED_RESOURCES: SeedResource[] = [
  // ... transcribed records
];

export const SEED_PROGRAMMES: { title: string; timeframe: string; description: string; sort_order: number }[] = [
  // ... transcribed from the prototype's programmes array
];

export const SEED_IMPACT_STORIES: { organisation: string; country: string; description: string; sort_order: number }[] = [
  // ... transcribed from the prototype's stories array
];

export const SEED_HEADLINE_STATS: { value: string; label: string; is_hero: boolean; sort_order: number }[] = [
  // ... transcribed from the prototype's settings.stats array
];

export const SEED_COMPUTE_METRICS: { value: string; label: string; sub_note: string | null; sort_order: number }[] = [
  // ... transcribed from the prototype's computeStats array
];

export const SEED_SITE_CONTENT: { key: string; value: string }[] = [
  { key: 'welcome_band_heading', value: '' },
  { key: 'welcome_band_body', value: '' },
  { key: 'welcome_band_cta_label', value: '' },
  { key: 'about_intro', value: '' },
  { key: 'about_alignment', value: '' },
  { key: 'privacy_copy', value: '' },
  { key: 'terms_copy', value: '' },
];
```

**Transcription rules, non-negotiable:**
- `CINECA Leonardo` — no "Mattei Plan" in the title
- `Democratic Republic of the Congo` written in full, never "DRC"
- No "Verified" wording anywhere in a resource description
- Cyber4Africa partners are Cyber 4.0 and Cisco
- Every `external_url` starts `https://`
- Copy `welcome_band_*` and `about_*` text from the prototype's editable blocks, with the §16.1 overrides applied: "co-led by MIMIT and UNDP", never "powered by" or "implemented by"

- [ ] **Step 4: Write `scripts/seed.ts`**

```ts
import { config } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  SEED_PARTNERS, SEED_RESOURCES, SEED_PROGRAMMES, SEED_IMPACT_STORIES,
  SEED_HEADLINE_STATS, SEED_COMPUTE_METRICS, SEED_SITE_CONTENT,
} from './seed-data';

config({ path: process.env.SEED_ENV_FILE ?? '.env.test' });

function admin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Idempotent content seed. Upserts on natural keys so re-running is
 * safe.
 *
 * Deliberately seeds NOTHING into subscribers, submissions,
 * digest_sends or engagement_events. PRD 15 and 8.4: the prototype's
 * subscriber emails and send log are fixtures, and seeding them would
 * place fabricated personal data and a false reporting history into a
 * production UNDP system.
 */
export async function seed(): Promise<void> {
  const db = admin();

  const { error: partnerError } = await db
    .from('partners')
    .upsert(SEED_PARTNERS, { onConflict: 'name' });
  if (partnerError) throw partnerError;

  const { data: partners, error: readError } = await db
    .from('partners')
    .select('id, name');
  if (readError) throw readError;
  const partnerIdByName = new Map(
    (partners ?? []).map((p) => [p.name as string, p.id as string]),
  );

  for (const resource of SEED_RESOURCES) {
    const partnerId = partnerIdByName.get(resource.partner_name);
    if (!partnerId) {
      throw new Error(
        `resource "${resource.name}" names partner "${resource.partner_name}" ` +
        `which is absent from SEED_PARTNERS`,
      );
    }
    const { partner_name: _drop, ...rest } = resource;
    const { error } = await db
      .from('resources')
      .upsert({ ...rest, partner_id: partnerId }, { onConflict: 'name' });
    if (error) throw error;
  }

  for (const [table, rows, conflict] of [
    ['programmes', SEED_PROGRAMMES, 'title'],
    ['impact_stories', SEED_IMPACT_STORIES, 'organisation'],
    ['headline_stats', SEED_HEADLINE_STATS, 'label'],
    ['compute_metrics', SEED_COMPUTE_METRICS, 'label'],
  ] as const) {
    if (rows.length === 0) continue;
    const { error } = await db.from(table).upsert(rows as never, { onConflict: conflict });
    if (error) throw error;
  }

  const { error: contentError } = await db
    .from('site_content')
    .upsert(
      SEED_SITE_CONTENT.map((c) => ({ ...c, locale: 'en' })),
      { onConflict: 'key,locale' },
    );
  if (contentError) throw contentError;
}

if (process.argv[1]?.endsWith('seed.ts')) {
  seed()
    .then(() => {
      console.log('seed complete');
      process.exit(0);
    })
    .catch((err) => {
      console.error('seed failed:', err);
      process.exit(1);
    });
}
```

- [ ] **Step 5: Add the unique constraints the upserts need**

`onConflict` requires a unique constraint on each target. Create `supabase/migrations/0010_seed_constraints.sql`:

```sql
alter table public.resources add constraint resources_name_key unique (name);
alter table public.programmes add constraint programmes_title_key unique (title);
alter table public.impact_stories add constraint impact_stories_org_key unique (organisation);
alter table public.headline_stats add constraint headline_stats_label_key unique (label);
alter table public.compute_metrics add constraint compute_metrics_label_key unique (label);
```

- [ ] **Step 6: Verify every seeded external URL by hand**

```bash
node -e '
const { SEED_RESOURCES } = require("./scripts/seed-data.ts");
' 2>/dev/null || npx tsx -e '
import { SEED_RESOURCES } from "./scripts/seed-data";
for (const r of SEED_RESOURCES) console.log(r.status.padEnd(10), r.external_url);
'
```

For each URL, open it and confirm it resolves to the intended page. PRD §15: **do not treat a failed automated HEAD request as proof of a dead link** — many live sites reject bots. Where a URL cannot be confirmed by hand, set that resource's `status` to `'pipeline'`.

- [ ] **Step 7: Apply, seed, and run the test**

```bash
npm run db:reset
npm test -- tests/seed.test.ts
```

Expected: PASS, all seven cases. If "eleven live" fails, the transcription's live count is wrong — reconcile against the prototype rather than adjusting the assertion.

- [ ] **Step 8: Commit**

```bash
git add scripts/seed.ts scripts/seed-data.ts supabase/migrations/0010_seed_constraints.sql tests/seed.test.ts
git commit -m "feat: idempotent content seed from prototype, no fabricated metrics"
```

---

## Task 13: Supabase clients and admin provisioning

**Files:**
- Create: `src/lib/supabase/browser.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts`, `src/lib/supabase/database.types.ts`, `scripts/provision-admins.ts`
- Test: `tests/unit/supabase-clients.test.ts`

**Interfaces:**
- Consumes: every migration
- Produces: `createBrowserSupabase()`, `createServerSupabase()`, `createAdminSupabase()`, `requireRole(roles: Role[]): Promise<Profile>`

- [ ] **Step 1: Generate the database types**

```bash
npm run db:types
head -20 src/lib/supabase/database.types.ts
```

Expected: a `Database` interface naming the tables and views.

- [ ] **Step 2: Write the failing test**

`tests/unit/supabase-clients.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('supabase client modules', () => {
  it('keeps the service_role key out of any module reachable from the browser', () => {
    const browser = readFileSync('src/lib/supabase/browser.ts', 'utf8');
    expect(browser).not.toMatch(/SERVICE_ROLE/);
    expect(browser).toMatch(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it('marks the admin client server-only', () => {
    const adminSrc = readFileSync('src/lib/supabase/admin.ts', 'utf8');
    expect(adminSrc).toMatch(/^import 'server-only';/m);
    expect(adminSrc).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(adminSrc).not.toMatch(/NEXT_PUBLIC_SUPABASE_SERVICE/);
  });

  it('never prefixes the service_role key with NEXT_PUBLIC_', () => {
    const example = readFileSync('.env.example', 'utf8');
    expect(example).not.toMatch(/NEXT_PUBLIC_.*SERVICE_ROLE/);
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npm test -- tests/unit/supabase-clients.test.ts`
Expected: FAIL — the modules do not exist.

- [ ] **Step 4: Install `server-only` and write the three clients**

```bash
npm install server-only
```

`src/lib/supabase/browser.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

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
 * Request-scoped client carrying the caller's session from httpOnly
 * cookies. Every query it makes is subject to RLS as that user.
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
            // Called from a Server Component render, where cookies are
            // read-only. Session refresh happens in middleware instead.
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
 * Only for: public write endpoints after Zod validation (contact,
 * suggest, subscribe, event log), audit_log writes, and admin
 * provisioning. Never for reading on a user's behalf — that is what
 * createServerSupabase is for, so RLS still applies.
 *
 * The 'server-only' import makes importing this from a Client
 * Component a build error rather than a leaked key.
 */
export function createAdminSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

- [ ] **Step 5: Write the server-side role gate**

`src/lib/auth.ts`:

```ts
import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';

export type Role = 'admin' | 'editor' | 'viewer';

export interface CurrentUser {
  userId: string;
  profileId: string;
  email: string;
  fullName: string;
  displayLabel: string;
  role: Role;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, display_label, role, is_active')
    .eq('user_id', auth.user.id)
    .single();

  if (!profile || !profile.is_active) return null;

  return {
    userId: auth.user.id,
    profileId: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    displayLabel: profile.display_label,
    role: profile.role as Role,
  };
}

/**
 * Re-check the caller's role inside every mutating server action.
 * PRD 3 and 14.4: middleware route gating is UX, not security.
 */
export async function requireRole(allowed: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHENTICATED');
  if (!allowed.includes(user.role)) throw new Error('FORBIDDEN');
  return user;
}
```

- [ ] **Step 6: Write the admin provisioning script**

`scripts/provision-admins.ts`:

```ts
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: process.env.SEED_ENV_FILE ?? '.env.local' });

/**
 * Invite the initial admin accounts. PRD 3 requires at least two so a
 * single lockout does not lock out the team.
 *
 * Addresses come from the client (PRD 16.4 question 7) and are passed
 * on the command line rather than committed:
 *   npx tsx scripts/provision-admins.ts a@undp.org b@undp.org
 */
async function main(): Promise<void> {
  const emails = process.argv.slice(2);
  if (emails.length < 2) {
    console.error('Provide at least two admin email addresses (PRD 3).');
    process.exit(1);
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  for (const email of emails) {
    const { data, error } = await db.auth.admin.inviteUserByEmail(email);
    if (error) {
      console.error(`invite failed for ${email}:`, error.message);
      continue;
    }
    const { error: roleError } = await db
      .from('profiles')
      .update({ role: 'admin' })
      .eq('user_id', data.user.id);
    if (roleError) {
      console.error(`role update failed for ${email}:`, roleError.message);
      continue;
    }
    console.log(`invited ${email} as admin`);
  }

  const { count } = await db
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin')
    .eq('is_active', true);
  console.log(`active admins: ${count}`);
  if ((count ?? 0) < 2) {
    console.error('FEWER THAN TWO ACTIVE ADMINS — PRD 3 lockout risk.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Note: `inviteUserByEmail` requires a working mail provider. Until SPF/DKIM lands, provision instead with `createUser` plus a strong generated password delivered out of band, and record that in the README. The script's admin-count check still applies.

- [ ] **Step 7: Run the test and the build**

```bash
npm test -- tests/unit/supabase-clients.test.ts
npm run build
```

Expected: test PASS, build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/lib/supabase src/lib/auth.ts scripts/provision-admins.ts tests/unit/supabase-clients.test.ts package.json package-lock.json
git commit -m "feat: supabase browser/server/admin clients, server-side role gate, admin provisioning"
```

---

## Task 14: Bundle secret audit and protected Vercel deploy

**Files:**
- Create: `tests/build/no-secrets.test.ts`
- Modify: `next.config.ts`, `README.md`
- Create: `public/robots.txt`

**Interfaces:**
- Consumes: Task 13's clients, Task 1's build
- Produces: a deployed, protected, non-indexable preview URL

- [ ] **Step 1: Write the failing bundle audit test**

`tests/build/no-secrets.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

describe('client bundle secret audit (PRD 14.9 check 6)', () => {
  it('requires a build to have been produced', () => {
    expect(existsSync('.next'), 'run `npm run build` first').toBe(true);
  });

  it('contains no service_role key and no service_role env name', () => {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const clientFiles = walk('.next/static').filter(
      (f) => f.endsWith('.js') || f.endsWith('.map'),
    );
    expect(clientFiles.length).toBeGreaterThan(0);

    for (const file of clientFiles) {
      const contents = readFileSync(file, 'utf8');
      if (serviceKey && serviceKey.length > 20) {
        expect(contents.includes(serviceKey), `${file} contains the service_role key`).toBe(false);
      }
      expect(contents.includes('SUPABASE_SERVICE_ROLE_KEY'), `${file} references the service_role env name`).toBe(false);
    }
  });

  it('contains no JWT with the service_role claim', () => {
    const clientFiles = walk('.next/static').filter((f) => f.endsWith('.js'));
    for (const file of clientFiles) {
      const contents = readFileSync(file, 'utf8');
      // "service_role" appears in the decoded payload; the encoded form
      // of {"role":"service_role" starts with this fragment.
      expect(contents).not.toMatch(/eyJ[\w-]*cm9sZSI6InNlcnZpY2Vfcm9sZSI/);
    }
  });
});
```

- [ ] **Step 2: Run it**

```bash
npm run build
npm test -- tests/build/no-secrets.test.ts
```

Expected: PASS. If it fails, an `admin.ts` import has reached a Client Component — trace it and move the call into a server action. Do not weaken the test.

- [ ] **Step 3: Add the noindex configuration**

`next.config.ts`:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // SP1 ships behind Vercel Deployment Protection for a gated
        // stakeholder review. CSP, HSTS and the rest of the header set
        // are SP4; this only keeps the unhardened build out of indexes.
        source: '/(.*)',
        headers: [
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

`public/robots.txt`:

```
User-agent: *
Disallow: /
```

SP2 replaces this with a real `robots.txt` and `sitemap.xml` at go-live.

- [ ] **Step 4: Push the schema and seed to the hosted EU project**

```bash
npx supabase link --project-ref <project-ref from the Supabase dashboard>
npx supabase db push
SEED_ENV_FILE=.env.local npx tsx scripts/seed.ts
```

Record the project ref and the confirmed EU region in `README.md` under `## Infrastructure`.

- [ ] **Step 5: Deploy to Vercel with protection enabled**

```bash
npx vercel login
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
npx vercel --prod
```

Then in the Vercel dashboard, under Settings → Deployment Protection, enable **Vercel Authentication** (or Password Protection) for production. Confirm by opening the URL in a private window: it must challenge before rendering.

- [ ] **Step 6: Verify the deployed state**

```bash
curl -sI "https://<deployment>.vercel.app/" | grep -i -E "x-robots-tag|x-content-type-options"
```

Expected: `x-robots-tag: noindex, nofollow` and `x-content-type-options: nosniff`.

- [ ] **Step 7: Document what is deliberately outstanding**

Add to `README.md`:

```markdown
## SP1 scope boundary

Shipped: schema, RLS on every table, public-safe views, auth with three
roles, seed, protected deploy.

Deliberately NOT in SP1 — see the SP4 and SP6 sections of
`docs/superpowers/specs/2026-07-26-askhub-decomposition-design.md`:

- CSP and the full security header set
- Cloudflare Turnstile and honeypots on public write endpoints
- Rate limiting on login and public writes
- Tested backup restore
- WCAG 2.1 AA audit
- Core Web Vitals verification
- sitemap.xml and structured data
- GA4 Data API read-back
- Preview branch databases
- Transactional email delivery (externally blocked on SPF/DKIM)

The deploy is behind Vercel Deployment Protection and serves noindex
because of the above. It is not a public go-live.
```

- [ ] **Step 8: Run the full suite and commit**

```bash
npm test
git add -A
git commit -m "feat: bundle secret audit, noindex headers, protected Vercel deploy"
```

Expected: every test passes — Tasks 3 through 14 together cover PRD §14.9 checks 1–6.

---

## Verification: the SP1 exit gate

Run all of these before declaring SP1 done. Do not claim completion on any that has not been run.

```bash
npm run db:reset          # migrations apply cleanly from scratch
npx tsx scripts/seed.ts   # seed runs
npm run build             # app compiles
npm test                  # every test passes
```

Then confirm by hand:

- [ ] `npm test` output shows zero failures, and the RLS suites are present in the run
- [ ] `select count(*) from subscribers` returns 0 in production
- [ ] `select count(*) from engagement_events` returns 0 in production
- [ ] `select count(*) from digest_sends` returns 0 in production
- [ ] No file in the repo contains any figure from the prototype's `GADATA` block — `grep -rn "12840\|14698\|2583\|17650" src scripts supabase` returns nothing
- [ ] At least two active admin accounts exist
- [ ] The production URL challenges for authentication in a private window
- [ ] `README.md` records the Supabase project ref, the confirmed EU region, and the installed Next.js, React and Tailwind versions
