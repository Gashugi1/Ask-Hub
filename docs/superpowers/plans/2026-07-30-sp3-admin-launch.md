# SP3 Admin Portal (launch scope) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the authenticated admin portal's launch scope — sign in, a Dashboard shell with honest empty states, Resources, Site Content, an admin-only Settings route, admin-only Users, and a read-only Audit Log — on top of an audit spine that makes an unaudited successful write structurally impossible.

**Architecture:** Every read uses the request-scoped `createServerSupabase()` client, so RLS evaluates as the signed-in user. Every mutation is a server action in `src/lib/actions/` that opens with its own `requireRole([...])`, parses with Zod, mutates on the caller's client, and calls `revalidateTag` only after the mutation returns without error. **No server action writes an `audit_log` row.** A single `security definer` trigger function, attached to every write-policied base table, writes the audit row inside the mutation's own database transaction — so the pair cannot become inconsistent, and a failed audit insert aborts the mutation.

**Tech Stack:** Next.js 16.2.12 (App Router, Turbopack), React 19.2, TypeScript 5 strict, Tailwind v4 (CSS-first `@theme`), Supabase JS v2, Zod, Vitest 4, plpgsql for the audit spine.

**Spec:** `docs/superpowers/specs/2026-07-30-sp3-admin-portal-design.md`. Read §1–§5 before Task 1. Decisions and their dates: `docs/sp3-ledger.md`.

## Deviations from the PRD, and why

Three, each recorded in the spec with fuller reasoning:

1. **GA4 config, `contact_email` and the feature flags move off Site Content to a new admin-only `/admin/settings`.** PRD §6.7 puts them on Site Content as panels 1–2; PRD §3's capability table lists "Settings: GA4 ID, contact email, feature flags" as admin-only, one row above Site Content, which is editor-writable. The two sections contradict each other; §3 is the one the RLS policies were built from and agree with. Splitting the route makes the permission boundary and the route boundary the same line (spec §3.1).

2. **A Users screen exists at `/admin/users`, which PRD §6's sidebar does not list.** PRD §3 names the capability ("Users: invite, change role, deactivate", admin only) and requires that users are created by an admin with at least two admins provisioned before launch. After `scripts/provision-admins.ts` bootstraps those two, this screen is the only non-operator path to the rest of the client team.

3. **Four of PRD §6's nine screens are not built.** Review Queue, Alerts & Subscribers, Partnerships, Reach & Engagement, and the Updates log are deferred, and deliberately **not** scaffolded as empty routes (spec §2). The Dashboard states in words that engagement reporting is unavailable; it renders no card for a number it cannot source.

## Global Constraints

Every task's requirements implicitly include this section. Values copied verbatim from `CLAUDE.md` and the spec.

- **Never fabricate data.** Metric panels show true values or explicit empty states. A plausible fake number on this surface is a launch-blocking defect. Zero is a value; render it only where it is counted.
- **No hardcoded user-facing strings.** Everything goes to `src/locales/en.json` via `t()`. `tests/structure/no-hardcoded-copy.test.ts` scans all of `src/` and will fail the build. The single documented exception is `audit_log.change_summary`, composed in SQL at write time per PRD §4.15 — it never appears in `src/`.
- **Attribution is always "co-led by MIMIT and UNDP".** Never "powered by" or "implemented by".
- **Always "AI Hub" or "AI Hub for Sustainable Development".** Never "the Hub" alone.
- **One mailbox only:** `aihubfordevelopment@undp.org`.
- **No per-resource "Verified" badge.** The word `verified` may appear in `src/` only inside the exact string `Every resource is curated and verified by the AI Hub team.`
- **"Democratic Republic of the Congo" in full. "CINECA Leonardo" with no "Mattei Plan". No "Global programmes" country filter option.**
- **RLS enabled on every table, deny by default.** A new table without RLS is a defect.
- **`service_role` key is server-only**, and in SP3 it has exactly one production caller: the Auth Admin invite in Task 7.
- **Every mutating server action re-checks the caller's role**, as its first statement, with its own allowed set. Middleware gating is UX, not security.
- **`viewer` sees no write affordance at all** — not a disabled one.
- **Zod at every server boundary. No string-built SQL. No `dangerouslySetInnerHTML` with user content.**
- **Reject SVG uploads and SVG image URLs.** (`resources_banner_not_svg` enforces it in the database; the form must not offer a path that fails there.)
- **No hardcoded colours or type values.** Use the `@theme` tokens in `src/app/globals.css`; `tests/structure/app-structure.test.ts` fails on any hex/oklch/rgb/hsl literal elsewhere under `src/`.
- **Public pages revalidate on write** (`revalidateTag` with `CACHE_TAGS` from `src/lib/public/cache.ts`) — SP3 imports those tags and never edits SP2a's readers.
- **`revalidateTag` takes TWO arguments in the installed Next 16.2.12**:
  `revalidateTag(tag: string, profile: string | CacheLifeConfig)` (verified in
  `node_modules/next/dist/server/web/spec-extension/revalidate.d.ts`). A one-argument
  call does not typecheck. Task 4 passed `{ expire: 0 }` rather than the documented
  `'max'` profile, because PRD 13.4 requires an editor's save to appear on the public
  site immediately while `'max'` implies stale-while-revalidate. Use the same call
  shape in every task, and if a review overturns the choice, change it everywhere at
  once rather than per screen.
- **Enum values are derived from `src/lib/supabase/database.types.ts`, never retyped.**
  This plan's own snippets inherited a stale four-value `partner_tier` from an older
  design doc; the real enum has five values. Any hand-copied enum list in this plan is
  suspect — check it against the generated types before using it.
- **Deadline past means the resource displays as Closed and is flagged in admin. Its `status` does not change.**
- **Feature flags `feature_innovator_profiles` and `feature_public_impact_page` are both off at launch.** Build the flag, not the feature.
- **`audit_log` is append-only for all roles**, and must never be given `force row level security` — the audit trigger's insert depends on the table owner not being subject to its own policies.
- **Canonical migration grants block**, in this order (`supabase/migrations/README.md`): `enable row level security` → `revoke all ... from anon, authenticated` → `grant ... to authenticated` → `grant all ... to service_role` → policies.
- **New migrations only.** Never append to a shipped migration file.
- **Test the security boundary and the logic, not the presentation.** No markup snapshots, no class-name assertions.

## File Structure

**New — the audit spine:**

| File | Responsibility |
|---|---|
| `supabase/migrations/0017_audit_triggers.sql` | `audit_change_summary()`, `audit_row_change()`, and one trigger per write-policied base table. The whole audit architecture lives here |
| `supabase/seed.sql` (modified) | Two new local-only introspection/fixture helpers: `trigger_inventory()` for G15, and `test_break_audit_log()` / `test_unbreak_audit_log()` for the atomicity test |

**New — admin data layer (`src/lib/admin/`):**

| File | Responsibility |
|---|---|
| `client.ts` | `createAdminReadClient()` — a thin named re-export of `createServerSupabase()` so no admin screen has to decide which client to use |
| `guard.ts` | `requirePageRole(allowed)` — page-level gate that `notFound()`s instead of throwing, for Settings and Users |
| `types.ts` | Admin row types and mappers: `AdminResource`, `AdminUser`, `AuditEntry`, `ContentArea` |
| `readers.ts` | Uncached, per-request reads for the admin screens. **No `unstable_cache`** — an admin editing a row must see their own write |
| `resource-view.ts` | Pure: `resourceTab`, `filterAdminResources`, `expiringSoon` |
| `audit-view.ts` | Pure: `parseAuditFilters`, `toAuditQuery` |

**New — server actions (`src/lib/actions/`):** `resources.ts`, `content.ts`, `settings.ts`, `users.ts`, `session.ts`.

**New — schemas (`src/lib/schemas/`):** `resource.ts`, `content.ts`, `settings.ts`, `user.ts`.

**New — components (`src/components/admin/`):** `AdminSidebar.tsx`, `AdminFooter.tsx`, `EmptyState.tsx`, `RoleBadge.tsx`, `ResourceTable.tsx`, `ResourceForm.tsx` (client), `StatusSelect.tsx` (client), `FeaturedToggle.tsx` (client), `ContentPanel.tsx`, `TextAreaField.tsx` (client), `StatRows.tsx` (client), `SettingsForm.tsx` (client), `UserTable.tsx`, `InviteForm.tsx` (client), `AuditTable.tsx`, `AuditFilters.tsx` (client), `SignInForm.tsx` (client), `SignOutButton.tsx` (client).

**New — routes:** `src/app/(admin)/admin/resources/page.tsx`, `resources/new/page.tsx`, `resources/[id]/page.tsx`, `content/page.tsx`, `settings/page.tsx`, `users/page.tsx`, `audit/page.tsx`, plus `error.tsx` at `(admin)/admin/`.

**Modified:** `src/app/(admin)/admin/layout.tsx`, `src/app/(admin)/admin/page.tsx`, `src/app/(admin)/admin/login/page.tsx`, `src/locales/en.json`, `src/lib/actions/README.md`, `tests/structure/routes.test.ts`, `tests/rls/security-allowlist.ts`, `tests/rls/schema-guards.test.ts`, `tests/rls/audit-log.test.ts`, `src/lib/supabase/database.types.ts` (regenerated).

## Task ordering, and why it is this order

1. **Audit spine first.** Every mutating task depends on it, and retrofitting it means every action written before it shipped unaudited. It is also the only task that can invalidate the plan's architecture if the trigger cannot do what §4 claims — finding that out first is worth more than any UI.
2. **Shell and sign in second.** Nothing is reachable without a login, and every later screen needs the role-aware layout and the page guard.
3. **Resources read, then Resources write.** A reviewer can reject the mutation surface while keeping the table.
4. **Site Content, then Settings.** Content is the editor-writable half; doing it first means the admin-only split in Settings is written against a working comparison.
5. **Users after Settings**, because it is the only task touching the service-role key and the Auth Admin API, and it should not be entangled with a first pass at forms.
6. **Audit Log last but one**, so the screen is built against real rows produced by Tasks 4–7 rather than hand-inserted fixtures.
7. **Launch sweep last:** the viewer walkthrough, service-role containment in the built bundle, and the revalidation proof.

---

### Task 1: The audit spine

**Files:**
- Create: `supabase/migrations/0017_audit_triggers.sql`
- Modify: `supabase/seed.sql` (three new local-only functions)
- Create: `tests/rls/audit-triggers.test.ts`
- Modify: `tests/rls/audit-log.test.ts` (add the trigger-written-insert case)
- Modify: `tests/rls/schema-guards.test.ts` (add G15), `tests/rls/security-allowlist.ts` (add `AUDIT_EXEMPT`)
- Regenerate: `src/lib/supabase/database.types.ts`

**Interfaces:**
- Consumes: `public.audit_log`, `public.audit_action`, `public.profiles`, `public.current_app_role()`.
- Produces:
  ```
  public.audit_sentence_case(p_value text) returns text
  public.audit_change_summary(p_action public.audit_action, p_entity_type text, p_diff jsonb) returns text
  public.audit_row_change() returns trigger
      -- TG_ARGV[0] entity_type, [1] label column, [2] label prefix, [3] comma-separated redact list
  one trigger named <table>_audit on each of the 15 write-policied base tables
  -- seed.sql only (local):
  public.trigger_inventory() returns table (table_name text, trigger_name text, function_name text, timing text, events text)
  public.test_break_audit_log() returns void
  public.test_unbreak_audit_log() returns void
  ```
- Produces, for TypeScript: nothing. No source file changes in this task.

- [ ] **Step 1: Write the failing test for the trigger's behaviour**

Create `tests/rls/audit-triggers.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { ensureTestUsers, roleClient, serviceClient } from '../helpers/clients';

/**
 * The audit row is written by a database trigger inside the mutation's own
 * transaction, not by the server action. These tests are the boundary
 * assertions for that claim: attribution the caller cannot influence, one row
 * per mutated row, and — the load-bearing one — no successful write when the
 * audit insert fails.
 */
async function newResource(svc: ReturnType<typeof serviceClient>, name: string) {
  const { data: partner } = await svc.from('partners').select('name').limit(1).single();
  const { data, error } = await svc
    .from('resources')
    .insert({
      name,
      partner: partner!.name,
      partner_tier: 'strategic',
      resource_type: 'Credits',
      need_primary: 'compute',
      description: 'Audit trigger fixture.',
      external_url: 'https://example.org/apply',
    })
    .select('id, name, status')
    .single();
    if (error) throw error;
  return data!;
}

async function auditRowsFor(entityId: string) {
  const { data, error } = await serviceClient()
    .from('audit_log')
    .select('actor, actor_name, action, entity_type, entity_id, entity_label, change_summary, diff')
    .eq('entity_id', entityId)
    .order('occurred_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

describe('audit_row_change', () => {
  beforeAll(async () => {
    await ensureTestUsers();
  });

  it('writes exactly one row for an admin edit, attributed to that admin', async () => {
    const svc = serviceClient();
    const row = await newResource(svc, `audit-edit-${Date.now()}`);
    const admin = await roleClient('admin');

    const { error } = await admin
      .from('resources')
      .update({ resource_type: 'Grant' })
      .eq('id', row.id);
    expect(error).toBeNull();

    const rows = (await auditRowsFor(row.id)).filter((r) => r.action !== 'created');
    expect(rows).toHaveLength(1);

    const { data: profile } = await svc
      .from('profiles')
      .select('id, full_name, email')
      .eq('email', 'rls-admin@askhub.test')
      .single();

    expect(rows[0].actor).toBe(profile!.id);
    expect(rows[0].actor_name).not.toBe('system');
    expect(rows[0].action).toBe('edited');
    expect(rows[0].entity_type).toBe('resource');
    // Resources appear by bare name, no prefix (PRD 4.15).
    expect(rows[0].entity_label).toBe(row.name);
    expect(rows[0].change_summary).toBe('Resource type Credits to Grant');
    expect(rows[0].diff).toEqual({ resource_type: { from: 'Credits', to: 'Grant' } });
  });

  it('records a status change to live as published, not edited', async () => {
    const svc = serviceClient();
    const row = await newResource(svc, `audit-publish-${Date.now()}`);
    const admin = await roleClient('admin');

    await admin.from('resources').update({ status: 'live' }).eq('id', row.id);

    const rows = (await auditRowsFor(row.id)).filter((r) => r.action !== 'created');
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe('published');
    // Enum-shaped values are title-cased; PRD 4.15's example is
    // "Status Pipeline to Live".
    expect(rows[0].change_summary).toBe('Status Pipeline to Live');
  });

  it('writes no row when only updated_at would change', async () => {
    const svc = serviceClient();
    const row = await newResource(svc, `audit-noop-${Date.now()}`);
    const admin = await roleClient('admin');

    await admin.from('resources').update({ resource_type: 'Credits' }).eq('id', row.id);

    const rows = (await auditRowsFor(row.id)).filter((r) => r.action !== 'created');
    expect(rows).toHaveLength(0);
  });

  it('records a delete, and the row survives the entity it describes', async () => {
    const svc = serviceClient();
    const row = await newResource(svc, `audit-delete-${Date.now()}`);
    const admin = await roleClient('admin');

    const { error } = await admin.from('resources').delete().eq('id', row.id);
    expect(error).toBeNull();

    const rows = await auditRowsFor(row.id);
    const deleted = rows.filter((r) => r.action === 'deleted');
    expect(deleted).toHaveLength(1);
    expect(deleted[0].entity_label).toBe(row.name);
    expect(deleted[0].change_summary).toBe('Deleted');
  });

  it('attributes a service_role write to the system sentinel, not to a person', async () => {
    const svc = serviceClient();
    const row = await newResource(svc, `audit-system-${Date.now()}`);
    const rows = await auditRowsFor(row.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe('created');
    expect(rows[0].actor).toBeNull();
    expect(rows[0].actor_name).toBe('system');
  });

  it('prefixes every non-resource entity label per the 4.15 convention', async () => {
    const admin = await roleClient('admin');
    await admin
      .from('site_content')
      .update({ value: `About intro ${Date.now()}` })
      .eq('key', 'about_intro')
      .eq('locale', 'en');

    const { data } = await serviceClient()
      .from('audit_log')
      .select('entity_type, entity_label')
      .eq('entity_type', 'site_content')
      .order('occurred_at', { ascending: false })
      .limit(1);
    expect(data![0].entity_label).toBe('Site content: about_intro');
  });

  it('redacts a subscriber email from both the label and the diff', async () => {
    const svc = serviceClient();
    const email = `audit-sub-${Date.now()}@example.org`;
    const { data: sub, error: insertError } = await svc
      .from('subscribers')
      .insert({ email, categories: ['compute'], consent_at: new Date().toISOString() })
      .select('id')
      .single();
    if (insertError) throw insertError;

    const admin = await roleClient('admin');
    await admin.from('subscribers').update({ country: 'Kenya' }).eq('id', sub!.id);

    const rows = await auditRowsFor(sub!.id);
    const serialised = JSON.stringify(rows);
    expect(serialised).not.toContain(email);
    // The fact of the account is recorded; the address is not.
    expect(rows.some((r) => r.entity_label.startsWith('Subscriber: a***@'))).toBe(true);
  });

  it('records a role change as role_changed', async () => {
    const svc = serviceClient();
    const admin = await roleClient('admin');
    const { data: viewer } = await svc
      .from('profiles')
      .select('id, role')
      .eq('email', 'rls-viewer@askhub.test')
      .single();

    await admin.from('profiles').update({ role: 'editor' }).eq('id', viewer!.id);
    await admin.from('profiles').update({ role: 'viewer' }).eq('id', viewer!.id);

    const rows = await auditRowsFor(viewer!.id);
    const changes = rows.filter((r) => r.action === 'role_changed');
    expect(changes.length).toBeGreaterThanOrEqual(2);
    expect(changes.at(-1)!.change_summary).toBe('Role Editor to Viewer');
    expect(changes.at(-1)!.entity_label.startsWith('User: ')).toBe(true);
  });

  it('does not let a viewer produce an audit row, because it cannot write at all', async () => {
    const svc = serviceClient();
    const row = await newResource(svc, `audit-viewer-${Date.now()}`);
    const viewer = await roleClient('viewer');

    const { error } = await viewer.from('resources').update({ resource_type: 'Grant' }).eq('id', row.id);
    // RLS refuses the update; PostgREST reports zero rows affected rather than
    // an error for an UPDATE no policy admits, so assert on the data instead.
    const { data: after } = await svc.from('resources').select('resource_type').eq('id', row.id).single();
    expect(after!.resource_type).toBe('Credits');
    const rows = (await auditRowsFor(row.id)).filter((r) => r.action !== 'created');
    expect(rows, `viewer write produced an audit row: ${JSON.stringify(error)}`).toHaveLength(0);
  });
});

describe('a failed audit insert aborts the mutation', () => {
  beforeAll(async () => {
    await ensureTestUsers();
  });

  it('leaves the row unchanged rather than committing an unaudited write', async () => {
    const svc = serviceClient();
    const row = await newResource(svc, `audit-atomic-${Date.now()}`);
    const admin = await roleClient('admin');

    // Local-only helper (supabase/seed.sql): adds `check (false) not valid` to
    // audit_log, so every new audit insert fails while existing rows are left
    // alone. This is the only way to prove property 3 of spec 4.2 rather than
    // asserting it.
    const broke = await svc.rpc('test_break_audit_log');
    expect(broke.error).toBeNull();

    try {
      const { error } = await admin
        .from('resources')
        .update({ resource_type: 'Grant' })
        .eq('id', row.id);
      expect(error, 'the mutation must fail when its audit row cannot be written').not.toBeNull();

      const { data: after } = await svc
        .from('resources')
        .select('resource_type')
        .eq('id', row.id)
        .single();
      expect(after!.resource_type, 'an unaudited write was committed').toBe('Credits');
    } finally {
      const fixed = await svc.rpc('test_unbreak_audit_log');
      expect(fixed.error).toBeNull();
    }

    // And the same edit succeeds once auditing works again, so the test did
    // not simply prove the table was broken.
    const { error: retry } = await admin
      .from('resources')
      .update({ resource_type: 'Grant' })
      .eq('id', row.id);
    expect(retry).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/rls/audit-triggers.test.ts`
Expected: FAIL — no audit rows exist for any mutation, and `test_break_audit_log` does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0017_audit_triggers.sql`:

```sql
-- The audit spine.
--
-- Why the database writes these rows rather than the server action that
-- caused them: audit_log has no insert policy for any role (0007_logs.sql),
-- so an action running on the caller's session cannot insert its own audit
-- row. The obvious workaround -- do the mutation on the caller's client and
-- the audit insert on the service_role client -- puts the two writes on two
-- connections, which means two transactions, which means the pair can end up
-- inconsistent in either direction: a committed mutation with no audit row,
-- or an audit row for a mutation that rolled back. On an accountability
-- surface for a UN programme the first is unacceptable as a normal operating
-- mode, and it is also a large security concession: it would put a key that
-- bypasses RLS entirely on the critical path of the product's most common
-- write.
--
-- A trigger runs inside the statement that fired it. So the audit row shares
-- the mutation's transaction, an exception in the trigger aborts the
-- mutation, and there is no code path that can produce a successful
-- unaudited write. The mutation itself still runs as the caller and is still
-- subject to its own RLS policies -- nothing here widens what anyone may
-- write, it only records what they did.
--
-- SECURITY DEFINER is required because audit_log denies INSERT to every
-- role. These functions are owned by the role that owns every base table in
-- this schema (asserted by schema guard G8), and that owner is not subject to
-- audit_log's policies. That is load-bearing: audit_log must NEVER be given
-- `force row level security`, or every audited write in the product starts
-- failing at once.
--
-- The append-only triggers in 0007 are unaffected: they raise on UPDATE and
-- DELETE only, and this function only ever inserts.

-- The change_summary formatter (PRD 4.15: generated at write time, keyed on
-- entity_type and action, prose rather than a JSON dump).
--
-- Composing English in SQL is a deliberate, documented exception to the
-- project's no-hardcoded-strings rule, not an oversight. An audit entry is an
-- immutable historical record: it has to read at any later date exactly as it
-- read when written, which is the opposite of what translating it at display
-- time would do -- localising the contents would re-render history in
-- whichever language the reader picked. Everything AROUND the log (column
-- headers, filters, action badges, the `system` actor) is localised normally.
-- Sentence case, NOT initcap. `initcap('resource_type')` gives "Resource
-- Type" and `initcap('in_discussion')` gives "In Discussion", while PRD
-- 4.15's own examples are "Status Pipeline to Live" and "Stage In discussion"
-- -- first letter only, the rest left alone. Capitalising every word would
-- also mangle any value that is a phrase.
create or replace function public.audit_sentence_case(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(p_value, '') = '' then ''
    else upper(left(replace(p_value, '_', ' '), 1)) || substr(replace(p_value, '_', ' '), 2)
  end;
$$;

revoke all on function public.audit_sentence_case(text) from public, anon, authenticated;

create or replace function public.audit_change_summary(
  p_action public.audit_action,
  p_entity_type text,
  p_diff jsonb
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_keys text[];
  v_key text;
  v_from text;
  v_to text;
begin
  if p_action = 'created' then
    return 'Created';
  elsif p_action = 'deleted' then
    return 'Deleted';
  end if;

  select array_agg(k.key order by k.key)
    into v_keys
    from jsonb_object_keys(coalesce(p_diff, '{}'::jsonb)) as k(key);

  if v_keys is null then
    return 'Edited';
  end if;

  if array_length(v_keys, 1) = 1 then
    v_key := v_keys[1];
    v_from := coalesce(p_diff -> v_key ->> 'from', '');
    v_to := coalesce(p_diff -> v_key ->> 'to', '');

    -- Enum-shaped and other lower_snake values get sentence case so the
    -- sentence reads as PRD 4.15's examples do: 'pipeline' -> 'Pipeline',
    -- 'in_discussion' -> 'In discussion'. Anything else -- a stat value like
    -- "150+", a paragraph of copy -- is left exactly as stored: a summary
    -- must not restyle the content it is reporting.
    if v_from ~ '^[a-z][a-z_]*$' then
      v_from := public.audit_sentence_case(v_from);
    end if;
    if v_to ~ '^[a-z][a-z_]*$' then
      v_to := public.audit_sentence_case(v_to);
    end if;

    -- The from-to form is used consistently rather than the shorter
    -- new-value-only phrasing PRD 4.15 shows for a stage change: it
    -- reproduces that section's first example exactly ("Status Pipeline to
    -- Live") and carries strictly more information than the third.
    --
    -- Note also where 4.15's second example lands. "Updated 'extended
    -- network' stat to 150+" names the entity and the change in one string;
    -- here those are two columns, and the Audit Log renders them side by
    -- side -- ITEM "Headline stat: Extended network", CHANGE "Value 120+ to
    -- 150+". The sentence the operator reads across the row is the PRD's;
    -- nothing was dropped.
    if v_from <> '' and length(v_from) <= 80 and length(v_to) <= 80 then
      return public.audit_sentence_case(v_key) || ' ' || v_from || ' to ' || v_to;
    elsif length(v_to) <= 80 then
      return 'Updated ' || replace(v_key, '_', ' ') || ' to ' || v_to;
    else
      return 'Updated ' || replace(v_key, '_', ' ');
    end if;
  end if;

  return 'Updated ' || array_length(v_keys, 1) || ' fields: '
    || (select string_agg(replace(k, '_', ' '), ', ' order by k) from unnest(v_keys) as k);
end;
$$;

-- Same revoke as every other function in this schema (0010_function_grants.sql
-- exists because Postgres grants EXECUTE to PUBLIC by default and PostgREST
-- exposes every public function at /rpc/<name>). Nothing calls this except
-- audit_row_change() below, which runs as the owner and does not need a
-- grant.
revoke all on function public.audit_change_summary(public.audit_action, text, jsonb)
  from public, anon, authenticated;

comment on function public.audit_change_summary(public.audit_action, text, jsonb) is
  'Renders audit_log.change_summary from a diff at write time (PRD 4.15). English by design: an audit entry must read later exactly as it read when written.';

-- The trigger body. One function for every audited table; per-table variation
-- comes in as trigger arguments:
--
--   TG_ARGV[0]  entity_type          e.g. 'resource', 'site_content', 'user'
--   TG_ARGV[1]  label column         which column holds the human label
--   TG_ARGV[2]  label prefix         '' for resources (bare name, PRD 4.15),
--                                    'Partnership: ' etc. for everything else
--   TG_ARGV[3]  redact list          comma-separated columns whose VALUES must
--                                    never reach audit_log
--
-- There is deliberately NO dynamic SQL in this function. Per-column access
-- goes through to_jsonb(new) / to_jsonb(old) by key, so even a future caller
-- who controls the trigger arguments cannot make it execute a statement.
-- Together with `set search_path = ''` and the revoke below, and with the
-- fact that a trigger function called directly errors with "trigger functions
-- can only be called as triggers" before its body runs, this exposes no
-- callable privilege-escalation surface.
--
-- The actor is resolved from auth.uid() and never from an argument. An action
-- cannot attribute its mutation to someone else, because it does not write
-- the audit row at all.
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity_type text := tg_argv[0];
  v_label_column text := tg_argv[1];
  v_label_prefix text := coalesce(tg_argv[2], '');
  v_redact text[] := case
    when coalesce(tg_argv[3], '') = '' then '{}'::text[]
    else string_to_array(tg_argv[3], ',')
  end;
  v_actor uuid;
  v_actor_name text;
  v_before jsonb;
  v_after jsonb;
  v_diff jsonb;
  v_action public.audit_action;
  v_label text;
  v_entity_id uuid;
begin
  select p.id,
         coalesce(
           nullif(btrim(p.full_name), ''),
           nullif(btrim(p.display_label), ''),
           p.email
         )
    into v_actor, v_actor_name
    from public.profiles p
   where p.user_id = auth.uid();

  -- No authenticated caller: a seed script, a migration, an ops script, or
  -- the Auth Admin API's own transaction. 'system' is accurate rather than
  -- decorative -- at that instant no person made the write. The Audit Log
  -- screen renders this sentinel through a locale key.
  if v_actor_name is null then
    v_actor_name := 'system';
  end if;

  if tg_op = 'INSERT' then
    v_before := '{}'::jsonb;
    v_after := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
  else
    v_before := to_jsonb(old);
    v_after := '{}'::jsonb;
  end if;

  -- Bookkeeping columns are noise: updated_at changes on every write by
  -- definition (set_updated_at), and created_at never changes at all.
  v_before := v_before - 'updated_at' - 'created_at';
  v_after := v_after - 'updated_at' - 'created_at';

  select coalesce(
           jsonb_object_agg(
             k.key,
             case
               when k.key = any(v_redact)
                 then jsonb_build_object('from', '[redacted]', 'to', '[redacted]')
               else jsonb_build_object('from', v_before -> k.key, 'to', v_after -> k.key)
             end
           ),
           '{}'::jsonb
         )
    into v_diff
    from jsonb_object_keys(v_before || v_after) as k(key)
   where (v_before -> k.key) is distinct from (v_after -> k.key);

  -- An update whose only difference was updated_at is not a change anyone
  -- needs a record of.
  if tg_op = 'UPDATE' and v_diff = '{}'::jsonb then
    return null;
  end if;

  if tg_op = 'INSERT' then
    v_action := 'created';
  elsif tg_op = 'DELETE' then
    v_action := 'deleted';
  elsif v_entity_type = 'resource' and v_diff ? 'status' and v_after ->> 'status' = 'live' then
    v_action := 'published';
  elsif v_entity_type = 'user' and v_diff ? 'role' then
    v_action := 'role_changed';
  else
    v_action := 'edited';
  end if;

  v_label := btrim(coalesce(v_after ->> v_label_column, v_before ->> v_label_column, ''));

  -- A label column that is itself redacted is masked rather than dropped:
  -- audit_log is readable by all three roles, viewer included, so a
  -- subscriber's or a submitter's address must not be readable there, while
  -- the fact that a specific account changed still has to be recorded.
  if v_label_column = any(v_redact) then
    v_label := case
      when position('@' in v_label) > 1
        then left(v_label, 1) || '***@' || split_part(v_label, '@', 2)
      else '[redacted]'
    end;
  end if;

  v_label := v_label_prefix || left(coalesce(nullif(v_label, ''), v_entity_type), 120);

  v_entity_id := nullif(coalesce(v_after ->> 'id', v_before ->> 'id'), '')::uuid;

  insert into public.audit_log (
    actor, actor_name, action, entity_type, entity_id, entity_label,
    change_summary, diff
  )
  values (
    v_actor,
    v_actor_name,
    v_action,
    v_entity_type,
    v_entity_id,
    v_label,
    public.audit_change_summary(v_action, v_entity_type, v_diff),
    v_diff
  );

  -- ip_hash and user_agent are left null on purpose. The only values a
  -- trigger can see are PostgREST's request.headers, which for a server
  -- action describe the Next.js server that made the call, not the
  -- operator's browser. Recording the server's own user-agent in a forensic
  -- column would be a fabricated value dressed as evidence.

  return null;
end;
$$;

revoke all on function public.audit_row_change() from public, anon, authenticated;

comment on function public.audit_row_change() is
  'Writes the audit_log row for a mutation, inside that mutation''s own transaction. Actor comes from auth.uid(), never from an argument. A failure here aborts the mutation, which is the point: there is no path to a successful unaudited write.';

-- One trigger per base table that has any write policy -- all fifteen, not
-- only the eight the launch screens touch. The deferred tables cost one line
-- each, and covering them now means no future screen can ship against an
-- unaudited table by omission. Guard G15 asserts this set stays complete.
--
-- AFTER, not BEFORE: the row must be recorded as it ended up, including the
-- id a default generated and the updated_at set_updated_at wrote.

create trigger resources_audit
  after insert or update or delete on public.resources
  for each row execute function public.audit_row_change('resource', 'name', '', '');

create trigger partners_audit
  after insert or update or delete on public.partners
  for each row execute function public.audit_row_change('partner', 'name', 'Partner: ', '');

create trigger partnerships_audit
  after insert or update or delete on public.partnerships
  for each row execute function public.audit_row_change('partnership', 'organisation', 'Partnership: ', '');

create trigger submissions_audit
  after insert or update or delete on public.submissions
  for each row execute function public.audit_row_change('submission', 'resource_name', 'Submission: ', 'submitter_email,source_ip_hash');

create trigger subscribers_audit
  after insert or update or delete on public.subscribers
  for each row execute function public.audit_row_change('subscriber', 'email', 'Subscriber: ', 'email,confirm_token,unsubscribe_token');

create trigger contact_messages_audit
  after insert or update or delete on public.contact_messages
  for each row execute function public.audit_row_change('contact_message', 'email', 'Contact: ', 'email,name,message,source_ip_hash');

create trigger digest_sends_audit
  after insert or update or delete on public.digest_sends
  for each row execute function public.audit_row_change('digest_send', 'subject', 'Digest: ', '');

create trigger site_content_audit
  after insert or update or delete on public.site_content
  for each row execute function public.audit_row_change('site_content', 'key', 'Site content: ', '');

create trigger headline_stats_audit
  after insert or update or delete on public.headline_stats
  for each row execute function public.audit_row_change('headline_stat', 'label', 'Headline stat: ', '');

create trigger compute_metrics_audit
  after insert or update or delete on public.compute_metrics
  for each row execute function public.audit_row_change('compute_metric', 'label', 'Compute metric: ', '');

create trigger programmes_audit
  after insert or update or delete on public.programmes
  for each row execute function public.audit_row_change('programme', 'title', 'Programme: ', '');

create trigger impact_stories_audit
  after insert or update or delete on public.impact_stories
  for each row execute function public.audit_row_change('impact_story', 'organisation', 'Impact story: ', '');

create trigger updates_log_audit
  after insert or update or delete on public.updates_log
  for each row execute function public.audit_row_change('update_note', 'text', 'Update: ', '');

create trigger settings_audit
  after insert or update or delete on public.settings
  for each row execute function public.audit_row_change('setting', 'key', 'Setting: ', '');

create trigger profiles_audit
  after insert or update or delete on public.profiles
  for each row execute function public.audit_row_change('user', 'full_name', 'User: ', '');
```

- [ ] **Step 4: Add the local-only test helpers to `supabase/seed.sql`**

Append to `supabase/seed.sql`, following the file's existing convention for introspection helpers (`security definer`, pinned `search_path`, revoked from everyone, granted to `service_role` only):

```sql
-- Trigger inventory for schema guard G15. Same pattern and same grants as
-- relation_privileges() and function_privileges() above: local-only, needed
-- because information_schema.triggers is not reachable through PostgREST.
create or replace function public.trigger_inventory()
returns table (
  table_name text,
  trigger_name text,
  function_name text,
  arguments text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.relname::text,
         t.tgname::text,
         p.proname::text,
         coalesce(
           (select string_agg(a, ',')
              from unnest(string_to_array(
                     encode(t.tgargs, 'escape'), '\000')) as a
             where a <> ''),
           ''
         )
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    join pg_catalog.pg_proc p on p.oid = t.tgfoid
   where n.nspname = 'public'
     and not t.tgisinternal
$$;

revoke all on function public.trigger_inventory() from public, anon, authenticated;
grant execute on function public.trigger_inventory() to service_role;

-- Deliberately breaks the audit insert so a test can prove that a mutation
-- fails rather than committing unaudited (spec 4.2, property 3). `not valid`
-- is what makes this possible: the constraint is enforced on new inserts
-- while existing audit rows -- which other suites depend on -- are left
-- alone.
--
-- Lives in seed.sql, which only ever runs against the local stack via
-- `supabase db reset`. It is not a migration and must never become one.
create or replace function public.test_break_audit_log()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  alter table public.audit_log
    add constraint audit_log_test_break check (false) not valid;
end;
$$;

create or replace function public.test_unbreak_audit_log()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  alter table public.audit_log drop constraint if exists audit_log_test_break;
end;
$$;

revoke all on function public.test_break_audit_log() from public, anon, authenticated;
revoke all on function public.test_unbreak_audit_log() from public, anon, authenticated;
grant execute on function public.test_break_audit_log() to service_role;
grant execute on function public.test_unbreak_audit_log() to service_role;
```

- [ ] **Step 5: Apply and run the trigger tests**

Run: `npm run db:reset && npx vitest run tests/rls/audit-triggers.test.ts`
Expected: PASS (10 tests). If `change_summary` assertions fail on capitalisation, fix `audit_change_summary`, not the test — the strings in the test are PRD §4.15's own examples.

Run: `npm run db:types` and confirm the diff adds `audit_change_summary` under `Database['public']['Functions']` and nothing else unexpected.

- [ ] **Step 6: Add G15 to the schema guards**

In `tests/rls/security-allowlist.ts`, add the registry:

```ts
/**
 * Base tables that legitimately carry NO audit trigger. Two entries, and
 * both are exemptions of principle rather than of convenience — the point of
 * G15 is that a new screen cannot ship against an unaudited table by
 * omission, so this list must stay this short.
 */
export const AUDIT_EXEMPT: Record<string, { approvedIn: string; why: string }> = {
  audit_log: {
    approvedIn: 'SP3-T1',
    why: 'Has no write policy for any role and is append-only by trigger; auditing the audit log is circular.',
  },
  engagement_events: {
    approvedIn: 'SP3-T1',
    why: 'A high-volume first-party event stream that IS the record of its own writes. Mirroring every page view into audit_log would bury who-did-what under machine traffic.',
  },
};

export const EXPECTED_AUDIT_EXEMPT = 2;
```

In `tests/rls/schema-guards.test.ts`, import `AUDIT_EXEMPT` and `EXPECTED_AUDIT_EXEMPT`, add `svc.rpc('trigger_inventory', {}, { count: 'exact' })` to the Guard 0 resolve list, and add:

```ts
  it('G15: every base table with a write policy carries an audit trigger', async () => {
    const { data: triggers } = await serviceClient().rpc('trigger_inventory');
    const audited = new Set(
      (triggers ?? [])
        .filter((t: { function_name: string }) => t.function_name === 'audit_row_change')
        .map((t: { table_name: string }) => t.table_name),
    );

    // Any policy that is not SELECT-only is a write path, and every write
    // path must be recorded. policy_inventory() is the same helper G5 uses.
    const writePolicied = new Set(
      policies
        .filter((p) => p.command !== 'SELECT')
        .map((p) => p.table_name),
    );

    const offenders = [...writePolicied]
      .filter((table) => !audited.has(table) && !(table in AUDIT_EXEMPT))
      .sort();

    expect(Object.keys(AUDIT_EXEMPT).length).toBe(EXPECTED_AUDIT_EXEMPT);
    expect(
      offenders,
      'A table with a write policy and no audit trigger is an unaudited write path. Attach public.audit_row_change in a migration, or register the table in AUDIT_EXEMPT with a reason.',
    ).toEqual([]);
  });
```

Adapt the property names (`command`, `table_name`) to whatever `policy_inventory()` actually returns — read the function in `supabase/seed.sql` and the existing G5 assertion rather than guessing.

- [ ] **Step 7: Extend the append-only test**

In `tests/rls/audit-log.test.ts`, keep every existing case and add:

```ts
  it('accepts the trigger-written insert while still refusing a direct one', async () => {
    await ensureTestUsers();
    const admin = await roleClient('admin');

    // Direct insert: still refused, exactly as before. The trigger changed
    // how rows arrive, not who may write them by hand.
    const direct = await admin.from('audit_log').insert({
      actor_name: 'hand-written',
      action: 'edited',
      entity_type: 'resource',
      entity_label: 'hand-written',
      change_summary: 'hand-written',
    });
    expect(direct.error).not.toBeNull();

    // Trigger-written: succeeds, as the mutation's own side effect.
    const before = await serviceClient()
      .from('audit_log')
      .select('id', { count: 'exact', head: true });
    await admin
      .from('site_content')
      .update({ value: `About intro ${Date.now()}` })
      .eq('key', 'about_intro')
      .eq('locale', 'en');
    const after = await serviceClient()
      .from('audit_log')
      .select('id', { count: 'exact', head: true });
    expect((after.count ?? 0) - (before.count ?? 0)).toBe(1);
  });
```

- [ ] **Step 8: Check the server-action contract, and name the migration in it**

`src/lib/actions/README.md` was already corrected on the `sp3-admin-design`
branch: its `audit_log` bullet now says not to write the row and not to pass an
actor, explains why the service-role-client alternative is wrong, and points at
the RPC hatch. Read it before writing any action in Tasks 4–7 — it is the
binding contract for this folder.

One edit belongs to this task: the README describes the trigger without naming
the file it lives in, because the migration did not exist when it was written.
Add the reference now that it does — `supabase/migrations/0017_audit_triggers.sql`
— so the next reader can go straight to the mechanism rather than grepping for
it. Change nothing else; if you find yourself wanting to soften the
"do not use `createAdminSupabase()` here" paragraph, that is the design
decision in spec §4.1 and it is not this task's to reopen.

- [ ] **Step 9: Full verification**

Run: `npm run db:reset && npm test && npm run typecheck && npm run lint`
Expected: PASS, including G15 and the unchanged G1–G14.

- [ ] **Step 10: Commit**

```bash
git add supabase/migrations/0017_audit_triggers.sql supabase/seed.sql tests/rls/audit-triggers.test.ts tests/rls/audit-log.test.ts tests/rls/schema-guards.test.ts tests/rls/security-allowlist.ts src/lib/supabase/database.types.ts src/lib/actions/README.md
git commit -m "feat(admin): audit rows written by the database, in the mutation's transaction

audit_log has no insert policy for any role, so an action on the caller's
session cannot write its own audit row. Doing it with the service_role client
instead would put the two writes on two connections -- two transactions, and a
pair that can end up inconsistent in either direction. A committed mutation
with no audit row is not acceptable as a normal operating mode on this surface.

A trigger runs inside the statement that fired it, so the audit row shares the
mutation's transaction and an exception in the trigger aborts the mutation.
There is now no code path that produces a successful unaudited write, and the
atomicity test proves it by breaking the audit insert and asserting the edit
did not land.

Attached to all fifteen write-policied tables, not just the eight the launch
screens touch, so no later screen can ship against an unaudited table by
omission. G15 keeps that set complete. The actor comes from auth.uid() and
never from an argument."
```

---

### Task 2: Sign in, the admin shell, and an honest Dashboard

**Files:**
- Modify: `src/app/(admin)/admin/login/page.tsx`, `src/app/(admin)/admin/layout.tsx`, `src/app/(admin)/admin/page.tsx`
- Create: `src/app/(admin)/admin/error.tsx`
- Create: `src/lib/admin/client.ts`, `src/lib/admin/guard.ts`, `src/lib/admin/readers.ts`
- Create: `src/lib/actions/session.ts`
- Create: `src/components/admin/AdminSidebar.tsx`, `AdminFooter.tsx`, `EmptyState.tsx`, `SignInForm.tsx`, `SignOutButton.tsx`
- Create: `tests/unit/admin-guard.test.ts`, `tests/unit/admin-nav.test.ts`
- Modify: `src/locales/en.json`, `tests/structure/routes.test.ts`

**Interfaces:**
- Consumes: `requireRole`, `getCurrentUser`, `CurrentUser`, `Role` from `@/lib/auth`; `createServerSupabase` from `@/lib/supabase/server`; `t` from `@/lib/i18n`.
- Produces:
  ```ts
  // src/lib/admin/client.ts
  export function createAdminReadClient(): ReturnType<typeof createServerSupabase>;

  // src/lib/admin/guard.ts
  export function visibleNavItems(role: Role): readonly NavItem[];
  export interface NavItem { href: string; labelKey: string; adminOnly: boolean }
  export const NAV_ITEMS: readonly NavItem[];
  export function requirePageRole(allowed: Role[]): Promise<CurrentUser>;  // notFound() instead of throwing
  export function canWrite(role: Role): boolean;   // admin | editor
  export function canAdminister(role: Role): boolean;  // admin only

  // src/lib/admin/readers.ts
  export interface ResourceCounts { live: number; pipeline: number; reference: number; expiringSoon: number }
  export function readResourceCounts(): Promise<ResourceCounts>;

  // src/lib/actions/session.ts
  export async function signIn(formData: FormData): Promise<{ error: string } | void>;
  export async function signOut(): Promise<void>;
  ```

- [ ] **Step 1: Write the failing test for navigation and the write predicates**

Create `tests/unit/admin-nav.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { NAV_ITEMS, visibleNavItems, canWrite, canAdminister } from '@/lib/admin/guard';

describe('visibleNavItems', () => {
  it('shows every launch screen to an admin', () => {
    expect(visibleNavItems('admin').map((i) => i.href)).toEqual([
      '/admin',
      '/admin/resources',
      '/admin/content',
      '/admin/settings',
      '/admin/users',
      '/admin/audit',
    ]);
  });

  it('hides Settings and Users from an editor', () => {
    const hrefs = visibleNavItems('editor').map((i) => i.href);
    expect(hrefs).not.toContain('/admin/settings');
    expect(hrefs).not.toContain('/admin/users');
    expect(hrefs).toContain('/admin/content');
  });

  it('hides Settings and Users from a viewer too', () => {
    const hrefs = visibleNavItems('viewer').map((i) => i.href);
    expect(hrefs).toEqual(['/admin', '/admin/resources', '/admin/content', '/admin/audit']);
  });

  it('links to no deferred screen', () => {
    // The deferred screens have no route (spec 2). A nav entry pointing at a
    // route that does not exist is a 404 waiting to be clicked, and a
    // disabled "coming soon" entry invites the question of when.
    const hrefs = NAV_ITEMS.map((i) => i.href);
    for (const deferred of [
      '/admin/subscribers',
      '/admin/partnerships',
      '/admin/reach',
      '/admin/review',
      '/admin/updates',
    ]) {
      expect(hrefs).not.toContain(deferred);
    }
  });

  it('names a locale key for every label, never a literal', () => {
    for (const item of NAV_ITEMS) {
      expect(item.labelKey).toMatch(/^admin\.nav\./);
    }
  });
});

describe('write predicates', () => {
  it('lets admin and editor write, and viewer never', () => {
    expect(canWrite('admin')).toBe(true);
    expect(canWrite('editor')).toBe(true);
    expect(canWrite('viewer')).toBe(false);
  });

  it('reserves administration for admin', () => {
    expect(canAdminister('admin')).toBe(true);
    expect(canAdminister('editor')).toBe(false);
    expect(canAdminister('viewer')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/admin-nav.test.ts`
Expected: FAIL with "Failed to resolve import @/lib/admin/guard".

- [ ] **Step 3: Write the guard module**

Create `src/lib/admin/guard.ts`:

```ts
import 'server-only';
import { notFound } from 'next/navigation';
import { requireRole, type CurrentUser, type Role } from '@/lib/auth';

export interface NavItem {
  href: string;
  labelKey: string;
  adminOnly: boolean;
}

/**
 * The launch sidebar (spec 1). Deferred screens are absent rather than
 * disabled: a route that does not exist asks no questions, while a greyed-out
 * "Subscribers" entry reads as a broken feature.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/admin', labelKey: 'admin.nav.dashboard', adminOnly: false },
  { href: '/admin/resources', labelKey: 'admin.nav.resources', adminOnly: false },
  { href: '/admin/content', labelKey: 'admin.nav.content', adminOnly: false },
  { href: '/admin/settings', labelKey: 'admin.nav.settings', adminOnly: true },
  { href: '/admin/users', labelKey: 'admin.nav.users', adminOnly: true },
  { href: '/admin/audit', labelKey: 'admin.nav.audit', adminOnly: false },
];

export function canWrite(role: Role): boolean {
  return role === 'admin' || role === 'editor';
}

export function canAdminister(role: Role): boolean {
  return role === 'admin';
}

export function visibleNavItems(role: Role): readonly NavItem[] {
  return NAV_ITEMS.filter((item) => !item.adminOnly || canAdminister(role));
}

/**
 * Page-level gate. `requireRole` throws, which is right for an action — the
 * caller gets FORBIDDEN and the client shows it. For a page, a role that may
 * not see the screen should be told the screen does not exist: `notFound()`
 * rather than a redirect carrying a message, because whether /admin/settings
 * exists is not information a non-admin needs.
 *
 * This is not the security boundary. Every action on these pages calls
 * `requireRole` for itself, and RLS refuses the write regardless.
 */
export async function requirePageRole(allowed: Role[]): Promise<CurrentUser> {
  try {
    return await requireRole(allowed);
  } catch {
    notFound();
  }
}
```

- [ ] **Step 4: Run the nav test to verify it passes**

Run: `npx vitest run tests/unit/admin-nav.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Add the locale keys**

Add to `src/locales/en.json` (flat, every value non-empty — both asserted by `tests/unit/i18n.test.ts`):

```json
  "admin.nav.dashboard": "Dashboard",
  "admin.nav.resources": "Resources",
  "admin.nav.content": "Site Content",
  "admin.nav.settings": "Settings",
  "admin.nav.users": "Users",
  "admin.nav.audit": "Audit Log",
  "admin.footer.viewSite": "View site",
  "admin.footer.signOut": "Sign out",
  "admin.login.heading": "Sign in",
  "admin.login.intro": "Administration for the AI Hub for Sustainable Development directory, co-led by MIMIT and UNDP.",
  "admin.login.email": "Email address",
  "admin.login.password": "Password",
  "admin.login.submit": "Sign in",
  "admin.login.failed": "That email address and password did not match an active account.",
  "admin.login.noSignup": "Accounts are created by an administrator. There is no sign-up.",
  "admin.dashboard.heading": "Dashboard",
  "admin.dashboard.resourcesLive": "Resources live",
  "admin.dashboard.resourcesPipeline": "In pipeline",
  "admin.dashboard.resourcesReference": "Reference only",
  "admin.dashboard.expiringSoon": "Deadlines within 14 days",
  "admin.dashboard.reportingUnavailableHeading": "Reach and engagement reporting is not available yet",
  "admin.dashboard.reportingUnavailableBody": "Visit and click reporting starts once event capture is live and a GA4 Measurement ID is set. Until then this screen shows only figures that can be counted from the directory itself.",
  "admin.empty.noRows": "Nothing here yet."
```

The reporting-unavailable copy is the spec §7 decision 3 wording; it names the missing dependency instead of showing an empty chart, and it is copy K&S may revise without touching code.

- [ ] **Step 6: Write the counts reader**

Create `src/lib/admin/client.ts`:

```ts
import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * The admin surface's only database client: request-scoped, carrying the
 * caller's cookies, so every read is evaluated by RLS as that user.
 *
 * Named separately from createServerSupabase so no admin screen has to make
 * the choice. Never the anon client (it holds only the *_public views, which
 * strip the status and provenance columns these screens exist to edit) and
 * never the service_role client (its reads would show a viewer rows their own
 * policies deny).
 */
export function createAdminReadClient() {
  return createServerSupabase();
}
```

Create `src/lib/admin/readers.ts`:

```ts
import 'server-only';
import { createAdminReadClient } from './client';
import { deadlineInfo } from '@/lib/deadline';

export interface ResourceCounts {
  live: number;
  pipeline: number;
  reference: number;
  expiringSoon: number;
}

/**
 * Uncached, deliberately. Admin reads are per-request: an editor who has just
 * saved must see their own write, and `unstable_cache` here would serve them
 * the row they just replaced. Caching belongs to the public surface, which is
 * the same read for every visitor.
 *
 * These four numbers are counted from `resources` and are therefore real.
 * Nothing on the Dashboard may show a figure that is not (CLAUDE.md).
 */
export async function readResourceCounts(): Promise<ResourceCounts> {
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase.from('resources').select('status, deadline');
  if (error) throw new Error(`admin read failed (resources): ${error.message}`);

  const rows = data ?? [];
  return {
    live: rows.filter((r) => r.status === 'live').length,
    pipeline: rows.filter((r) => r.status === 'pipeline').length,
    reference: rows.filter((r) => r.status === 'reference').length,
    // deadlineInfo returns a four-value `state`, not booleans:
    // 'rolling' | 'open' | 'expiring' | 'closed', with EXPIRING_SOON_DAYS = 14.
    // Use it; do not re-implement the 14-day rule here.
    expiringSoon: rows.filter((r) => deadlineInfo(r.deadline).state === 'expiring').length,
  };
}
```

- [ ] **Step 7: Write the session actions**

Create `src/lib/actions/session.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase/server';
import { t } from '@/lib/i18n';

const credentials = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
});

/**
 * Sign in. Not gated by requireRole — this is the one admin path that must
 * work with no session.
 *
 * One message for every failure mode. Distinguishing "no such account" from
 * "wrong password" from "deactivated" would confirm which addresses hold
 * accounts on a UN programme's admin portal, and PRD 14.5 forbids the
 * disclosure. `getCurrentUser()` already makes a deactivated account
 * indistinguishable from no account, so the deactivated case needs no
 * special handling here.
 */
export async function signIn(formData: FormData): Promise<{ error: string } | void> {
  const parsed = credentials.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: t('admin.login.failed') };

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: t('admin.login.failed') };

  redirect('/admin');
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect('/admin/login');
}
```

- [ ] **Step 8: Write the shell components**

Create `src/components/admin/AdminSidebar.tsx`:

```tsx
import Link from 'next/link';
import { visibleNavItems } from '@/lib/admin/guard';
import { t } from '@/lib/i18n';
import type { Role } from '@/lib/auth';

/**
 * PRD 6's sidebar, reduced to the launch screens (spec 1) and filtered by
 * role. Settings and Users are absent for non-admins, matching the routes,
 * which return notFound() for them.
 */
export default function AdminSidebar({ role }: { role: Role }) {
  return (
    <nav className="w-56 shrink-0 border-r border-hairline bg-tint-2 p-4">
      <ul className="flex flex-col gap-1 text-sm">
        {visibleNavItems(role).map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="block rounded px-3 py-2 text-navy">
              {t(item.labelKey)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

Create `src/components/admin/AdminFooter.tsx`:

```tsx
import Link from 'next/link';
import SignOutButton from './SignOutButton';
import type { CurrentUser } from '@/lib/auth';

/**
 * PRD 6: signed-in name, display label, View site, Sign out.
 *
 * `display_label` is free text and independent of `role` (PRD 3). It is shown
 * as given and never used to decide what the user may do.
 */
export default function AdminFooter({ user }: { user: CurrentUser }) {
  return (
    <footer className="border-t border-hairline px-4 py-3 text-sm text-muted">
      <div className="flex flex-wrap items-center gap-4">
        <span>{user.fullName || user.email}</span>
        {user.displayLabel ? <span>{user.displayLabel}</span> : null}
        <Link href="/">{t('admin.footer.viewSite')}</Link>
        <SignOutButton />
      </div>
    </footer>
  );
}
```

Add the `import { t } from '@/lib/i18n';` line this snippet needs at the top alongside the others.

Create `src/components/admin/SignOutButton.tsx`:

```tsx
'use client';

import { signOut } from '@/lib/actions/session';
import { t } from '@/lib/i18n';

export default function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className="text-primary underline">
        {t('admin.footer.signOut')}
      </button>
    </form>
  );
}
```

Create `src/components/admin/EmptyState.tsx`:

```tsx
/**
 * The honest alternative to a placeholder figure. Takes copy, never a number
 * — an empty state that renders "0" in a stat card is a fabricated value with
 * extra steps unless that zero was actually counted.
 */
export default function EmptyState({ heading, body }: { heading: string; body?: string }) {
  return (
    <div className="rounded border border-hairline bg-tint-1 p-6">
      <p className="font-medium text-navy">{heading}</p>
      {body ? <p className="mt-2 text-sm text-muted">{body}</p> : null}
    </div>
  );
}
```

- [ ] **Step 9: Write the sign-in page**

Replace `src/app/(admin)/admin/login/page.tsx`:

```tsx
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import SignInForm from '@/components/admin/SignInForm';

/**
 * PRD 3 and 14.3: there is no sign-up route, and public signup is disabled at
 * the Supabase project level, so one cannot be added by application code.
 * Users are created by an admin — `scripts/provision-admins.ts` for the first
 * two, /admin/users for everyone after.
 */
export default async function AdminLoginPage() {
  if (await getCurrentUser()) redirect('/admin');
  return <SignInForm />;
}
```

Create `src/components/admin/SignInForm.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import { signIn } from '@/lib/actions/session';
import { t } from '@/lib/i18n';

type State = { error: string } | null;

export default function SignInForm() {
  const [state, action, pending] = useActionState<State, FormData>(
    async (_previous, formData) => (await signIn(formData)) ?? null,
    null,
  );

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 p-8">
      <h1 className="text-xl font-semibold text-navy">{t('admin.login.heading')}</h1>
      <p className="text-sm text-muted">{t('admin.login.intro')}</p>
      <form action={action} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {t('admin.login.email')}
          <input name="email" type="email" required autoComplete="username" className="rounded border border-hairline px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('admin.login.password')}
          <input name="password" type="password" required autoComplete="current-password" className="rounded border border-hairline px-3 py-2" />
        </label>
        <button type="submit" disabled={pending} className="rounded bg-primary px-4 py-2 text-white">
          {t('admin.login.submit')}
        </button>
      </form>
      {state?.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
      <p className="text-xs text-muted">{t('admin.login.noSignup')}</p>
    </main>
  );
}
```

- [ ] **Step 10: Write the layout and the Dashboard**

Replace `src/app/(admin)/admin/layout.tsx`:

```tsx
import { headers } from 'next/headers';
import { getCurrentUser } from '@/lib/auth';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminFooter from '@/components/admin/AdminFooter';

/**
 * The signed-in shell. It resolves the role once and passes it down, so no
 * screen guesses at what the current user may do — and so a viewer's write
 * affordances are absent by construction rather than by each screen
 * remembering to check (PRD 3, spec 3.3).
 *
 * Authorization is not here. Every page calls requirePageRole or requireRole
 * for itself and every action re-checks; this layout only decides what to
 * draw.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();

  // The login page lives under this layout and must render with no session.
  // The proxy has already redirected an unauthenticated visitor away from
  // every other /admin path.
  if (!user) return <div className="min-h-full">{children}</div>;

  return (
    <div className="flex min-h-full">
      <AdminSidebar role={user.role} />
      <div className="flex min-h-full flex-1 flex-col">
        <div className="flex-1 p-6">{children}</div>
        <AdminFooter user={user} />
      </div>
    </div>
  );
}
```

Delete the unused `headers` import if the final file does not need it.

Replace `src/app/(admin)/admin/page.tsx`:

```tsx
import { requireRole } from '@/lib/auth';
import { readResourceCounts } from '@/lib/admin/readers';
import EmptyState from '@/components/admin/EmptyState';
import { t } from '@/lib/i18n';

/**
 * The Dashboard, at launch scope (spec 1).
 *
 * Four figures, all counted from `resources` at request time. There is no
 * Total reach card, no Growth this week, and no Most-clicked list, because
 * `engagement_events` is empty until SP2b ships capture and CLAUDE.md makes a
 * plausible fake number on this surface a launch-blocking defect. The absence
 * is stated in words instead — naming a missing dependency is honest, drawing
 * an empty chart is not.
 */
export default async function AdminDashboardPage() {
  await requireRole(['admin', 'editor', 'viewer']);
  const counts = await readResourceCounts();

  const cards = [
    { key: 'admin.dashboard.resourcesLive', value: counts.live },
    { key: 'admin.dashboard.resourcesPipeline', value: counts.pipeline },
    { key: 'admin.dashboard.resourcesReference', value: counts.reference },
    { key: 'admin.dashboard.expiringSoon', value: counts.expiringSoon },
  ];

  return (
    <main data-route="/admin" className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-navy">{t('admin.dashboard.heading')}</h1>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <li key={card.key} className="rounded border border-hairline p-4">
            <p className="text-sm text-muted">{t(card.key)}</p>
            <p className="text-2xl font-semibold text-navy">{card.value}</p>
          </li>
        ))}
      </ul>
      <EmptyState
        heading={t('admin.dashboard.reportingUnavailableHeading')}
        body={t('admin.dashboard.reportingUnavailableBody')}
      />
    </main>
  );
}
```

Create `src/app/(admin)/admin/error.tsx`:

```tsx
'use client';

import { t } from '@/lib/i18n';

/**
 * Boundary for the admin subtree. `requireRole` throws FORBIDDEN and
 * UNAUTHENTICATED as plain Errors; neither message is shown to the user,
 * because "you are forbidden" is all the detail anyone needs and the raw
 * message could carry query detail from a failed read.
 */
export default function AdminError() {
  return (
    <main className="p-6">
      <p role="alert">{t('admin.error.generic')}</p>
    </main>
  );
}
```

Add `"admin.error.generic": "Something went wrong. Try again, or sign out and back in."` to `en.json`.

- [ ] **Step 11: Update the placeholder assertion**

In `tests/structure/routes.test.ts`, remove both entries from `PLACEHOLDERS`, leaving the array empty and the loop harmlessly inert, or delete the block and its `describe` if empty. Add above the change:

```ts
  // Both admin placeholders became real screens in SP3 Task 2. Nothing under
  // src/app is a placeholder any more.
```

Then update the route-count assertion in the same file to include the six admin routes SP3 adds (`/admin/resources`, `/admin/resources/new`, `/admin/resources/[id]`, `/admin/content`, `/admin/settings`, `/admin/users`, `/admin/audit`) as those tasks land — Task 2 adds none of them, so only the placeholder block changes here.

- [ ] **Step 12: Verify**

Run: `npm run build && npm test && npm run typecheck && npm run lint`
Expected: PASS. `tests/structure/no-hardcoded-copy.test.ts` must pass — if it flags a string in a new component, move it to `en.json`, never add an exemption for real copy.

- [ ] **Step 13: Commit**

```bash
git add "src/app/(admin)" src/lib/admin src/lib/actions/session.ts src/components/admin src/locales/en.json tests/unit/admin-nav.test.ts tests/structure/routes.test.ts
git commit -m "feat(admin): sign in, role-aware shell, and a Dashboard that shows only counted figures

The four Dashboard cards are counted from resources at request time. There is
no Total reach, Growth this week or Most-clicked card, because
engagement_events is empty until SP2b and a plausible fake number here is a
launch-blocking defect. The screen names the missing dependency in words
instead.

The sidebar shows the five launch screens and no disabled entries for the
deferred ones: a route that does not exist asks no questions. Settings and
Users are absent for non-admins, matching routes that notFound() for them.

Sign-in reports one message for every failure mode, so the form cannot be used
to discover which addresses hold accounts."
```

---

### Task 3: The Resources table (read-only surface)

**Files:**
- Create: `src/app/(admin)/admin/resources/page.tsx`
- Create: `src/lib/admin/types.ts`, `src/lib/admin/resource-view.ts`
- Create: `src/components/admin/ResourceTable.tsx`
- Create: `tests/unit/admin-resource-view.test.ts`
- Modify: `src/lib/admin/readers.ts`, `src/locales/en.json`, `tests/structure/routes.test.ts`

**Interfaces:**
- Consumes: `createAdminReadClient`, `canWrite`, `deadlineInfo`.
- Produces:
  ```ts
  // src/lib/admin/types.ts
  export type ResourceStatus = 'live' | 'pipeline' | 'reference';
  export interface AdminResource {
    id: string; name: string; partner: string; partnerTier: string; resourceType: string;
    subCategory: string | null; needPrimary: string; needSecondary: string | null;
    geoScope: string; countriesEligible: string[]; sectorsEligible: string[]; stagesEligible: string[];
    deadline: string | null; status: ResourceStatus; isFeatured: boolean; sortOrder: number | null;
  }
  // src/lib/admin/resource-view.ts
  export type ResourceTab = 'all' | 'expiring' | 'closed';
  export interface ResourceQuery { tab: ResourceTab; search: string; status: ResourceStatus | 'all'; need: string | 'all' }
  export function parseResourceQuery(params: URLSearchParams): ResourceQuery;
  export function filterAdminResources(rows: AdminResource[], query: ResourceQuery): AdminResource[];
  // src/lib/admin/readers.ts (added)
  export function readAdminResources(): Promise<AdminResource[]>;
  ```

- [ ] **Step 1: Write the failing test**

Create `tests/unit/admin-resource-view.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseResourceQuery, filterAdminResources } from '@/lib/admin/resource-view';
import type { AdminResource } from '@/lib/admin/types';

function res(overrides: Partial<AdminResource> = {}): AdminResource {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'GPU allocation programme',
    partner: 'CINECA Leonardo',
    partnerTier: 'strategic',
    resourceType: 'Credits',
    subCategory: 'HPC allocation',
    needPrimary: 'compute',
    needSecondary: null,
    geoScope: 'partner_countries',
    countriesEligible: ['Kenya'],
    sectorsEligible: [],
    stagesEligible: ['Building'],
    deadline: null,
    status: 'live',
    isFeatured: false,
    sortOrder: 10,
    ...overrides,
  };
}

/** Days from today as an ISO date, so tests do not pin a calendar date. */
function inDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('parseResourceQuery', () => {
  it('defaults to the All tab with no filters', () => {
    expect(parseResourceQuery(new URLSearchParams())).toEqual({
      tab: 'all',
      search: '',
      status: 'all',
      need: 'all',
    });
  });

  it('ignores a tab, status or need it does not recognise', () => {
    const q = parseResourceQuery(new URLSearchParams('tab=nonsense&status=deleted&need=vibes'));
    expect(q).toEqual({ tab: 'all', search: '', status: 'all', need: 'all' });
  });

  it('reads the three real tabs and trims the search term', () => {
    expect(parseResourceQuery(new URLSearchParams('tab=closed&q=  gpu  ')).tab).toBe('closed');
    expect(parseResourceQuery(new URLSearchParams('q=  gpu  ')).search).toBe('gpu');
  });
});

describe('filterAdminResources', () => {
  const all = [
    res({ id: 'a', name: 'Rolling credits', deadline: null }),
    res({ id: 'b', name: 'Closing tomorrow', deadline: inDays(1) }),
    res({ id: 'c', name: 'Closing in a fortnight', deadline: inDays(14) }),
    res({ id: 'd', name: 'Closing later', deadline: inDays(15) }),
    res({ id: 'e', name: 'Already closed', deadline: inDays(-1) }),
    res({ id: 'f', name: 'Pipeline item', status: 'pipeline', partner: 'AWS' }),
  ];

  it('Expiring soon holds 14 days and excludes 15', () => {
    const ids = filterAdminResources(all, parseResourceQuery(new URLSearchParams('tab=expiring'))).map((r) => r.id);
    expect(ids).toEqual(['b', 'c']);
  });

  it('Closed holds only a past deadline, and status is untouched', () => {
    const closed = filterAdminResources(all, parseResourceQuery(new URLSearchParams('tab=closed')));
    expect(closed.map((r) => r.id)).toEqual(['e']);
    // CLAUDE.md: a past deadline displays as Closed and is flagged in admin;
    // its status does not change.
    expect(closed[0].status).toBe('live');
  });

  it('searches name and partner, case-insensitively', () => {
    expect(filterAdminResources(all, parseResourceQuery(new URLSearchParams('q=aws'))).map((r) => r.id)).toEqual(['f']);
    expect(filterAdminResources(all, parseResourceQuery(new URLSearchParams('q=ROLLING'))).map((r) => r.id)).toEqual(['a']);
  });

  it('filters by status independently of the tab', () => {
    expect(
      filterAdminResources(all, parseResourceQuery(new URLSearchParams('status=pipeline'))).map((r) => r.id),
    ).toEqual(['f']);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/admin-resource-view.test.ts`
Expected: FAIL with "Failed to resolve import @/lib/admin/resource-view".

- [ ] **Step 3: Write the types and the pure view logic**

Create `src/lib/admin/types.ts` with the `AdminResource` interface exactly as given in the Interfaces block above, plus:

```ts
import type { Database } from '@/lib/supabase/database.types';

type ResourceRow = Database['public']['Tables']['resources']['Row'];

/**
 * Admin screens read base tables, not the *_public views: the views drop
 * `status`, provenance and internal columns, which are the columns these
 * screens exist to edit. Base-table rows are already correctly typed
 * (NOT NULL survives), so no null-narrowing layer is needed here — unlike
 * SP2a's readers, which narrow view rows.
 */
export function toAdminResource(row: ResourceRow): AdminResource {
  return {
    id: row.id,
    name: row.name,
    partner: row.partner,
    partnerTier: row.partner_tier,
    resourceType: row.resource_type,
    subCategory: row.sub_category,
    needPrimary: row.need_primary,
    needSecondary: row.need_secondary,
    geoScope: row.geo_scope,
    countriesEligible: row.countries_eligible,
    sectorsEligible: row.sectors_eligible,
    stagesEligible: row.stages_eligible,
    deadline: row.deadline,
    status: row.status,
    isFeatured: row.is_featured,
    sortOrder: row.sort_order,
  };
}
```

Create `src/lib/admin/resource-view.ts`:

```ts
import { deadlineInfo } from '@/lib/deadline';
import type { AdminResource, ResourceStatus } from './types';

export type ResourceTab = 'all' | 'expiring' | 'closed';

export interface ResourceQuery {
  tab: ResourceTab;
  search: string;
  status: ResourceStatus | 'all';
  need: string | 'all';
}

const TABS: readonly ResourceTab[] = ['all', 'expiring', 'closed'];
const STATUSES: readonly ResourceStatus[] = ['live', 'pipeline', 'reference'];

/**
 * The URL is the single source of filter state, as on the public directory.
 * Anything unrecognised falls back to the default rather than throwing: a
 * hand-edited query string should show an unfiltered table, not an error page.
 */
export function parseResourceQuery(params: URLSearchParams): ResourceQuery {
  const tab = params.get('tab');
  const status = params.get('status');
  const need = params.get('need');
  return {
    tab: TABS.includes(tab as ResourceTab) ? (tab as ResourceTab) : 'all',
    search: (params.get('q') ?? '').trim(),
    status: STATUSES.includes(status as ResourceStatus) ? (status as ResourceStatus) : 'all',
    need: need && need !== 'all' ? need : 'all',
  };
}

/**
 * Tabs are deadline state, filters are stored state, and the two are
 * independent — a resource can be `live` and Closed at once, which is exactly
 * the case the Closed tab exists to surface (CLAUDE.md: a past deadline
 * displays as Closed and is flagged in admin; its status does not change).
 */
export function filterAdminResources(rows: AdminResource[], query: ResourceQuery): AdminResource[] {
  const term = query.search.toLowerCase();
  return rows.filter((row) => {
    // 'rolling' | 'open' | 'expiring' | 'closed' — the states deadline.ts
    // already defines. EXPIRING_SOON_DAYS lives there too; nothing here
    // re-derives the 14-day boundary.
    const { state } = deadlineInfo(row.deadline);
    if (query.tab === 'expiring' && state !== 'expiring') return false;
    if (query.tab === 'closed' && state !== 'closed') return false;
    if (query.status !== 'all' && row.status !== query.status) return false;
    if (query.need !== 'all' && row.needPrimary !== query.need && row.needSecondary !== query.need) {
      return false;
    }
    if (term && !`${row.name} ${row.partner}`.toLowerCase().includes(term)) return false;
    return true;
  });
}
```

Note what this file does **not** do: it never compares a date itself. `deadlineInfo` owns the boundary (`EXPIRING_SOON_DAYS = 14`) and the four states, and it is the same function SP2a's public card path deliberately avoids because it reads a clock — which is correct here, where "expiring soon" is a live admin flag, and wrong there, where a cached page must not embed the moment it was rendered.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/admin-resource-view.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Add the reader**

Add to `src/lib/admin/readers.ts`:

```ts
export async function readAdminResources(): Promise<AdminResource[]> {
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });
  if (error) throw new Error(`admin read failed (resources): ${error.message}`);
  return (data ?? []).map(toAdminResource);
}
```

- [ ] **Step 6: Add the locale keys**

```json
  "admin.resources.heading": "Resources",
  "admin.resources.publicNote": "Resources with status Live appear on the public directory.",
  "admin.resources.tab.all": "All",
  "admin.resources.tab.expiring": "Expiring soon",
  "admin.resources.tab.closed": "Closed",
  "admin.resources.search": "Search by name or partner",
  "admin.resources.filterStatus": "Status",
  "admin.resources.filterNeed": "Need",
  "admin.resources.filterAll": "All",
  "admin.resources.col.resource": "Resource",
  "admin.resources.col.need": "Need",
  "admin.resources.col.eligibility": "Eligibility",
  "admin.resources.col.deadline": "Deadline",
  "admin.resources.col.status": "Status",
  "admin.resources.col.actions": "Actions",
  "admin.resources.empty": "No resources match these filters.",
  "admin.status.live": "Live",
  "admin.status.pipeline": "Pipeline",
  "admin.status.reference": "Reference"
```

- [ ] **Step 7: Write the table and the page**

Create `src/components/admin/ResourceTable.tsx` as a presentational server component taking `{ rows, canWrite }`. When `canWrite` is false it renders **no Actions column at all** — not a column with disabled buttons in it — and no status dropdown; the status cell renders `t('admin.status.' + row.status)` as text.

The deadline cell uses the keys that already exist rather than adding admin duplicates: `deadlineInfo(row.deadline).label` covers `deadline.rolling` and the days-left case, and the `closed` state renders `t('deadline.autoClosed')` — "Auto-closed, past deadline", which is PRD §6.2's admin wording and is already in `en.json`, alongside the public surface's shorter `deadline.closed`. Do not add a second key for either.

Create `src/app/(admin)/admin/resources/page.tsx`:

```tsx
import { requireRole } from '@/lib/auth';
import { canWrite } from '@/lib/admin/guard';
import { readAdminResources } from '@/lib/admin/readers';
import { parseResourceQuery, filterAdminResources } from '@/lib/admin/resource-view';
import ResourceTable from '@/components/admin/ResourceTable';
import { t } from '@/lib/i18n';

export default async function AdminResourcesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(['admin', 'editor', 'viewer']);
  const params = new URLSearchParams(
    Object.entries(await searchParams).flatMap(([k, v]) =>
      typeof v === 'string' ? [[k, v] as [string, string]] : [],
    ),
  );
  const query = parseResourceQuery(params);
  const rows = filterAdminResources(await readAdminResources(), query);

  return (
    <main data-route="/admin/resources" className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-navy">{t('admin.resources.heading')}</h1>
      <p className="text-sm text-muted">{t('admin.resources.publicNote')}</p>
      <ResourceTable rows={rows} canWrite={canWrite(user.role)} />
    </main>
  );
}
```

Tabs and filter controls are links that set the query string — no client component is needed for them, and the URL stays the source of truth.

- [ ] **Step 8: Verify and commit**

Run: `npm run build && npm test && npm run typecheck && npm run lint`

```bash
git add "src/app/(admin)/admin/resources" src/lib/admin src/components/admin/ResourceTable.tsx src/locales/en.json tests/unit/admin-resource-view.test.ts
git commit -m "feat(admin): resources table with deadline tabs and filters

Tabs are deadline state, filters are stored state, and they are independent: a
resource can be Live and Closed at once, which is the case the Closed tab
exists to surface. A past deadline never changes status.

A viewer gets no Actions column at all rather than a column of disabled
buttons, and the status cell renders as text instead of a dropdown."
```

---

### Task 4: Resource mutations

**Files:**
- Create: `src/lib/schemas/resource.ts`, `src/lib/actions/resources.ts`
- Create: `src/app/(admin)/admin/resources/new/page.tsx`, `src/app/(admin)/admin/resources/[id]/page.tsx`
- Create: `src/components/admin/ResourceForm.tsx`, `StatusSelect.tsx`, `FeaturedToggle.tsx`
- Create: `tests/unit/resource-schema.test.ts`, `tests/rls/admin-actions-resources.test.ts`
- Modify: `src/locales/en.json`, `tests/structure/routes.test.ts`

**Interfaces:**
- Consumes: `requireRole`, `createAdminReadClient`, `CACHE_TAGS` from `@/lib/public/cache`.
- Produces:
  ```ts
  // src/lib/schemas/resource.ts
  export const resourceInput: z.ZodType<ResourceInput>;
  export type ResourceInput = { name: string; partner: string; partnerTier: 'strategic'|'government'|'development_partner'|'academic'|'network';
    resourceType: string; needPrimary: NeedKey; needSecondary: NeedKey | null; subCategory: string | null;
    description: string; actionLabel: string; externalUrl: string; bannerImageUrl: string | null;
    countriesEligible: string[]; sectorsEligible: string[]; stagesEligible: string[];
    geoScope: 'global'|'all_africa'|'partner_countries'|'specific'; deadline: string | null;
    status: 'live'|'pipeline'|'reference'; isFeatured: boolean; exclusivity: 'exclusive'|'early_access'|null;
    sortOrder: number | null };
  // src/lib/actions/resources.ts
  export async function createResource(input: unknown): Promise<{ id: string }>;
  export async function updateResource(id: string, input: unknown): Promise<void>;
  export async function deleteResource(id: string): Promise<void>;
  export async function setResourceStatus(id: string, status: unknown): Promise<void>;
  export async function setResourceFeatured(id: string, isFeatured: unknown): Promise<void>;
  ```

- [ ] **Step 1: Write the failing schema test**

Create `tests/unit/resource-schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resourceInput } from '@/lib/schemas/resource';

function valid(overrides: Record<string, unknown> = {}) {
  return {
    name: 'GPU allocation programme',
    partner: 'CINECA Leonardo',
    partnerTier: 'strategic',
    resourceType: 'Credits',
    needPrimary: 'compute',
    needSecondary: null,
    subCategory: 'HPC allocation',
    description: 'Leonardo GPU hours for African AI teams.',
    actionLabel: 'Apply',
    externalUrl: 'https://example.org/apply',
    bannerImageUrl: null,
    countriesEligible: ['Kenya'],
    sectorsEligible: [],
    stagesEligible: ['Building'],
    geoScope: 'partner_countries',
    deadline: null,
    status: 'pipeline',
    isFeatured: false,
    exclusivity: null,
    sortOrder: 10,
    ...overrides,
  };
}

describe('resourceInput', () => {
  it('accepts a complete resource', () => {
    expect(resourceInput.safeParse(valid()).success).toBe(true);
  });

  it('requires the fields the database requires', () => {
    for (const field of ['name', 'partner', 'resourceType', 'description', 'externalUrl', 'needPrimary', 'partnerTier']) {
      expect(resourceInput.safeParse(valid({ [field]: '' })).success, field).toBe(false);
    }
  });

  it('rejects a non-https external URL', () => {
    // The database enforces this too (resources_external_url_https). The
    // schema exists so the operator gets a field-level message instead of a
    // constraint violation.
    expect(resourceInput.safeParse(valid({ externalUrl: 'http://example.org' })).success).toBe(false);
    expect(resourceInput.safeParse(valid({ externalUrl: 'javascript:alert(1)' })).success).toBe(false);
  });

  it('rejects an SVG banner in every shape the constraint catches', () => {
    for (const url of [
      'https://cdn.example.org/logo.svg',
      'https://cdn.example.org/logo.svgz',
      'https://cdn.example.org/logo.svg?v=2',
      'https://cdn.example.org/logo.svg/w_300',
    ]) {
      expect(resourceInput.safeParse(valid({ bannerImageUrl: url })).success, url).toBe(false);
    }
    expect(resourceInput.safeParse(valid({ bannerImageUrl: 'https://cdn.example.org/logo.png' })).success).toBe(true);
  });

  it('rejects an unknown enum value rather than coercing it', () => {
    expect(resourceInput.safeParse(valid({ status: 'deleted' })).success).toBe(false);
    expect(resourceInput.safeParse(valid({ needPrimary: 'vibes' })).success).toBe(false);
    expect(resourceInput.safeParse(valid({ geoScope: 'moon' })).success).toBe(false);
  });

  it('rejects a country, sector or stage outside the reference lists', () => {
    expect(resourceInput.safeParse(valid({ countriesEligible: ['Atlantis'] })).success).toBe(false);
    expect(resourceInput.safeParse(valid({ sectorsEligible: ['Cryptocurrency'] })).success).toBe(false);
  });

  it('accepts a null deadline as Rolling and rejects a non-date', () => {
    expect(resourceInput.safeParse(valid({ deadline: null })).success).toBe(true);
    expect(resourceInput.safeParse(valid({ deadline: '2026-09-01' })).success).toBe(true);
    expect(resourceInput.safeParse(valid({ deadline: 'next Tuesday' })).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/resource-schema.test.ts`
Expected: FAIL with "Failed to resolve import @/lib/schemas/resource".

- [ ] **Step 3: Write the schema**

Create `src/lib/schemas/resource.ts`. Build the enums from the generated database types' `Enums` entries and the arrays from `@/lib/reference` (`COUNTRIES`, `SECTORS`, `STAGES`, `NEED_KEYS`) rather than retyping any value — a literal list here would drift from the database and from the public filters. Mirror the three database constraints exactly:

```ts
import { z } from 'zod';
import { COUNTRIES, SECTORS, STAGES, NEED_KEYS } from '@/lib/reference';

const httpsUrl = z
  .string()
  .trim()
  .max(2048)
  .regex(/^https:\/\//i, 'must start with https://');

/**
 * Mirrors `resources_banner_not_svg` from 0004_resources.sql, including the
 * `/` and `?`/`#` anchors: some CDN transform URLs put the extension
 * mid-path (.../logo.svg/w_300), and `.svgz` is the gzip-compressed variant.
 * CLAUDE.md rejects SVG uploads and SVG image URLs outright.
 */
const notSvg = (value: string) => !/\.svgz?($|\?|#|\/)/i.test(value);

export const resourceInput = z.object({
  name: z.string().trim().min(1).max(200),
  partner: z.string().trim().min(1).max(200),
  // Five values, sourced from the generated types rather than retyped:
  // migration 0013 replaced the original four-value enum, and the design
  // doc this plan inherited its list from was never updated. Derive it, do
  // not hand-copy it -- Task 4 hit exactly this and added a regression test.
  partnerTier: z.enum(Constants.public.Enums.partner_tier),
  resourceType: z.string().trim().min(1).max(100),
  needPrimary: z.enum(NEED_KEYS),
  needSecondary: z.enum(NEED_KEYS).nullable(),
  subCategory: z.string().trim().max(200).nullable(),
  description: z.string().trim().min(1).max(5000),
  actionLabel: z.string().trim().min(1).max(60),
  externalUrl: httpsUrl,
  bannerImageUrl: httpsUrl.refine(notSvg, 'SVG images are not accepted').nullable(),
  countriesEligible: z.array(z.enum(COUNTRIES)).max(COUNTRIES.length),
  sectorsEligible: z.array(z.enum(SECTORS)).max(SECTORS.length),
  stagesEligible: z.array(z.enum(STAGES)).max(STAGES.length),
  geoScope: z.enum(['global', 'all_africa', 'partner_countries', 'specific']),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  status: z.enum(['live', 'pipeline', 'reference']),
  isFeatured: z.boolean(),
  exclusivity: z.enum(['exclusive', 'early_access']).nullable(),
  sortOrder: z.number().int().min(0).max(100000).nullable(),
});

export type ResourceInput = z.infer<typeof resourceInput>;
```

`z.enum(COUNTRIES)` requires those exports to be `as const` tuples; they are (`src/lib/reference.ts`). If a list is a plain `string[]`, use `z.string().refine((v) => COUNTRIES.includes(v))` rather than widening the source list.

- [ ] **Step 4: Run the schema test to verify it passes**

Run: `npx vitest run tests/unit/resource-schema.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Write the failing action-boundary test**

Create `tests/rls/admin-actions-resources.test.ts`. This suite exercises the **database boundary** the actions rely on — a viewer's write refused by RLS, an editor's allowed, and an audit row produced for each — using role clients, because a server action cannot be invoked from Vitest with a cookie jar:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { ensureTestUsers, roleClient, serviceClient } from '../helpers/clients';

describe('resource writes at the database boundary', () => {
  beforeAll(async () => {
    await ensureTestUsers();
  });

  async function fixture(name: string) {
    const svc = serviceClient();
    const { data: partner } = await svc.from('partners').select('name').limit(1).single();
    const { data, error } = await svc
      .from('resources')
      .insert({
        name,
        partner: partner!.name,
        partner_tier: 'strategic',
        resource_type: 'Credits',
        need_primary: 'compute',
        description: 'Action boundary fixture.',
        external_url: 'https://example.org/apply',
      })
      .select('id')
      .single();
    if (error) throw error;
    return data!.id as string;
  }

  it('lets an editor publish, and records it as published', async () => {
    const id = await fixture(`editor-publish-${Date.now()}`);
    const editor = await roleClient('editor');
    const { error } = await editor.from('resources').update({ status: 'live' }).eq('id', id);
    expect(error).toBeNull();

    const { data } = await serviceClient()
      .from('audit_log')
      .select('action, actor_name')
      .eq('entity_id', id)
      .eq('action', 'published');
    expect(data).toHaveLength(1);
    expect(data![0].actor_name).not.toBe('system');
  });

  it('refuses every write verb to a viewer', async () => {
    const id = await fixture(`viewer-denied-${Date.now()}`);
    const viewer = await roleClient('viewer');
    const svc = serviceClient();

    await viewer.from('resources').update({ status: 'live' }).eq('id', id);
    await viewer.from('resources').delete().eq('id', id);
    const insert = await viewer.from('resources').insert({
      name: `viewer-insert-${Date.now()}`,
      partner: 'CINECA Leonardo',
      partner_tier: 'strategic',
      resource_type: 'Credits',
      need_primary: 'compute',
      description: 'Should never exist.',
      external_url: 'https://example.org/apply',
    });
    expect(insert.error).not.toBeNull();

    const { data } = await svc.from('resources').select('status').eq('id', id).single();
    expect(data, 'a viewer deleted a resource').not.toBeNull();
    expect(data!.status).toBe('pipeline');
  });
});
```

- [ ] **Step 6: Run it to verify the boundary already holds**

Run: `npx vitest run tests/rls/admin-actions-resources.test.ts`
Expected: PASS immediately — the policies and the Task 1 trigger already provide this. That is the point: it is a regression test for the boundary the actions in Step 7 must not work around (for example by reaching for the admin client when a write is refused).

- [ ] **Step 7: Write the actions**

Create `src/lib/actions/resources.ts`:

```ts
'use server';

import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { createAdminReadClient } from '@/lib/admin/client';
import { resourceInput } from '@/lib/schemas/resource';
import { CACHE_TAGS } from '@/lib/public/cache';

const id = z.string().uuid();
const status = z.enum(['live', 'pipeline', 'reference']);

/**
 * Every action here opens with its own requireRole. Not because the page did
 * not check — because an action can be invoked directly, with no page and no
 * proxy in the path (PRD 14.4).
 *
 * No action writes an audit_log row: the trigger from 0017_audit_triggers.sql
 * writes it inside this mutation's own transaction, attributed to auth.uid().
 * See src/lib/actions/README.md.
 *
 * revalidateTag comes last and only on success. Invalidating a tag for a
 * write that failed would evict a correct cached page and replace it with an
 * identical one, hiding the failure behind a cache miss.
 */
function toRow(input: ReturnType<typeof resourceInput.parse>) {
  return {
    name: input.name,
    partner: input.partner,
    partner_tier: input.partnerTier,
    resource_type: input.resourceType,
    need_primary: input.needPrimary,
    need_secondary: input.needSecondary,
    sub_category: input.subCategory,
    description: input.description,
    action_label: input.actionLabel,
    external_url: input.externalUrl,
    banner_image_url: input.bannerImageUrl,
    countries_eligible: input.countriesEligible,
    sectors_eligible: input.sectorsEligible,
    stages_eligible: input.stagesEligible,
    geo_scope: input.geoScope,
    deadline: input.deadline,
    status: input.status,
    is_featured: input.isFeatured,
    exclusivity: input.exclusivity,
    sort_order: input.sortOrder,
  };
}

export async function createResource(input: unknown): Promise<{ id: string }> {
  await requireRole(['admin', 'editor']);
  const parsed = resourceInput.parse(input);
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('resources')
    .insert(toRow(parsed))
    .select('id')
    .single();
  if (error) throw new Error(`createResource failed: ${error.message}`);
  revalidateTag(CACHE_TAGS.resources, { expire: 0 });
  return { id: data!.id };
}

export async function updateResource(rawId: unknown, input: unknown): Promise<void> {
  await requireRole(['admin', 'editor']);
  const targetId = id.parse(rawId);
  const parsed = resourceInput.parse(input);
  const supabase = await createAdminReadClient();
  const { error } = await supabase.from('resources').update(toRow(parsed)).eq('id', targetId);
  if (error) throw new Error(`updateResource failed: ${error.message}`);
  revalidateTag(CACHE_TAGS.resources, { expire: 0 });
}

export async function setResourceStatus(rawId: unknown, rawStatus: unknown): Promise<void> {
  await requireRole(['admin', 'editor']);
  const targetId = id.parse(rawId);
  const next = status.parse(rawStatus);
  const supabase = await createAdminReadClient();
  const { error } = await supabase.from('resources').update({ status: next }).eq('id', targetId);
  if (error) throw new Error(`setResourceStatus failed: ${error.message}`);
  revalidateTag(CACHE_TAGS.resources, { expire: 0 });
}

export async function setResourceFeatured(rawId: unknown, rawFeatured: unknown): Promise<void> {
  await requireRole(['admin', 'editor']);
  const targetId = id.parse(rawId);
  const isFeatured = z.boolean().parse(rawFeatured);
  const supabase = await createAdminReadClient();
  const { error } = await supabase.from('resources').update({ is_featured: isFeatured }).eq('id', targetId);
  if (error) throw new Error(`setResourceFeatured failed: ${error.message}`);
  revalidateTag(CACHE_TAGS.resources, { expire: 0 });
}

export async function deleteResource(rawId: unknown): Promise<void> {
  await requireRole(['admin', 'editor']);
  const targetId = id.parse(rawId);
  const supabase = await createAdminReadClient();
  const { error } = await supabase.from('resources').delete().eq('id', targetId);
  if (error) throw new Error(`deleteResource failed: ${error.message}`);
  revalidateTag(CACHE_TAGS.resources, { expire: 0 });
}
```

- [ ] **Step 8: Write the form, the two routes and the inline controls**

`ResourceForm.tsx` is a client component taking `{ initial?: AdminResource & extras, action }`; it renders every field in the schema, marks the seven required ones, and surfaces Zod field errors returned by the action. `StatusSelect.tsx` and `FeaturedToggle.tsx` are client components that call `setResourceStatus` / `setResourceFeatured` and are **rendered only when `canWrite` is true** — the table passes them through, it does not render disabled variants. Delete uses a confirmation step (`<dialog>` or a two-step submit), never a bare one-click destructive button.

`resources/new/page.tsx` and `resources/[id]/page.tsx` both call
`await requireRole(['admin', 'editor'])` — an editor may reach them, a viewer
may not, and the check is on the page as well as in the action.

- [ ] **Step 9: Add the locale keys, then verify**

Add form labels, validation messages, the delete-confirmation copy and the Add/Edit/Delete button labels under `admin.resources.*`.

Run: `npm run build && npm test && npm run typecheck && npm run lint`

- [ ] **Step 10: Commit**

```bash
git add src/lib/schemas/resource.ts src/lib/actions/resources.ts "src/app/(admin)/admin/resources" src/components/admin src/locales/en.json tests/unit/resource-schema.test.ts tests/rls/admin-actions-resources.test.ts
git commit -m "feat(admin): resource create, edit, delete, status and featured

Each action re-checks its own role first, parses with Zod, mutates on the
caller's client so RLS still applies, and revalidates the resources tag only
after the mutation returns without error. None of them writes an audit row --
the trigger does that in the same transaction.

The schema mirrors the three database constraints rather than trusting them:
https-only external URL, no SVG banner in any of the four shapes the check
constraint catches, and enum values that must match the database's."
```

---

### Task 5: Site Content — the six editor-writable areas

**Files:**
- Create: `src/app/(admin)/admin/content/page.tsx`
- Create: `src/lib/schemas/content.ts`, `src/lib/actions/content.ts`
- Create: `src/components/admin/ContentPanel.tsx`, `TextAreaField.tsx`, `StatRows.tsx`
- Create: `tests/unit/content-schema.test.ts`, `tests/rls/admin-actions-content.test.ts`
- Modify: `src/lib/admin/readers.ts`, `src/locales/en.json`, `tests/structure/routes.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // src/lib/schemas/content.ts
  // The five keys the table actually holds -- NOT PRD 4.12's names, which were
  // never implemented (see the note in Step 3 and spec 3.1).
  export const CONTENT_KEYS: readonly ['welcome_title','welcome_body','welcome_cta','identity_lead','identity_align'];
  export const contentEntry: z.ZodType<{ key: (typeof CONTENT_KEYS)[number]; value: string }>;
  export const statInput: z.ZodType<{ value: string; label: string; isHero: boolean; sortOrder: number | null; source: string; attestedBy: string; attestedOn: string }>;
  export const computeMetricInput: z.ZodType<{ value: string; label: string; subNote: string | null; sortOrder: number | null; source: string; attestedBy: string; attestedOn: string }>;
  export const programmeInput: z.ZodType<{ title: string; timeframe: string; description: string; sortOrder: number | null }>;
  export const impactStoryInput: z.ZodType<{ organisation: string; country: string; description: string; sortOrder: number | null }>;
  // src/lib/actions/content.ts
  export async function saveContentEntry(input: unknown): Promise<void>;
  export async function saveStat(id: unknown, input: unknown): Promise<void>;
  export async function createStat(input: unknown): Promise<void>;
  export async function deleteStat(id: unknown): Promise<void>;
  // ... the same three-verb trio for computeMetric, programme, impactStory
  ```

- [ ] **Step 1: Write the failing schema test**

Create `tests/unit/content-schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { contentEntry, statInput, CONTENT_KEYS } from '@/lib/schemas/content';

describe('contentEntry', () => {
  it('accepts every key the table actually holds', () => {
    for (const key of CONTENT_KEYS) {
      expect(contentEntry.safeParse({ key, value: 'Copy.' }).success, key).toBe(true);
    }
  });

  it('refuses a key that is not in the list', () => {
    // The key set is an allow-list, not free text: a typo would otherwise
    // insert a new site_content row that no public reader ever reads, and the
    // edit would appear to have silently done nothing.
    expect(contentEntry.safeParse({ key: 'ga4_measurement_id', value: 'G-XXXX' }).success).toBe(false);
    expect(contentEntry.safeParse({ key: 'welcome_titel', value: 'typo' }).success).toBe(false);
  });

  it("refuses PRD 4.12's key names, which the database does not have", () => {
    // Not pedantry -- this is the failure this allow-list exists to prevent.
    // scripts/seed-data.ts invented its own key names because the prototype had
    // no key/locale structure, and SP2a's readers read those. An upsert on
    // `about_intro` would silently create a sixth row nothing renders, and the
    // editor would see their save succeed and change nothing on the site.
    for (const phantom of ['welcome_band_heading', 'about_intro', 'privacy_copy', 'terms_copy']) {
      expect(contentEntry.safeParse({ key: phantom, value: 'Copy.' }).success, phantom).toBe(false);
    }
  });

  it('accepts an empty value only where the database does', () => {
    // site_content.value is `not null default ''`, so blank is legal; the
    // public band decides whether to render.
    expect(contentEntry.safeParse({ key: 'identity_lead', value: '' }).success).toBe(true);
  });
});

describe('statInput', () => {
  const valid = {
    value: '150+',
    label: 'Extended network',
    isHero: true,
    sortOrder: 1,
    source: 'AI Hub programme office, June 2026 partner count',
    attestedBy: 'A. Nakamura, Programme Lead',
    attestedOn: '2026-06-30',
  };

  it('accepts a fully attested stat', () => {
    expect(statInput.safeParse(valid).success).toBe(true);
  });

  it('refuses a stat with no provenance', () => {
    // headline_stats requires source, attested_by and attested_on NOT NULL
    // and non-blank (0015_stat_provenance.sql). A figure on a UN leadership
    // surface without a named source is exactly what that migration exists to
    // prevent; the form must not be able to attempt it.
    for (const field of ['source', 'attestedBy']) {
      expect(statInput.safeParse({ ...valid, [field]: '' }).success, field).toBe(false);
      expect(statInput.safeParse({ ...valid, [field]: '   ' }).success, `${field} blank`).toBe(false);
    }
    expect(statInput.safeParse({ ...valid, attestedOn: '' }).success).toBe(false);
  });

  it('requires a value and a label', () => {
    expect(statInput.safeParse({ ...valid, value: '' }).success).toBe(false);
    expect(statInput.safeParse({ ...valid, label: '' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/content-schema.test.ts`
Expected: FAIL with "Failed to resolve import @/lib/schemas/content".

- [ ] **Step 3: Write the schemas**

Create `src/lib/schemas/content.ts` with `CONTENT_KEYS` as the **five-key** `as const` tuple `['welcome_title','welcome_body','welcome_cta','identity_lead','identity_align']`, `contentEntry` keyed on `z.enum(CONTENT_KEYS)`, and the four row schemas. Provenance fields use `z.string().trim().min(1)` so a blank string cannot pass, and `attestedOn` uses the same `^\d{4}-\d{2}-\d{2}$` date pattern as the resource deadline.

**Do not use PRD §4.12's key names.** They were never implemented: `scripts/seed-data.ts` states in its own header that its key names are the seed's invention, because the prototype rendered `settings.welcome.title` directly and had no key/locale structure to inherit. Verify the list against the database before writing the tuple — `select key from public.site_content order by key` — rather than against the PRD. Task 1 found this discrepancy the hard way, with an update that matched zero rows.

Two consequences to carry into this task:

- `privacy_copy` and `terms_copy` **do not exist**, and `docs/deployment.md`'s pre-launch checklist gates going public on legal-reviewed Privacy and Terms copy being in `site_content`. Resolve ledger question Q8 before building the panels: either this screen gains the ability to write those two keys (and `CONTENT_KEYS` becomes seven, with the two new ones created on first save), or a migration seeds them empty and the screen only ever updates. Do not quietly leave the checklist ungateable.
- The public readers already map these five keys to bands. Renaming a key here would break SP2a's rendering, and renaming is not in SP3's remit (spec §5).

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/unit/content-schema.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Write the actions**

Create `src/lib/actions/content.ts`. Every action opens with
`await requireRole(['admin', 'editor'])` — the six content areas are
editor-writable (spec §3.1) — parses, mutates on the caller's client, and
revalidates the mapping from spec §5:

| Action | Tag |
|---|---|
| `saveContentEntry` | `CACHE_TAGS.siteContent` |
| `createStat` / `saveStat` / `deleteStat` | `CACHE_TAGS.headlineStats` |
| `createImpactStory` / `saveImpactStory` / `deleteImpactStory` | `CACHE_TAGS.impactStories` |
| `createComputeMetric` / `saveComputeMetric` / `deleteComputeMetric` | **none** |
| `createProgramme` / `saveProgramme` / `deleteProgramme` | **none** |

The last two have no tag on purpose, and the file must say so in a comment:
`CACHE_TAGS` has no entry for `compute_metrics` or `programmes` because no
SP2a reader queries either table. Inventing a tag here would create a name
that nothing listens to, which reads like working invalidation and is not. If
a public page later renders them, SP2a adds the reader and the tag together.

`saveContentEntry` upserts on the `(key, locale)` unique constraint with
`locale: 'en'`, so the six areas work before the other three locales exist.

- [ ] **Step 6: Write the reader, the panels and the page**

Add `readSiteContent()`, `readStats()`, `readComputeMetrics()`, `readProgrammes()` and `readImpactStories()` to `src/lib/admin/readers.ts`, each uncached and each throwing on error.

`content/page.tsx` calls `await requireRole(['admin', 'editor', 'viewer'])` and passes `canWrite(user.role)` into every panel. When false, a panel renders its current values as text with **no form element at all** — no disabled inputs, no save button. The page header states that edits reach the public site immediately with no rebuild (PRD §6.7, §13.4), and it does **not** mention GA4 or feature flags, which now live on Settings.

- [ ] **Step 7: Write the boundary test**

Create `tests/rls/admin-actions-content.test.ts`: an editor may update `site_content`, `headline_stats`, `compute_metrics`, `programmes` and `impact_stories`; a viewer may not, and the row is unchanged afterwards; each successful write produced exactly one audit row with the prefixed label from spec §4.3.

- [ ] **Step 8: Verify and commit**

Run: `npm run build && npm test && npm run typecheck && npm run lint`

```bash
git add "src/app/(admin)/admin/content" src/lib/schemas/content.ts src/lib/actions/content.ts src/lib/admin/readers.ts src/components/admin src/locales/en.json tests/unit/content-schema.test.ts tests/rls/admin-actions-content.test.ts
git commit -m "feat(admin): site content, six editor-writable areas

GA4 and the feature flags are deliberately absent: they write settings, which
is admin-only, and they moved to /admin/settings in the next task. PRD 3's
capability table already separates them; 6.7's panel list is the section that
contradicts it.

Headline stats and compute metrics cannot be saved without a source, a named
attester and a date -- the schema refuses blanks before the database's
non-blank check has to. compute_metrics and programmes revalidate nothing,
because no public reader queries either table and a tag nothing listens to
would look like working invalidation."
```

---

### Task 6: Settings — admin only

**Files:**
- Create: `src/app/(admin)/admin/settings/page.tsx`
- Create: `src/lib/schemas/settings.ts`, `src/lib/actions/settings.ts`
- Create: `src/components/admin/SettingsForm.tsx`
- Create: `tests/unit/settings-schema.test.ts`, `tests/rls/admin-actions-settings.test.ts`
- Modify: `src/lib/admin/readers.ts`, `src/locales/en.json`, `tests/structure/routes.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // src/lib/schemas/settings.ts
  export const SETTING_KEYS: readonly ['ga4_measurement_id','ga4_property_id','contact_email','feature_innovator_profiles','feature_public_impact_page'];
  export const settingUpdate: z.ZodType<{ key: (typeof SETTING_KEYS)[number]; value: string | boolean }>;
  // src/lib/actions/settings.ts
  export async function saveSetting(input: unknown): Promise<void>;
  // src/lib/admin/readers.ts (added)
  export function readSettings(): Promise<Record<string, string | boolean>>;
  ```

- [ ] **Step 1: Write the failing schema test**

Create `tests/unit/settings-schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { settingUpdate } from '@/lib/schemas/settings';

describe('settingUpdate', () => {
  it('accepts a GA4 Measurement ID in its real shape', () => {
    expect(settingUpdate.safeParse({ key: 'ga4_measurement_id', value: 'G-ABCD123456' }).success).toBe(true);
    // Clearing it back to unconfigured must stay possible: an empty string is
    // what drives the "Not connected" state (PRD 6.4).
    expect(settingUpdate.safeParse({ key: 'ga4_measurement_id', value: '' }).success).toBe(true);
  });

  it('refuses a Measurement ID that is not one', () => {
    expect(settingUpdate.safeParse({ key: 'ga4_measurement_id', value: 'UA-12345-1' }).success).toBe(false);
    expect(settingUpdate.safeParse({ key: 'ga4_measurement_id', value: '<script>' }).success).toBe(false);
  });

  it('accepts only the one mailbox for contact_email', () => {
    // CLAUDE.md: one mailbox only. A settings row is the one place a second
    // address could be introduced without touching a locale file, so the
    // rule is enforced here rather than trusted.
    expect(settingUpdate.safeParse({ key: 'contact_email', value: 'aihubfordevelopment@undp.org' }).success).toBe(true);
    expect(settingUpdate.safeParse({ key: 'contact_email', value: 'someone.else@undp.org' }).success).toBe(false);
  });

  it('takes booleans for the flags and refuses strings', () => {
    expect(settingUpdate.safeParse({ key: 'feature_public_impact_page', value: true }).success).toBe(true);
    expect(settingUpdate.safeParse({ key: 'feature_public_impact_page', value: 'true' }).success).toBe(false);
  });

  it('refuses a key outside the five', () => {
    expect(settingUpdate.safeParse({ key: 'service_role_key', value: 'x' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/settings-schema.test.ts`
Expected: FAIL with "Failed to resolve import @/lib/schemas/settings".

- [ ] **Step 3: Write the schema**

Create `src/lib/schemas/settings.ts` as a discriminated union on `key`, so each key carries its own value type: the two GA4 ids are `''` or `/^G-[A-Z0-9]{6,12}$/` and `/^\d{6,12}$/`, `contact_email` is the exact literal `'aihubfordevelopment@undp.org'`, and the two flags are `z.boolean()`.

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/unit/settings-schema.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the action and the page**

`src/lib/actions/settings.ts`:

```ts
'use server';

import { revalidateTag } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createAdminReadClient } from '@/lib/admin/client';
import { settingUpdate } from '@/lib/schemas/settings';
import { CACHE_TAGS } from '@/lib/public/cache';

/**
 * Admin only, and that is checked here rather than only on the page that
 * renders the form (spec 3.2). This is the action an editor could most
 * plausibly reach by hand: the Site Content screen they legitimately use
 * carried these panels in the prototype, so a stale client or a reposted form
 * is a realistic path, not a theoretical one.
 *
 * `settings_write_admin` refuses the write as well. Neither layer is
 * decorative: this one produces FORBIDDEN, that one is the boundary.
 */
export async function saveSetting(input: unknown): Promise<void> {
  await requireRole(['admin']);
  const parsed = settingUpdate.parse(input);
  const supabase = await createAdminReadClient();
  const { error } = await supabase
    .from('settings')
    .update({ value: parsed.value })
    .eq('key', parsed.key);
  if (error) throw new Error(`saveSetting failed: ${error.message}`);
  // settings_public projects the two feature flags to anon, so a flag change
  // must reach the public site without a rebuild.
  revalidateTag(CACHE_TAGS.settings, { expire: 0 });
}
```

`settings/page.tsx` calls `await requirePageRole(['admin'])` — `notFound()` for an editor or viewer, so the route's existence is not disclosed — and renders three groups: GA4 (with the "Not connected" state when `ga4_measurement_id` is `''`, and the note listing the five fixed event names), the contact mailbox, and the two feature flags, each labelled off at launch.

- [ ] **Step 6: Write the boundary test**

Create `tests/rls/admin-actions-settings.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { ensureTestUsers, roleClient, serviceClient } from '../helpers/clients';

describe('settings writes are admin-only at the database boundary', () => {
  beforeAll(async () => {
    await ensureTestUsers();
  });

  it('lets an admin change a flag and records it', async () => {
    const admin = await roleClient('admin');
    const { error } = await admin
      .from('settings')
      .update({ value: true })
      .eq('key', 'feature_innovator_profiles');
    expect(error).toBeNull();

    const { data } = await serviceClient()
      .from('audit_log')
      .select('entity_label, change_summary, actor_name')
      .eq('entity_type', 'setting')
      .order('occurred_at', { ascending: false })
      .limit(1);
    expect(data![0].entity_label).toBe('Setting: feature_innovator_profiles');
    expect(data![0].actor_name).not.toBe('system');

    // Restore: both flags are off at launch.
    await admin.from('settings').update({ value: false }).eq('key', 'feature_innovator_profiles');
  });

  it('refuses an editor, who may write every content table but not this one', async () => {
    const editor = await roleClient('editor');
    await editor.from('settings').update({ value: true }).eq('key', 'feature_public_impact_page');

    const { data } = await serviceClient()
      .from('settings')
      .select('value')
      .eq('key', 'feature_public_impact_page')
      .single();
    expect(data!.value, 'an editor flipped a feature flag').toBe(false);
  });
});
```

- [ ] **Step 7: Verify and commit**

Run: `npm run build && npm test && npm run typecheck && npm run lint`

```bash
git add "src/app/(admin)/admin/settings" src/lib/schemas/settings.ts src/lib/actions/settings.ts src/components/admin/SettingsForm.tsx src/lib/admin/readers.ts src/locales/en.json tests/unit/settings-schema.test.ts tests/rls/admin-actions-settings.test.ts
git commit -m "feat(admin): admin-only Settings route for GA4, mailbox and feature flags

Split out of Site Content so the route boundary and the permission boundary
are the same line. PRD 3's capability table already lists Settings as
admin-only one row above Site Content, which is editor-writable; 6.7's panel
list is what put them on one screen, and a single screen-level check there
would have been wrong in both directions.

contact_email accepts only aihubfordevelopment@undp.org: a settings row is the
one place a second mailbox could appear without touching a locale file."
```

---

### Task 7: Users — invite, role, deactivate

**Files:**
- Create: `src/app/(admin)/admin/users/page.tsx`
- Create: `src/lib/schemas/user.ts`, `src/lib/actions/users.ts`
- Create: `src/components/admin/UserTable.tsx`, `InviteForm.tsx`, `RoleBadge.tsx`
- Create: `tests/unit/user-schema.test.ts`, `tests/rls/admin-actions-users.test.ts`
- Modify: `src/lib/admin/readers.ts`, `src/locales/en.json`, `tests/structure/routes.test.ts`, `docs/deployment.md`

**Interfaces:**
- Produces:
  ```ts
  // src/lib/schemas/user.ts
  export const inviteInput: z.ZodType<{ email: string; fullName: string; displayLabel: string; role: 'admin'|'editor'|'viewer' }>;
  export const roleChange: z.ZodType<{ profileId: string; role: 'admin'|'editor'|'viewer' }>;
  // src/lib/actions/users.ts
  export async function inviteUser(input: unknown): Promise<void>;
  export async function changeUserRole(input: unknown): Promise<void>;
  export async function setUserActive(profileId: unknown, isActive: unknown): Promise<void>;
  // src/lib/admin/readers.ts (added)
  export interface AdminUser { id: string; email: string; fullName: string; displayLabel: string; role: Role; isActive: boolean; lastSignInAt: string | null }
  export function readUsers(): Promise<AdminUser[]>;
  ```

- [ ] **Step 1: Write the failing schema test**

Create `tests/unit/user-schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { inviteInput, roleChange } from '@/lib/schemas/user';

describe('inviteInput', () => {
  const valid = {
    email: 'new.editor@undp.org',
    fullName: 'A. Nakamura',
    displayLabel: 'Leadership',
    role: 'editor' as const,
  };

  it('accepts a complete invitation', () => {
    expect(inviteInput.safeParse(valid).success).toBe(true);
  });

  it('requires a full name', () => {
    // audit_log.actor_name falls back to display_label then email when
    // full_name is blank, and PRD 6.9 says the audit log shows the actor's
    // full name, not their email address. Requiring it here is what keeps
    // that promise; the fallback exists for accounts that predate the screen.
    expect(inviteInput.safeParse({ ...valid, fullName: '' }).success).toBe(false);
    expect(inviteInput.safeParse({ ...valid, fullName: '   ' }).success).toBe(false);
  });

  it('accepts a display label that says anything, including a role name', () => {
    // display_label is free text and independent of role (PRD 3). "Leadership"
    // on a viewer is legitimate and must not be rejected or reinterpreted.
    expect(inviteInput.safeParse({ ...valid, role: 'viewer', displayLabel: 'Leadership' }).success).toBe(true);
    expect(inviteInput.safeParse({ ...valid, displayLabel: '' }).success).toBe(true);
  });

  it('refuses a role outside the enum', () => {
    expect(inviteInput.safeParse({ ...valid, role: 'superadmin' }).success).toBe(false);
  });

  it('refuses a malformed email', () => {
    expect(inviteInput.safeParse({ ...valid, email: 'not-an-address' }).success).toBe(false);
  });
});

describe('roleChange', () => {
  it('requires a uuid profile id', () => {
    expect(roleChange.safeParse({ profileId: 'abc', role: 'admin' }).success).toBe(false);
    expect(
      roleChange.safeParse({ profileId: '00000000-0000-0000-0000-000000000001', role: 'admin' }).success,
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run it, then write the schema and re-run**

Run: `npx vitest run tests/unit/user-schema.test.ts` → FAIL, then create `src/lib/schemas/user.ts` and re-run → PASS (6 tests).

- [ ] **Step 3: Write the actions**

Create `src/lib/actions/users.ts`:

```ts
'use server';

import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { createAdminReadClient } from '@/lib/admin/client';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { inviteInput, roleChange } from '@/lib/schemas/user';

/**
 * The only place in SP3 that uses the service_role key, and the reason it is
 * needed at all: creating a Supabase Auth user is a GoTrue Admin API call, not
 * a table write, and no RLS policy can grant it. Everything else on this
 * screen -- the role, the name, the label, deactivation -- is an ordinary
 * admin UPDATE on `profiles` running as the caller.
 *
 * The seam this leaves, and why it is the safe direction (spec 4.6): the auth
 * call and the profile update cannot share a transaction, because no database
 * transaction can span an HTTP call to another service. So the invite creates
 * a least-privilege `viewer` profile via the existing on_auth_user_created
 * trigger -- audited as `system`, honestly, since no authenticated user made
 * that write -- and the admin's own attributed UPDATE then assigns the
 * intended role. If the second step fails, the account exists as a viewer,
 * which is read access the whole client team has anyway, and the error names
 * the account so an admin can finish or deactivate it.
 */
export async function inviteUser(input: unknown): Promise<void> {
  const actor = await requireRole(['admin']);
  const parsed = inviteInput.parse(input);

  const auth = createAdminSupabase();
  const invited = await auth.auth.admin.inviteUserByEmail(parsed.email);
  if (invited.error) throw new Error(`inviteUser failed at the auth step: ${invited.error.message}`);
  const userId = invited.data.user?.id;
  if (!userId) throw new Error('inviteUser: the auth API returned no user id');

  // On the caller's client, so profiles_update_admin applies and the audit
  // row is attributed to this admin rather than to the service key.
  const supabase = await createAdminReadClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      role: parsed.role,
      full_name: parsed.fullName,
      display_label: parsed.displayLabel,
      invited_by: actor.profileId,
    })
    .eq('user_id', userId);
  if (error) {
    throw new Error(
      `inviteUser: ${parsed.email} was invited but its role was not set (${error.message}). ` +
        'The account exists as a viewer; set its role or deactivate it.',
    );
  }
}

export async function changeUserRole(input: unknown): Promise<void> {
  const actor = await requireRole(['admin']);
  const parsed = roleChange.parse(input);

  // PRD 3: at least two admin accounts must exist so a single lockout does not
  // lock out the team. An admin demoting themselves while they are the only
  // one is the exact way that requirement gets undone by accident.
  if (parsed.profileId === actor.profileId && parsed.role !== 'admin') {
    throw new Error('LAST_ADMIN_SELF_DEMOTION');
  }

  const supabase = await createAdminReadClient();
  const { error } = await supabase
    .from('profiles')
    .update({ role: parsed.role })
    .eq('id', parsed.profileId);
  if (error) throw new Error(`changeUserRole failed: ${error.message}`);
}

export async function setUserActive(rawId: unknown, rawActive: unknown): Promise<void> {
  const actor = await requireRole(['admin']);
  const profileId = z.string().uuid().parse(rawId);
  const isActive = z.boolean().parse(rawActive);

  if (profileId === actor.profileId && !isActive) {
    throw new Error('SELF_DEACTIVATION');
  }

  // No auth-side call. `current_app_role()` returns null for an inactive
  // profile, so every policy in the schema stops passing for that user, and
  // `getCurrentUser()` returns null so their session cannot render an admin
  // page. Deactivation is complete at the database layer.
  const supabase = await createAdminReadClient();
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', profileId);
  if (error) throw new Error(`setUserActive failed: ${error.message}`);
}
```

The self-demotion guard is a floor, not the whole rule: it stops the common
accident. Counting remaining admins in the action would be a race; if the
programme wants a hard "never fewer than two admins" invariant, that belongs in
a database check, and it is listed as a follow-up in the ledger.

- [ ] **Step 4: Write the page**

`users/page.tsx` calls `await requirePageRole(['admin'])`, reads `profiles` via a new `readUsers()`, and renders the table with the invite form. There is **no delete control** (spec §7 decision 4): deactivation is complete and preserves the audit trail. Show `last_sign_in_at` as supplied and never as "active now".

- [ ] **Step 5: Write the boundary test**

Create `tests/rls/admin-actions-users.test.ts`: an admin may change a role and deactivate; an **editor may not** (the row is unchanged afterwards — this is the prototype's actual bug, where the Settings tab admitted editors and offered role changes, so an editor could promote themselves); every role change writes one `role_changed` audit row attributed to the acting admin; a deactivated user's `current_app_role()` returns null, proven by signing in as them and finding a previously-permitted write now refused.

- [ ] **Step 6: Check the deployment runbook against what was actually built**

`docs/deployment.md` §3 was already narrowed on the `sp3-admin-design` branch: it carries a "What actually needs the service-role key" table naming `src/lib/actions/users.ts` as the one production caller, and it records that the earlier "every admin write needs this key" conclusion was withdrawn. Confirm the file still matches the code as built — same file path, same single caller — and correct the table if this task's implementation diverged. Do not re-widen the note to "SP3's server actions": that phrasing is what the narrowing replaced.

- [ ] **Step 7: Verify and commit**

Run: `npm run build && npm test && npm run typecheck && npm run lint`

```bash
git add "src/app/(admin)/admin/users" src/lib/schemas/user.ts src/lib/actions/users.ts src/components/admin src/lib/admin/readers.ts src/locales/en.json tests/unit/user-schema.test.ts tests/rls/admin-actions-users.test.ts docs/deployment.md
git commit -m "feat(admin): users screen — invite, change role, deactivate

The service_role key has exactly one production caller, here: creating a
Supabase Auth user is a GoTrue Admin API call and no RLS policy can grant it.
The role, name, label and deactivation are ordinary admin UPDATEs on profiles
running as the caller, so they are audited by the trigger and attributed to the
admin who made them.

Deactivation needs no auth-side call: current_app_role() returns null for an
inactive profile, so every policy in the schema stops passing. No delete
control, because deactivation is complete and keeps the audit trail readable.

Editors are refused at both layers -- the prototype's Settings tab admitted
them and offered role changes, which let an editor promote themselves."
```

---

### Task 8: The Audit Log screen

**Files:**
- Create: `src/app/(admin)/admin/audit/page.tsx`
- Create: `src/lib/admin/audit-view.ts`
- Create: `src/components/admin/AuditTable.tsx`, `AuditFilters.tsx`
- Create: `tests/unit/audit-view.test.ts`
- Modify: `src/lib/admin/readers.ts`, `src/locales/en.json`, `tests/structure/routes.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // src/lib/admin/audit-view.ts
  export interface AuditFilters { actor: string | 'all'; action: AuditAction | 'all'; from: string | null; to: string | null; page: number }
  export const AUDIT_ACTIONS: readonly ['published','edited','created','deleted','approved','rejected','role_changed','digest_sent'];
  export const AUDIT_PAGE_SIZE: 50;
  export function parseAuditFilters(params: URLSearchParams): AuditFilters;
  export function isClearedFilters(filters: AuditFilters): boolean;
  // src/lib/admin/readers.ts (added)
  export interface AuditEntry { id: string; occurredAt: string; actorName: string; action: AuditAction; entityLabel: string; changeSummary: string }
  export function readAuditPage(filters: AuditFilters): Promise<{ rows: AuditEntry[]; total: number }>;
  ```

- [ ] **Step 1: Write the failing test**

Create `tests/unit/audit-view.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseAuditFilters, isClearedFilters, AUDIT_ACTIONS } from '@/lib/admin/audit-view';

describe('parseAuditFilters', () => {
  it('defaults to everything, page 1', () => {
    expect(parseAuditFilters(new URLSearchParams())).toEqual({
      actor: 'all',
      action: 'all',
      from: null,
      to: null,
      page: 1,
    });
  });

  it('reads each of the eight actions and rejects anything else', () => {
    for (const action of AUDIT_ACTIONS) {
      expect(parseAuditFilters(new URLSearchParams(`action=${action}`)).action).toBe(action);
    }
    expect(parseAuditFilters(new URLSearchParams('action=exfiltrated')).action).toBe('all');
  });

  it('keeps a date only when it is a date', () => {
    expect(parseAuditFilters(new URLSearchParams('from=2026-07-01')).from).toBe('2026-07-01');
    expect(parseAuditFilters(new URLSearchParams('from=yesterday')).from).toBeNull();
  });

  it('clamps a nonsense page to 1', () => {
    expect(parseAuditFilters(new URLSearchParams('page=0')).page).toBe(1);
    expect(parseAuditFilters(new URLSearchParams('page=-3')).page).toBe(1);
    expect(parseAuditFilters(new URLSearchParams('page=abc')).page).toBe(1);
    expect(parseAuditFilters(new URLSearchParams('page=4')).page).toBe(4);
  });
});

describe('isClearedFilters', () => {
  it('is true only when every filter is off', () => {
    // PRD 6.9 requires a Clear action that resets every filter; this is what
    // tells the UI whether to offer it.
    expect(isClearedFilters(parseAuditFilters(new URLSearchParams()))).toBe(true);
    expect(isClearedFilters(parseAuditFilters(new URLSearchParams('action=edited')))).toBe(false);
    expect(isClearedFilters(parseAuditFilters(new URLSearchParams('from=2026-07-01')))).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails, write `audit-view.ts`, re-run**

Run: `npx vitest run tests/unit/audit-view.test.ts` → FAIL → implement → PASS (6 tests).

- [ ] **Step 3: Write the reader**

Add `readAuditPage` to `src/lib/admin/readers.ts`: selects `id, occurred_at, actor, actor_name, action, entity_label, change_summary` from `audit_log`, applies the filters, orders `occurred_at desc`, and uses `.range()` with `{ count: 'exact' }` for pagination. **Never `select('*')`** — `diff`, `ip_hash` and `user_agent` are marked `@sensitive` and the screen does not display them, so they should not travel to the render layer at all.

- [ ] **Step 4: Write the page**

`audit/page.tsx` calls `await requireRole(['admin', 'editor', 'viewer'])` — read for all three roles, identically — renders the entry count, the three filters with a Clear action, and the five columns from PRD §6.9 (WHEN to the minute, USER as `actor_name`, ACTION as a colour-coded badge from design tokens, ITEM as `entity_label`, CHANGE as `change_summary` **rendered verbatim as data**, not through `t()`).

Two rules for this screen, both testable:

- There is no write path of any kind: no delete, no export-and-edit, no "add note" (that is the deferred Updates screen). The page renders no `<form>` at all.
- `actor_name === 'system'` renders through `t('admin.audit.actorSystem')`. It is the one value in that column that is a sentinel rather than a person's name, and it must not read as if someone called "system" made the change.

- [ ] **Step 5: Verify and commit**

Run: `npm run build && npm test && npm run typecheck && npm run lint`

```bash
git add "src/app/(admin)/admin/audit" src/lib/admin/audit-view.ts src/lib/admin/readers.ts src/components/admin src/locales/en.json tests/unit/audit-view.test.ts src/locales/en.json
git commit -m "feat(admin): read-only audit log with filters and pagination

Identical for all three roles, because it is read-only for all three. The page
renders no form element at all -- there is no write path to gate.

change_summary is displayed verbatim as data rather than through t(): it is
composed at write time in the database (PRD 4.15) precisely so an entry reads
later exactly as it read when written. The chrome around it is localised
normally, including the 'system' actor sentinel."
```

---

### Task 9: Launch sweep

**Files:**
- Create: `tests/structure/admin-write-affordances.test.ts`, `tests/structure/service-role-containment.test.ts`
- Create: `tests/rls/revalidation-contract.test.ts`
- Modify: `docs/sp3-ledger.md`, `tests/structure/routes.test.ts`

- [ ] **Step 1: Write the viewer-affordance guard**

Create `tests/structure/admin-write-affordances.test.ts`. It parses every `.tsx` under `src/components/admin` and `src/app/(admin)` with the existing TypeScript-compiler helper style from `tests/structure/jsx-literals.ts`, and asserts:

- No JSX element in the admin tree carries a `disabled` attribute whose value is derived from a role or a `canWrite`-shaped prop. A disabled write control is the failure mode spec §3.3 forbids; the affordance must be absent, not inert.
- Every component that renders a `<form>`, a `<button type="submit">`, or an element with an `action`/`formAction` attribute is either inside a route that calls `requireRole` with a write-capable set, or receives a `canWrite`/`canAdminister` prop it guards on.

State the intent in the file header: this catches the regression where someone "helpfully" re-adds a greyed-out Add button so the layout does not shift for viewers.

- [ ] **Step 2: Write the service-role containment guard**

Create `tests/structure/service-role-containment.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * CLAUDE.md: the service_role key is server-only. SP3 gives
 * createAdminSupabase its first and only production caller, so the moment to
 * pin the caller count is now — a second one would be a design change, not a
 * detail, and this test makes it argue for itself in a diff.
 */
function files(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

describe('service_role containment', () => {
  it('has exactly one production caller of createAdminSupabase', () => {
    const callers = files('src')
      .filter((f) => !f.endsWith('src/lib/supabase/admin.ts'))
      .filter((f) => /createAdminSupabase\s*\(/.test(readFileSync(f, 'utf8')));
    expect(
      callers.sort(),
      'The service_role client bypasses RLS entirely. Its only legitimate SP3 caller is the Auth Admin invite; ordinary admin writes run as the caller and are audited by a database trigger (spec 4.1).',
    ).toEqual(['src/lib/actions/users.ts']);
  });

  it('never imports the admin client into a client component', () => {
    const offenders = files('src').filter((f) => {
      const code = readFileSync(f, 'utf8');
      return /['"]use client['"]/.test(code) && /supabase\/admin/.test(code);
    });
    expect(offenders).toEqual([]);
  });

  it('names no service-role environment variable with a NEXT_PUBLIC_ prefix', () => {
    const offenders = files('src').filter((f) =>
      /NEXT_PUBLIC_[A-Z_]*SERVICE/.test(readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 3: Write the revalidation contract test**

Create `tests/rls/revalidation-contract.test.ts`, a source-level assertion rather than a runtime one: every module in `src/lib/actions/` that performs an insert, update, upsert or delete either calls `revalidateTag` with a member of `CACHE_TAGS`, or carries an explicit `// no-revalidate:` comment stating why (the `compute_metrics` and `programmes` actions from Task 5, and every action in `users.ts` and `session.ts`, which touch no publicly-cached data). Assert the comment exists rather than allowing silence — silence is indistinguishable from forgetting.

- [ ] **Step 4: Manual verification pass, recorded in the ledger**

Run through this against the local stack, as three separate sessions, and record the result in `docs/sp3-ledger.md` under "Verification":

- [ ] Sign in as `viewer`: the sidebar shows four entries; `/admin/settings` and `/admin/users` return 404; Resources shows no Actions column; Site Content shows no form; Audit Log is fully readable.
- [ ] Sign in as `editor`: Resources and Site Content are fully editable; `/admin/settings` and `/admin/users` return 404; a direct `saveSetting` call fails `FORBIDDEN`.
- [ ] Sign in as `admin`: every screen works; invite a test address; confirm two audit rows (one `created` as `system`, one attributed to the admin).
- [ ] Publish a resource in admin and confirm it appears on the public directory **without a rebuild**; confirm the reverse for unpublish.
- [ ] Confirm the Dashboard shows four counted figures and no card for reach, growth or clicks.
- [ ] `npm run build` then grep the built bundles under `.next/` for `service_role` and for the key's prefix: no match.

- [ ] **Step 5: Final verification and commit**

Run: `npm run db:reset && npm run build && npm test && npm run typecheck && npm run lint`

```bash
git add tests/structure/admin-write-affordances.test.ts tests/structure/service-role-containment.test.ts tests/rls/revalidation-contract.test.ts docs/sp3-ledger.md
git commit -m "test(admin): viewer affordances, service-role containment, revalidation contract

Three regressions these exist to catch: a greyed-out Add button re-added for a
viewer so the layout does not shift, a second caller of createAdminSupabase
added because a write was inconveniently refused, and a mutating action that
quietly stops revalidating its tag. The last one allows silence nowhere: an
action either revalidates or says in a comment why it does not."
```

---

## Self-review against the spec

- **Spec §1 launch scope** — Task 2 covers sign in, shell and Dashboard; Tasks 3–4 Resources; Task 5 Site Content; Task 6 Settings; Task 7 Users; Task 8 Audit Log. All seven routes accounted for.
- **Spec §2 deferred** — no task creates a route, nav entry or reader for a deferred screen; `tests/unit/admin-nav.test.ts` asserts the absence.
- **Spec §3 permissions** — per-action `requireRole` in Tasks 4–7, page-level `requirePageRole(['admin'])` for Settings and Users, and database-boundary tests per screen. §3.3's no-disabled-control rule is enforced structurally in Task 9.
- **Spec §4 audit** — Task 1 in full, including the atomicity test, G15, and the correction to `src/lib/actions/README.md`.
- **Spec §4.6 service role** — Task 7 is its only caller; Task 9 pins the count; the deployment note is narrowed in Task 7 Step 6.
- **Spec §5 boundary** — SP3 touches no file under `src/lib/public/` except to import `CACHE_TAGS`; the revalidation map is implemented in Tasks 4–6 and asserted in Task 9.
- **Spec §6 testing** — every row of that table maps to a step above, except digest subscriber matching, which belongs to a deferred screen and is named as such.
- **Known gap, stated rather than hidden:** the ResourceForm, ContentPanel, SettingsForm, UserTable and AuditTable components are specified by their props, their role-conditional behaviour and their locale keys rather than given line by line. They are presentational, they carry no security decision that is not asserted elsewhere, and CLAUDE.md forbids testing presentation — so writing 600 lines of JSX here would add volume without adding a guarantee. Every behaviour that *is* load-bearing (which control renders for which role, which action a control calls, which tag that action clears) is specified above and tested.
