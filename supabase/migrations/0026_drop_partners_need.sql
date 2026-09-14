-- The `partners` need category goes, everywhere.
--
-- The client's decision: partnerships are not something a visitor browses
-- the directory for. A partner organisation is who *provides* a resource
-- (resources.partner, the partners table -- untouched here), not a kind of
-- resource. The category was in the original five (0002_enums.sql) and has
-- never had a resource in it; the seed has none, and the guard below
-- refuses to run if a database somewhere has since acquired one, because a
-- row silently reassigned by a migration is a curation decision nobody
-- made.
--
-- Postgres cannot drop a value from an enum, so this is 0013's route for
-- partner_tier, applied to need_type: rename the old type aside, create the
-- new one without the label, move every column across with a text cast,
-- drop the old type. The two public views that project a need_type column
-- lock the column's type and have to go first and come back after; both
-- are restated exactly as their last definitions (resources_public from
-- 0014, need_counts_public from 0023), with the revoke/grant pair every
-- recreated view in this schema needs to shed the pg_default_acl residue
-- (0009 explains it, 0014 and 0017 repeat it). The index on need_primary
-- is rebuilt by the column retype; nothing else references the type by
-- OID -- submit_resource_suggestion (0024) names `public.need_type` in a
-- plpgsql body, which is resolved when it runs, so it picks up the new
-- type with no change.
--
-- Label order is preserved minus the one removed, because
-- tests/unit/reference.test.ts compares NEED_KEYS to the enum
-- element-for-element and tests/rls/enums.test.ts pins the list.

do $$
declare
  v_resources integer;
  v_submissions integer;
  v_events integer;
begin
  select count(*) into v_resources from public.resources
   where need_primary = 'partners' or need_secondary = 'partners';
  select count(*) into v_submissions from public.submissions where need = 'partners';
  select count(*) into v_events from public.engagement_events where need = 'partners';
  if v_resources > 0 or v_submissions > 0 or v_events > 0 then
    raise exception
      'need_type: cannot drop ''partners'' while rows still carry it (resources: %, submissions: %, engagement_events: %). Reassign each to another need first, then re-run.',
      v_resources, v_submissions, v_events;
  end if;
end;
$$;

drop view public.resources_public;
drop view public.need_counts_public;

alter type public.need_type rename to need_type_old;

create type public.need_type as enum
  ('compute', 'training', 'funding', 'accelerator', 'data', 'challenges', 'community');

alter table public.resources
  alter column need_primary type public.need_type using need_primary::text::public.need_type,
  alter column need_secondary type public.need_type using need_secondary::text::public.need_type;

alter table public.submissions
  alter column need type public.need_type using need::text::public.need_type;

alter table public.engagement_events
  alter column need type public.need_type using need::text::public.need_type;

drop type public.need_type_old;

-- resources_public, exactly as 0014 left it.
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

revoke all on public.resources_public from anon, authenticated;
grant select on public.resources_public to anon, authenticated;

-- need_counts_public, exactly as 0023 left it.
create view public.need_counts_public
with (security_invoker = false) as
select n.need, count(*)::integer as live_count
from public.resources r
cross join lateral (
  select r.need_primary as need
  union
  select r.need_secondary where r.need_secondary is not null
) n
where r.status = 'live'
  and (r.deadline is null or r.deadline >= current_date)
group by n.need;

revoke all on public.need_counts_public from anon, authenticated;
grant select on public.need_counts_public to anon, authenticated;
