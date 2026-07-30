-- LOCAL-ONLY. This file is applied by `supabase db reset` after every
-- migration in supabase/migrations/, but it is never applied by
-- `supabase db push` and never reaches a production database.
--
-- It exists purely so the contract tests can introspect the schema
-- (enum labels, column names, index names) without hand-maintaining a
-- parallel description of the schema in TypeScript. These functions are
-- test-only surface area with no application caller: shipping them to
-- production would be pure attack surface for no benefit, which is why
-- they live here instead of in a migration.
--
-- Per CLAUDE.md's "never fabricate data" rule, this file contains
-- functions only -- no data rows.

-- Returns every enum defined in the public schema with its ordered
-- labels, so tests can assert the full enum contract in one round trip.
create or replace function public.enum_labels()
returns table (enum_name text, labels text[])
language sql
stable
set search_path = ''
as $$
  select t.typname::text,
         array_agg(e.enumlabel::text order by e.enumsortorder)
  from pg_catalog.pg_type t
  join pg_catalog.pg_enum e on e.enumtypid = t.oid
  join pg_catalog.pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
  group by t.typname
$$;

-- Revoking from public also strips service_role's implicit grant, so
-- it must be granted back explicitly or the contract tests fail with
-- "permission denied for function".
revoke all on function public.enum_labels() from public, anon, authenticated;
grant execute on function public.enum_labels() to service_role;

-- Column names for a table OR a view. information_schema.columns covers
-- both, which matters because a later test calls this with
-- `resources_public`, a public-safe view rather than a table.
--
-- The parameter is qualified by function name (column_names.table_name)
-- to disambiguate it from the identically-named column on
-- information_schema.columns -- verified to work against this Postgres.
create or replace function public.column_names(table_name text)
returns table (column_name text)
language sql
stable
set search_path = ''
as $$
  select c.column_name::text
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = column_names.table_name
  order by c.ordinal_position
$$;

revoke all on function public.column_names(text) from public, anon, authenticated;
grant execute on function public.column_names(text) to service_role;

-- Index names for a table, read from pg_indexes so later tasks can
-- assert the indexes their migrations claim to add actually exist.
create or replace function public.index_names(table_name text)
returns table (index_name text)
language sql
stable
set search_path = ''
as $$
  select i.indexname::text
  from pg_catalog.pg_indexes i
  where i.schemaname = 'public' and i.tablename = index_names.table_name
  order by i.indexname
$$;

revoke all on function public.index_names(text) from public, anon, authenticated;
grant execute on function public.index_names(text) to service_role;

-- ---------------------------------------------------------------------
-- Task 11b: schema-wide security guard helpers.
--
-- These six return raw long-format catalog facts only -- never a
-- verdict. The judgement (what counts as an offender) lives in
-- tests/rls/schema-guards.test.ts, in TypeScript, so a failing
-- assertion can name every offender at once instead of a helper
-- returning a single boolean nobody can act on.
--
-- Every query here is scoped to `nspname = 'public'` and excludes
-- extension members via `pg_depend.deptype = 'e'`. Without both, these
-- guards fail on day one against Supabase's own grants on
-- `storage.objects` / `auth.users`, and the tempting "fix" is to weaken
-- the guard rather than the query.
--
-- `information_schema.role_table_grants` is not used anywhere below:
-- verified directly against this database that, as service_role, it
-- returns zero rows for a grantee of `anon` or `authenticated` even
-- when `pg_class.relacl` shows the grant -- the information_schema
-- grant views filter to rows where the current user is grantor,
-- grantee, or a member of the grantee role, none of which service_role
-- is. Built on pg_catalog and has_table_privilege()/
-- has_any_column_privilege() instead, both confirmed to work for
-- arbitrary role names as service_role.
-- ---------------------------------------------------------------------

-- RLS posture per relation: whether it is enabled/forced, and how many
-- policies exist. relkind is returned raw ('r', 'p', 'v', 'm', 'f') so
-- the caller can assert "every table has RLS" (r, p) separately from
-- "no materialized or foreign table exists at all" (m, f), which can
-- never satisfy the first assertion since RLS cannot be enabled on
-- either.
create or replace function public.relation_security()
returns table (
  relname text,
  relkind text,
  owner text,
  rls_enabled boolean,
  rls_forced boolean,
  policy_count integer
)
language sql
stable
set search_path = ''
as $$
  select
    c.relname::text,
    c.relkind::text,
    o.rolname::text as owner,
    c.relrowsecurity,
    c.relforcerowsecurity,
    (
      select count(*)::integer
      from pg_catalog.pg_policy pol
      where pol.polrelid = c.oid
    )
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join pg_catalog.pg_roles o on o.oid = c.relowner
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and not exists (
      select 1 from pg_catalog.pg_depend d
      where d.classid = 'pg_catalog.pg_class'::regclass
        and d.objid = c.oid
        and d.deptype = 'e'
    )
$$;

revoke all on function public.relation_security() from public, anon, authenticated;
grant execute on function public.relation_security() to service_role;

-- Table/view-level and column-level privileges actually held, in long
-- format: one row per (relname, grantee, privilege) actually granted,
-- across the seven privilege verbs RLS-relevant tables can hold, for
-- exactly the three roles that matter (anon, authenticated,
-- service_role). `column_only` is true when only a column-level grant
-- accounts for the privilege (has_table_privilege false, but
-- has_any_column_privilege true) -- that distinction is what lets a
-- failure say "anon holds SELECT on public.submissions (column-level)"
-- instead of masking a `grant select (name) on t to anon` as a clean
-- pass.
--
-- has_any_column_privilege only accepts SELECT/INSERT/UPDATE/REFERENCES
-- -- verified directly: passing DELETE, TRUNCATE, TRIGGER or MAINTAIN
-- raises "unrecognized privilege type". Those four are not column-level
-- privileges at all (there is no such thing as column-level TRUNCATE),
-- so column_only is always false for them and only has_table_privilege
-- is consulted.
--
-- MAINTAIN is PG17+; this database is 17.6, confirmed via
-- current_setting('server_version_num'), so it is included rather than
-- omitted.
create or replace function public.relation_privileges()
returns table (
  relname text,
  relkind text,
  grantee text,
  privilege text,
  column_only boolean
)
language sql
stable
set search_path = ''
as $$
  with grantees(grantee) as (
    values ('anon'), ('authenticated'), ('service_role')
  ),
  privs(privilege) as (
    select unnest(
      case when current_setting('server_version_num')::int >= 170000
        then array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']
        else array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']
      end
    )
  ),
  rels as (
    select c.oid, c.relname::text, c.relkind::text
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and not exists (
        select 1 from pg_catalog.pg_depend d
        where d.classid = 'pg_catalog.pg_class'::regclass
          and d.objid = c.oid
          and d.deptype = 'e'
      )
  )
  select
    r.relname,
    r.relkind,
    g.grantee,
    p.privilege,
    case
      when p.privilege in ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
        then (not pg_catalog.has_table_privilege(g.grantee, r.oid, p.privilege))
             and pg_catalog.has_any_column_privilege(g.grantee, r.oid, p.privilege)
      else false
    end as column_only
  from rels r
  cross join grantees g
  cross join privs p
  where pg_catalog.has_table_privilege(g.grantee, r.oid, p.privilege)
     or (
       p.privilege in ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
       and pg_catalog.has_any_column_privilege(g.grantee, r.oid, p.privilege)
     )
$$;

revoke all on function public.relation_privileges() from public, anon, authenticated;
grant execute on function public.relation_privileges() to service_role;

-- Every RLS policy in public, with its full roles array as Postgres
-- recorded it. A policy written with no `to` clause defaults to
-- PUBLIC, which pg_policies renders as roles = {public} -- that is the
-- shape a guard must catch, and it is invisible in a migration diff
-- because the omission itself is the defect.
create or replace function public.policy_inventory()
returns table (
  tablename text,
  policyname text,
  cmd text,
  roles text[]
)
language sql
stable
set search_path = ''
as $$
  select
    p.tablename::text,
    p.policyname::text,
    p.cmd::text,
    p.roles::text[]
  from pg_catalog.pg_policies p
  where p.schemaname = 'public'
$$;

revoke all on function public.policy_inventory() from public, anon, authenticated;
grant execute on function public.policy_inventory() to service_role;

-- (view, base_table, base_column) triples, resolved through
-- pg_rewrite -> pg_depend -> pg_attribute on refobjsubid > 0. This is
-- alias-proof: renaming a base column in a view's select list still
-- resolves to the marked base column, so a forbidden-column guard
-- cannot be dodged by aliasing.
--
-- Postgres records a rewrite dependency for every Var in the query
-- tree, including one that only appears in a WHERE qual -- confirmed
-- directly against resources_public, whose `where status = 'live'`
-- clause makes `resources.status` appear here even though the view
-- never projects it as an output column. That column must therefore
-- never be marked @sensitive (it would flag the one view that legally
-- filters on it); it is instead policed by relation_columns() below,
-- which reflects only a view's actual output columns and type.
create or replace function public.view_column_sources()
returns table (
  view_name text,
  base_table text,
  base_column text
)
language sql
stable
set search_path = ''
as $$
  select distinct
    v.relname::text as view_name,
    bt.relname::text as base_table,
    ba.attname::text as base_column
  from pg_catalog.pg_class v
  join pg_catalog.pg_namespace vn on vn.oid = v.relnamespace
  join pg_catalog.pg_rewrite rw on rw.ev_class = v.oid
  join pg_catalog.pg_depend d
    on d.classid = 'pg_catalog.pg_rewrite'::regclass
   and d.objid = rw.oid
   and d.refclassid = 'pg_catalog.pg_class'::regclass
   and d.refobjsubid > 0
  join pg_catalog.pg_class bt on bt.oid = d.refobjid
  join pg_catalog.pg_namespace btn on btn.oid = bt.relnamespace
  join pg_catalog.pg_attribute ba
    on ba.attrelid = bt.oid and ba.attnum = d.refobjsubid
  where vn.nspname = 'public'
    and v.relkind = 'v'
    and btn.nspname = 'public'
    -- Same extension-member exclusion every other helper in this file
    -- applies, checked against both sides of the dependency (the view
    -- itself and the base table it reads): without it, a view or table
    -- shipped by an extension into public would be in scope here even
    -- though every other helper structurally excludes it. No live effect
    -- today -- zero extension-owned relations exist in public -- but the
    -- section comment above claims this exclusion applies everywhere in
    -- this file, and this function was the one place that didn't.
    and not exists (
      select 1 from pg_catalog.pg_depend ext
      where ext.classid = 'pg_catalog.pg_class'::regclass
        and ext.objid = v.oid
        and ext.deptype = 'e'
    )
    and not exists (
      select 1 from pg_catalog.pg_depend ext
      where ext.classid = 'pg_catalog.pg_class'::regclass
        and ext.objid = bt.oid
        and ext.deptype = 'e'
    )
$$;

revoke all on function public.view_column_sources() from public, anon, authenticated;
grant execute on function public.view_column_sources() to service_role;

-- Every live column of every relation in public, with its type and
-- column comment. This is what a sensitivity-name heuristic and the
-- enum-type guard (G13, G14) run against: unlike view_column_sources
-- above, this reflects only a relation's actual output columns (its
-- own pg_attribute rows), not qual-only dependencies -- confirmed
-- directly: resources_public's own columns do not include `status`,
-- even though view_column_sources reports it as a dependency.
create or replace function public.relation_columns()
returns table (
  relname text,
  relkind text,
  column_name text,
  type_schema text,
  type_name text,
  col_comment text
)
language sql
stable
set search_path = ''
as $$
  select
    c.relname::text,
    c.relkind::text,
    a.attname::text,
    tn.nspname::text as type_schema,
    t.typname::text as type_name,
    pg_catalog.col_description(c.oid, a.attnum) as col_comment
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join pg_catalog.pg_attribute a on a.attrelid = c.oid
  join pg_catalog.pg_type t on t.oid = a.atttypid
  join pg_catalog.pg_namespace tn on tn.oid = t.typnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and a.attnum > 0
    and not a.attisdropped
    and not exists (
      select 1 from pg_catalog.pg_depend d
      where d.classid = 'pg_catalog.pg_class'::regclass
        and d.objid = c.oid
        and d.deptype = 'e'
    )
$$;

revoke all on function public.relation_columns() from public, anon, authenticated;
grant execute on function public.relation_columns() to service_role;

-- EXECUTE privilege per (function, grantee), including the PUBLIC
-- pseudo-role (has_function_privilege accepts 'public' as its literal
-- name, confirmed directly). Postgres grants EXECUTE to PUBLIC on
-- every new function by default, and PostgREST exposes every function
-- in the public schema at /rpc/<name> -- this is the function-level
-- analogue of the table-level Dxtm residue the grants convention
-- already strips, and it is what fires on public.set_updated_at()
-- until Task 11b's Requirement 6 revokes it.
create or replace function public.function_privileges()
returns table (
  proname text,
  identity_args text,
  security_definer boolean,
  search_path_pinned boolean,
  grantee text,
  can_execute boolean
)
language sql
stable
set search_path = ''
as $$
  with grantees(grantee) as (
    values ('anon'), ('authenticated'), ('service_role'), ('public')
  ),
  fns as (
    select
      p.oid,
      p.proname::text,
      pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_args,
      p.prosecdef as security_definer,
      exists (
        select 1
        from unnest(coalesce(p.proconfig, '{}'::text[])) cfg
        where cfg like 'search_path=%'
      ) as search_path_pinned
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p')
      and not exists (
        select 1 from pg_catalog.pg_depend d
        where d.classid = 'pg_catalog.pg_proc'::regclass
          and d.objid = p.oid
          and d.deptype = 'e'
      )
  )
  select
    f.proname,
    f.identity_args,
    f.security_definer,
    f.search_path_pinned,
    g.grantee,
    pg_catalog.has_function_privilege(g.grantee, f.oid, 'EXECUTE')
  from fns f
  cross join grantees g
$$;

revoke all on function public.function_privileges() from public, anon, authenticated;
grant execute on function public.function_privileges() to service_role;


-- Trigger inventory for schema guard G15. Same pattern and same grants as
-- relation_privileges() and function_privileges() above: local-only, needed
-- because information_schema.triggers is not reachable through PostgREST.
--
-- tgargs is a NUL-separated blob of C strings, so it is exposed as a plain
-- count rather than parsed here: G15 only asks whether the audit trigger is
-- attached, and a half-decoded argument list would invite a test to assert on
-- an encoding detail instead of on the invariant.
create or replace function public.trigger_inventory()
returns table (
  table_name text,
  trigger_name text,
  function_name text,
  argument_count smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.relname::text,
         t.tgname::text,
         p.proname::text,
         t.tgnargs
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
-- fails rather than committing unaudited (SP3 design spec 4.2, property 3).
-- `not valid` is what makes this possible: the constraint is enforced on new
-- inserts while the existing audit rows other suites depend on are left alone.
--
-- Lives in seed.sql, which only ever runs against the local stack via
-- `supabase db reset`. It is not a migration and must never become one: a
-- production database that can be told to break its own audit log has a
-- switch nobody should be able to reach.
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
