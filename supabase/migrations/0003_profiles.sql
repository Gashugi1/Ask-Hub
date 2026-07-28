create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  -- display_label is free text shown in the admin sidebar and is
  -- INDEPENDENT of role (PRD 3). Never infer one from the other.
  display_label text not null default '',
  role public.app_role not null default 'viewer',
  is_active boolean not null default true,
  invited_by uuid references public.profiles(id) on delete set null,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_user_id_idx on public.profiles (user_id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Per supabase/migrations/README.md: RLS alone does not grant anything.
-- A freshly created table only gives `authenticated` TRUNCATE, REFERENCES,
-- TRIGGER and MAINTAIN by default -- no SELECT/INSERT/UPDATE/DELETE -- so
-- without these grants every policy below is unreachable and every query
-- fails on a permission check before RLS is ever evaluated. `editor` and
-- `viewer` are still denied writes: not by withholding the grant, but by
-- having no write policy, which is what the policies further down encode.
--
-- The revoke covers `authenticated` too, not just `anon`: that same
-- default residue includes TRUNCATE, and TRUNCATE is not subject to row
-- level security. Left in place, `viewer` -- which has no write policy at
-- all -- would still hold a privilege that empties the table outright, no
-- policy able to stop it. Revoking first and re-granting exactly the four
-- verbs below removes the residue without changing the intended grant.
revoke all on table public.profiles from anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- MUST be security definer. A plain function selecting from profiles is
-- itself subject to the RLS policy on profiles, which calls this
-- function, which selects from profiles — infinite recursion, reported
-- as a confusing error rather than an obvious one.
--
-- search_path is pinned to empty, not 'public', because this function runs
-- with the owner's privileges (security definer) and is exactly the kind
-- of function where a mutable/attacker-influenceable search_path matters.
-- The body already fully qualifies public.profiles; auth.uid() is schema
-- qualified too; and the plain `is not null` / boolean logic resolves from
-- pg_catalog, which is always implicitly searched regardless of search_path.
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.user_id = auth.uid()
    and p.is_active
$$;

revoke all on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated;

-- All three roles read every profile (PRD 3: view all admin screens).
create policy profiles_select_authenticated
  on public.profiles
  for select
  to authenticated
  using (public.current_app_role() is not null);

-- Only admin writes. editor and viewer get no insert, update or delete
-- policy on this table at all.
create policy profiles_insert_admin
  on public.profiles for insert to authenticated
  with check (public.current_app_role() = 'admin');

create policy profiles_update_admin
  on public.profiles for update to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create policy profiles_delete_admin
  on public.profiles for delete to authenticated
  using (public.current_app_role() = 'admin');

-- Mint the profile row on user creation, at least privilege. An admin
-- promotes explicitly afterwards.
--
-- search_path pinned to empty for the same reason as current_app_role()
-- above: this is security definer, and its body already fully qualifies
-- public.profiles. now(), coalesce and the ->> operator resolve from
-- pg_catalog; the 'viewer' literal coerces from the target column's enum
-- type.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'viewer'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Symmetric with current_app_role() above. Not exploitable today --
-- calling this as anon errors with "trigger functions can only be called
-- as triggers" before the body ever runs -- but leaving it ungranted-only
-- is the precedent that matters: a later task copying this file's shape
-- for a non-trigger SECURITY DEFINER function without this revoke would
-- create a real hole.
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
