# Prototype styling parity — design

Date: 2026-08-14
Status: awaiting review
Reference prototype: `https://startling-rugelach-dd7204.netlify.app/#/`
Branch base: `worktree-styling-drift-fixes`

## Context

The client's approved prototype is a single-page React application deployed to Netlify. The
built application in this repository shares its palette and its font, but not its visual
execution: headings, spacing, weights, radii and hover states were rebuilt with Tailwind
defaults rather than transcribed. The instruction is that both the public storefront and the
admin portal match the prototype exactly.

### The prototype is fully recoverable, and was recovered

The deployed page is a ~960KB HTML file with the entire application inlined as base64 payloads
inside `<script type="__bundler/*">` tags. Fetching the URL yields only a loading shell, so the
prototype was instead decoded into:

- **`template.html`** — 297,656 characters of server-rendered markup, reassembled from a
  character-indexed JSON object. This carries every element with its literal inline styles, for
  the public shell *and* the admin portal.
- **Two woff2 files** — Outfit, latin and latin-ext subsets.
- **One PNG** — the AskHub roundel logo, 165×165.

This markup, not a screenshot or a reading of the rendered page, is the source of truth for
this work. Every value in this document was read out of it.

### What is already correct

Two findings materially reduce scope:

| Asset | Finding |
|---|---|
| Outfit woff2, both subsets | **Byte-identical.** `public/fonts/outfit-latin.woff2` and `outfit-latin-ext.woff2` hash-match the prototype's embedded fonts (`92684e4a…`, `9e38b3f1…`). No font work. |
| Colour palette | **~80% correct.** `@theme` in `src/app/globals.css` already carries the prototype's most-used colours. The defect is omission, not error. |

### What is wrong

**Colours with no token.** Read from the markup, with their actual roles:

| Hex | Uses | Role in the prototype |
|---|---|---|
| `#174A99` | 24 | Primary button **hover** — the darker step under `#1F5FBF` |
| `#2B3A5C` | 18 | Standard body-copy colour on marketing pages |
| `#F4F6F9` | 17 | Panel / inset background |
| `#C6D2F2` | 8 | Border on tinted surfaces |
| `#A9B8E0` | 6 | Muted text on tinted surfaces |
| `#4FB0AE` | 5 | Alternate brand accent — one of the prototype's three `accentColor` options |
| `#9FB6D9` | 1 | Welcome-band subtitle on the deep-blue field |

The prototype exposes `accentColor` as a configurable property defaulting to `#F06428`, with
`#FFB81C` and `#4FB0AE` as the alternates, threaded through the shell as a `--acc` custom
property. Only the default is in use; the other two are recorded here so the port does not
mistake them for stray values.

Colours already tokenised and correct, confirmed against `globals.css` rather than assumed:
`#F1F4FA` (`--color-tint-2`, 30 uses, nav hover), `#0E7A8A` / `#E6F3F5` (`--color-need-training*`).

**Typography.** The prototype is emphatic and tightly tracked; the build is not.

- Headings are `font-weight:800` almost without exception, with `letter-spacing:-0.02em` on page
  titles and `-0.01em` on section titles. `ResourceCard.tsx:44` currently renders
  `text-lg font-semibold`.
- Body sizes include half-pixel values — `16.5px`, `15.5px`, `13.5px` — that no Tailwind step
  produces.
- Page-title sizes are per-page rather than from a scale: 40px (about), 38px (alerts), 36px
  (detail), 34px (contact), 32px (directory), 30px (privacy/terms), 28px (innovator), 25px
  (welcome band), 24px (every admin page).

**Missing CSS.** The prototype defines `@keyframes fadeUp`, `@keyframes marquee`, and
`@media (max-width:640px){.askhub-wordmark{display:none}}`. `globals.css` has none of these.

**Logo under-resolution.** `public/partners/askhub-wordmark.png` is 63×63 but renders at 40×40 —
about 1.6× density, visibly soft on retina. The prototype's asset is the same mark at 165×165.

## Decisions

| # | Decision | Reason |
|---|---|---|
| D1 | Port the prototype's **inline `style` objects verbatim** | Directed by the client. Highest literal fidelity, no translation step in which values drift. |
| D2 | **Delete the colour guard** in `tests/structure/app-structure.test.ts` and strike the no-hardcoded-colours rule from `CLAUDE.md` | D1 is impossible while the guard stands. Directed by the client after the narrower alternatives — a presentation-layer exception, or a palette allowlist — were declined. The rule is removed rather than left to fail, so the documentation does not contradict the code. |
| D3 | **Strings still route through `locales/en.json`** | `jsx-literals`, `no-hardcoded-copy` and `locale-keys` guards remain green, and the fr/pt/ar stubs stay meaningful. This is the one respect in which the port is not literally verbatim. Styles are copied; text is not. |
| D4 | **No prototype content is copied** | The prototype is populated with invented metrics. `CLAUDE.md` calls a plausible fake number a launch-blocking defect on a UN reporting surface. |
| D5 | **Style what exists; build nothing new** | The prototype's admin includes review queue, reach & engagement, subscribers, partnerships and updates screens that this application does not have. Adding them is a feature, not styling. |
| D6 | Check the extracted markup into **`docs/prototype/`** | Reviewers can diff against the same source of truth, and future drift can be re-checked without re-deriving the bundle. |
| D7 | Verify by **side-by-side screenshot per route**, at desktop and mobile | The task is defined visually, so acceptance must be visual. No route is complete until both captures have been compared. |
| D8 | Base the work on **`worktree-styling-drift-fixes`** | It is two commits ahead and already modifies six of the files this work rewrites. Rebasing later would resolve the same conflicts twice. |

## Scope

### In

- Public: home, resources directory, resource detail, about, contact, privacy, terms — 7 pages,
  18 components.
- Admin: dashboard, resources (list, new, edit), content, settings, audit, users, login,
  set-password — 10 pages, 21 components.
- `src/app/globals.css`: keyframes, the mobile wordmark rule, token reconciliation.
- `public/partners/askhub-wordmark.png`: replaced with the 165×165 asset.

### Out

- Any screen the prototype has and this application does not (D5).
- Any prototype copy, metric or seed value (D4).
- Innovator profile screens — `feature_innovator_profiles` is off at launch, per `CLAUDE.md`.
- Behaviour, data flow, routing, caching, RLS. This work changes presentation only.

## Guard and test reconciliation

| File | Action |
|---|---|
| `tests/structure/app-structure.test.ts` | Delete the colour-guard block (D2). Leave the remaining structural assertions. |
| `tests/structure/theme-block.test.ts`, `theme-block.ts` | Reconcile with the token block after the port supersedes parts of it. |
| `tests/unit/tokens.test.ts` | Same. `worktree-styling-drift-fixes` already adds ~70 lines here. |
| `tests/structure/jsx-literals.test.ts` | **Must stay green** (D3). |
| `tests/structure/no-hardcoded-copy.test.ts` | **Must stay green** (D3). |
| `tests/structure/locale-keys.test.ts` | **Must stay green** (D3). |
| `CLAUDE.md` | Remove "No hardcoded colours or type values. Use design tokens." from Conventions. |

Every other suite — RLS, role enforcement, server actions, deadline computation, export field
exclusion — must pass unchanged. A styling change that alters one of those has overreached.

## Port order

Shell first: every downstream screenshot comparison depends on the header, footer and admin
chrome being right.

1. **`globals.css`** — keyframes, mobile wordmark rule.
2. **Logo asset** — 165×165 replacement.
3. **Public shell** — `SiteHeader`, `SiteFooter`, `(public)/layout.tsx`.
4. **Admin shell** — `AdminSidebar`, `AdminFooter`, `(admin)/layout.tsx`.
5. **Public components** — 18 files.
6. **Public pages** — 7 files.
7. **Admin components** — 21 files.
8. **Admin pages** — 10 files.

### Worked example: the public header

Transcribed from the extracted markup, this is the fidelity level every file is held to.

- Sticky, `z-index:50`, background `#FFFFFF`, `border-bottom:1px solid #DDE5EE`.
- Inner rail `max-width:1180px`, `margin:0 auto`, `padding:10px 24px`, `min-height:68px`,
  flex, `gap:14px`, wrapping.
- Logo 40×40, `object-fit:contain`; wordmark 22px / weight 800 / `letter-spacing:-0.02em`,
  hidden below 640px via `.askhub-wordmark`.
- Search pill: `border:1.5px solid #C9D3E8`, `border-radius:99px`, `max-width:430px`; input
  `13.5px`, padding `9px 18px`, transparent, no outline; button `#1F5FBF` → hover `#174A99`,
  13px, weight 800.
- Nav buttons: 14px, weight 600, `padding:8px 12px`, `border-radius:6px`, hover `#F1F4FA`.

## Verification

For each route:

1. Serve `docs/prototype/` locally; run `next dev`.
2. Capture both at a desktop width and a mobile width (≤640px, to exercise the wordmark rule).
3. Compare directly and iterate until treatment agrees.

**Stated limit.** The application renders real Supabase rows; the prototype renders its invented
fixtures. The two will never be pixel-identical in content, and per D4 they must not be. What is
being matched is *treatment* — type, colour, spacing, structure, states — not text. Acceptance is
a judgement against that standard, not a pixel threshold.

Full suite green before the branch is proposed for merge.

## Risks

| Risk | Mitigation |
|---|---|
| Inline styles cannot express responsive variants, which Tailwind gave for free. The prototype computes some mobile styles in JS. | Where a media query is genuinely needed, add it to `globals.css` rather than inventing a breakpoint inline. Flag each such case in review rather than guessing. |
| 39 components at verbatim fidelity is a large mechanical diff; review fatigue can hide a real defect. | Commit per layer in the order above, so each commit is reviewable on its own. |
| Removing the colour guard (D2) leaves nothing preventing a wrong colour later. | Accepted by the client. `docs/prototype/` (D6) preserves the ability to re-check drift manually. |
| Porting markup risks importing prototype copy along with style, violating D3/D4. | The three copy guards fail the build if it happens. They are the backstop, and they stay green. |
| The prototype's admin covers screens this app lacks; the boundary can blur during the port. | D5 is explicit: no route is created. Missing screens are recorded, not built. |
