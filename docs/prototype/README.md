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
