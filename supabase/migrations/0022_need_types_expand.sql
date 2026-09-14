-- Extend need_type with three categories the expanded directory catalogue
-- uses: data (datasets and dataset-creation grants), challenges (hackathons
-- and competitions), and community (networks and gatherings). The prototype's
-- catalogue files resources under these; the original five could not express
-- them without mis-categorising, so they are added rather than mapped.
--
-- ALTER TYPE ... ADD VALUE appends to the end of the enum, so these land after
-- 'partners'. NEED_KEYS (src/lib/reference.ts) and every ordered list that
-- mirrors the enum (tests/rls/enums.test.ts, tests/unit/reference.test.ts)
-- follow that same trailing order.
--
-- This migration does NOTHING else on purpose: a newly added enum label cannot
-- be used in the same transaction that adds it, so no seed row or reference to
-- 'data'/'challenges'/'community' may appear here. They are used only from a
-- later transaction (the seed) and from application code.
--
-- No grant or RLS work: adding an enum label touches neither. need_counts_public
-- (0017) is a dynamic GROUP BY, so the new needs surface automatically once a
-- live resource carries one.
alter type public.need_type add value if not exists 'data';
alter type public.need_type add value if not exists 'challenges';
alter type public.need_type add value if not exists 'community';
