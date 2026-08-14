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
- **Do not write an `audit_log` row, and do not pass an actor.** The database
  does it, inside your mutation's own transaction:
  `public.audit_row_change()`, a `security definer` trigger function from
  `supabase/migrations/0017_audit_triggers.sql`, is attached to every
  write-policied table and records `actor`,
  `actor_name`, `action`, `entity_type`, `entity_id`, `entity_label`,
  `change_summary` and `diff` per PRD 4.15, resolving the actor from
  `auth.uid()`.

  This is worth one paragraph rather than a bare instruction, because the
  obvious-looking alternative is wrong in a way that is hard to see later.
  `audit_log` has no insert policy for any role (`0007_logs.sql`), so an action
  running on the caller's session genuinely cannot insert its own audit row —
  which invites doing the mutation on the caller's client and the audit insert
  on the `service_role` client. Two clients means two connections, two
  transactions, and a pair that can end up inconsistent in either direction: a
  committed mutation with no record, or a record of a mutation that rolled
  back. A trigger runs inside the statement that fired it, so neither is
  representable, and a failed audit insert aborts the mutation instead of
  producing a successful unaudited write.

  If a mutation needs an audit row a row trigger cannot express accurately, use
  the narrowly scoped `security definer` RPC pattern in the SP3 design spec
  §4.5 — one transaction, caller's role re-checked in the database, typed
  parameters, no dynamic SQL. Do not reach for the admin client.

- **Do not use `createAdminSupabase()` here** unless the operation genuinely
  cannot be done as the caller. `service_role` bypasses RLS entirely, so it
  removes the database's own permission model from the write path. The whole
  legitimate list is in `docs/deployment.md` §3; in the admin portal it is one
  entry, the Supabase Auth Admin invite, because creating an auth user is not a
  table write. Ordinary resource, content, settings and profile writes run on
  `createServerSupabase()` and are refused by RLS if the caller may not make
  them — which is the point.
- `revalidateTag` or `revalidatePath` on every content and resource mutation.
  PRD 6.7 and 13.4: an editor's save must appear on the public site with no
  rebuild.
