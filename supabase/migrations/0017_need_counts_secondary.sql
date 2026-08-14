-- The home page's "browse by need" chips disagreed with the directory they
-- link into.
--
-- need_counts_public grouped by need_primary alone, but the directory filter
-- (src/lib/public/filters.ts) matches need_primary OR need_secondary. On real
-- content that made every chip understate its own link: compute said 3 where
-- the directory showed 4, training 6 against 8, partners 1 against 3. The
-- funding chip was worse than wrong -- it did not render at all, because no
-- live resource carries funding as its primary need, yet /?need=funding
-- returns AfDB Digital Jobs Programme. A resource was reachable by a route
-- nothing on the page led you to.
--
-- The count now follows the filter rather than the column: a resource is
-- counted under both the need it primarily serves and the one it also
-- serves. Chip totals therefore exceed the number of live resources, which
-- is correct -- they are counts of matches, not a partition of the
-- catalogue.
--
-- The output column is renamed need_primary -> need, because a column named
-- need_primary that deliberately includes secondary needs is precisely the
-- kind of name that produces the next bug. Renaming a view column requires
-- drop and recreate; `create or replace view` cannot do it.

drop view public.need_counts_public;

create view public.need_counts_public
with (security_invoker = false) as
select n.need, count(*)::integer as live_count
from public.resources r
cross join lateral (
  -- UNION, not UNION ALL: a resource whose secondary need repeats its
  -- primary must still be counted once.
  select r.need_primary as need
  union
  select r.need_secondary where r.need_secondary is not null
) n
where r.status = 'live'
group by n.need;

-- Recreated views inherit the pg_default_acl residue again (rDxtm, not
-- merely r), exactly as 0009_public_views.sql documents at length. Strip it
-- and re-grant the single privilege this surface is allowed to hold, or
-- tests/rls/schema-guards.test.ts G3/G4 will surface the inconsistency --
-- and anon would silently lose SELECT on a view the home page needs.
revoke all on public.need_counts_public from anon, authenticated;
grant select on public.need_counts_public to anon, authenticated;
