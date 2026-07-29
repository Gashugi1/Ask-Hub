-- Reconciliation migration. The plan (0004_resources.sql, 0009_public_views.sql)
-- normalised partner identity into its own table with a required
-- website_url and logo_url. Re-extracting the prototype after the plan
-- was written showed that entity never existed there: partner identity in
-- the prototype is a free-text `resources.partner` string plus
-- `partner_tier`, and there is no website_url field anywhere in it (the
-- prototype's favicon-domain map used to fake a logo even misattributes
-- Stanford -> coursera.org). Human ruling H8: denormalise to match, with
-- the tradeoff explicitly accepted -- there is no partner logo and no
-- partner URL after this migration. PRD 5.1's partner *logo* row becomes
-- a partner *name* row, and rule 10.10 ("each logo links to its own
-- official site") is vacuous rather than violated: there are no logos
-- left to mislink. A later sub-project must not reintroduce partner
-- logos or links without first getting a real URL source -- there isn't
-- one today.
--
-- Two enum corrections ride along (rulings H9, H10), both cheap because
-- nothing is seeded yet: partner_tier gets the prototype's real five
-- values, and the exclusivity badge becomes a nullable three-state enum
-- instead of a boolean that cannot distinguish "early access" from
-- "exclusive" -- rendering one as the other overstates the claim on a
-- UN programme's public site.
--
-- Statement order below is load-bearing and deliberately uses no
-- `cascade` anywhere: every dropped object is named explicitly, so this
-- file is a readable record of what was removed, and nothing gets taken
-- along silently that wasn't named here.
--   1. resources_public and partners_public must go first: the former
--      joins partners and projects is_exclusive/partner_tier, the latter
--      reads partners directly. Both must be gone before partners, and
--      before the columns they read change shape.
--   2. resources.partner_id carries the FK to partners(id), and (found
--      while writing this migration, not in the task brief's stated
--      dependency facts) 0005_community.sql's partnerships.partner_id
--      carries a second, independent FK to partners(id) `on delete set
--      null`. Both columns must go before partners itself can be dropped.
--      Dropping a column takes its own FK constraint with it (the
--      constraint is owned by the column, unlike the two views above, so
--      no cascade is needed -- only a view depending on a column needs
--      the view dropped first). partnerships.partner_id is unreferenced
--      anywhere else in the codebase (no test, no application code), and
--      once the partners catalog is gone there is nothing left for it to
--      point at, so it is dropped rather than left as a dangling,
--      never-populated uuid column with no valid target.
--   3. Only then can partners itself be dropped: by this point nothing in
--      the catalog depends on it any more.
--   4. Only once partners.tier (which used public.partner_tier) is gone
--      is resources.partner_tier the type's only remaining user, so the
--      type swap is safe.

drop view public.resources_public;
drop view public.partners_public;

-- The FK's `on delete restrict` protected curated resources from an
-- accidental partner delete; that protection is moot once partner
-- identity is a plain string with no row of its own to delete.
alter table public.resources drop column partner_id;

-- See point 2 above: AskHub's own partner-pipeline table (0005_community.sql)
-- also pointed at partners, independently of resources. Nothing reads this
-- column today; removing it is strictly safer than leaving an FK-less uuid
-- column that references a table which no longer exists.
alter table public.partnerships drop column partner_id;

drop table public.partners;

-- The only remaining partner identity: a plain string, matching the
-- prototype exactly. Not null because every resource in the prototype
-- names a partner; no default because the caller (admin form) always
-- supplies one and a silent default would misattribute a resource.
alter table public.resources add column partner text not null;

-- partner_tier: replace the type outright rather than adding/removing
-- labels in place. Old labels were ('strategic','network','institutional',
-- 'other'); the prototype's real five are below. Renaming through a
-- temporary type name, converting the column, dropping the old type, then
-- renaming the new type back to `partner_tier` keeps the final type name
-- unchanged -- tests/rls/schema-guards.test.ts's G14 allow-lists
-- *_public enum columns by type name, and this keeps that match intact
-- without touching the guard.
create type public.partner_tier_v2 as enum
  ('strategic', 'government', 'development_partner', 'academic', 'network');

-- The old default ('other') has no equivalent in the new type, so it must
-- go before the type conversion; a fake mapping would misattribute every
-- resource's tier, and nothing is seeded yet to map, so `using null` is
-- the honest conversion, not an approximation. It never violates the
-- table's own not-null constraint below because the table holds zero rows.
alter table public.resources alter column partner_tier drop default;
alter table public.resources
  alter column partner_tier type public.partner_tier_v2 using null;

drop type public.partner_tier;
alter type public.partner_tier_v2 rename to partner_tier;

-- Column stays `not null` (carried over from 0004, untouched by the type
-- swap) with deliberately **no** default: the old default was 'other',
-- which no longer exists, and silently defaulting a partner's tier again
-- would be worse than making the caller state it explicitly -- the admin
-- form's dropdown always supplies one.

-- exclusivity: the prototype's `exclusive` field is three-state ('',
-- 'Exclusive to AskHub', 'Early access') and drives a visible public
-- badge. is_exclusive boolean cannot distinguish "early access" from
-- "exclusive to AskHub", and rendering the former as the latter overstates
-- the claim. Nullable: null means neither badge applies, matching the
-- prototype's empty-string case.
create type public.exclusivity as enum ('exclusive', 'early_access');
alter table public.resources add column exclusivity public.exclusivity;
alter table public.resources drop column is_exclusive;

-- The real invariant is that a given partner cannot list the same resource
-- twice -- not that no two resources anywhere share a name. Two different
-- partners can plausibly run identically-titled programmes ("Startup
-- Accelerator"), so a bare `unique (name)` would restrict every future
-- admin-created resource forever just to make one upsert convenient.
-- (partner_id, name) is what a later task was going to add before this
-- reconciliation; (partner, name) is its direct replacement now that
-- `partner` is the only partner identity.
alter table public.resources
  add constraint resources_partner_name_key unique (partner, name);

-- Rebuilt resources_public. Preserves 0009_public_views.sql's reasoning
-- verbatim: security_invoker = false is the mechanism that makes this
-- view readable at all (it reads its base table as owner, bypassing RLS),
-- which is exactly why every column is enumerated explicitly rather than
-- `select *` -- a later addition to `resources` cannot silently widen
-- this view's exposure.
--
-- Changes from the version this replaces: reads r.partner directly (no
-- join -- partners is gone) but keeps the output column name
-- `partner_name` so the view's contract stays descriptive; drops
-- partner_logo_url and partner_website_url entirely, since those columns
-- no longer exist anywhere in the schema; projects `exclusivity` where it
-- previously projected `is_exclusive` -- cast to text, not the bare enum.
-- tests/rls/schema-guards.test.ts's G14 allow-lists only
-- {need_type, geo_scope, partner_tier} as enum types a *_public view may
-- expose; G14's own remediation is exactly this shape for resources.status
-- ("compute [a derived value] in the view instead of projecting the enum
-- itself" -- the is_closed boolean below, not status). The same move
-- applies here: the text cast carries the same two values a client needs
-- ('exclusive' / 'early_access' / null) without adding public.exclusivity
-- to G14's allow-list, which is not this migration's call to make. Still
-- filters on `status = 'live'`
-- without ever projecting `status` (PRD 4.2: a past deadline never
-- transitions status, so status itself is deliberately absent from this
-- view), and still computes is_closed/days_left with the same boundary:
-- a deadline of exactly current_date is NOT closed (matches
-- src/lib/deadline.ts: daysLeft < 0 is the only closed condition,
-- daysLeft === 0 is "expiring", not "closed").
create view public.resources_public
with (security_invoker = false) as
select
  r.id,
  r.name,
  r.partner        as partner_name,
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
  r.exclusivity::text as exclusivity,
  r.sort_order,
  r.added_date,
  (r.deadline is not null and r.deadline < current_date) as is_closed,
  (r.deadline - current_date)                           as days_left
from public.resources r
where r.status = 'live';

-- Same residue this view (like every other in 0009_public_views.sql) picks
-- up from pg_default_acl the moment it is created: a bare `create view`
-- hands anon a `Dxtm` grant (TRUNCATE, REFERENCES, TRIGGER, MAINTAIN), not
-- merely nothing. Revoke it explicitly before granting SELECT, per Task
-- 11b -- otherwise the earlier "SELECT is the only privilege anon holds
-- on this view" claim would again be false the moment this recreated view
-- exists.
revoke all on public.resources_public from anon, authenticated;
grant select on public.resources_public to anon, authenticated;
