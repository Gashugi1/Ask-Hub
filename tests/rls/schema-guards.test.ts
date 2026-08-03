import { describe, it, expect, beforeAll } from 'vitest';
import { serviceClient } from '../helpers/clients';
import {
  ANON_SELECTABLE,
  ANON_EXECUTABLE,
  AUDIT_EXEMPT,
  EXPECTED_ANON_SELECTABLE,
  EXPECTED_ANON_EXECUTABLE,
  EXPECTED_AUDIT_EXEMPT,
} from './security-allowlist';

// ---------------------------------------------------------------------
// Generic, schema-wide security guards.
//
// Everything the per-table suites assert is hand-enumerated: this file
// exists because a table or view added by a later session -- a different
// person, in a different sitting, adding to this same schema -- is
// invisible to a hand-enumerated list until someone remembers to add it.
// Every query these guards run against is pg_catalog -- deliberately not
// information_schema, whose grant views return zero rows for anon/
// authenticated as service_role even when a grant genuinely exists (the
// task brief's F1), which would make a guard built on it vacuously green
// forever -- plus the seed.sql introspection helpers (relation_security,
// relation_privileges, policy_inventory, view_column_sources,
// relation_columns, function_privileges, enum_labels, and trigger_inventory
// as an eighth added by SP3 Task 1 for G15), never a hand list of table
// names, so a new relation is caught the moment `npm test` next runs.
//
// Every assertion is `expect(offenders, message).toEqual([])`: the
// offenders array is the actual value under test, so a passing test
// genuinely proves zero offenders exist, and a failing one names every
// offender in the failure message -- vitest prints only that message, so
// each one embeds the offender list itself rather than relying on an
// automatic diff. No guard here is written as `if (data) { ... }`: that
// shape can never fail, which is the one thing a guard must be able to do.
// ---------------------------------------------------------------------

interface RelationSecurityRow {
  relname: string;
  relkind: string;
  owner: string;
  rls_enabled: boolean;
  rls_forced: boolean;
  policy_count: number;
}

interface RelationPrivilegeRow {
  relname: string;
  relkind: string;
  grantee: string;
  privilege: string;
  column_only: boolean;
}

interface PolicyRow {
  tablename: string;
  policyname: string;
  cmd: string;
  roles: string[];
}

interface TriggerRow {
  table_name: string;
  trigger_name: string;
  function_name: string;
  argument_count: number;
}

interface ViewColumnSourceRow {
  view_name: string;
  base_table: string;
  base_column: string;
}

interface RelationColumnRow {
  relname: string;
  relkind: string;
  column_name: string;
  type_schema: string;
  type_name: string;
  col_comment: string | null;
}

interface FunctionPrivilegeRow {
  proname: string;
  identity_args: string;
  security_definer: boolean;
  search_path_pinned: boolean;
  grantee: string;
  can_execute: boolean;
}

interface EnumRow {
  enum_name: string;
  labels: string[];
}

const README = 'supabase/migrations/README.md';
const CLAUDE_MD = 'CLAUDE.md';

const NO_ALLOWLIST = 'There is no allow-list for this invariant. Do not add one.';

function allowlistException(what: string): string {
  return (
    `To except this: add an entry to tests/rls/security-allowlist.ts with ` +
    `approvedIn and why, and bump ${what}.`
  );
}

/**
 * Builds a five-part failure message per Requirement 4: the offenders
 * themselves (so the message is self-contained even though vitest prints
 * only this string), the invariant and the doc line it enforces, the
 * non-obvious why (mandatory for G3/G4/G6/G12), copy-pasteable
 * remediation naming a real file, and the exception status.
 */
function guardMessage(opts: {
  offenders: string[];
  rule: string;
  why?: string;
  remediation: string;
  exception: string;
}): string {
  const list = opts.offenders.length
    ? opts.offenders.map((o) => `  - ${o}`).join('\n')
    : '  (no offenders — this message should not be visible)';
  return [
    list,
    `RULE: ${opts.rule}`,
    opts.why ? `WHY: ${opts.why}` : undefined,
    `FIX: ${opts.remediation}`,
    `EXCEPTION: ${opts.exception}`,
  ]
    .filter((line): line is string => line !== undefined)
    .join('\n');
}

let relationSecurity: RelationSecurityRow[] = [];
let relationPrivileges: RelationPrivilegeRow[] = [];
let policyInventory: PolicyRow[] = [];
let viewColumnSources: ViewColumnSourceRow[] = [];
let relationColumns: RelationColumnRow[] = [];
let functionPrivileges: FunctionPrivilegeRow[] = [];
let enumNames: string[] = [];
let triggerInventory: TriggerRow[] = [];

// One shared snapshot for the whole file, fetched once. These are catalog
// facts (pg_class, pg_policy, pg_proc, pg_depend, pg_attribute, the
// privilege functions) -- structurally immune to whatever rows other
// suites insert, so one fetch per run is correct, not merely convenient.
// Errors are captured rather than thrown here so Guard 0 below is the
// test that reports a missing helper, with its own actionable message,
// rather than every test in the file failing on an opaque beforeAll
// exception.
let helperErrors: Record<string, string> = {};

// PostgREST applies `db-max-rows` (supabase/config.toml's `max_rows`) to
// every set-returning function call, including these introspection
// helpers -- confirmed directly by requesting `count: 'exact'` alongside
// each RPC, which asks PostgREST for the row count as of the query plan
// via `Content-Range`, independent of how many rows it actually returned.
// A non-empty `data` array is not proof the snapshot is complete: at
// `max_rows`+1 rows, `data.length` would still be non-zero (it would be
// exactly `max_rows`), so a bare emptiness check could not tell a
// truncated snapshot from a small schema. Recording `data.length !==
// count` per helper is what lets Guard 0 catch that case specifically.
let helperTruncated: Record<string, { returned: number; total: number }> = {};

beforeAll(async () => {
  const svc = serviceClient();
  const [rs, rp, pi, vcs, rc, fp, en, ti] = await Promise.all([
    svc.rpc('relation_security', {}, { count: 'exact' }),
    svc.rpc('relation_privileges', {}, { count: 'exact' }),
    svc.rpc('policy_inventory', {}, { count: 'exact' }),
    svc.rpc('view_column_sources', {}, { count: 'exact' }),
    svc.rpc('relation_columns', {}, { count: 'exact' }),
    svc.rpc('function_privileges', {}, { count: 'exact' }),
    svc.rpc('enum_labels', {}, { count: 'exact' }),
    svc.rpc('trigger_inventory', {}, { count: 'exact' }),
  ]);

  const results: Record<
    string,
    { data: unknown; error: { message: string } | null; count: number | null }
  > = {
    relation_security: rs,
    relation_privileges: rp,
    policy_inventory: pi,
    view_column_sources: vcs,
    relation_columns: rc,
    function_privileges: fp,
    enum_labels: en,
    trigger_inventory: ti,
  };
  helperErrors = {};
  helperTruncated = {};
  for (const [name, result] of Object.entries(results)) {
    if (result.error) {
      helperErrors[name] = result.error.message;
      continue;
    }
    const returned = ((result.data ?? []) as unknown[]).length;
    if (result.count !== null && returned !== result.count) {
      helperTruncated[name] = { returned, total: result.count };
    }
  }

  relationSecurity = (rs.data ?? []) as RelationSecurityRow[];
  relationPrivileges = (rp.data ?? []) as RelationPrivilegeRow[];
  policyInventory = (pi.data ?? []) as PolicyRow[];
  viewColumnSources = (vcs.data ?? []) as ViewColumnSourceRow[];
  relationColumns = (rc.data ?? []) as RelationColumnRow[];
  functionPrivileges = (fp.data ?? []) as FunctionPrivilegeRow[];
  enumNames = ((en.data ?? []) as EnumRow[]).map((e) => e.enum_name);
  triggerInventory = (ti.data ?? []) as TriggerRow[];
});

describe('Guard 0 — the guards guard themselves', () => {
  it('every introspection helper resolves, returns non-empty results, and is not truncated by PostgREST max_rows', () => {
    const snapshots: Record<string, unknown[]> = {
      relation_security: relationSecurity,
      relation_privileges: relationPrivileges,
      policy_inventory: policyInventory,
      view_column_sources: viewColumnSources,
      relation_columns: relationColumns,
      function_privileges: functionPrivileges,
      enum_labels: enumNames,
      trigger_inventory: triggerInventory,
    };
    const offenders = Object.entries(snapshots)
      .filter(([, rows]) => rows.length === 0)
      .map(([name]) => `public.${name}() returned zero rows`)
      .concat(
        Object.entries(helperErrors).map(([name, message]) => `public.${name}() errored: ${message}`),
      )
      .concat(
        Object.entries(helperTruncated).map(
          ([name, { returned, total }]) =>
            `public.${name}() returned ${returned} rows but Postgres reports ${total} exist — the snapshot is truncated`,
        ),
      );

    expect(
      offenders,
      guardMessage({
        offenders,
        rule:
          'Every schema-wide guard below depends on these seed.sql helpers actually being callable, non-empty, and returning every row that exists — not merely some of them.',
        why:
          'A suite whose helpers silently 404 (PGRST202, "function not found") reports every downstream guard green while asserting nothing — strictly worse than no suite, because it looks thorough. The same failure mode has a second, quieter door: PostgREST applies `db-max-rows` (supabase/config.toml\'s `max_rows`) to every set-returning function call, including these helpers. relation_privileges (~relations × 3 grantees × up to 8 verbs) and relation_columns (one row per column) are the ones likeliest to cross that ceiling as this schema grows across two sub-projects — and a `data` array that is merely non-empty cannot distinguish a small schema from a snapshot cut off at max_rows. Requesting `count: \'exact\'` and comparing it to `data.length` is what catches the cut, rather than every guard downstream going quietly, partially blind on whichever rows happened to sort last.',
        remediation:
          'supabase/seed.sql is applied only by `supabase db reset`, not by `supabase db push` — run `npm run db:reset` so every introspection helper exists. If truncated, raise `max_rows` in supabase/config.toml (and restart the local stack so PostgREST reloads it) rather than working around the guard.',
        exception: NO_ALLOWLIST,
      }),
    ).toEqual([]);
  });
});

describe('Tier 1 — no exception path', () => {
  it('G1: every table has row-level security enabled', () => {
    const offenders = relationSecurity
      .filter((r) => (r.relkind === 'r' || r.relkind === 'p') && !r.rls_enabled)
      .map((r) => `public.${r.relname} (relkind=${r.relkind}): rls_enabled=false`);

    expect(
      offenders,
      guardMessage({
        offenders,
        rule:
          `${CLAUDE_MD}: "RLS enabled on every table, deny by default. A new table without RLS is a defect." ${README}: "Every table gets RLS enabled, deny by default."`,
        remediation: 'alter table public.<X> enable row level security;',
        exception: NO_ALLOWLIST,
      }),
    ).toEqual([]);
  });

  it('G2: anon holds no SELECT/INSERT/UPDATE/DELETE on any base table', () => {
    const offenders = relationPrivileges
      .filter(
        (p) =>
          p.grantee === 'anon' &&
          (p.relkind === 'r' || p.relkind === 'p') &&
          ['SELECT', 'INSERT', 'UPDATE', 'DELETE'].includes(p.privilege),
      )
      .map(
        (p) =>
          `public.${p.relname}: anon holds ${p.privilege}${p.column_only ? ' (column-level)' : ''}`,
      );

    expect(
      offenders,
      guardMessage({
        offenders,
        rule:
          `${CLAUDE_MD}: "Anonymous reads go through public-safe views that exclude views, clicks, CTR, submitter emails and internal notes." anon must hold zero DML privilege on any base table, table-level or column-level.`,
        remediation:
          'revoke all on table public.<X> from anon, authenticated; then re-grant only to authenticated, per the block in supabase/migrations/README.md. If public read access is intended, add a column to an existing *_public view instead — never grant anon directly on a base table.',
        exception: NO_ALLOWLIST,
      }),
    ).toEqual([]);
  });

  it('G3: neither anon nor authenticated holds INSERT/UPDATE/DELETE on any view', () => {
    const offenders = relationPrivileges
      .filter(
        (p) =>
          p.relkind === 'v' &&
          (p.grantee === 'anon' || p.grantee === 'authenticated') &&
          ['INSERT', 'UPDATE', 'DELETE'].includes(p.privilege),
      )
      .map(
        (p) =>
          `public.${p.relname}: ${p.grantee} holds ${p.privilege}${p.column_only ? ' (column-level)' : ''}`,
      );

    expect(
      offenders,
      guardMessage({
        offenders,
        rule:
          `${CLAUDE_MD}: "Anonymous reads go through public-safe views" — implicit in that is that those views are read-only. No view in public may accept a write from anon or authenticated.`,
        why:
          'This view is security_invoker = false and (for the seven single-table ones) auto-updatable; a write through it executes as the view owner and bypasses the base table\'s RLS entirely. Anonymous writes belong in a server action holding the service_role client behind Zod validation and a rate limit — never a grant on a view or a base table, including for the public submission form, digest signup and contact form.',
        remediation:
          'revoke all on public.<view> from anon, authenticated; then grant select on public.<view> to anon, authenticated; — the exact shape now in supabase/migrations/0009_public_views.sql\'s revoke/grant pair.',
        exception: NO_ALLOWLIST,
      }),
    ).toEqual([]);
  });

  it('G4: authenticated holds exactly {SELECT,INSERT,UPDATE,DELETE} on every base table', () => {
    const EXPECTED = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
    const baseTables = relationSecurity
      .filter((r) => r.relkind === 'r' || r.relkind === 'p')
      .map((r) => r.relname);

    // column_only privileges are tracked separately from table-level ones:
    // `grant select (name) on public.X to authenticated` with no
    // table-level SELECT must not read as "SELECT present." Folding both
    // into one set (as an earlier version of this guard did) would hide
    // exactly that under-grant, since has_table_privilege is false but the
    // privilege would still land in the "held" set via the column-level
    // path -- the same column-level blind spot G2 and G3 already guard
    // against on their own privilege checks.
    const tableLevelHeld = new Map<string, Set<string>>();
    const columnLevelOnly = new Map<string, Set<string>>();
    for (const table of baseTables) {
      tableLevelHeld.set(table, new Set());
      columnLevelOnly.set(table, new Set());
    }
    for (const p of relationPrivileges) {
      if (p.grantee !== 'authenticated') continue;
      if (p.relkind !== 'r' && p.relkind !== 'p') continue;
      (p.column_only ? columnLevelOnly : tableLevelHeld).get(p.relname)?.add(p.privilege);
    }

    const offenders: string[] = [];
    for (const table of baseTables) {
      const privs = tableLevelHeld.get(table) ?? new Set<string>();
      const columnOnly = columnLevelOnly.get(table) ?? new Set<string>();
      const extra = [...privs].filter((priv) => !EXPECTED.includes(priv)).sort();
      const missing = EXPECTED.filter((priv) => !privs.has(priv));
      if (extra.length === 0 && missing.length === 0 && columnOnly.size === 0) continue;
      const parts: string[] = [];
      if (extra.length) parts.push(`extra (table-level): ${extra.join(', ')}`);
      if (missing.length) parts.push(`missing (table-level): ${missing.join(', ')}`);
      if (columnOnly.size) {
        parts.push(
          `granted at column-level only, which does NOT satisfy the table-level requirement: ${[...columnOnly].sort().join(', ')}`,
        );
      }
      offenders.push(`public.${table}: ${parts.join('; ')}`);
    }

    expect(
      offenders,
      guardMessage({
        offenders,
        rule:
          `${README}: "grant select, insert, update, delete on public.X to authenticated" — exactly these four verbs, no more, no fewer, and table-level, not column-level.`,
        why:
          'TRUNCATE, REFERENCES, TRIGGER and MAINTAIN are not subject to row-level security. A role like viewer that has no write *policy* at all on this table could still empty it outright via TRUNCATE if the grant were left in place — RLS has no opinion on TRUNCATE, so no policy can stop it. "Extra" catches that Dxtm residue and any later `grant truncate`; "missing" catches an under-grant that would make a legitimate INSERT/UPDATE/DELETE silently fail before any policy is evaluated -- including the case where a column-level grant exists but the table-level one does not, which would otherwise read as the privilege being present.',
        remediation:
          'revoke all on table public.<X> from anon, authenticated; grant select, insert, update, delete on public.<X> to authenticated; — the exact block in supabase/migrations/README.md. If a column-level grant exists, revoke it explicitly too: revoke <priv> (<column>) on public.<X> from authenticated;',
        exception: NO_ALLOWLIST,
      }),
    ).toEqual([]);
  });

  it('G5: no policy names anon or defaults to PUBLIC', () => {
    const offenders = policyInventory
      .filter((p) => p.roles.includes('anon') || p.roles.includes('public'))
      .map(
        (p) =>
          `public.${p.tablename}.${p.policyname} (${p.cmd}): roles = {${p.roles.join(', ')}}`,
      );

    expect(
      offenders,
      guardMessage({
        offenders,
        rule:
          `${CLAUDE_MD}: "viewer role has no write policy on any table" and anon reads only through public-safe views — neither holds if a policy names anon or defaults to PUBLIC.`,
        why:
          'A policy written with no `to` clause defaults to PUBLIC, which includes anon. That is the likelier mistake, and it is invisible in a migration diff because the omission itself is the defect — there is no `to anon` line to spot in review, just a missing `to authenticated`.',
        remediation:
          'Add `to authenticated` (or the specific staff roles via current_app_role()) to the offending `create policy` statement.',
        exception: NO_ALLOWLIST,
      }),
    ).toEqual([]);
  });

  it('G6: no materialized view or foreign table exists in public', () => {
    const offenders = relationSecurity
      .filter((r) => r.relkind === 'm' || r.relkind === 'f')
      .map((r) => `public.${r.relname} (relkind=${r.relkind})`);

    expect(
      offenders,
      guardMessage({
        offenders,
        rule:
          `${CLAUDE_MD}: "RLS enabled on every table, deny by default." A materialized view (relkind m) or foreign table (relkind f) cannot satisfy that.`,
        why:
          'RLS cannot be enabled on a materialized or foreign table at all — ALTER TABLE ... ENABLE ROW LEVEL SECURITY errors on either. G1 could never catch one because it could never be made to pass; the only correct guard is to forbid the shape outright rather than try to police it after the fact.',
        remediation:
          'Do not create a materialized view or foreign table in public. Use a plain view (relkind v) with security_invoker = false and explicit grants instead, following supabase/migrations/0009_public_views.sql.',
        exception: NO_ALLOWLIST,
      }),
    ).toEqual([]);
  });

  it('G7: no *_public view depends on any @sensitive column', () => {
    const sensitiveColumns = new Set(
      relationColumns
        .filter((c) => c.col_comment?.startsWith('@sensitive'))
        .map((c) => `${c.relname}.${c.column_name}`),
    );

    const offenders = viewColumnSources
      .filter((v) => /_public$/.test(v.view_name))
      .filter((v) => sensitiveColumns.has(`${v.base_table}.${v.base_column}`))
      .map(
        (v) =>
          `public.${v.view_name} depends on @sensitive public.${v.base_table}.${v.base_column}`,
      );

    expect(
      offenders,
      guardMessage({
        offenders,
        rule:
          `${CLAUDE_MD}: "Anonymous reads go through public-safe views that exclude views, clicks, CTR, submitter emails and internal notes." Resolved alias-proof through view_column_sources() (pg_rewrite -> pg_depend -> pg_attribute), so renaming a column in a view's select list cannot dodge this.`,
        remediation:
          'Remove the column from the view\'s select list in supabase/migrations/0009_public_views.sql (or wherever the view is defined). If the column is filtered on but never projected — the resources.status / "where status = \'live\'" shape — it must NOT be marked @sensitive; that case is instead enforced by G14 on the column\'s type.',
        exception: NO_ALLOWLIST,
      }),
    ).toEqual([]);
  });

  it('G8: every base table shares public.profiles\' owner', () => {
    const profilesOwner = relationSecurity.find((r) => r.relname === 'profiles')?.owner;
    const offenders = relationSecurity
      .filter((r) => (r.relkind === 'r' || r.relkind === 'p') && r.owner !== profilesOwner)
      .map((r) => `public.${r.relname} is owned by ${r.owner}, expected ${profilesOwner}`);

    expect(
      offenders,
      guardMessage({
        offenders,
        rule:
          'Every base table in public must be owned by the same role as public.profiles, the schema\'s baseline migration table.',
        why:
          'RLS policies never apply to the table owner (unless FORCE ROW LEVEL SECURITY is also set, which this schema deliberately does not use — see the migration plan\'s "Deliberately excluded" section). anon and authenticated specifically cannot own a table today because neither holds CREATE on schema public — but that is a second, independent layer, not this guard\'s job to assume permanent: a table created by any connection other than the Supabase CLI\'s migration runner, or by a role later granted CREATE on public (directly confirmed: a role granted CREATE in a transaction and then used to create a table here left that table owned by it, with relation_security() reporting the mismatch), would own itself, and its own RLS policies would never apply to its owner — a silent, total bypass of whatever policies were carefully written for it.',
        remediation:
          'Recreate the table from a migration applied by the same role/connection every other migration runs as (the Supabase CLI\'s migration runner), rather than an ad-hoc DDL statement run from a different connection or role.',
        exception: NO_ALLOWLIST,
      }),
    ).toEqual([]);
  });

  it('G9: every security definer function has search_path pinned', () => {
    const byName = new Map<string, FunctionPrivilegeRow>();
    for (const f of functionPrivileges) if (!byName.has(f.proname)) byName.set(f.proname, f);

    const offenders = [...byName.values()]
      .filter((f) => f.security_definer && !f.search_path_pinned)
      .map((f) => `public.${f.proname}(${f.identity_args})`);

    expect(
      offenders,
      guardMessage({
        offenders,
        rule:
          'Every SECURITY DEFINER function in public must set search_path explicitly (matching public.current_app_role() and public.handle_new_user() in supabase/migrations/0003_profiles.sql).',
        why:
          'A SECURITY DEFINER function runs with the privileges of its owner regardless of caller. Without a pinned search_path, a caller who can influence the session\'s search_path (or create objects earlier in it) can get the function to resolve an unqualified identifier to an attacker-controlled object of the same name instead of the intended one — the classic SECURITY DEFINER search_path attack.',
        remediation: "Add `set search_path = ''` to the function definition and schema-qualify every reference inside its body.",
        exception: NO_ALLOWLIST,
      }),
    ).toEqual([]);
  });
});

describe('Tier 2 — allow-listed', () => {
  it('G10: every anon-selectable relation is a *_public view in the registry', () => {
    const anonSelect = relationPrivileges.filter(
      (p) => p.grantee === 'anon' && p.privilege === 'SELECT',
    );
    const offenders = anonSelect
      .filter(
        (p) =>
          p.relkind !== 'v' || !/_public$/.test(p.relname) || !(p.relname in ANON_SELECTABLE),
      )
      .map(
        (p) =>
          `public.${p.relname} (relkind=${p.relkind})${p.column_only ? ' — column-level SELECT' : ''}`,
      );

    expect(
      offenders,
      guardMessage({
        offenders,
        rule:
          `${CLAUDE_MD}: "Anonymous reads go through public-safe views" — every relation anon can SELECT must be a view, named *_public, and registered in tests/rls/security-allowlist.ts.`,
        remediation:
          'If this is a legitimate new public-safe view, name it <table>_public and add it to ANON_SELECTABLE in tests/rls/security-allowlist.ts (bump EXPECTED_ANON_SELECTABLE too — see G11). Otherwise revoke the grant: revoke all on public.<X> from anon;',
        exception: allowlistException('EXPECTED_ANON_SELECTABLE'),
      }),
    ).toEqual([]);
  });

  it('G11: the anon-selectable view set equals the registry, exactly', () => {
    const anonSelectableViews = [
      ...new Set(
        relationPrivileges
          .filter((p) => p.grantee === 'anon' && p.privilege === 'SELECT' && p.relkind === 'v')
          .map((p) => p.relname),
      ),
    ].sort();
    const registryKeys = Object.keys(ANON_SELECTABLE).sort();

    const offenders: string[] = [];
    if (JSON.stringify(anonSelectableViews) !== JSON.stringify(registryKeys)) {
      const missingFromRegistry = anonSelectableViews.filter((v) => !registryKeys.includes(v));
      const missingGrant = registryKeys.filter((v) => !anonSelectableViews.includes(v));
      if (missingFromRegistry.length) {
        offenders.push(`anon can SELECT but not registered: ${missingFromRegistry.join(', ')}`);
      }
      if (missingGrant.length) {
        offenders.push(`registered but anon cannot SELECT: ${missingGrant.join(', ')}`);
      }
    }
    if (Object.keys(ANON_SELECTABLE).length !== EXPECTED_ANON_SELECTABLE) {
      offenders.push(
        `ANON_SELECTABLE has ${Object.keys(ANON_SELECTABLE).length} entries, EXPECTED_ANON_SELECTABLE = ${EXPECTED_ANON_SELECTABLE}`,
      );
    }

    expect(
      offenders,
      guardMessage({
        offenders,
        rule:
          'The registered set of anon-selectable views in tests/rls/security-allowlist.ts must equal the actual set exactly, in both directions, and its length must equal the pinned EXPECTED_ANON_SELECTABLE count.',
        why:
          'Comparing sorted arrays for equality (not `toContain`) is what catches removal as well as addition — dropping a view from the anon grant list would leave a `toContain`-style check green while the public page it powers now 403s. The separate cardinality check catches the case where an add and a remove happen to leave the set-membership check passing by coincidence.',
        remediation:
          'Add or remove the entry in ANON_SELECTABLE in tests/rls/security-allowlist.ts and update EXPECTED_ANON_SELECTABLE to match, in the same diff as the grant change.',
        exception: allowlistException('EXPECTED_ANON_SELECTABLE'),
      }),
    ).toEqual([]);
  });

  it('G12: no function in public is executable by anon or PUBLIC unless registered', () => {
    // Keyed by `proname(identity_args)`, not proname alone: two overloads
    // of the same name (e.g. a future column_names(text) and
    // column_names(text, text)) would otherwise share a single
    // ANON_EXECUTABLE slot, so registering one would silently also except
    // the other. The offender string below already prints this same
    // composite form, so the lookup key now matches what a reader would
    // actually type into the registry.
    const offenders = functionPrivileges
      .filter(
        (f) =>
          (f.grantee === 'anon' || f.grantee === 'public') &&
          f.can_execute &&
          !(`${f.proname}(${f.identity_args})` in ANON_EXECUTABLE),
      )
      .map((f) => `public.${f.proname}(${f.identity_args}): executable by ${f.grantee}`);

    expect(
      offenders,
      guardMessage({
        offenders,
        rule:
          'Every function in public must have EXECUTE revoked from PUBLIC/anon unless it is a deliberate, registered exception in tests/rls/security-allowlist.ts (ANON_EXECUTABLE).',
        why:
          'Postgres grants EXECUTE to PUBLIC on every new function by default, and PostgREST exposes every function in the public schema at /rpc/<name>. This is the function-level analogue of the table-level Dxtm residue every table migration already strips — an unrevoked function is reachable over the anonymous REST API the moment it exists, whatever it was actually written for (a trigger body, an internal helper).',
        remediation:
          "revoke all on function public.<fn>(<args>) from public, anon, authenticated; in a new migration — see supabase/migrations/0010_function_grants.sql for the exact shape used for public.set_updated_at().",
        exception: allowlistException('EXPECTED_ANON_EXECUTABLE'),
      }),
    ).toEqual([]);
  });

  it('G13: every sensitivity-shaped column carries @sensitive or @public-ok', () => {
    const HEURISTICS = [
      '%email%', '%token%', '%ip%hash%', '%hash%', '%note%',
      'message', 'user_agent', 'diff', 'views', 'clicks', 'ctr',
      '%secret%', '%phone%',
    ];
    const heuristicRegexes = HEURISTICS.map((pattern) => {
      const escaped = pattern
        .split('%')
        .map((seg) => seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*');
      return new RegExp(`^${escaped}$`, 'i');
    });
    const matchesHeuristic = (columnName: string): boolean =>
      heuristicRegexes.some((re) => re.test(columnName));

    const offenders = relationColumns
      .filter((c) => c.relkind === 'r' || c.relkind === 'p')
      .filter((c) => matchesHeuristic(c.column_name))
      .filter((c) => {
        const comment = c.col_comment ?? '';
        if (comment.startsWith('@sensitive')) return false;
        if (/^@public-ok\s+\S/.test(comment)) return false;
        return true;
      })
      .map(
        (c) =>
          `public.${c.relname}.${c.column_name} (comment: ${c.col_comment ? JSON.stringify(c.col_comment) : 'none'})`,
      );

    expect(
      offenders,
      guardMessage({
        offenders,
        rule:
          `${CLAUDE_MD}'s "never fabricate data" / "public-safe views" intent applied at the column level: a column whose name looks like PII, a secret, an internal note or an analytics figure must say, explicitly, whether it is sensitive.`,
        remediation:
          "comment on column public.<table>.<column> is '@sensitive <why, and confirmation it never reaches a public view>'; -- or, if the column is deliberately public content, '@public-ok <reason>';",
        // Deliberately not allowlistException(): that helper's template
        // always opens with "add an entry to tests/rls/security-
        // allowlist.ts," which is exactly the wrong instruction here and
        // reads as correct to someone under time pressure who stops at the
        // first clause. G13 has no allow-list at all -- the column itself
        // is the only place to record the decision.
        exception:
          'There is no allow-list for this invariant. Do not add one — annotate the column itself with @sensitive, or @public-ok <reason> if it is an audited false positive.',
      }),
    ).toEqual([]);
  });

  it('G13 floor: the 18 originally-marked @sensitive columns still carry the marker', () => {
    // Hand list deliberately used here, unlike every other guard in this
    // file: this is a floor test whose entire job is to notice if the
    // @sensitive convention itself is later abandoned (comments deleted,
    // column renamed without moving the comment) — a catalog-driven check
    // would just silently track whatever the convention currently says,
    // which cannot catch its own erosion. Confirmed against pg_description
    // directly during Task 11b: exactly 18 columns.
    const EXPECTED_SENSITIVE: ReadonlyArray<readonly [string, string]> = [
      ['partnerships', 'note'],
      ['submissions', 'submitter_email'],
      ['submissions', 'source_ip_hash'],
      ['submissions', 'rejection_reason'],
      ['subscribers', 'email'],
      ['subscribers', 'confirm_token'],
      ['subscribers', 'unsubscribe_token'],
      ['digest_sends', 'notes'],
      ['contact_messages', 'email'],
      ['contact_messages', 'message'],
      ['contact_messages', 'source_ip_hash'],
      ['contact_messages', 'delivery_error'],
      ['updates_log', 'actor_name'],
      ['audit_log', 'ip_hash'],
      ['audit_log', 'user_agent'],
      ['audit_log', 'actor_name'],
      ['audit_log', 'diff'],
      ['engagement_events', 'session_hash'],
    ];

    expect(EXPECTED_SENSITIVE.length).toBe(18);

    const offenders = EXPECTED_SENSITIVE.filter(([table, column]) => {
      const row = relationColumns.find((c) => c.relname === table && c.column_name === column);
      return !row || !row.col_comment?.startsWith('@sensitive');
    }).map(([table, column]) => `public.${table}.${column}`);

    expect(
      offenders,
      guardMessage({
        offenders,
        rule:
          'The 18 columns marked @sensitive as of Task 11b must remain marked — this is the floor the convention cannot regress under.',
        remediation:
          "Restore the comment: comment on column public.<table>.<column> is '@sensitive ...'; — do not remove a @sensitive marker without also removing the column from every place it could be reached.",
        exception: NO_ALLOWLIST,
      }),
    ).toEqual([]);
  });

  it('G14: every *_public view is typed only from {need_type, geo_scope, partner_tier, exclusivity} among public enums', () => {
    const ALLOWED = new Set(['need_type', 'geo_scope', 'partner_tier', 'exclusivity']);
    const offenders = relationColumns
      .filter((c) => c.relkind === 'v' && /_public$/.test(c.relname))
      .filter(
        (c) => c.type_schema === 'public' && enumNames.includes(c.type_name) && !ALLOWED.has(c.type_name),
      )
      .map((c) => `public.${c.relname}.${c.column_name}: type public.${c.type_name}`);

    expect(
      offenders,
      guardMessage({
        offenders,
        rule:
          `${CLAUDE_MD}: "Anonymous reads go through public-safe views that exclude ... internal notes" — extended here to internal-only enum types. Only need_type, geo_scope, partner_tier and exclusivity may appear as a *_public view's output column type among public's enums.`,
        why:
          "Type-based, so alias-proof for resources.status specifically: resources_public legitimately filters `where status = 'live'` (and Postgres's rewrite dependency tracking makes view_column_sources() report that qual reference — confirmed directly against this database), so status cannot be marked @sensitive without making G7 flag the one view that correctly filters on it. Any projection of resources.status as an output column, however renamed, still carries type public.resource_status, so G14 catches it where a name-based check could be dodged by an alias. submission_status, partnership_stage, audit_action and app_role reaching the public surface would be defects for the same reason. exclusivity (Task 12r) is allow-listed for the opposite reason those five are excluded: it is a two-value **public badge** with no internal-workflow meaning at all — 'exclusive' or 'early_access', displayed on the public site by design (ruling H10) — unlike resource_status/submission_status/partnership_stage/audit_action/app_role, which describe internal pipeline or access state and must never reach the public surface. The line a new enum must be judged against is exactly that: does its value describe something the public site is meant to show (allow-list it, by name, here), or internal state a public visitor must never see (keep it off this list, and prefer a derived column — the is_closed boolean, not status — if only part of the meaning needs to be public). Note also what this guard cannot see: a `::text` cast of a disallowed enum (e.g. `r.status::text as availability`) erases the type before G14's introspection ever runs, and G7 does not backstop it either since resources.status is deliberately unmarked (marking it @sensitive would make G7 flag the one view that legitimately filters on it). G14 is not a complete defence against that specific bypass — review remains load-bearing for a cast that erases an enum's type rather than exposing it honestly.",
        remediation:
          'Remove the column from the view\'s select list in supabase/migrations/0009_public_views.sql (or supabase/migrations/0013_reconcile_partners.sql for resources_public). If only a derived boolean/label is needed (the resources_public shape: is_closed, not status), compute that in the view instead of projecting the enum itself. If the enum is a genuine public-safe value like exclusivity, add it to ALLOWED here with a why explaining which side of the public/internal line it falls on — never dodge the guard with a `::text` cast instead.',
        exception: NO_ALLOWLIST,
      }),
    ).toEqual([]);
  });

  it('G15: every base table with a write policy carries an audit trigger', () => {
    const audited = new Set(
      triggerInventory
        .filter((t) => t.function_name === 'audit_row_change')
        .map((t) => t.table_name),
    );

    // Any policy that is not SELECT-only is a write path, and every write path
    // must leave a record. Derived from policy_inventory rather than from a
    // hand list, for the reason this whole file exists: a table added by a
    // later session is invisible to a hand list until somebody remembers it.
    const writePolicied = [...new Set(
      policyInventory.filter((p) => p.cmd !== 'SELECT').map((p) => p.tablename),
    )].sort();

    const offenders = writePolicied
      .filter((table) => !audited.has(table) && !(table in AUDIT_EXEMPT))
      .map((table) => `public.${table} has a write policy and no audit_row_change trigger`);

    expect(
      offenders,
      guardMessage({
        offenders,
        rule:
          `${CLAUDE_MD}: audit_log is the accountability record for every admin write, and PRD 6.9 states the log spans every entity type, not resources only. A table anyone may write with no trigger to record it is an unaudited write path.`,
        why:
          'The audit row is written by the database precisely so it cannot drift from the mutation (SP3 design spec 4.2): a trigger runs inside the statement that fired it, so the pair shares one transaction and a failed audit insert aborts the write. That guarantee is per table, and it is established by attaching the trigger -- so the failure mode this guard exists for is not a broken trigger but a missing one, on a table whose admin screen arrives three sub-projects later and whose writes silently go unrecorded. SP3 Task 1 therefore attaches it to all fifteen write-policied tables, including the ones whose screens are deferred, and this guard is what keeps that set complete rather than complete-as-of-2026.',
        remediation:
          "Add `create trigger <table>_audit after insert or update or delete on public.<table> for each row execute function public.audit_row_change('<entity_type>', '<label columns>', '<label prefix>', '<redact list>');` in a new migration, following supabase/migrations/0018_audit_triggers.sql. If the table genuinely must not be audited, add it to AUDIT_EXEMPT in tests/rls/security-allowlist.ts with a reason and bump EXPECTED_AUDIT_EXEMPT.",
        exception: allowlistException('EXPECTED_AUDIT_EXEMPT'),
      }),
    ).toEqual([]);
  });
});

describe('allow-list meta-test — tests/rls/security-allowlist.ts must itself be well-formed', () => {
  function checkRegistry(
    registry: Record<string, { approvedIn: string; why: string }>,
    expectedCount: number,
    expectedCountName: string,
  ): string[] {
    const offenders: string[] = [];
    // The optional letter after the SP number (not just after the T number)
    // was added for SP2a, SP2b, ... -- sub-projects of SP2 named with a
    // letter suffix, distinct from a lettered task variant like SP1-T12l.
    for (const [name, exception] of Object.entries(registry)) {
      if (!/^SP\d+[a-z]?-T\d+[a-z]?$/.test(exception.approvedIn)) {
        offenders.push(
          `${name}: approvedIn "${exception.approvedIn}" does not match /^SP\\d+[a-z]?-T\\d+[a-z]?$/`,
        );
      }
      if (exception.why.length < 40) {
        offenders.push(`${name}: why is ${exception.why.length} characters, must be >= 40`);
      }
      if (exception.why.toLowerCase().includes(name.toLowerCase())) {
        offenders.push(`${name}: why must not merely restate the object's own name as a substring`);
      }
    }
    if (Object.keys(registry).length !== expectedCount) {
      offenders.push(
        `registry has ${Object.keys(registry).length} entries, ${expectedCountName} = ${expectedCount}`,
      );
    }
    return offenders;
  }

  it('ANON_SELECTABLE entries are well-formed and the count is pinned', () => {
    const offenders = checkRegistry(ANON_SELECTABLE, EXPECTED_ANON_SELECTABLE, 'EXPECTED_ANON_SELECTABLE');
    expect(
      offenders,
      guardMessage({
        offenders,
        rule:
          'Every ANON_SELECTABLE entry needs a real approvedIn plan-task reference and a why that is not a restated name, per Requirement 3 of Task 11b.',
        remediation:
          'Fix the offending entry in tests/rls/security-allowlist.ts directly.',
        exception:
          'This is the meta-test for the allow-list itself — there is no further allow-list above it.',
      }),
    ).toEqual([]);
  });

  it('AUDIT_EXEMPT entries are well-formed and the count is pinned', () => {
    const offenders = checkRegistry(AUDIT_EXEMPT, EXPECTED_AUDIT_EXEMPT, 'EXPECTED_AUDIT_EXEMPT');
    expect(
      offenders,
      guardMessage({
        offenders,
        rule:
          'Every AUDIT_EXEMPT entry needs a real approvedIn plan-task reference and a why that is not a restated name, held to the same standard as the two anon registries — an entry here is a table whose writes nobody can reconstruct afterwards.',
        remediation:
          'Fix the offending entry in tests/rls/security-allowlist.ts directly.',
        exception:
          'This is the meta-test for the allow-list itself — there is no further allow-list above it.',
      }),
    ).toEqual([]);
  });

  it('ANON_EXECUTABLE entries are well-formed and the count is pinned', () => {
    const offenders = checkRegistry(ANON_EXECUTABLE, EXPECTED_ANON_EXECUTABLE, 'EXPECTED_ANON_EXECUTABLE');
    expect(
      offenders,
      guardMessage({
        offenders,
        rule:
          'Every ANON_EXECUTABLE entry needs a real approvedIn plan-task reference and a why that is not a restated name, per Requirement 3 of Task 11b.',
        remediation:
          'Fix the offending entry in tests/rls/security-allowlist.ts directly.',
        exception:
          'This is the meta-test for the allow-list itself — there is no further allow-list above it.',
      }),
    ).toEqual([]);
  });
});
