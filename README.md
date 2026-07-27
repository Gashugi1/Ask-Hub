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

## Infrastructure

Supabase project ref: <recorded in SP1 Task 14>
Supabase region: <confirmed EU region, recorded in SP1 Task 14>
