-- Human-readable "what's new" for the team (PRD 4.14).
create table public.updates_log (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor uuid references public.profiles(id) on delete set null,
  actor_name text not null default '',
  text text not null,
  is_automatic boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.updates_log.actor_name is
  '@sensitive Denormalised staff display name attached to a log entry; never surfaced on the public site.';

create index updates_log_occurred_at_idx on public.updates_log (occurred_at desc);

-- Kept even though no authenticated role currently has an UPDATE policy on
-- this table (only select and insert below, per the brief): service_role
-- can still update, and a future admin edit path will need this trigger.
-- It is presently unreachable from any authenticated role -- do not read
-- its presence as proof an update path already exists for editor/viewer/
-- admin. Same pattern as digest_sends in 0005_community.sql.
create trigger updates_log_set_updated_at
  before update on public.updates_log
  for each row execute function public.set_updated_at();

alter table public.updates_log enable row level security;

-- Per supabase/migrations/README.md: RLS alone grants nothing. A freshly
-- created table only gives `authenticated` TRUNCATE, REFERENCES, TRIGGER
-- and MAINTAIN by default -- no SELECT/INSERT/UPDATE/DELETE -- so without
-- these grants every policy below is unreachable. The revoke covers
-- `authenticated` too, not just `anon`: that same residue includes
-- TRUNCATE, which RLS cannot govern, so viewer (no write policy at all)
-- would otherwise still be able to empty the table outright. Revoke
-- first, then re-grant exactly the four DML verbs. anon gets nothing:
-- this table is never anon-reachable, no public view exists for it.
revoke all on table public.updates_log from anon, authenticated;
grant select, insert, update, delete on public.updates_log to authenticated;
grant all on public.updates_log to service_role;

create policy updates_log_select_authenticated on public.updates_log
  for select to authenticated using (public.current_app_role() is not null);

create policy updates_log_insert_staff on public.updates_log
  for insert to authenticated
  with check (public.current_app_role() in ('admin', 'editor'));


-- System record, separate from updates_log (PRD 4.15).
-- No updated_at: the table is append-only, so a column that can never
-- change would be misleading.
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  -- Deliberately NO foreign key to public.profiles. Verified directly
  -- against this Postgres: `references public.profiles(id) on delete set
  -- null` is incompatible with the append-only trigger below -- Postgres
  -- implements ON DELETE SET NULL as a real UPDATE issued against this
  -- table, which fires audit_log_no_update and raises "audit_log is
  -- append-only", aborting the parent profile delete. Reproduced with a
  -- CONTEXT line showing the RI-generated UPDATE. The consequence in
  -- production would be severe and silent: no user who has ever written
  -- an audit row could ever be deleted, and offboarding staff would fail
  -- looking like a database bug. actor_name below is denormalised at
  -- write time (PRD 4.15) precisely so this log survives a deleted user
  -- -- that is the design the FK would fight, not an omission.
  actor uuid,
  -- Denormalised at write time so the record stays readable after the
  -- referenced user is deactivated, renamed or deleted (PRD 4.15).
  actor_name text not null,
  action public.audit_action not null,
  entity_type text not null,
  entity_id uuid,
  -- Denormalised human label. Resources appear by bare name; every
  -- other entity type is prefixed, e.g. "Partnership: NVIDIA".
  entity_label text not null,
  -- Rendered sentence, generated at write time by a formatter keyed on
  -- entity_type and action. Not a JSON dump.
  change_summary text not null,
  diff jsonb,
  occurred_at timestamptz not null default now(),
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

comment on column public.audit_log.ip_hash is
  '@sensitive Hashed IP used for abuse handling only; never displayed.';
comment on column public.audit_log.user_agent is
  '@sensitive Raw client user-agent string captured at write time; never surfaced on the public site.';
comment on column public.audit_log.actor_name is
  '@sensitive Denormalised staff display name attached to a log entry; never surfaced on the public site.';
comment on column public.audit_log.diff is
  '@sensitive Before/after field values for the mutation being recorded, which can originate from ANY table in the schema -- the widest sensitive surface here; never surfaced on the public site.';

create index audit_log_occurred_at_idx on public.audit_log (occurred_at desc);
create index audit_log_actor_idx on public.audit_log (actor);
create index audit_log_action_idx on public.audit_log (action);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);

alter table public.audit_log enable row level security;

-- Per supabase/migrations/README.md: same grants shape as every other
-- table. Note the interaction with append-only below: authenticated
-- holds the UPDATE and DELETE grants here, and is stopped from using them
-- by having NO update or delete policy -- plus the trigger as the real
-- backstop against every path, including service_role's. That layering
-- is deliberate: append-only is not expressed by withholding grants.
revoke all on table public.audit_log from anon, authenticated;
grant select, insert, update, delete on public.audit_log to authenticated;
grant all on public.audit_log to service_role;

-- Read for all three roles (PRD 3, 6.9).
create policy audit_log_select_authenticated on public.audit_log
  for select to authenticated using (public.current_app_role() is not null);

-- NO insert, update or delete policy for ANY role, including admin.
-- Rows are written by server actions using service_role, inside the
-- same action as the mutation they record: PRD 4.15 requires
-- actor_name and entity_label denormalised at write time and
-- change_summary generated by a formatter, none of which can be
-- trusted to a client-side insert.

-- service_role bypasses RLS but NOT triggers. This is what makes
-- append-only hold against every path into the table, including the
-- server's own, and survive a future migration that adds a policy
-- carelessly.
--
-- search_path pinned to empty for the same reason as every other
-- function in this schema (set_updated_at, current_app_role,
-- handle_new_user): the body only raises an exception using tg_op, which
-- resolves from pg_catalog, so nothing else needs schema-qualifying, but
-- leaving search_path unpinned would be the one function in the schema
-- that differs from the house convention for no reason.
create or replace function public.audit_log_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log is append-only; % is not permitted', tg_op;
end;
$$;

create trigger audit_log_no_update
  before update on public.audit_log
  for each row execute function public.audit_log_append_only();

create trigger audit_log_no_delete
  before delete on public.audit_log
  for each row execute function public.audit_log_append_only();
