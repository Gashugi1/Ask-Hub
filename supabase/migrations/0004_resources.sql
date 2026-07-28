create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  -- Nullable: every distinct partner named in the seed gets a row,
  -- including those with no logo available.
  logo_url text,
  website_url text not null,
  tier public.partner_tier not null default 'other',
  sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partners_website_https
    check (website_url ~* '^https://'),
  constraint partners_logo_https
    check (logo_url is null or logo_url ~* '^https://'),
  -- PRD 14.5: SVG is an active-content XSS vector. Reject it.
  -- The anchor set (end-of-string, ?, #, /) matters: without the trailing
  -- `/` alternative, `.../logo.svg/banner.png` -- a real shape some CDN
  -- and image-transform URLs use, with the extension mid-path -- slips
  -- past the check. `svgz?` also catches `.svgz`, gzip-compressed SVG
  -- with the same active-content risk. Case-insensitivity (!~*, not !~)
  -- is load-bearing: it is the only thing that rejects `logo.SVG`.
  -- Verified against Postgres directly (see Task 5 fix report): rejects
  -- logo.svg, logo.SVG, logo.svg?v=2, logo.svg#frag, logo.svg/banner.png,
  -- logo.svgz, logo.SVGZ; accepts logo.png, logo.jpg?w=300. Deliberately
  -- over-rejects a query string that merely mentions .svg (e.g.
  -- image.png?ref=banner.svg) -- accepted as the safe direction rather
  -- than adding path/query-splitting complexity to a security check.
  constraint partners_logo_not_svg
    check (logo_url is null or logo_url !~* '\.svgz?($|\?|#|/)')
);

-- name is `unique`, which already builds its own index. An explicit index
-- on it would just duplicate that one -- pure write amplification.

create trigger partners_set_updated_at
  before update on public.partners
  for each row execute function public.set_updated_at();

alter table public.partners enable row level security;

-- Per supabase/migrations/README.md: RLS alone grants nothing. A freshly
-- created table only gives `authenticated` TRUNCATE, REFERENCES, TRIGGER
-- and MAINTAIN by default -- no SELECT/INSERT/UPDATE/DELETE -- so without
-- these grants every policy below is unreachable. The revoke covers
-- `authenticated` too, not just `anon`: that same residue includes
-- TRUNCATE, which RLS cannot govern, so a role with no write policy at all
-- (editor or viewer, depending on the table) would otherwise still be able
-- to empty it outright. Revoking first and re-granting exactly the four
-- DML verbs removes the residue without changing the intended grant.
--
-- Neither anon nor authenticated get direct table access to partners: the
-- public site reads it only through a partners_public view (a later
-- task), and staff read it while authenticated per the select policy
-- below. anon holds no grant at all, so it never reaches policy
-- evaluation for this table.
revoke all on table public.partners from anon, authenticated;
grant select, insert, update, delete on public.partners to authenticated;
grant all on public.partners to service_role;

create policy partners_select_authenticated
  on public.partners for select to authenticated
  using (public.current_app_role() is not null);

create policy partners_insert_staff
  on public.partners for insert to authenticated
  with check (public.current_app_role() in ('admin', 'editor'));

create policy partners_update_staff
  on public.partners for update to authenticated
  using (public.current_app_role() in ('admin', 'editor'))
  with check (public.current_app_role() in ('admin', 'editor'));

create policy partners_delete_staff
  on public.partners for delete to authenticated
  using (public.current_app_role() in ('admin', 'editor'));


create table public.resources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- FK rather than text (design doc 5.3.1): one source of truth for
  -- logo, tier and official site.
  -- `restrict`, not `cascade` or `set null`: deleting a partner must not
  -- silently orphan (set null) or mass-delete (cascade) the curated
  -- resources that point at it. Restrict forces an admin to explicitly
  -- reassign or remove those resources first, rather than losing curated
  -- content as a side effect of an unrelated delete.
  partner_id uuid not null references public.partners(id) on delete restrict,
  -- Denormalised from partners.tier for list-rendering performance --
  -- NOT a maintained mirror. Nothing syncs this column when a partner's
  -- tier changes on public.partners: no trigger, no generated column, by
  -- deliberate choice (see Task 5 rulings). The partner_id FK above
  -- remains the single, authoritative source of truth for logo, tier and
  -- official site; this column can and will drift from it over time. Any
  -- code path that needs a guaranteed-current tier (rather than a fast
  -- read for a list row) must join public.partners, not trust this
  -- column.
  partner_tier public.partner_tier not null default 'other',
  resource_type text not null,
  need_primary public.need_type not null,
  need_secondary public.need_type,
  sub_category text,
  description text not null,
  action_label text not null default 'Apply',
  external_url text not null,
  banner_image_url text,
  countries_eligible text[] not null default '{}',
  sectors_eligible text[] not null default '{}',
  stages_eligible text[] not null default '{}',
  geo_scope public.geo_scope not null default 'specific',
  -- null means rolling and displays as "Rolling" (PRD 4.2).
  deadline date,
  -- Default pipeline: publishing is always an explicit act.
  status public.resource_status not null default 'pipeline',
  is_featured boolean not null default false,
  is_exclusive boolean not null default false,
  description_fr text,
  description_pt text,
  description_ar text,
  sort_order integer,
  added_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resources_external_url_https
    check (external_url ~* '^https://'),
  constraint resources_banner_https
    check (banner_image_url is null or banner_image_url ~* '^https://'),
  -- Same rationale and verified regex as partners_logo_not_svg above:
  -- the `/` anchor catches `.svg` mid-path (some CDN/image-transform URLs
  -- put the extension there, e.g. .../logo.svg/w_300), and `svgz?` also
  -- catches gzip-compressed `.svgz`.
  constraint resources_banner_not_svg
    check (banner_image_url is null or banner_image_url !~* '\.svgz?($|\?|#|/)')
);

create index resources_status_idx on public.resources (status);
create index resources_need_primary_idx on public.resources (need_primary);
create index resources_deadline_idx on public.resources (deadline);
create index resources_added_date_idx on public.resources (added_date desc);
create index resources_partner_idx on public.resources (partner_id);

create trigger resources_set_updated_at
  before update on public.resources
  for each row execute function public.set_updated_at();

alter table public.resources enable row level security;

-- Same rationale as partners above: revoke the authenticated residue
-- (including TRUNCATE, which RLS cannot govern) before re-granting exactly
-- the four DML verbs, so every policy below is actually reachable and
-- viewer -- which gets no write policy at all on this table -- cannot
-- empty it via TRUNCATE regardless.
revoke all on table public.resources from anon, authenticated;
grant select, insert, update, delete on public.resources to authenticated;
grant all on public.resources to service_role;

create policy resources_select_authenticated
  on public.resources for select to authenticated
  using (public.current_app_role() is not null);

create policy resources_insert_staff
  on public.resources for insert to authenticated
  with check (public.current_app_role() in ('admin', 'editor'));

create policy resources_update_staff
  on public.resources for update to authenticated
  using (public.current_app_role() in ('admin', 'editor'))
  with check (public.current_app_role() in ('admin', 'editor'));

create policy resources_delete_staff
  on public.resources for delete to authenticated
  using (public.current_app_role() in ('admin', 'editor'));
