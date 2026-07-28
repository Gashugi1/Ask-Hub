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
