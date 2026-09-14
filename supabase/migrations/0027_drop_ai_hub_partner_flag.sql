-- AskHub has no partners. It lists providers.
--
-- The client has confirmed there are no official partners of the AI Hub among
-- the organisations in this table: Amazon Web Services, CINECA and Microsoft
-- are organisations whose opportunities the directory lists, exactly as
-- NVIDIA, Google, Stanford and every other row are. Migration 0019 recorded
-- the opposite -- a flag naming those three as partners, a public view that
-- served only them, and a seed that re-asserted the three on every run -- on
-- a MIMIT- and UNDP-branded page. That was a factual error, and this
-- migration is its correction, not a redesign.
--
-- The view first, because Postgres will not drop a column a view's WHERE
-- depends on. `create or replace` with the same four output columns keeps the
-- ACL 0014 granted (the property 0019 relied on), so the revoke/grant pair is
-- not restated; tests/rls/schema-guards.test.ts G3/G11/G17/G18 hold because
-- neither the column set nor the grants change. The view again projects the
-- whole registry -- which nothing public renders today: the home-page strip
-- was removed on 1 September. It stays so a strip could return without a
-- migration.
--
-- The column goes outright. It carried a claim no one had made, and there is
-- nothing to preserve: a row that lost the flag is simply a provider, which
-- is what every row was.

create or replace view public.partners_public
with (security_invoker = false) as
select p.name, p.logo_url, p.website_url, p.sort_order
from public.partners p;

alter table public.partners drop column is_ai_hub_partner;
