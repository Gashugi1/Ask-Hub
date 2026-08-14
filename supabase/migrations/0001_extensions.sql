create extension if not exists pgcrypto;

-- Shared updated_at maintenance. Append-only tables (audit_log,
-- engagement_events) deliberately do not use this and carry no
-- updated_at column at all.
--
-- search_path is pinned to empty so the function cannot be tricked by a
-- session-level search_path change into resolving `now()` from an
-- attacker-controlled schema. now() itself resolves from pg_catalog, so
-- nothing else in the body needs schema-qualifying.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
