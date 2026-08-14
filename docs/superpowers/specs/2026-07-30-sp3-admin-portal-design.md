# SP3: Admin portal — design

Date: 2026-07-30
Status: **decided — the three open decisions were ruled on by the human on 2026-07-30; this is ready to plan**
Branch: `sp3-admin-design`, cut from `sp2a/public-read-surface` at `f44c7d4`

Companion documents:

- Implementation plan: `docs/superpowers/plans/2026-07-30-sp3-admin-launch.md`
- Running record of decisions and task state: `docs/sp3-ledger.md`

## Why this exists now

SP2a is mid-flight. This document was written in parallel to buy schedule, and
it touches no source file. Everything in it is grounded in what the repository
actually contains at `f44c7d4` — every claim below was checked against a
migration, a policy, or a source file, and the ones I could not check are
marked.

**SP3 does not wait for SP2b.** Nothing in the launch scope below depends on
`engagement_events` carrying a single row, on a public submission arriving, or
on anyone having subscribed. That was the second open decision and it is now
closed: SP3 proceeds in parallel with SP2b, and the screens that need SP2b's
data are not built at all until they have data (see "Deferred", below).

## What SP3 inherits, verified

| Dependency | State | Where |
|---|---|---|
| `requireRole(allowed: Role[])` | Built, returns `CurrentUser`, throws `UNAUTHENTICATED` / `FORBIDDEN` | `src/lib/auth.ts:70` |
| `getCurrentUser()` | Built; returns `null` for a deactivated account, so `is_active: false` is indistinguishable from no account | `src/lib/auth.ts:38` |
| 17 base tables, RLS on every one | Built | migrations `0001`–`0016` |
| `current_app_role()` | `security definer`, `search_path` pinned empty, returns `null` unless the profile row is `is_active` | `supabase/migrations/0003_profiles.sql` |
| `CACHE_TAGS` | Built and exported precisely so SP3's saves have tag names to invalidate | `src/lib/public/cache.ts:11-16` |
| `deadlineInfo()` | Deliberately kept for SP3's "expiring soon" flag; it computes from a clock, which is correct here and wrong on the public card path | `src/lib/deadline.ts` |
| Server-action contract | Written and binding | `src/lib/actions/README.md` |
| JSX copy guard | Active, scans **all** of `src/`, so every admin screen is policed as it is written | `tests/structure/no-hardcoded-copy.test.ts` |
| Schema guards G1–G14 | Active; G4, G8, G9 and G12 constrain how SP3's migration may be written (see "Atomic audit", below) | `tests/rls/schema-guards.test.ts` |

That last-but-one row is worth stating plainly: SP3 starting after SP2a Task 2
rather than before it means the admin screens cannot accumulate hardcoded copy
that someone has to audit later. The guard flags JSX text, string children,
template literals, both ternary branches, string concatenation, and eight
user-facing attributes.

## 1. Launch scope

Five screens. The test for inclusion was not "is it in PRD §6's sidebar" but
"can the client's team run the directory without it on day one".

| Screen | Route | Why it is launch-blocking |
|---|---|---|
| Sign in | `/admin/login` | The door. It is still a placeholder at `f44c7d4` (`src/app/(admin)/admin/login/page.tsx` renders `<main data-route>` and nothing else), so without it no launch screen below is reachable by anyone. Email and password against Supabase Auth; no sign-up route exists and public signup is disabled at the project level |
| Dashboard | `/admin` | The shell every other screen hangs off: sidebar, footer identity, "View site", sign out. Carries honest empty states and **no placeholder statistics** |
| Resources | `/admin/resources` | The product. Curating the directory is the job |
| Site Content | `/admin/content` | PRD §6.7 and §13.4 make "an editor's save reaches the public site with no rebuild" binding. Without it, public copy needs a developer |
| Settings | `/admin/settings` | GA4 Measurement ID, contact email, the two feature flags. Admin-only, split out of Site Content — see §3 |
| Users | `/admin/users` | PRD §3: "Users are created by an admin", and "at least two admin accounts must be provisioned before launch". After `scripts/provision-admins.ts` bootstraps the first admins, **the only way the rest of the client team gets access is this screen**. Without it, every invitation, role change and offboarding is an operator running a script against production |
| Audit Log | `/admin/audit` | Read-only. It is the accountability record for everything above, and it is the one screen that has real data from the first admin write |

Seven routes. `/admin` and `/admin/login` exist as placeholders that render no
text; the other five are new.

Two things the Dashboard must do, and one it must not:

- It **must** navigate. Sidebar to the five screens, footer with the signed-in
  name, `display_label`, "View site" and "Sign out" (PRD §6).
- It **may** state, in words, that reach and engagement reporting is not
  available yet. Naming an absent dependency is honest.
- It **must not** render a stat card whose number it cannot source. Not zero,
  not a dash presented as a value, not "—" in a card styled to look like a
  figure. `resources_live` and `pipeline_count` are real and countable today;
  Total reach, Growth this week, Most-clicked resources and the engagement
  half of Coverage are not. CLAUDE.md is unambiguous: a plausible fake number
  on a UN leadership surface is a launch-blocking defect.

## 2. Deferred

Documented future scope. **Not built as empty routes.** An `/admin/subscribers`
that renders "no subscribers yet" is indistinguishable, to the client team, from
a subscribers feature that is broken — and it invites the reasonable question of
why the digest cannot be sent. A route that does not exist asks no questions.

| Deferred | Blocked on | Note |
|---|---|---|
| Alerts & Subscribers (PRD §6.6) | SP2b's signup endpoint | Includes the digest preview and send log. The sender itself is SP5 |
| Partnerships (PRD §6.5) | Nothing technical — scope only | `partnerships` has schema and policies; no rows and no launch need |
| Reach & Engagement (PRD §6.4) | SP2b event capture + GA4 configuration | Its first-party half reads `engagement_events`, which is empty by construction until SP2b |
| Any `engagement_events`-derived dashboard panel | Same | Including the Dashboard's Total reach, Growth this week and Most-clicked resources cards |
| Review Queue (PRD §6.3) | SP2b's submission endpoint | Nothing to review until the public form exists |
| Updates / what's new (PRD §6.8) | Scope only | Includes PRD §4.14's automatic `updates_log` entries. When it ships it uses the same trigger mechanism as the audit spine — the argument in §4 applies identically |
| Innovator profiles | Nothing; deliberately not built | `feature_innovator_profiles` is off at launch. SP3 builds the flag's toggle on Settings and nothing behind it (CLAUDE.md) |

The sidebar shows the five launch screens only. It does not show disabled or
"coming soon" entries for the deferred ones, for the same reason the routes are
absent.

**What this costs, stated plainly:** at launch the client can curate resources,
edit public copy, manage their own team and audit all of it. They cannot see
engagement reporting, accept a public submission, or email subscribers. Those
capabilities arrive with SP2b and SP5, and the Dashboard says so in words
rather than implying it with an empty chart.

## 3. The permission model, per launch screen

Read off the actual policies — from `grep 'create policy'` across the
migrations, not from the PRD's prose:

| Table group | Write policy | Who |
|---|---|---|
| `resources`, `partners`, `partnerships`, `submissions`, `subscribers`, `site_content`, `headline_stats`, `compute_metrics`, `programmes`, `impact_stories`, `updates_log`, `digest_sends`, `contact_messages` | `*_write_staff` / `*_insert_staff` | admin **and** editor |
| `settings` | `settings_write_admin` | **admin only** |
| `profiles` | `profiles_insert_admin`, `profiles_update_admin`, `profiles_delete_admin` | **admin only** |
| `audit_log` | **none, for any role** | nobody (see §4) |

Which gives, per screen:

| Screen | Read | Write | Tables written | Enforcement |
|---|---|---|---|---|
| Sign in `/admin/login` | **unauthenticated** — the one admin route that must render with no session | none. `signInWithPassword` writes no table | — | none applicable; it is pre-authentication. It must not leak whether an address exists, and it carries no sign-up or password-reset-by-anyone path |
| Dashboard `/admin` | all three roles | none — it is a shell | — | `requireRole(['admin','editor','viewer'])` on the page |
| Resources `/admin/resources` | all three roles | admin, editor | `resources` | `requireRole(['admin','editor'])` in **each** mutating action |
| Site Content `/admin/content` | all three roles | admin, editor | `site_content`, `headline_stats`, `compute_metrics`, `programmes`, `impact_stories` | `requireRole(['admin','editor'])` in **each** mutating action |
| Settings `/admin/settings` | **admin only** | **admin only** | `settings` | `requireRole(['admin'])` on the page **and** in each action |
| Users `/admin/users` | **admin only** | **admin only** | `profiles`, plus `auth.users` via the Auth Admin API | `requireRole(['admin'])` on the page **and** in each action |
| Audit Log `/admin/audit` | all three roles | **nobody, ever** | — | no mutating action exists to gate |

### 3.1 Mixed permissions are resolved by splitting the route

PRD §6.7 lists eight panels on Site Content. Panels 1 and 2 — the GA4
Measurement ID and the two feature flags — write `settings`, which is
**admin-only**. Panels 3–8 are editor-writable. A single screen-level role
check on that screen is therefore wrong in both directions: gate it to admin
and editors lose the copy they are supposed to own; gate it to staff and an
editor is shown two panels their writes will bounce off.

**Decision: GA4 configuration, `contact_email` and the two feature flags move
to `/admin/settings`, admin-only. Site Content keeps the six content areas,
editor-writable.** The route boundary and the permission boundary become the
same line.

The reasoning, and why this is not a deviation from the PRD so much as a
correction to one of its two descriptions of the same thing:

- PRD §3's capability table already names **"Settings: GA4 ID, contact email,
  feature flags"** as a distinct capability with a distinct answer — admin yes,
  editor **no**, viewer no — one row above "Site content: copy, stats, compute
  metrics, programmes, impact stories", which is admin yes, editor **yes**.
  §6.7's panel list contradicts §3's capability table by putting both
  capabilities on one screen. §3 is the normative one: it is the section the
  RLS policies were built from, and the policies agree with it.
- A screen whose panels have different answers to "may I write here" is the
  shape most likely to be implemented with one check at the top. Splitting the
  route removes the failure mode rather than documenting around it.
- It also removes a subtler problem: Site Content's header, per §6.7, tells
  the operator that everything on the screen reaches the public site
  immediately. That is true of the six content areas and false of the GA4
  Measurement ID.

**Site Content's six content areas**, all editor-writable, all reaching the
public surface:

1. Welcome band copy — `site_content` keys `welcome_title`, `welcome_body`,
   `welcome_cta`
2. Identity / About copy — `site_content` keys `identity_lead`,
   `identity_align`

**Those key names are the database's, not PRD §4.12's, and the difference is
load-bearing.** PRD §4.12 names `welcome_band_heading`, `welcome_band_body`,
`welcome_band_cta_label`, `about_intro`, `about_alignment`, `privacy_copy` and
`terms_copy`. None of those exist: `scripts/seed-data.ts` says in its own
header that its key names are "this seed's own invention" because the prototype
had no key/locale structure to inherit, and the five keys it seeded are the
five the table holds. SP2a's public readers read those five. Task 1 surfaced
this the hard way — an `update ... where key = 'about_intro'` matched zero rows
and the test that depended on it failed rather than passing vacuously.

So Site Content is built against the five real keys, and **`privacy_copy` and
`terms_copy` do not exist at all**. That is not cosmetic: `docs/deployment.md`'s
pre-launch checklist gates going public on "legal-reviewed Privacy and Terms
copy is in `site_content`", and the public `/privacy` and `/terms` routes have
no key to read. Whether SP3's Site Content screen can create a new key, or
whether a migration seeds the two, is open question Q8 in the ledger.
3. Headline reach numbers — `headline_stats`, with `source`, `attested_by`,
   `attested_on` required by the schema
4. Compute snapshot — `compute_metrics`, same provenance columns
5. Programmes — `programmes`
6. Impact stories — `impact_stories`

**Settings' three admin-only areas:** GA4 (`ga4_measurement_id`,
`ga4_property_id`), contact mailbox (`contact_email` — one mailbox only,
`aihubfordevelopment@undp.org`), feature flags
(`feature_innovator_profiles`, `feature_public_impact_page`).

### 3.2 Hiding a control is not authorization

Every mutating server action independently calls `requireRole` with its own
allowed set, as its first statement, whether or not the page that renders its
form already checked. This is already binding in `src/lib/actions/README.md`;
what §3.1 adds is that **the allowed set is per action, not per screen**. A
`saveSetting` action reached directly by an editor whose form was never
rendered must fail on `requireRole(['admin'])`, and then fail again at the
`settings_write_admin` policy if the first check were ever removed.

Three layers, in order of authority:

1. RLS policies keyed on `current_app_role()`. If this layer and the others
   disagree, this one wins.
2. `requireRole` inside each action. Defence in depth, and the layer that
   produces a clean `FORBIDDEN` instead of a raw Postgres error.
3. The proxy redirect and the rendered control set. **UX only.**

### 3.3 Viewer behaviour

`viewer` has no write policy on any table in the schema. The rule, confirmed:

**Viewer pages render no create, edit, publish, delete, invite, role-change or
save control at all. Not a disabled one.** A disabled button tells a viewer
the product has a capability they are being denied; an absent one tells them
the screen is a report, which is what it is. It also removes any chance of a
control that re-enables on a client-side state change.

Concretely, for a viewer: Resources renders as a table with filters and no
Actions column, no status dropdown, no star toggle and no "Add resource". Site
Content renders the six areas as read-only text. Settings and Users **do not
appear in the sidebar and their routes return `notFound()`** — not a redirect
to `/admin` with a flash message, since the existence of the route is not
information a viewer needs. Audit Log is identical for all three roles,
because it is read-only for all three.

`display_label` is free text and independent of `role` (PRD §3). A viewer may
be labelled "Leadership"; that does not grant them anything. Never infer one
from the other.

## 4. The atomic audit architecture

### 4.1 What the schema actually enforces

**`audit_log` has no insert policy for any role, including admin.**
`authenticated` holds the INSERT *grant*, and RLS denies it anyway
(`supabase/migrations/0007_logs.sql`, whose own comment says "NO insert,
update or delete policy for ANY role, including admin"). Two triggers,
`audit_log_no_update` and `audit_log_no_delete`, raise on the other two verbs
— and `service_role` bypasses RLS but **not** triggers, which is what makes
append-only hold even against a key that ignores policies.

The previous draft of this document concluded from that: every mutating action
needs the `service_role` client for its audit insert. **That conclusion is
withdrawn.** It is technically true and architecturally wrong, because the
mutation and the audit insert would then travel on two different connections.
Two connections means two transactions, and two transactions means the pair
can end up inconsistent in both directions: a mutation that succeeded with no
audit row, or an audit row describing a mutation that was rolled back. On an
accountability surface for a UN programme, the first is the worse of the two
and neither is acceptable as a normal operating mode.

It is also a much larger security concession than the problem needs. Using a
key that bypasses RLS entirely on every ordinary resource edit means the
database's own permission model is no longer in the path of the product's most
common write.

### 4.2 The design: the audit row is written by the database, in the mutation's own transaction

```
server action                          database (one transaction)
─────────────                          ──────────────────────────
requireRole([...])            ┐
Zod parse                     │ Node
                              ┘
caller's Supabase client ──────────▶  update public.resources ...       ← RLS applies as the caller
                                        │
                                        └─ AFTER UPDATE trigger
                                             └─ public.audit_row_change()   ← SECURITY DEFINER
                                                  └─ insert into public.audit_log
                                      ◀── commit, or nothing at all
revalidateTag(...)            ← only after the commit is confirmed
```

Four properties fall out of this, and each was a requirement:

1. **The mutation runs as the caller.** `createServerSupabase()` carries the
   caller's cookies, so `resources_write_staff` and every other policy is
   evaluated against `current_app_role()` for that user. A viewer's write is
   refused by the database, not merely hidden by the UI.
2. **The audit row shares the mutation's transaction.** A trigger body runs
   inside the statement that fired it. There is no window in which one exists
   without the other, and no process that can die between them.
3. **A failed audit insert fails the mutation.** An exception raised inside an
   `AFTER` trigger aborts the statement and the transaction. There is no code
   path that produces a successful unaudited write — not "unlikely", not
   "monitored": unrepresentable.
4. **The actor cannot be spoofed.** The trigger resolves the actor from
   `auth.uid()` and the `profiles` row it maps to. It takes no actor argument
   from the caller. An action cannot write an audit row attributing its
   mutation to someone else, because it does not write the audit row at all.

### 4.3 The function

One generic trigger function, `public.audit_row_change()`, attached once per
audited table with table-specific arguments. Its shape is constrained by
guards that already exist:

- `security definer`, because `audit_log` has no insert policy for anyone. The
  function is owned by the same role that owns every base table (asserted by
  **G8**), and that owner is not subject to `audit_log`'s policies — no table
  in this schema uses `force row level security`, and **`audit_log` must never
  be given it**, or every audited write in the product starts failing.
- `set search_path = ''`, with every reference schema-qualified. Required by
  **G9**, and the house convention for all four existing functions.
- `revoke all on function ... from public, anon, authenticated`, per **G12**
  and the precedent in `0010_function_grants.sql`. It is a trigger function,
  so a direct `/rpc/audit_row_change` call errors with "trigger functions can
  only be called as triggers" before the body runs — the same belt-and-braces
  as `handle_new_user()`.
- **No dynamic SQL anywhere.** The per-table variation (which column holds the
  human label, which prefix it takes, which columns must be redacted) is
  handled by reading `to_jsonb(new)`/`to_jsonb(old)` by key, never by building
  a statement from `TG_ARGV`. There is no `execute` in the body, so there is
  no injection surface even for a future caller who controls the arguments.

Taken together: the function has no directly callable surface, cannot be
tricked by a search-path change, and cannot be made to run arbitrary SQL.

What it records, per PRD §4.15:

| Column | Source |
|---|---|
| `actor` | `profiles.id` for `auth.uid()`. **Not** `auth.uid()` itself — PRD §4.15 defines this field against `profiles`, and the two ids differ |
| `actor_name` | `profiles.full_name`, falling back to `display_label` then `email` when blank, and to the sentinel `system` when there is no authenticated caller |
| `action` | `created` on INSERT, `deleted` on DELETE, `published` when a resource's `status` becomes `live`, `role_changed` when a profile's `role` changes, `edited` otherwise. The `audit_action` enum needs no new values |
| `entity_type` | Trigger argument, e.g. `resource`, `site_content`, `user` |
| `entity_id` | The row's `id` |
| `entity_label` | Trigger argument names the label column; resources appear by bare name, every other type takes its prefix ("Partnership: NVIDIA", "Setting: ga4_measurement_id"), per PRD §4.15's convention |
| `change_summary` | Composed from the diff by `public.audit_change_summary()`. Prose, not a JSON dump |
| `diff` | Changed keys only, `{from, to}` per key, with `created_at`/`updated_at` dropped and any column in the trigger's redact list replaced by a `[redacted]` marker |
| `occurred_at` | Column default `now()` |
| `ip_hash`, `user_agent` | **Left null, deliberately.** See §4.6 |

An UPDATE whose only difference is `updated_at` writes no row at all.

### 4.4 Why `change_summary` is composed in SQL

PRD §4.15 requires `change_summary` to be "generated at write time by a
formatter keyed on `entity_type` and `action`", producing prose. Write time is
now inside the database transaction, so the formatter is a SQL function.

This is the one deliberate exception to CLAUDE.md's "no hardcoded user-facing
strings", and it is worth being explicit about rather than letting a reviewer
discover it:

- The rule's mechanism is `tests/unit/i18n.test.ts` scanning `en.json` plus
  the JSX guard scanning `src/`. A string composed in Postgres is in neither
  place, so nothing is being evaded — the guards are unaffected because the
  string never appears in `src/`.
- An audit entry is an immutable historical record. It must read at any later
  date exactly as it read when written, which is the opposite of what
  translating it at display time would do. Localising the audit log's
  *contents* would mean re-rendering history in whatever language the reader
  picked; PRD §4.15's "generated at write time" is the requirement that
  forbids that.
- Everything *around* the log is localised normally: column headers, the
  filters, the action badges, the pagination controls, and the rendering of
  the `system` actor sentinel. The `change_summary` cell is displayed
  verbatim, as data.

**One consequence to accept:** a batched panel save that changes three
`site_content` keys writes three audit rows, one per row changed, each with
its own summary. That is more precise than one row per button press and it is
what a row trigger can honestly produce. See §7 for the open product question
about whether the log should instead read one entry per user-visible action.

### 4.5 The RPC escape hatch, and the fact that launch does not need it

If a business operation cannot be represented accurately by a row trigger, the
fallback is a narrowly scoped `security definer` RPC that validates the
caller's role and performs the mutation and the audit insert in one
transaction. Its template:

```sql
create or replace function public.<verb>_<entity>(<typed parameters>)
returns <typed result>
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- First statement, always: the caller's role, re-checked in the database.
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'FORBIDDEN';
  end if;
  -- ... the mutation, then the audit insert, no dynamic SQL, typed parameters only.
end;
$$;

revoke all on function public.<verb>_<entity>(...) from public, anon;
grant execute on function public.<verb>_<entity>(...) to authenticated;
```

**No launch-scope operation needs it.** Every mutation in §1's five screens is
an INSERT, UPDATE or DELETE on a table that carries the trigger:

| Operation | Table | Covered by |
|---|---|---|
| Create / edit / delete a resource | `resources` | row trigger |
| Change a resource's status, incl. publish | `resources` | row trigger, `published` when status becomes `live` |
| Toggle featured | `resources` | row trigger |
| Edit any of the six content areas | `site_content`, `headline_stats`, `compute_metrics`, `programmes`, `impact_stories` | row trigger |
| Change a GA4 id, the contact mailbox, a feature flag | `settings` | row trigger |
| Change a user's role, deactivate a user | `profiles` | row trigger, `role_changed` when `role` changes |
| Invite a user | `auth.users`, then `profiles` | two rows, see §4.6 — the DB half is trigger-covered |

The hatch is documented because the deferred screens will need it (approving a
submission, sending a digest, and any operation the product wants recorded as
a single entry), not because launch does.

### 4.6 The one seam that cannot be transactional, and how it is handled

Inviting a user creates a row in `auth.users` through the GoTrue Admin API —
an HTTP call to a separate service. No database transaction can span it. The
flow, and what each step guarantees:

1. `requireRole(['admin'])`, then Zod parse of email, role and full name.
2. `createAdminSupabase().auth.admin.inviteUserByEmail(...)`. This creates the
   auth user, which fires the existing `on_auth_user_created` trigger, which
   runs `handle_new_user()`, which inserts a `profiles` row with role
   `viewer` — least privilege, by design, in that call's own transaction. The
   audit trigger on `profiles` fires there too, and records `created` with
   `actor_name = 'system'`, because a service-key call carries no
   `auth.uid()`. That row is honest: at that instant no authenticated user
   made the write.
3. On the **caller's** client, an admin-only UPDATE on that `profiles` row
   sets the intended `role`, `full_name` and `invited_by`. This is subject to
   `profiles_update_admin`, and its audit row carries the real admin as actor.

So an invitation produces two audit rows — the account appearing, and the
admin assigning its role — each atomic with its own mutation, neither
fabricated. If step 3 fails, the failure direction is safe: the account exists
as a `viewer`, which grants read access the whole client team has anyway, and
the action surfaces an error naming the stranded account so an admin can fix
the role or deactivate it. The audit row from step 2 proves it appeared.

Deactivation needs no auth-side call at all: `is_active = false` on
`profiles` is a normal admin UPDATE, and it is fully effective at the database
layer because `current_app_role()` returns `null` for an inactive profile, so
every policy in the schema stops passing for that user, and `getCurrentUser()`
returns `null` so the session cannot render an admin page.

**`ip_hash` and `user_agent` stay null.** They are nullable, and the only
values available to a trigger are the ones PostgREST puts in
`request.headers` — which, for a server action, describe the Next.js server
that made the call, not the operator's browser. Recording the server's own
user-agent in a forensic column would be a fabricated value dressed as
evidence. If per-operator forensics is wanted later, the honest route is the
RPC hatch taking a hash computed in Node from the real request headers, as a
typed parameter.

### 4.7 Structural guarantee: no unaudited write path

The migration attaches the trigger to **every base table that has any write
policy** — all fifteen — not only to the eight the launch screens touch. The
deferred tables cost one line of DDL each and it means no screen can ever ship
against an unaudited table by omission.

A new guard, **G15**, asserts exactly that: every base table with an INSERT,
UPDATE, DELETE or ALL policy carries an `audit_row_change` trigger, unless it
is in a two-entry exemption registry with a stated reason:

- `audit_log` — has no write policy for anyone; auditing the audit log is
  circular.
- `engagement_events` — a high-volume first-party event stream that *is* the
  record of its own writes. Mirroring every page view into `audit_log` would
  bury who-did-what under machine traffic.

Because the deferred tables are covered from day one, and because subscriber
emails and submitter emails must not be widened by their presence in a diff
(`audit_log` is readable by all three roles, including `viewer`), those
triggers pass a redact list: `subscribers.email`, `confirm_token`,
`unsubscribe_token`, `submissions.submitter_email`, `source_ip_hash`,
`contact_messages.email`, `message`, `name`. Redacted keys appear in the diff
as `[redacted]`, so the fact of the change is recorded and the value is not.

## 5. The public/admin boundary

Unchanged from the agreed split, restated because SP3 is the side that could
break it:

| Owns | SP2a | SP3 |
|---|---|---|
| Anonymous readers, `*_public` views | ✅ | ❌ must not touch |
| Public rendering and components | ✅ | ❌ |
| `CACHE_TAGS`, tagged/cached readers | ✅ defines | ❌ imports only |
| Responding to invalidation | ✅ | — |
| Authenticated admin UI | — | ✅ |
| Zod validation, mutations, permissions | — | ✅ |
| Calling `revalidateTag` after a commit | ❌ none exist | ✅ every write path |

SP3 imports `CACHE_TAGS` from `src/lib/public/cache.ts` and calls
`revalidateTag` with those exact values. It does not add a tag, rename one, or
edit a reader. SP2a deliberately shipped the tags with no invalidation caller;
SP3 is that caller and nothing more.

Two consequences worth naming:

- **Admin reads use `createServerSupabase()`** — the request-scoped client
  carrying the caller's cookies, so every admin query is subject to RLS *as
  that user*. Not the no-cookie anon client, which is SP2a's and only holds
  the public views. Not `service_role`, whose reads would show a viewer rows
  their policies deny (`admin.ts`'s own docstring says exactly this).
- **Admin screens read base tables, not `*_public` views.** The views exclude
  `status`, internal notes and provenance columns that the admin screens exist
  to edit. Reading a view in admin would be a bug in the opposite direction
  from the usual one.

Invalidation map — which tag each mutation must clear:

| Mutated | Tag |
|---|---|
| `resources` | `CACHE_TAGS.resources` (also covers `need_counts_public`) |
| `site_content` | `CACHE_TAGS.siteContent` |
| `headline_stats` | `CACHE_TAGS.headlineStats` |
| `impact_stories` | `CACHE_TAGS.impactStories` |
| `settings` | `CACHE_TAGS.settings` |
| `compute_metrics`, `programmes` | **none exists, and none is needed** — verified: no SP2a reader queries either table, and `CACHE_TAGS` has no entry for them. They are admin-and-reporting-only today. Do not invent a tag; if a public page later renders them, SP2a adds the tag and the reader together |

## 6. Testing

Per CLAUDE.md: the security boundary and the logic, not the presentation.

| What | How |
|---|---|
| Role enforcement per action | Each action invoked as admin, editor, viewer and unauthenticated; assert `FORBIDDEN`/`UNAUTHENTICATED` for every role that must not pass. Per action, not per screen — that is the §3.1 failure this catches |
| Settings actions reject an editor | Explicitly, at both layers: `requireRole(['admin'])` throws, and the `settings_write_admin` policy refuses the same write made directly on an editor's client |
| `viewer` renders no write affordance | Assert on the rendered control set, not on styling. A disabled control is a failure, not a pass |
| Settings and Users are absent for non-admins | Route returns `notFound()`; sidebar omits the entry |
| Audit row per mutation | One row per mutated row, correct `action`, `actor` = the caller's `profiles.id`, `actor_name` denormalised, `entity_label` prefixed per convention, `change_summary` prose |
| **A failed audit insert aborts the mutation** | Break the audit insert deliberately (a `check (false) not valid` constraint added by a local-only test helper), attempt an ordinary edit as admin, assert the edit failed **and the row is unchanged**, then remove the constraint. This is the §4.2 property 3 claim, tested rather than asserted |
| No unaudited write path | G15: every write-policied base table carries the trigger, or is in the two-entry exemption registry |
| `audit_log` stays append-only | Already covered by `tests/rls/audit-log.test.ts`; extend it to prove the trigger-written insert succeeds while a direct insert as admin still fails |
| Actor cannot be spoofed | An action cannot influence `actor`/`actor_name`; a service-key write records `system` rather than an arbitrary name |
| Redaction | A `subscribers` update records the change and no email in the diff |
| Revalidation | Each write path calls `revalidateTag` with the tag its entity maps to, and only after the mutation returns without error |
| Expiring-soon computation | `deadlineInfo()` boundaries at 0, 1, 14 and 15 days |
| No fabricated metric | The Dashboard renders no numeric card for a value it cannot source; assert on the absence, since this is the hard rule most likely to regress under pressure to fill space |
| Service-role containment | The built client bundle contains no `service_role` string, and `createAdminSupabase` has exactly one production caller (the invite path) |

Digest subscriber matching is named in CLAUDE.md as required coverage. It
belongs to the deferred Alerts & Subscribers screen and ships with it; there
is no matching logic in SP3 to test.

## 7. Remaining product decisions

Not architectural — these need the client or a product call, and none blocks
starting the plan.

1. **Role assignment per named user.** PRD §16.4 open question. Who on the
   client team is `admin`, who is `editor`, who is `viewer`. The Users screen
   makes this changeable in seconds, so it does not block launch, but the two
   bootstrap admins must be named before `scripts/provision-admins.ts` runs.
2. **Audit granularity for batched saves.** One row per database row changed
   (what the trigger does, more precise) versus one row per user-visible
   action (needs the §4.5 RPC). Recommendation: ship per-row for launch and
   revisit only if the log reads as noise in practice.
3. **Does the Dashboard name its missing dependency, and in whose words?**
   The screen must not fake a number; whether it says "engagement reporting
   becomes available when event capture ships" or stays silent is a copy
   decision for K&S. The locale key exists either way.
4. **Users screen: hard delete, or deactivate only?** Deactivation is
   complete at the database layer (§4.6) and preserves the audit trail's
   readability. A hard delete of an `auth.users` row cascades to `profiles`,
   and `audit_log` deliberately has no FK so history survives — but the
   capability is not needed at launch. Recommendation: deactivate only, and no
   delete control.
5. **`ip_hash` / `user_agent` for admin operations.** Left null (§4.6). If
   the programme's security review wants per-operator forensics, that is the
   RPC hatch plus a hash computed in Node, and it is a scoped follow-up.
6. **The `system` actor sentinel's display.** Seed scripts, migrations and the
   invite's auth-side step write `actor_name = 'system'`. The Audit Log renders
   it through a locale key; the wording is a copy decision.

## 8. Not in SP3

- Innovator profiles. `feature_innovator_profiles` is off at launch and
  CLAUDE.md says build the flag, not the feature. SP3 builds the toggle on
  Settings and nothing behind it.
- Event capture and the four public write endpoints — SP2b.
- CSP, HSTS, Turnstile, honeypots, rate limiting — SP4.
- The digest sender, and the Alerts screen's preview and send log — SP5 and
  the deferred scope in §2.
- Sitemap, GA4 read-back, locale switcher, WCAG audit — SP6.
