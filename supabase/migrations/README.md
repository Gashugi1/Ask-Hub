# Migration conventions

## Every table gets RLS enabled, deny by default

RLS is enabled on every table. There is no exception. A new table without
RLS is a defect, full stop -- even a table you believe holds nothing
sensitive, and even a table you intend to come back and lock down "later."

## Every table gets explicit grants before its policies

Enabling RLS is not enough on its own. This was verified directly against
this Postgres: a newly created table grants the `authenticated` role only
`Dxtm` (TRUNCATE, REFERENCES, TRIGGER, MAINTAIN) by default -- no SELECT,
INSERT, UPDATE or DELETE. A probe table reproduced this: querying it as
`authenticated` fails with `permission denied for table probe_grants`,
independent of any RLS policy. `service_role` having `rolbypassrls` does
not help either, because bypassing RLS does not bypass GRANTs -- the two
are separate permission systems. Without explicit grants, not one RLS
policy written for a table is reachable; the request never gets past the
grant check to reach policy evaluation.

Every table migration must therefore follow this shape:

```sql
alter table public.X enable row level security;
revoke all on table public.X from anon, authenticated;
grant select, insert, update, delete on public.X to authenticated;
grant all on public.X to service_role;
-- then the policies
```

The revoke covers `authenticated`, not just `anon`. That same `Dxtm`
default residue (TRUNCATE, REFERENCES, TRIGGER, MAINTAIN) lands on
`authenticated` too, and TRUNCATE is not subject to row-level security --
no policy can stop it. A role that is meant to hold no write privilege at
all (a role with no insert/update/delete policy on the table, such as
`editor` or `viewer` on most tables) would otherwise still be able to
empty it outright via TRUNCATE, entirely outside what RLS governs.
Revoking from `authenticated` first and re-granting exactly the four DML
verbs removes that residue without changing the intended grant.

Anonymous access, where a table is meant to be publicly readable at all,
goes through a public-safe view instead of a direct grant to `anon` --
see CLAUDE.md's "anonymous reads go through public-safe views" rule.

## Why explicit per-table grants, not `alter default privileges`

`alter default privileges` would apply automatically to every future
table and remove the need to repeat the `revoke`/`grant` block above.
That convenience is exactly why it is rejected here.

Explicit per-table grants are fail-safe: forget one, and the table is
simply unreachable by `authenticated` -- every query against it errors
loudly, the test suite for that table fails immediately, and the gap is
obvious and cheap to fix at review time.

`alter default privileges` is fail-dangerous in the opposite way: a
future table silently inherits broad grants the moment it is created,
before anyone has written or reviewed its RLS policies. Forgetting RLS
on that table does not error -- it exposes it. The failure mode moves
from "loud test failure" to "silent data exposure," which is the wrong
direction for a schema whose tables include submitter emails, internal
notes, and reach-reporting data for a UN programme.

This choice is deliberate. Do not "simplify" it away in a later task by
switching to default privileges, even though it would shorten every
subsequent migration.
