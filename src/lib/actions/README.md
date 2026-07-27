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
