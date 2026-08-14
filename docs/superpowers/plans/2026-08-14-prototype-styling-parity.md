# Prototype Styling Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the public storefront and admin portal visually identical to the approved prototype by transcribing its inline styles verbatim.

**Architecture:** The prototype's server-rendered markup is checked into `docs/prototype/prototype.html` as the single source of truth. Each task transcribes a cited line range into the corresponding React component as literal inline `style` objects, extracts any user-facing text into `locales/en.json`, then verifies with a side-by-side headless-Chrome screenshot. The colour guard that would forbid this is removed in Task 2.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind v4, Vitest, headless Google Chrome for screenshots (already installed; no new dependencies).

**Design spec:** `docs/superpowers/specs/2026-08-14-prototype-styling-parity-design.md`

## Global Constraints

Every task's requirements implicitly include all of these.

- **Styles are copied verbatim; text is not.** Every user-facing string goes to `src/locales/en.json` and is read with `t('key')`. Never inline a literal string in JSX.
- **No prototype content.** No metric, count, statistic, subscriber, or seed value from the prototype enters this codebase. The prototype's numbers are invented; `CLAUDE.md` calls a plausible fake number a launch-blocking defect.
- **No new routes, pages, or features.** Style only what already exists.
- **Attribution is always "co-led by MIMIT and UNDP"** — never "powered by" or "implemented by".
- **Always "AI Hub" or "AI Hub for Sustainable Development"** — never "the Hub" alone.
- **One mailbox only:** `aihubfordevelopment@undp.org`.
- **No per-resource "Verified" badge.**
- **"Democratic Republic of the Congo" in full. "CINECA Leonardo" with no "Mattei Plan".**
- **`feature_innovator_profiles` and `feature_public_impact_page` stay off.** The prototype's innovator screens (lines 441–581) and its "My matches" nav button (lines 22–24) are **not** ported.
- **Do not touch** behaviour, data flow, routing, caching, RLS, server actions, or Zod schemas. This is presentation only.
- **These test files must stay green throughout:** `tests/structure/jsx-literals.test.ts`, `tests/structure/no-hardcoded-copy.test.ts`, `tests/structure/locale-keys.test.ts`, plus every RLS, role-enforcement and server-action suite.

## Reference Index

`docs/prototype/prototype.html` (3,423 lines), created in Task 1. Line ranges below are the authoritative source for each component.

| App file | Prototype lines |
|---|---|
| `SiteHeader.tsx` | 3–28 |
| `WelcomeBand.tsx` | 29–49 |
| `BrowseByNeed.tsx` | 50–82 |
| `StatsBand.tsx` | 83–84 |
| `FeaturedCarousel.tsx` | 85–129 |
| `PartnerRow.tsx` | 130–142 |
| `RecentlyAddedRail.tsx` | 143–174 |
| Directory, `ResourceCard`, `NeedBadge`, `FilterControls`, `ExportButton` | 175–289 |
| Resource detail, `ShareModal` | 290–377 |
| About page | 378–422 |
| Contact page, `ContactForm` | 423–440 |
| Privacy / Terms | 582–594 |
| `SiteFooter.tsx` | 595–631 |
| `SignInForm.tsx`, login page | 632–665 |
| `AdminSidebar.tsx`, `AdminFooter.tsx`, admin layout | 666–690 |
| Admin dashboard, `StatRows` | 691–769 |
| Admin resources, `ResourceTable`, `StatusSelect`, `FeaturedToggle` | 770–841 |
| Admin settings (GA4, feature flags) | 1239–1258 |
| Admin users, `UserTable`, `InviteForm`, `RoleBadge` | 1260–1288 |
| Admin content, `ContentPanel`, `TextAreaField` | 1290–1372 |
| Admin audit, `AuditTable`, `AuditFilters` | 1395–1442 |
| `ResourceForm.tsx` | 1484–1639 |

**Prototype sections with no app equivalent — do not build:** review queue (842–894), reach & engagement (895–1163), alerts & subscribers (1164–1231), updates log (1373–1394), partnerships (1443–1483), innovator screens (441–581), and all modals except the resource form and share pop-up.

**App file with no prototype equivalent:** `src/app/(admin)/admin/set-password/page.tsx` and `SetPasswordForm.tsx`. Task 21 styles it by analogy with the sign-in screen (632–665). This is the plan's one deliberate act of extrapolation.

**App route deliberately not styled:** `src/app/(public)/impact/` is 404-gated behind `feature_public_impact_page`, which is off at launch. It is unreachable, has no prototype counterpart, and gets no task. Leave it exactly as it is.

### The prototype's colour vocabulary

Read from the markup. Use these literal values.

| Hex | Role |
|---|---|
| `#1F5FBF` | Primary — buttons, links, active nav |
| `#174A99` | Primary **hover** |
| `#1A2332` | Body text, wordmark |
| `#2B3A5C` | Marketing-page body copy |
| `#5B6B8C` | Muted / secondary text |
| `#42506E` | Muted text, darker |
| `#DDE5EE` | Hairline borders |
| `#C9D3E8` | Input / pill borders |
| `#C6D2F2` | Borders on tinted surfaces |
| `#A9B8E0` | Muted text on tinted surfaces |
| `#9FB6D9` | Subtitle on deep-blue field |
| `#EEF2FB` | Tint 1 — hover on outlined buttons |
| `#F1F4FA` | Tint 2 — nav hover |
| `#F4F6F9` | Panel / inset background |
| `#003D60` | Deep blue — welcome band |
| `#F06428` | Accent (default of three `accentColor` options) |
| `#C0392B` / `#FBEAE8` | Danger / danger background |

### Typography facts

- Headings: `font-weight:800`, `letter-spacing:-0.02em` (page titles) or `-0.01em` (section titles).
- Page-title sizes are per-page, not from a scale: about 40px, alerts 38px, detail 36px, contact 34px, directory 32px, privacy/terms 30px, welcome band 25px, **every admin page 24px**.
- Section titles: 20px (public), 18px (admin).
- Body sizes include half-pixel values: `16.5px`, `15.5px`, `13.5px`, `12.5px`.
- Root wrapper: `font-family:'Outfit',-apple-system,'Segoe UI',sans-serif; color:#1A2332; background:#FFFFFF; -webkit-font-smoothing:antialiased`.

---

## Task 1: Check in the prototype reference

**Files:**
- Create: `docs/prototype/prototype.html`
- Create: `docs/prototype/README.md`
- Create: `scripts/extract-prototype.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `docs/prototype/prototype.html` — the line-numbered reference every later task cites.

- [ ] **Step 1: Write the extraction script**

```js
// scripts/extract-prototype.mjs
// Recovers the approved prototype from its deployed bundle. The deployed page
// serves only a loading shell: the application is inlined as base64 payloads in
// <script type="__bundler/*"> tags, and the markup arrives as a
// character-indexed JSON object rather than a string.
import fs from 'node:fs';

const URL_ = 'https://startling-rugelach-dd7204.netlify.app/';
const OUT = 'docs/prototype';

const html = await fetch(URL_).then((r) => r.text());

const payload = (kind) => {
  const m = html.match(new RegExp(`<script type="__bundler/${kind}">([\\s\\S]*?)</script>`));
  if (!m) throw new Error(`missing __bundler/${kind} payload`);
  return JSON.parse(m[1].trim());
};

// The template arrives as {0:'<',1:'!',...}. Join it back into a string.
const joinIndexed = (o) =>
  Object.keys(o).sort((a, b) => a - b).map((k) => o[k]).join('');

let markup = joinIndexed(payload('template'));
markup = markup.slice(markup.lastIndexOf('</style>') + 8);

// Pretty-print so line numbers are stable and citable.
const VOID = /^<(img|input|br|hr|meta|link|source|path|circle|rect|line|use|stop)\b/i;
let depth = 0;
const out = [];
for (let line of markup.replace(/>\s*</g, '>\n<').split('\n')) {
  line = line.trim();
  if (!line) continue;
  if (/^<\//.test(line)) depth = Math.max(0, depth - 1);
  out.push('  '.repeat(depth) + line);
  if (
    /^<[a-zA-Z]/.test(line) && !VOID.test(line) && !/\/>$/.test(line) &&
    !/^<!--/.test(line) && !/<\/[a-zA-Z-]+>$/.test(line)
  ) depth++;
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/prototype.html`, out.join('\n'));
console.log(`wrote ${OUT}/prototype.html (${out.length} lines)`);

// The roundel logo, at the resolution the prototype actually ships.
for (const [, v] of Object.entries(payload('manifest'))) {
  const asset = v && typeof v === 'object' && v.mime ? v : JSON.parse(v);
  if (asset.mime === 'image/png') {
    fs.writeFileSync(`${OUT}/askhub-roundel.png`, Buffer.from(asset.data, 'base64'));
    console.log(`wrote ${OUT}/askhub-roundel.png`);
  }
}
```

- [ ] **Step 2: Run it**

Run: `node scripts/extract-prototype.mjs`
Expected: `wrote docs/prototype/prototype.html (3423 lines)` and `wrote docs/prototype/askhub-roundel.png`

- [ ] **Step 3: Verify the reference matches this plan's line index**

Run: `sed -n '5,9p;26p' docs/prototype/prototype.html`
Expected: line 5 is the sticky header `<div>`, line 8 the 40×40 logo `<img>`, line 9 the `askhub-wordmark` span, line 26 the outlined `Admin` button. If the line numbers have drifted, the prototype was redeployed — stop and re-derive the Reference Index before continuing.

- [ ] **Step 4: Write the README**

```markdown
# Prototype reference

`prototype.html` is the client-approved prototype's server-rendered markup,
recovered from its deployed bundle by `scripts/extract-prototype.mjs`. It is the
source of truth for `docs/superpowers/specs/2026-08-14-prototype-styling-parity-design.md`.

It is a **reference, not a dependency**. Nothing imports it and nothing ships it.
Its inline styles are transcribed by hand into components; its copy is not —
all user-facing text lives in `src/locales/en.json`, and its metrics are
invented and must never be seeded.

Line numbers are cited throughout the implementation plan. Regenerate with
`node scripts/extract-prototype.mjs`; if the count changes, the prototype was
redeployed and the plan's line index needs revisiting.
```

- [ ] **Step 5: Commit**

```bash
git add docs/prototype scripts/extract-prototype.mjs
git commit -m "docs(prototype): check in the recovered reference markup"
```

---

## Task 2: Remove the colour guard and reconcile the token tests

**Files:**
- Modify: `tests/structure/app-structure.test.ts` (delete the colour-guard describe block)
- Modify: `CLAUDE.md`
- Modify: `tests/structure/theme-block.test.ts`, `tests/structure/theme-block.ts`
- Modify: `tests/unit/tokens.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a test suite that permits inline `style` objects with colour literals. Every later task depends on this.

- [ ] **Step 1: Confirm the guard currently fails the approach**

Run: `npx vitest run tests/structure/app-structure.test.ts`
Expected: PASS today. Note the describe block named `no hardcoded colour outside the @theme token block` at line 111.

- [ ] **Step 2: Delete the colour-guard block**

Remove the entire `describe('no hardcoded colour outside the @theme token block', ...)` block from `tests/structure/app-structure.test.ts`, together with the explanatory comment above it (lines ~79–110) and any `notation` fixtures used only by it. Leave every other assertion in the file untouched.

- [ ] **Step 3: Strike the rule from CLAUDE.md**

In the `## Conventions` section, delete this line:

```
- No hardcoded colours or type values. Use design tokens.
```

Replace it with:

```
- Colour and type values are transcribed verbatim from the approved prototype;
  `docs/prototype/prototype.html` is the reference. Design tokens remain in
  `globals.css` for anything not covered by it.
```

- [ ] **Step 4: Reconcile the token and theme-block tests**

Run: `npx vitest run tests/structure/theme-block.test.ts tests/unit/tokens.test.ts`

For each failure, the token block is still the authority on what `@theme` contains — keep assertions that check a token exists and holds its documented value, and delete only assertions that require components to *use* tokens rather than literals. Do not delete a whole file to make it pass.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS. If `jsx-literals`, `no-hardcoded-copy` or `locale-keys` fail, you changed something you should not have — revert and redo Step 2.

- [ ] **Step 6: Commit**

```bash
git add tests CLAUDE.md
git commit -m "test: retire the colour guard, and say so in CLAUDE.md

The prototype styles every element with inline style objects, and the client
directed a verbatim port. The guard and that instruction cannot both stand.
Narrower alternatives -- a presentation-layer exception, a palette allowlist --
were offered and declined.

The copy guards are untouched and stay green: styles are copied verbatim,
strings still route through locales/en.json."
```

---

## Task 3: Global CSS and the logo asset

**Files:**
- Modify: `src/app/globals.css`
- Replace: `public/partners/askhub-wordmark.png`

**Interfaces:**
- Consumes: `docs/prototype/askhub-roundel.png` from Task 1.
- Produces: `@keyframes fadeUp`, `@keyframes marquee`, `.askhub-wordmark` — referenced by Tasks 5, 9 and 10.

- [ ] **Step 1: Append the prototype's global rules to `globals.css`**

Add below the existing `body` rule. These are transcribed from the prototype's second `<style>` block:

```css
/*
 * Transcribed from the prototype's global stylesheet. `fadeUp` is its entrance
 * animation, `marquee` drives the partner scroll, and `.askhub-wordmark` hides
 * the header wordmark on narrow screens so the logo and search pill still fit
 * on one row.
 */
* {
  box-sizing: border-box;
}

input,
select,
textarea,
button {
  font-family: inherit;
}

@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes marquee {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}

@media (max-width: 640px) {
  .askhub-wordmark {
    display: none;
  }
}
```

- [ ] **Step 2: Replace the logo with the prototype's resolution**

The current asset is 63×63 but renders at 40×40 — soft on retina. The prototype ships the same mark at 165×165.

```bash
cp docs/prototype/askhub-roundel.png public/partners/askhub-wordmark.png
sips -g pixelWidth -g pixelHeight public/partners/askhub-wordmark.png
```

Expected: `pixelWidth: 165`, `pixelHeight: 165`.

- [ ] **Step 3: Verify the app still builds**

Run: `npm run typecheck && npx vitest run tests/structure`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css public/partners/askhub-wordmark.png
git commit -m "style: add the prototype's keyframes, and a logo that survives retina"
```

---

## Task 4: Screenshot comparison harness

**Files:**
- Create: `scripts/compare-screens.sh`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `docs/prototype/prototype.html`.
- Produces: `scripts/compare-screens.sh <route> <name>` — the verification step of every task from Task 5 onward.

- [ ] **Step 1: Write the harness**

```bash
#!/usr/bin/env bash
# Captures one route from the running dev server at desktop and mobile widths,
# for side-by-side comparison against docs/prototype/prototype.html.
#
# Uses the installed Google Chrome in headless mode: the client chose visual
# comparison specifically to avoid taking on a browser-automation dependency.
set -euo pipefail

ROUTE="${1:?usage: compare-screens.sh <route> <name>}"
NAME="${2:?usage: compare-screens.sh <route> <name>}"
BASE="${BASE_URL:-http://localhost:3000}"
OUT="tmp/screens"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

[ -x "$CHROME" ] || { echo "Google Chrome not found at $CHROME" >&2; exit 1; }
mkdir -p "$OUT"

curl -fsS -o /dev/null "$BASE$ROUTE" || {
  echo "dev server not answering at $BASE$ROUTE -- run 'npm run dev' first" >&2
  exit 1
}

for size in "1440,2400:desktop" "390,1800:mobile"; do
  dims="${size%%:*}"; label="${size##*:}"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
    --virtual-time-budget=6000 \
    --window-size="$dims" \
    --screenshot="$OUT/${NAME}-${label}.png" \
    "$BASE$ROUTE" 2>/dev/null
  echo "wrote $OUT/${NAME}-${label}.png (${dims})"
done
```

- [ ] **Step 2: Make it executable and ignore its output**

```bash
chmod +x scripts/compare-screens.sh
printf '\n# screenshot comparison output\ntmp/\n' >> .gitignore
```

- [ ] **Step 3: Verify it captures the current home page**

```bash
npm run dev &
sleep 8
./scripts/compare-screens.sh / home-before
```

Expected: two PNGs in `tmp/screens/`. Open both and confirm they show the current, unported home page. This is the "before" baseline.

- [ ] **Step 4: Commit**

```bash
git add scripts/compare-screens.sh .gitignore
git commit -m "chore: headless-Chrome screenshot harness for prototype comparison"
```

---

## Task 5: SiteHeader — the worked exemplar

**Every later port task follows this task's shape.** Read it before starting any other.

**Files:**
- Modify: `src/components/public/SiteHeader.tsx`
- Modify: `src/locales/en.json`
- Test: `npx vitest run tests/structure`

**Interfaces:**
- Consumes: `.askhub-wordmark` from Task 3; `scripts/compare-screens.sh` from Task 4.
- Produces: the shell every public screenshot in Tasks 6–18 is captured inside.

**Prototype source:** lines 3–28.

- [ ] **Step 1: Read the prototype source**

Run: `sed -n '3,28p' docs/prototype/prototype.html`

Transcribe from it, exactly: sticky header (`position:sticky; top:0; z-index:50; background:#FFFFFF; border-bottom:1px solid #DDE5EE`); inner rail (`max-width:1180px; margin:0 auto; padding:10px 24px; min-height:68px; display:flex; align-items:center; gap:14px; flex-wrap:wrap`); logo group (`gap:10px`, image 40×40 `object-fit:contain`); wordmark (22px / 800 / `letter-spacing:-0.02em`, class `askhub-wordmark`); search pill (`border:1.5px solid #C9D3E8; border-radius:99px; max-width:430px`, input 13.5px `padding:9px 18px`, button `#1F5FBF` → hover `#174A99`, 13px / 800); nav buttons (14px / 600, `padding:8px 12px`, `border-radius:6px`, hover `#F1F4FA`); Admin button (`border:1.5px solid #1F5FBF`, 12.5px / 600, `letter-spacing:0.06em`, uppercase, `padding:9px 16px`, `border-radius:8px`, hover `#EEF2FB`).

Nav items are **Home, Browse, About, Contact** — then the outlined Admin button. Do **not** port "My matches" (lines 22–24): it is innovator-gated and that flag is off.

- [ ] **Step 2: Add the locale keys**

The prototype's literal strings become keys. Add to `src/locales/en.json`, and add the same keys with the English value to the `fr`, `pt` and `ar` stubs so `locale-keys.test.ts` stays green:

```json
{
  "nav.home": "Home",
  "nav.browse": "Browse",
  "nav.about": "About",
  "nav.contact": "Contact",
  "nav.admin": "Admin",
  "search.placeholder": "Search opportunities",
  "search.submit": "Search"
}
```

If a key already exists with the same meaning, reuse it rather than adding a duplicate.

- [ ] **Step 3: Transcribe the styles**

Rewrite `SiteHeader.tsx` with literal inline `style` objects. Hover and focus states have no inline equivalent in React, so express them with `onMouseEnter`/`onMouseLeave` only if the component is already a client component — otherwise add a scoped rule to `globals.css` and reference it by class. Do not convert the component to a client component solely for a hover colour.

Keep every existing `href`, `Link`, and accessibility attribute. This task changes appearance, not navigation.

- [ ] **Step 4: Verify the guards**

Run: `npm run typecheck && npx vitest run tests/structure`
Expected: PASS. A `no-hardcoded-copy` failure means a literal string survived in JSX — move it to `en.json`.

- [ ] **Step 5: Compare against the prototype**

```bash
npm run dev &
sleep 8
./scripts/compare-screens.sh / header-after
```

Open `tmp/screens/header-after-desktop.png` and `-mobile.png` beside lines 3–28 rendered in the prototype. Confirm: rail width 1180px, header height 68px, wordmark hidden below 640px, search pill fully rounded, Admin button outlined and uppercase. Iterate until they agree.

- [ ] **Step 6: Commit**

```bash
git add src/components/public/SiteHeader.tsx src/locales
git commit -m "style(public): transcribe the prototype's header"
```

---

## Tasks 6–18: Public surface

Each follows Task 5's six steps exactly: read the cited lines, add locale keys to all four locale files, transcribe styles verbatim, run `npm run typecheck && npx vitest run tests/structure`, capture and compare screenshots, commit. Only the differences are noted below.

### Task 6: SiteFooter

**Files:** `src/components/public/SiteFooter.tsx`, `src/locales/*`
**Prototype:** lines 595–631
**Route to capture:** `/`
**Watch for:** attribution must read "co-led by MIMIT and UNDP"; the only mailbox is `aihubfordevelopment@undp.org`. Both are global constraints and the footer is where they most often go wrong.
**Commit:** `style(public): transcribe the prototype's footer`

- [ ] Read the source: `sed -n '595,631p' docs/prototype/prototype.html`
- [ ] Move every literal string into `src/locales/en.json` and the `fr`/`pt`/`ar` stubs
- [ ] Transcribe the styles verbatim into the files listed above
- [ ] Verify: `npm run typecheck && npx vitest run tests/structure` → PASS
- [ ] Compare: `./scripts/compare-screens.sh / footer`, then check both PNGs against lines 595–631
- [ ] Commit with the message above

### Task 7: WelcomeBand and StatsBand

**Files:** `src/components/public/WelcomeBand.tsx`, `StatsBand.tsx`, `src/locales/*`
**Prototype:** lines 29–49 (welcome), 83–84 (stats)
**Route:** `/`
**Watch for:** the band sits on `#003D60` with its subtitle in `#9FB6D9`; the title is 25px/800/`-0.02em`. `StatsBand` must keep rendering only counted figures — the prototype's numbers are invented and must not be copied even as defaults.
**Commit:** `style(public): transcribe the welcome and reach bands`

- [ ] Read the source: `sed -n '29,49p;83,84p' docs/prototype/prototype.html`
- [ ] Move every literal string into `src/locales/en.json` and the `fr`/`pt`/`ar` stubs
- [ ] Transcribe the styles verbatim into the files listed above
- [ ] Verify: `npm run typecheck && npx vitest run tests/structure` → PASS
- [ ] Compare: `./scripts/compare-screens.sh / welcome-band`, then check both PNGs against lines 29–49
- [ ] Commit with the message above

### Task 8: BrowseByNeed and NeedBadge

**Files:** `src/components/public/BrowseByNeed.tsx`, `NeedBadge.tsx`, `src/locales/*`
**Prototype:** lines 50–82
**Route:** `/`
**Watch for:** each need keeps its existing colour pair from `@theme` (`--color-need-compute` etc.) — those tokens were already correct and match the prototype. Transcribe layout and type only.
**Commit:** `style(public): transcribe the browse-by-need menu`

- [ ] Read the source: `sed -n '50,82p' docs/prototype/prototype.html`
- [ ] Move every literal string into `src/locales/en.json` and the `fr`/`pt`/`ar` stubs
- [ ] Transcribe the styles verbatim into the files listed above
- [ ] Verify: `npm run typecheck && npx vitest run tests/structure` → PASS
- [ ] Compare: `./scripts/compare-screens.sh / browse-by-need`, then check both PNGs against lines 50–82
- [ ] Commit with the message above

### Task 9: FeaturedCarousel and PartnerRow

**Files:** `src/components/public/FeaturedCarousel.tsx`, `PartnerRow.tsx`, `src/locales/*`
**Prototype:** lines 85–129 (featured), 130–142 (partner scroll)
**Route:** `/`
**Watch for:** the partner scroll uses `@keyframes marquee` from Task 3, which translates `-50%` and therefore requires the logo list to be **duplicated** in the DOM or it will visibly jump. Respect `prefers-reduced-motion` by pausing the animation.
**Commit:** `style(public): transcribe the featured band and partner scroll`

- [ ] Read the source: `sed -n '85,142p' docs/prototype/prototype.html`
- [ ] Move every literal string into `src/locales/en.json` and the `fr`/`pt`/`ar` stubs
- [ ] Transcribe the styles verbatim into the files listed above
- [ ] Duplicate the partner logo list in the DOM so `marquee`'s `-50%` loops seamlessly
- [ ] Verify: `npm run typecheck && npx vitest run tests/structure` → PASS
- [ ] Compare: `./scripts/compare-screens.sh / featured-partners`, then check both PNGs against lines 85–142
- [ ] Commit with the message above

### Task 10: RecentlyAddedRail

**Files:** `src/components/public/RecentlyAddedRail.tsx`, `src/locales/*`
**Prototype:** lines 143–174
**Route:** `/`
**Watch for:** section title is 20px/800; the rail is `overflow-x:auto` with `gap:14px` and `padding-bottom:8px`.
**Commit:** `style(public): transcribe the recently-added rail`

- [ ] Read the source: `sed -n '143,174p' docs/prototype/prototype.html`
- [ ] Move every literal string into `src/locales/en.json` and the `fr`/`pt`/`ar` stubs
- [ ] Transcribe the styles verbatim into the files listed above
- [ ] Verify: `npm run typecheck && npx vitest run tests/structure` → PASS
- [ ] Compare: `./scripts/compare-screens.sh / recently-added`, then check both PNGs against lines 143–174
- [ ] Commit with the message above

### Task 11: HeroSearch

**Files:** `src/components/public/HeroSearch.tsx`, `src/locales/*`
**Prototype:** the search pill at lines 11–16
**Route:** `/`
**Watch for:** this is the same pill as the header's. Reuse Task 5's values exactly rather than re-deriving them, so the two cannot drift apart.
**Commit:** `style(public): transcribe the hero search`

- [ ] Read the source: `sed -n '11,16p' docs/prototype/prototype.html`
- [ ] Reuse Task 5's pill values exactly — do not re-derive them
- [ ] Reuse the `search.placeholder` and `search.submit` keys Task 5 added
- [ ] Verify: `npm run typecheck && npx vitest run tests/structure` → PASS
- [ ] Compare: `./scripts/compare-screens.sh / hero-search`, then check both PNGs against lines 11–16
- [ ] Commit with the message above

### Task 12: ResourceCard

**Files:** `src/components/public/ResourceCard.tsx`, `src/locales/*`
**Prototype:** within lines 175–289 (the directory grid's card)
**Route:** `/`
**Watch for:** the card is the most-repeated element on the site; get it right before Task 14 renders a grid of them. Preserve the closed-resource rule exactly — a closed resource still lists and still links to its detail page, with only the apply link suppressed. **No "Verified" badge.**
**Commit:** `style(public): transcribe the resource card`

- [ ] Read the source: `sed -n '175,289p' docs/prototype/prototype.html` and locate the repeated card element inside the grid
- [ ] Move every literal string into `src/locales/en.json` and the `fr`/`pt`/`ar` stubs
- [ ] Transcribe the styles verbatim into the files listed above
- [ ] Confirm a closed resource still renders and still links to its detail page, with only the apply link suppressed
- [ ] Verify: `npm run typecheck && npx vitest run tests/structure tests/unit/deadline-label.test.ts` → PASS
- [ ] Compare: `./scripts/compare-screens.sh / resource-card`, then check both PNGs against the card in lines 175–289
- [ ] Commit with the message above

### Task 13: FilterControls and ExportButton

**Files:** `src/components/public/FilterControls.tsx`, `ExportButton.tsx`, `src/locales/*`
**Prototype:** within lines 175–289
**Route:** `/`
**Watch for:** do not port the alerts pill at lines 236–289 — it is feature-gated off. Country filter options must **not** include "Global programmes".
**Commit:** `style(public): transcribe the directory filters and export`

- [ ] Read the source: `sed -n '175,235p' docs/prototype/prototype.html` — stop at 235, the alerts pill below it is feature-gated off
- [ ] Move every literal string into `src/locales/en.json` and the `fr`/`pt`/`ar` stubs
- [ ] Transcribe the styles verbatim into the files listed above
- [ ] Confirm the country filter offers no "Global programmes" option
- [ ] Verify: `npm run typecheck && npx vitest run tests/structure tests/unit/filters.test.ts tests/unit/export.test.ts` → PASS
- [ ] Compare: `./scripts/compare-screens.sh / directory-filters`, then check both PNGs against lines 175–235
- [ ] Commit with the message above

### Task 14: Directory grid

**Files:** `src/components/public/ResourceGrid.tsx`, `ResourceDirectoryStatic.tsx`, `ResourceDirectoryClient.tsx`, `src/locales/*`
**Prototype:** lines 175–235
**Route:** `/`
**Watch for:** `ResourceDirectoryStatic` is the prerendered Suspense fallback and `ResourceDirectoryClient` the hydrated view. **They must be styled identically** or the page will visibly shift on hydration. Directory title is 32px/800/`-0.02em`.
**Commit:** `style(public): transcribe the directory grid`

- [ ] Read the source: `sed -n '175,235p' docs/prototype/prototype.html`
- [ ] Move every literal string into `src/locales/en.json` and the `fr`/`pt`/`ar` stubs
- [ ] Apply identical styles to `ResourceDirectoryStatic` and `ResourceDirectoryClient`
- [ ] Verify no hydration shift: load `/` with JS disabled, then enabled, and confirm the grid does not move
- [ ] Verify: `npm run typecheck && npx vitest run tests/structure` → PASS
- [ ] Compare: `./scripts/compare-screens.sh / directory-grid`, then check both PNGs against lines 175–235
- [ ] Commit with the message above

### Task 15: Resource detail and ShareModal

**Files:** `src/app/(public)/resources/[id]/page.tsx`, `src/components/public/ShareModal.tsx`, `src/locales/*`
**Prototype:** lines 290–377
**Route:** `/resources/<any live id>`
**Watch for:** title 36px/800/`-0.02em`/`line-height:1.15`/`text-wrap:balance`; partner line 15px/700/`#1F5FBF`. Related-resources grid is `repeat(3,1fr)` with `gap:16px`. Do not alter the JSON-LD.
**Commit:** `style(public): transcribe the resource detail page`

- [ ] Read the source: `sed -n '290,377p' docs/prototype/prototype.html`
- [ ] Move every literal string into `src/locales/en.json` and the `fr`/`pt`/`ar` stubs
- [ ] Transcribe the styles verbatim into the files listed above
- [ ] Leave the JSON-LD block untouched
- [ ] Verify: `npm run typecheck && npx vitest run tests/structure tests/unit/jsonld.test.ts` → PASS
- [ ] Compare: `./scripts/compare-screens.sh /resources/<live-id> resource-detail`, then check both PNGs against lines 290–377
- [ ] Commit with the message above

### Task 16: About page

**Files:** `src/app/(public)/about/page.tsx`, `src/locales/*`
**Prototype:** lines 378–422
**Route:** `/about`
**Watch for:** largest page title on the site, 40px/800/`-0.02em`/`line-height:1.12`/`text-wrap:balance`; body copy 16.5px/`line-height:1.7`/`#2B3A5C`. "Democratic Republic of the Congo" in full; "CINECA Leonardo" with no "Mattei Plan".
**Commit:** `style(public): transcribe the about page`

- [ ] Read the source: `sed -n '378,422p' docs/prototype/prototype.html`
- [ ] Move every literal string into `src/locales/en.json` and the `fr`/`pt`/`ar` stubs
- [ ] Transcribe the styles verbatim into the files listed above
- [ ] Confirm "Democratic Republic of the Congo" in full and "CINECA Leonardo" with no "Mattei Plan"
- [ ] Verify: `npm run typecheck && npx vitest run tests/structure` → PASS
- [ ] Compare: `./scripts/compare-screens.sh /about about`, then check both PNGs against lines 378–422
- [ ] Commit with the message above

### Task 17: Contact page and ContactForm

**Files:** `src/app/(public)/contact/page.tsx`, `src/components/public/ContactForm.tsx`, `src/locales/*`
**Prototype:** lines 423–440
**Route:** `/contact`
**Watch for:** title 34px/800/`-0.02em`. The mailbox is `aihubfordevelopment@undp.org` and no other. Do not change the form's submission behaviour or validation.
**Commit:** `style(public): transcribe the contact page`

- [ ] Read the source: `sed -n '423,440p' docs/prototype/prototype.html`
- [ ] Move every literal string into `src/locales/en.json` and the `fr`/`pt`/`ar` stubs
- [ ] Transcribe the styles verbatim into the files listed above
- [ ] Confirm `aihubfordevelopment@undp.org` is the only mailbox, and leave submission and validation untouched
- [ ] Verify: `npm run typecheck && npx vitest run tests/structure` → PASS
- [ ] Compare: `./scripts/compare-screens.sh /contact contact`, then check both PNGs against lines 423–440
- [ ] Commit with the message above

### Task 18: Privacy and Terms

**Files:** `src/app/(public)/privacy/page.tsx`, `src/app/(public)/terms/page.tsx`, `src/locales/*`
**Prototype:** lines 582–594
**Routes:** `/privacy`, `/terms`
**Watch for:** both titles 30px/800; body 15.5px/`line-height:1.7`/`#2B3A5C`. Two routes, one shared treatment — capture both.
**Commit:** `style(public): transcribe the privacy and terms pages`

- [ ] Read the source: `sed -n '582,594p' docs/prototype/prototype.html`
- [ ] Move every literal string into `src/locales/en.json` and the `fr`/`pt`/`ar` stubs
- [ ] Transcribe the styles verbatim into both pages
- [ ] Verify: `npm run typecheck && npx vitest run tests/structure` → PASS
- [ ] Compare: `./scripts/compare-screens.sh /privacy privacy` and `./scripts/compare-screens.sh /terms terms`, checking all four PNGs against lines 582–594
- [ ] Commit with the message above

---

## Tasks 19–28: Admin surface

Same six steps. Admin page titles are **uniformly 24px/800/`letter-spacing:-0.01em`**, with a 13px `#5B6B8C` subtitle beneath — unlike the public pages, this is a real scale. Section headings are 18px/800/`-0.01em`.

### Capturing authenticated screens

Every route below `/admin` requires a session. Headless Chrome starts with no cookies and will photograph the login redirect instead of the screen you are working on. Before Task 20, create a reusable signed-in profile **once**:

```bash
# One-time: open headed Chrome against a throwaway profile and sign in by hand.
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --user-data-dir="$PWD/tmp/chrome-profile" http://localhost:3000/admin/login
```

Then point the harness at that profile for admin routes:

```bash
CHROME_PROFILE="$PWD/tmp/chrome-profile" ./scripts/compare-screens.sh /admin admin-dash
```

Add this to `scripts/compare-screens.sh` — insert into the `"$CHROME"` invocation, before the `--screenshot` flag:

```bash
    ${CHROME_PROFILE:+--user-data-dir="$CHROME_PROFILE"} \
```

`tmp/` is already ignored (Task 4), so the profile and its session never reach the repository. Sign in as an **administrator** for Tasks 20–28, and additionally capture one screen as a **viewer** in Task 23 to confirm no write affordance appears.

### Task 19: SignInForm and login page

**Files:** `src/app/(admin)/admin/login/page.tsx`, `src/components/admin/SignInForm.tsx`, `src/locales/*`
**Prototype:** lines 632–665
**Route:** `/admin/login`
**Watch for:** the screen carries its own centred shell — logo, "Team admin" label, "Sign in", the line "Authorised AI Hub team access only.", and a "← Back to AskHub" link. It does **not** use the public header. Preserve `signIn`'s single-message invariant: the error text must not distinguish unknown email from wrong password.
**Commit:** `style(admin): transcribe the sign-in screen`

- [ ] Read the source: `sed -n '632,665p' docs/prototype/prototype.html`
- [ ] Move every literal string into `src/locales/en.json` and the `fr`/`pt`/`ar` stubs
- [ ] Transcribe the styles verbatim — this screen has its own centred shell, not the public header
- [ ] Confirm the error text still cannot distinguish unknown email from wrong password
- [ ] Verify: `npm run typecheck && npx vitest run tests/structure tests/unit/auth.test.ts` → PASS
- [ ] Compare: `./scripts/compare-screens.sh /admin/login admin-login` (no profile needed), then check both PNGs against lines 632–665
- [ ] Commit with the message above

### Task 20: Admin shell

**Files:** `src/components/admin/AdminSidebar.tsx`, `AdminFooter.tsx`, `src/app/(admin)/layout.tsx`, `src/locales/*`
**Prototype:** lines 666–690
**Route:** `/admin`
**Watch for:** sidebar carries the logo, an "Admin" label, the nav list, then user name, role, "View site" and "Sign out" at the foot. Render only the nav entries whose routes exist — the prototype's review queue, reach, subscribers, updates and partnerships links have no destination here and must not be added as dead links.
**Commit:** `style(admin): transcribe the admin shell`

- [ ] Create the signed-in Chrome profile described above, and patch `scripts/compare-screens.sh`
- [ ] Read the source: `sed -n '666,690p' docs/prototype/prototype.html`
- [ ] Move every literal string into `src/locales/en.json` and the `fr`/`pt`/`ar` stubs
- [ ] Transcribe the styles verbatim; render nav entries only for routes that exist
- [ ] Verify: `npm run typecheck && npx vitest run tests/structure tests/unit/admin-nav.test.ts` → PASS
- [ ] Compare: `CHROME_PROFILE="$PWD/tmp/chrome-profile" ./scripts/compare-screens.sh /admin admin-shell`, then check both PNGs against lines 666–690
- [ ] Commit with the message above

### Task 21: Set-password screen (extrapolated)

**Files:** `src/app/(admin)/admin/set-password/page.tsx`, `src/components/admin/SetPasswordForm.tsx`, `src/locales/*`
**Prototype:** none. Style by analogy with sign-in, lines 632–665.
**Route:** `/admin/set-password`
**Watch for:** this is the plan's one deliberate extrapolation. Reuse the sign-in shell's exact values — same centred card, same field and button treatment — so it reads as the same family. Invent nothing new; if a decision is not answerable from lines 632–665, flag it in the commit body rather than guessing.
**Commit:** `style(admin): give set-password the sign-in screen's treatment`

- [ ] Read the source: `sed -n '632,665p' docs/prototype/prototype.html` — the analogue, not an equivalent
- [ ] Move every literal string into `src/locales/en.json` and the `fr`/`pt`/`ar` stubs
- [ ] Reuse the sign-in shell's exact card, field and button values; invent nothing
- [ ] List any decision not answerable from lines 632–665 in the commit body
- [ ] Verify: `npm run typecheck && npx vitest run tests/structure` → PASS
- [ ] Compare: `./scripts/compare-screens.sh /admin/set-password admin-set-password` against the sign-in capture, confirming they read as one family
- [ ] Commit with the message above

### Task 22: Dashboard

**Files:** `src/app/(admin)/admin/page.tsx`, `src/components/admin/StatRows.tsx`, `EmptyState.tsx`, `src/locales/*`
**Prototype:** lines 691–769
**Route:** `/admin`
**Watch for:** **the highest-risk task in the plan.** The prototype's dashboard is full of invented figures. Port the tile treatment — `repeat(4,1fr)`, `gap:14px` — and nothing else. Every figure stays whatever the current code computes, and a figure with no true value keeps its explicit empty state via `EmptyState`. Copying a single number from the prototype is a launch-blocking defect.
**Commit:** `style(admin): transcribe the dashboard tiles, not their invented figures`

- [ ] Read the source: `sed -n '691,769p' docs/prototype/prototype.html`
- [ ] Move every literal **label** into `src/locales/en.json` and the `fr`/`pt`/`ar` stubs — labels only, never figures
- [ ] Transcribe the tile treatment (`repeat(4,1fr)`, `gap:14px`) and nothing else
- [ ] Confirm every figure still comes from the current computation, and that `EmptyState` still covers figures with no true value
- [ ] Diff-check for leaked numbers: `git diff -- src/app/\(admin\)/admin/page.tsx src/components/admin/StatRows.tsx | grep -nE '^\+.*[0-9]{2,}'` — every hit must be a style value
- [ ] Verify: `npm run typecheck && npx vitest run tests/structure` → PASS
- [ ] Compare: `CHROME_PROFILE="$PWD/tmp/chrome-profile" ./scripts/compare-screens.sh /admin admin-dash`, then check both PNGs against lines 691–769
- [ ] Commit with the message above

### Task 23: Resources table

**Files:** `src/components/admin/ResourceTable.tsx`, `StatusSelect.tsx`, `FeaturedToggle.tsx`, `ConfirmDeleteButton.tsx`, `src/app/(admin)/admin/resources/page.tsx`, `src/locales/*`
**Prototype:** lines 770–841
**Route:** `/admin/resources`
**Watch for:** deadline tabs and filters keep their current behaviour. A past deadline shows as Closed and is flagged, but `status` does not change. `viewer` must still see no write affordances — `admin-write-affordances.test.ts` guards this and must stay green.
**Commit:** `style(admin): transcribe the resources table`

- [ ] Read the source: `sed -n '770,841p' docs/prototype/prototype.html`
- [ ] Move every literal string into `src/locales/en.json` and the `fr`/`pt`/`ar` stubs
- [ ] Transcribe the styles verbatim into the files listed above
- [ ] Confirm a past deadline shows Closed and is flagged, while `status` is unchanged
- [ ] Verify: `npm run typecheck && npx vitest run tests/structure tests/unit/deadline.test.ts` → PASS
- [ ] Compare as administrator: `CHROME_PROFILE="$PWD/tmp/chrome-profile" ./scripts/compare-screens.sh /admin/resources admin-resources`
- [ ] Capture again signed in as a **viewer** and confirm no write affordance is visible
- [ ] Commit with the message above

### Task 24: ResourceForm

**Files:** `src/components/admin/ResourceForm.tsx`, `src/app/(admin)/admin/resources/new/page.tsx`, `src/app/(admin)/admin/resources/[id]/page.tsx`, `src/locales/*`
**Prototype:** lines 1484–1639
**Routes:** `/admin/resources/new`, `/admin/resources/<id>`
**Watch for:** the longest single transcription in the plan (155 lines). The prototype renders it as a modal; here it is a page — keep the page layout and port the field, label, and control treatment. Do not touch Zod validation or the unresolvable-partner guard.
**Commit:** `style(admin): transcribe the resource form`

- [ ] Read the source: `sed -n '1484,1639p' docs/prototype/prototype.html`
- [ ] Move every literal string into `src/locales/en.json` and the `fr`/`pt`/`ar` stubs
- [ ] Transcribe field, label and control treatment onto the existing **page** layout — do not rebuild it as a modal
- [ ] Leave Zod validation and the unresolvable-partner guard untouched
- [ ] Verify: `npm run typecheck && npx vitest run tests/structure tests/unit/resource-schema.test.ts tests/unit/resource-actions.test.ts` → PASS
- [ ] Compare: `CHROME_PROFILE="$PWD/tmp/chrome-profile" ./scripts/compare-screens.sh /admin/resources/new admin-resource-form`, then check both PNGs against lines 1484–1639
- [ ] Commit with the message above

### Task 25: Site content

**Files:** `src/components/admin/ContentPanel.tsx`, `TextAreaField.tsx`, `EntityRows.tsx`, `src/app/(admin)/admin/content/page.tsx`, `src/locales/*`
**Prototype:** lines 1290–1372
**Route:** `/admin/content`
**Watch for:** the prototype consolidates this into its Settings screen; here it is its own route. Port the panel and field treatment onto the existing six editor-writable areas. Content edits must still appear without a rebuild — do not disturb `revalidateTag`/`revalidatePath` calls.
**Commit:** `style(admin): transcribe the site content panels`

- [ ] Read the source: `sed -n '1290,1372p' docs/prototype/prototype.html`
- [ ] Move every literal string into `src/locales/en.json` and the `fr`/`pt`/`ar` stubs
- [ ] Transcribe the panel and field treatment onto the existing six editor-writable areas
- [ ] Leave every `revalidateTag` / `revalidatePath` call untouched so edits still appear without a rebuild
- [ ] Verify: `npm run typecheck && npx vitest run tests/structure tests/unit/content-schema.test.ts` → PASS
- [ ] Compare: `CHROME_PROFILE="$PWD/tmp/chrome-profile" ./scripts/compare-screens.sh /admin/content admin-content`, then check both PNGs against lines 1290–1372
- [ ] Commit with the message above

### Task 26: Settings

**Files:** `src/components/admin/SettingsForm.tsx`, `src/app/(admin)/admin/settings/page.tsx`, `src/locales/*`
**Prototype:** lines 1239–1258
**Route:** `/admin/settings`
**Watch for:** covers the GA4 measurement ID block and the feature-flag rows. Both flags stay off. The GA4 status pill takes its colour from live state — keep whatever the current code computes; do not hardcode "connected".
**Commit:** `style(admin): transcribe the settings screen`

- [ ] Read the source: `sed -n '1239,1258p' docs/prototype/prototype.html`
- [ ] Move every literal string into `src/locales/en.json` and the `fr`/`pt`/`ar` stubs
- [ ] Transcribe the styles verbatim; both feature flags stay off
- [ ] Confirm the GA4 status pill still derives its label and colour from live state
- [ ] Verify: `npm run typecheck && npx vitest run tests/structure tests/unit/settings-schema.test.ts` → PASS
- [ ] Compare: `CHROME_PROFILE="$PWD/tmp/chrome-profile" ./scripts/compare-screens.sh /admin/settings admin-settings`, then check both PNGs against lines 1239–1258
- [ ] Commit with the message above

### Task 27: Users

**Files:** `src/components/admin/UserTable.tsx`, `InviteForm.tsx`, `RoleBadge.tsx`, `SignOutButton.tsx`, `src/app/(admin)/admin/users/page.tsx`, `src/locales/*`
**Prototype:** lines 1260–1288 (the "Team access" block inside Settings)
**Route:** `/admin/users`
**Watch for:** columns are Email, Role, Added, Last sign-in, plus a remove control; roles render as Administrator / Editor / Viewer. Keep the guard preventing an admin from locking themselves out, and keep the invitation link's destination working.
**Commit:** `style(admin): transcribe the team access table`

- [ ] Read the source: `sed -n '1260,1288p' docs/prototype/prototype.html`
- [ ] Move every literal string into `src/locales/en.json` and the `fr`/`pt`/`ar` stubs
- [ ] Transcribe the columns Email, Role, Added, Last sign-in, plus the remove control
- [ ] Confirm the lock-out guard still holds and the invitation link still resolves
- [ ] Verify: `npm run typecheck && npx vitest run tests/structure tests/unit/user-actions.test.ts tests/unit/user-schema.test.ts` → PASS
- [ ] Compare: `CHROME_PROFILE="$PWD/tmp/chrome-profile" ./scripts/compare-screens.sh /admin/users admin-users`, then check both PNGs against lines 1260–1288
- [ ] Commit with the message above

### Task 28: Audit log

**Files:** `src/components/admin/AuditTable.tsx`, `AuditFilters.tsx`, `src/app/(admin)/admin/audit/page.tsx`, `src/locales/*`
**Prototype:** lines 1395–1442
**Route:** `/admin/audit`
**Watch for:** `audit_log` is append-only and read-only in the UI — add no affordance implying otherwise. Filters stay a plain GET form. The `digest_sent` badge keeps its neutral grey (`--color-neutral`), which has no prototype equivalent and is deliberate.
**Commit:** `style(admin): transcribe the audit log`

- [ ] Read the source: `sed -n '1395,1442p' docs/prototype/prototype.html`
- [ ] Move every literal string into `src/locales/en.json` and the `fr`/`pt`/`ar` stubs
- [ ] Transcribe the styles verbatim; add no affordance implying the log is writable
- [ ] Keep the filters a plain GET form, and keep `digest_sent` on `--color-neutral`
- [ ] Verify: `npm run typecheck && npx vitest run tests/structure tests/unit/audit-view.test.ts` → PASS
- [ ] Compare: `CHROME_PROFILE="$PWD/tmp/chrome-profile" ./scripts/compare-screens.sh /admin/audit admin-audit`, then check both PNGs against lines 1395–1442
- [ ] Commit with the message above

---

## Task 29: Full sweep and verification

**Files:** none modified unless the sweep finds a defect.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS, with no suite skipped. Record the count.

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: succeeds. Confirm `/` still prerenders — the directory's static fallback must survive the port.

- [ ] **Step 4: Capture every route at both widths**

```bash
npm run dev &
sleep 8
for r in "/:home" "/about:about" "/contact:contact" "/privacy:privacy" "/terms:terms" \
         "/admin/login:admin-login" "/admin:admin-dash" "/admin/resources:admin-resources" \
         "/admin/content:admin-content" "/admin/settings:admin-settings" \
         "/admin/users:admin-users" "/admin/audit:admin-audit"; do
  ./scripts/compare-screens.sh "${r%%:*}" "${r##*:}"
done
```

Compare each against its cited prototype lines. Any route that still disagrees goes back to its task.

- [ ] **Step 5: Confirm no invented data entered the codebase**

```bash
git diff main --stat
git diff main -- src/ | grep -nE '^\+.*[0-9]{3,}' | grep -viE 'px|em|rem|%|#[0-9a-f]|z-index|width|height|max-|min-|radius|weight' || echo "no suspicious numeric literals"
```

Review every hit. A number that is not a style value has no business in this diff.

- [ ] **Step 6: Confirm the copy rules hold**

```bash
grep -rniE 'powered by|implemented by' src/ && echo "ATTRIBUTION DEFECT" || echo "attribution ok"
grep -rnE '\bthe Hub\b' src/ && echo "NAMING DEFECT" || echo "naming ok"
grep -rniE 'mattei plan|global programmes' src/ && echo "CONTENT DEFECT" || echo "content ok"
grep -rniE '@undp\.org' src/ src/locales | grep -v 'aihubfordevelopment@undp.org' && echo "MAILBOX DEFECT" || echo "mailbox ok"
```

Expected: all four report ok.

- [ ] **Step 7: Commit and open for review**

```bash
git add -A
git commit -m "style: complete the prototype styling parity sweep"
```

Then use `superpowers:requesting-code-review`. The reviewer should be pointed at `docs/prototype/prototype.html` and this plan's Reference Index so they can check transcriptions against the same source.

---

## Notes for the implementer

**When the prototype and the codebase disagree about structure**, the codebase wins. The prototype is a client-side SPA with modals and consolidated screens; this is a server-rendered app with routes. Port the *appearance*, not the architecture. Task 24 and Task 25 are both cases of this.

**When a value is not in the cited lines**, do not invent one. Say so in the commit body and flag it at review. Task 21 is the only place extrapolation is sanctioned, and even there the source is a specific line range.

**Hover and focus states** appear in the prototype as `style-hover` and `style-focus` attributes, which are not real HTML. They still need implementing — as a scoped class in `globals.css`, or via event handlers on components that are already client components. Do not convert a server component to a client component solely for a hover colour.

**If a screenshot comparison is ambiguous**, it is not done. The whole reason this verification method was chosen over a pixel threshold is that a human judgement is being applied — apply it.
