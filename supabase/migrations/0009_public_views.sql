-- Anonymous reads go exclusively through these views. The anon role
-- holds zero policies on any base table, so this file is the entire
-- public read surface.
--
-- security_invoker = false means the view reads its base tables as its
-- owner, bypassing their RLS. That is the mechanism, and it is why
-- every column is enumerated explicitly: a later "select *" cannot
-- silently widen the exposure, and PRD 14.9 checks 2 and 5 become
-- structural properties rather than behaviour to remember.
--
-- Eight views are created here, not seven: compute_metrics_public is a
-- public-surface view like the other seven (the home page compute rail,
-- PRD 4.10) even though it was missing from this task's stated
-- Produces/Interfaces list.

create view public.partners_public
with (security_invoker = false) as
select p.id, p.name, p.logo_url, p.website_url, p.tier, p.sort_order
from public.partners p;

create view public.resources_public
with (security_invoker = false) as
select
  r.id,
  r.name,
  p.name        as partner_name,
  p.logo_url    as partner_logo_url,
  p.website_url as partner_website_url,
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
  r.is_exclusive,
  r.sort_order,
  r.added_date,
  -- Display state only. PRD 4.2: a past deadline never transitions
  -- status, so status itself is deliberately absent from this view.
  -- A deadline of exactly current_date is NOT closed (matches
  -- src/lib/deadline.ts: daysLeft < 0 is the only closed condition,
  -- daysLeft === 0 is "expiring", not "closed").
  (r.deadline is not null and r.deadline < current_date) as is_closed,
  (r.deadline - current_date)                           as days_left
from public.resources r
join public.partners p on p.id = r.partner_id
where r.status = 'live';

create view public.headline_stats_public
with (security_invoker = false) as
select h.id, h.value, h.label, h.is_hero, h.sort_order
from public.headline_stats h;

create view public.compute_metrics_public
with (security_invoker = false) as
select c.id, c.value, c.label, c.sub_note, c.sort_order
from public.compute_metrics c;

create view public.site_content_public
with (security_invoker = false) as
select s.key, s.value, s.locale
from public.site_content s;

create view public.programmes_public
with (security_invoker = false) as
select p.id, p.title, p.timeframe, p.description, p.sort_order
from public.programmes p;

-- Gating is done in the application from the feature flag, which is
-- read server-side (PRD 7). The view exists so the page can be built
-- and tested while the flag is off.
create view public.impact_stories_public
with (security_invoker = false) as
select i.id, i.organisation, i.country, i.description, i.sort_order
from public.impact_stories i;

-- Live counts for the home page "browse by need" band (PRD 5.1).
-- Aggregated in the database rather than by fetching every row.
create view public.need_counts_public
with (security_invoker = false) as
select r.need_primary, count(*)::integer as live_count
from public.resources r
where r.status = 'live'
group by r.need_primary;

-- Views carry no RLS policies of their own -- security_invoker = false
-- above is what makes each one readable at all. This single grant is the
-- only privilege anon or authenticated ever hold on this public surface;
-- neither role holds insert/update/delete on any of these eight views, so
-- none of them can be written through, whatever shape Postgres considers
-- them (see the anonymous-write test in tests/rls/public-views.test.ts).
grant select on
  public.partners_public,
  public.resources_public,
  public.headline_stats_public,
  public.compute_metrics_public,
  public.site_content_public,
  public.programmes_public,
  public.impact_stories_public,
  public.need_counts_public
to anon, authenticated;
