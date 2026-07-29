-- Task 12L reverses one consequence of ruling H8 (0013_reconcile_partners.sql),
-- on the client's confirmation, not on new prototype evidence. H8
-- denormalised partner identity onto resources.partner (a plain string)
-- and resources.partner_tier after the re-extracted prototype turned out
-- to have no partners entity and no partner URLs at all. That dropped
-- logo_url and website_url outright, which turned PRD 5.1's partner
-- *logo* row into a partner *name* row and made content rule 10.10
-- ("each logo must link to its own official site") vacuous rather than
-- violated -- there were no logos left to mislink.
--
-- The client has since confirmed they want logos. The prototype was the
-- wrong authority for that question: it reflected what the prototype
-- happened to have, not what the client intends to ship. So the two URL
-- columns, the partner fields on resources_public, partners_public
-- itself, and rule 10.10 all come back.
--
-- What does NOT come back: partner_id as a uuid FK, or a tier column on
-- partners. H8's denormalisation of partner *name and tier* onto
-- resources stands -- resources.partner remains the display value and
-- resources.partner_tier remains the only place a resource's tier is
-- recorded (C6: tier lives in exactly one place). What changes here is
-- narrower than a full re-normalisation: `name` becomes the primary key
-- of a real partners table, so resources.partner -- already the display
-- value H8 established -- can double as the foreign key with no uuid
-- join for the common case and no second copy of the name to drift.
--
-- Asset note from the client: logos will arrive as an image file plus a
-- website URL, per partner, delivered together. The admin upload path
-- must reject SVG per PRD 14.5, so expect PNG in practice -- recorded
-- here so whoever builds that upload path does not have to rediscover
-- it. Both URL columns stay nullable so the seed (and the admin form
-- today) can create a partner row before its assets arrive, with no
-- logo and no link -- that breaks no rule, since there is no logo yet to
-- mislink. When assets do arrive, both columns land together, and the
-- CHECK below is what stops a logo from existing on its own.

create table public.partners (
  name         text primary key,
  logo_url     text,
  website_url  text,
  sort_order   integer,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint partners_website_https
    check (website_url is null or website_url ~* '^https://'),
  constraint partners_logo_https
    check (logo_url is null or logo_url ~* '^https://'),
  -- PRD 14.5: SVG is an active-content XSS vector. Reject it on this
  -- column exactly as resources.banner_image_url already does.
  -- The anchor set (end-of-string, ?, #, /) matters: without the
  -- trailing `/` alternative, `.../logo.svg/banner.png` -- a real shape
  -- some CDN and image-transform URLs use, with the extension mid-path
  -- -- slips past the check. `svgz?` also catches `.svgz`, gzip-
  -- compressed SVG with the same active-content risk. Case-
  -- insensitivity (!~*, not !~) is load-bearing: it is the only thing
  -- that rejects `logo.SVG`. This is the corrected pattern found during
  -- review of the original 0004 version (`\.svg($|\?|#)`, no trailing
  -- `/` alternative and no svgz coverage) -- verified directly against
  -- this Postgres with the same probe set 0004 used: rejects logo.svg,
  -- logo.SVG, logo.svg?v=2, logo.svg#frag, logo.svg/banner.png,
  -- logo.svgz, logo.SVGZ; accepts logo.png, logo.jpg?w=300. See
  -- tests/rls/resources.test.ts for the covering cases.
  constraint partners_logo_not_svg
    check (logo_url is null or logo_url !~* '\.svgz?($|\?|#|/)'),
  -- Content rule 10.10, back in force and now structural rather than a
  -- review item: "each logo must link to its own official site." A logo
  -- cannot exist without a link. Both columns are independently
  -- nullable (a partner can have neither yet), but a non-null logo_url
  -- with a null website_url is the one combination this table refuses
  -- to store.
  constraint partners_logo_requires_site
    check (logo_url is null or website_url is not null)
);

-- name is the primary key, which already builds its own unique index.
-- No separate index needed.

create trigger partners_set_updated_at
  before update on public.partners
  for each row execute function public.set_updated_at();

alter table public.partners enable row level security;

-- Per supabase/migrations/README.md: RLS alone grants nothing. A freshly
-- created table only gives `authenticated` TRUNCATE, REFERENCES, TRIGGER
-- and MAINTAIN by default -- no SELECT/INSERT/UPDATE/DELETE -- so
-- without these grants every policy below is unreachable. The revoke
-- covers `authenticated` too, not just `anon`: that same residue
-- includes TRUNCATE, which RLS cannot govern, so viewer (which gets no
-- write policy at all below) would otherwise still be able to empty
-- this table outright. Revoking first and re-granting exactly the four
-- DML verbs removes the residue without changing the intended grant.
--
-- Neither anon nor authenticated get direct table access to partners:
-- the public site reads it only through partners_public below, and
-- staff read it while authenticated per the select policy below. anon
-- holds no grant at all, so it never reaches policy evaluation for this
-- table.
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

-- resources.partner (H8's plain display string) becomes a real foreign
-- key now that partners exists again, keyed by the same name. `on
-- update cascade` is the point of keying partners by name rather than a
-- uuid: renaming a partner propagates to every resource automatically,
-- which is exactly the drift risk a denormalised text column would
-- otherwise carry forever. `on delete restrict` matches partners_id's
-- original behaviour in 0004 and the reasoning already recorded there --
-- deleting a partner must not silently orphan or mass-delete the
-- curated resources that name it; an admin must explicitly reassign or
-- remove those resources first, rather than losing curated content as a
-- side effect of an unrelated delete.
alter table public.resources
  add constraint resources_partner_fkey
  foreign key (partner) references public.partners(name)
  on update cascade on delete restrict;

-- resources_public must be rebuilt (not create-or-replace'd) because the
-- new partner_logo_url/partner_website_url columns are inserted next to
-- partner_name, which shifts every later column's position -- CREATE OR
-- REPLACE VIEW cannot do that, only append columns at the end. Dropping
-- and recreating explicitly, as 0013 itself did, keeps this file a
-- readable record of exactly what changed.
drop view public.resources_public;

-- Rebuilt resources_public: restores the join to partners that 0013
-- removed, and with it partner_logo_url/partner_website_url alongside
-- the existing partner_name. Everything else is unchanged from 0013:
-- filters on status = 'live' without ever projecting status (PRD 4.2: a
-- past deadline never transitions status), every column enumerated
-- rather than `select *`, security_invoker = false, exclusivity
-- projected as the bare enum (not cast to text, so the generated
-- Supabase types keep the public badge's render switch exhaustive --
-- see tests/rls/schema-guards.test.ts's G14), and the same is_closed/
-- days_left boundary: a deadline of exactly current_date is NOT closed
-- (matches src/lib/deadline.ts: daysLeft < 0 is the only closed
-- condition, daysLeft === 0 is "expiring", not "closed").
--
-- LEFT join, not inner: a resource whose partner row is somehow absent
-- (a partner deleted out of band, or -- once an admin UI exists --
-- retired without every resource being reassigned first) must still
-- appear on the public site with a null logo, rather than vanishing
-- from the directory entirely. An inner join would silently hide a live
-- resource, which is the worst failure mode available here precisely
-- because nothing about it looks broken -- there is no error, no empty
-- state, just one fewer row than there should be.
create view public.resources_public
with (security_invoker = false) as
select
  r.id,
  r.name,
  r.partner          as partner_name,
  p.logo_url         as partner_logo_url,
  p.website_url      as partner_website_url,
  r.partner_tier,
  r.resource_type,
  r.need_primary,
  r.need_secondary,
  r.sub_category,
  r.description,
  r.description_fr,
  r.description_pt,
  r.description_ar,
  r.action_label,
  r.external_url,
  r.banner_image_url,
  r.countries_eligible,
  r.sectors_eligible,
  r.stages_eligible,
  r.geo_scope,
  r.deadline,
  r.is_featured,
  r.exclusivity,
  r.sort_order,
  r.added_date,
  (r.deadline is not null and r.deadline < current_date) as is_closed,
  (r.deadline - current_date)                           as days_left
from public.resources r
left join public.partners p on p.name = r.partner
where r.status = 'live';

-- Same residue every view in this schema picks up from pg_default_acl
-- the moment it is (re)created: a bare `create view` hands anon a
-- `Dxtm` grant (TRUNCATE, REFERENCES, TRIGGER, MAINTAIN), not merely
-- nothing. Revoke it explicitly before granting SELECT.
revoke all on public.resources_public from anon, authenticated;
grant select on public.resources_public to anon, authenticated;

-- Posture update to 0013's own comment, which recorded that dropping
-- the join made this view a single-table projection and therefore fully
-- auto-updatable (pg_relation_is_updatable returning 28: INSERT|UPDATE|
-- DELETE all set), with the revoke/grant pair above as the only thing
-- standing between anon and a write that would execute as the view
-- owner and bypass resources' RLS. That posture is now reversed: this
-- view is a join again, so Postgres refuses any write through it
-- outright (SQLSTATE 55000, "cannot insert into view") regardless of
-- grants, restoring the structural backstop 0013 recorded as lost.
-- tests/rls/public-views.test.ts's NOT_AUTO_UPDATABLE_CODE path (already
-- exercised there by need_counts_public) now also covers
-- resources_public.

create view public.partners_public
with (security_invoker = false) as
select p.name, p.logo_url, p.website_url, p.sort_order
from public.partners p;

revoke all on public.partners_public from anon, authenticated;
grant select on public.partners_public to anon, authenticated;

-- Unlike resources_public above, this view IS a single-table projection
-- of partners and therefore auto-updatable (security_invoker = false
-- makes it run as the view owner) -- so the revoke/grant pair above is
-- the only thing standing between anon and a write that would bypass
-- partners' RLS entirely. tests/rls/schema-guards.test.ts's G3 asserts,
-- catalog-wide, that neither anon nor authenticated holds INSERT/
-- UPDATE/DELETE on any view; tests/rls/public-views.test.ts exercises
-- the 42501 (permission denied) path for this view specifically, the
-- same posture note 0013 recorded for the pre-join resources_public.
