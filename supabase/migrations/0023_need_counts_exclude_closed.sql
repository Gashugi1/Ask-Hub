-- Browse counts stop counting resources whose deadline has passed.
--
-- Closed resources now leave the public listings entirely (see
-- `openResources` in src/lib/public/filters.ts): the directory, search, the
-- recently-added rail and the browse menu all drop them, because a directory
-- of opportunities nobody can apply to any more wastes the reader's time.
-- They keep their own detail page, so a link shared months ago still resolves
-- and says Closed rather than 404ing.
--
-- This view was the one place that had not been told. It counts
-- `status = 'live'` and nothing else, so the browse menu would have gone on
-- advertising "Funding 7" into a directory showing five -- and the two
-- numbers disagreeing is worse than either being wrong on its own, because
-- the menu is what a visitor uses to decide whether a category is worth
-- opening.
--
-- The boundary is the one every other surface uses, from 0014: a deadline of
-- exactly `current_date` is NOT closed, so a resource is live through the end
-- of its closing day. Written as `>= current_date` rather than
-- `not (deadline < current_date)` so the condition reads the way it is meant
-- rather than as the negation of the `is_closed` expression.
--
-- `create or replace` suffices: the column list is unchanged, only the
-- filter. That also means the view keeps its existing grants and does not
-- pick up the pg_default_acl residue a drop-and-recreate would (see
-- 0017_need_counts_secondary.sql, which did have to drop, to rename a
-- column).

create or replace view public.need_counts_public
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
  and (r.deadline is null or r.deadline >= current_date)
group by n.need;
