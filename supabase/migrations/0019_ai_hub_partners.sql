-- The home page's partner row (PRD 5.1 item 6) was rendering all 19 rows of
-- public.partners. That table is not a list of the AI Hub's partners: since
-- 0014_partner_logos.sql it is keyed by `name` and doubles as the provider
-- registry that resources.partner is a foreign key into, so it holds every
-- organisation that runs a listed resource -- Google, NVIDIA, Meta, the
-- African Development Bank -- none of which is a partner of the AI Hub.
--
-- Client-confirmed: the AI Hub's partners are Amazon Web Services, CINECA
-- and Microsoft. UNDP is deliberately NOT among them and gets no row here:
-- it co-leads the AI Hub with MIMIT rather than partnering with it, and it
-- is already named on every page by the footer's co-lead attribution
-- (`site.footer` in src/locales/en.json, content rule 10.1). Adding a UNDP
-- partner row would restate a co-lead as a partner, which is the exact
-- distinction rule 10.1 exists to protect.
--
-- The client does not want the table split. One boolean marks the subset
-- instead, which keeps resources.partner's foreign key pointing at a single
-- registry and keeps the admin resource form's partner picker able to offer
-- every provider (src/lib/admin/readers.ts readPartnerNames selects from
-- public.partners directly and is deliberately left untouched by this
-- migration).
--
-- Column name: `is_ai_hub_partner`, not `is_hub_partner`. Every row in this
-- table is a "partner" in the registry sense, so `is_hub_partner` would
-- leave a reader guessing which sense is meant; naming the organisation in
-- full also matches CLAUDE.md's content rule that this programme is always
-- "AI Hub", never "the Hub" alone.

alter table public.partners
  add column is_ai_hub_partner boolean not null default false;

-- Default false, not null. Nothing in src/ writes to this table today, so
-- every row in a seeded database arrives from scripts/seed.ts, which names
-- the flag explicitly -- but the default is what decides for whatever
-- creates partners next (an admin partner screen, an import). The safe
-- direction for a defaulted flag is the one that shows less on a public
-- page: a new row is a resource provider until someone says otherwise,
-- rather than a claimed partner until someone notices.
comment on column public.partners.is_ai_hub_partner is
  'True only for organisations the client has confirmed as partners of the AI Hub (Amazon Web Services, CINECA, Microsoft). Every other row is a resource provider that resources.partner points at, not a partner. Drives the home page partner row via partners_public.';

-- `CINECA / AI Hub` is a prototype artefact -- the prototype used one
-- free-text string for the provider of the Leonardo allocation and named
-- both the facility and the programme in it. The client confirmed the
-- entity is CINECA.
--
-- Renaming is safe because `name` is the primary key and
-- resources_partner_fkey (0014_partner_logos.sql) is `on update cascade`:
-- the one resource that references it, `CINECA Leonardo`, follows
-- automatically with no second statement. Verified directly against this
-- Postgres rather than assumed -- a probe partner with a referencing
-- resource was renamed inside a transaction, and resources.partner came
-- back holding the new name with zero rows left under the old one. That
-- probe is now a standing test: tests/rls/ai-hub-partners.test.ts,
-- "carries its resources across via the FK cascade".
--
-- This statement and the update below both match zero rows under
-- `npm run db:reset`, which applies every migration to an empty database
-- before anything is seeded. scripts/seed-data.ts carries the same rename
-- and the same three names, and that is what actually populates a local
-- database; these two statements exist for a database that already holds
-- partner rows when the migration reaches it. The pair must stay in step:
-- a rename here that scripts/seed-data.ts does not also make is undone by
-- the next `npm run seed`, which would re-insert the old name as a 20th
-- partner row.
update public.partners set name = 'CINECA' where name = 'CINECA / AI Hub';

update public.partners
  set is_ai_hub_partner = true
  where name in ('Amazon Web Services', 'CINECA', 'Microsoft');

-- Deliberately no constraint requiring a flagged partner to carry
-- logo_url/website_url. None of the three has either today -- the seed
-- inserts all 19 partners name-only -- so such a constraint would validate
-- fine here against an empty table and then reject the very next
-- `npm run seed`, which is the worst place to discover it. Logos and links
-- for these three are a client deliverable, tracked as content work, not an
-- invariant this schema can enforce yet. Only the flagged rows need them;
-- the other 16 are provider names behind resources and are never rendered
-- as logos. 0014's partners_logo_requires_site CHECK (a
-- logo cannot exist without a site to link it to, content rule 10.10) is
-- untouched and still applies to every row, flagged or not.

-- partners_public filters on the flag rather than projecting it.
--
-- Projecting it would put a column on the anonymous surface whose value is
-- `true` on every row the view can return -- no information, and it would
-- still have to be registered in PUBLIC_VIEW_COLUMNS and counted in
-- EXPECTED_PUBLIC_VIEW_COLUMNS (tests/rls/security-allowlist.ts, guards
-- G17/G18), i.e. permanently widening the public surface to carry a
-- constant. It would also arrive in src/lib/public/readers.ts's
-- listPublicPartners, which selects `*` (it would stop there rather than
-- reaching PartnerRow, since toPublicPartner in src/lib/public/types.ts maps
-- four named fields and drops the rest -- but the row on the wire is the
-- surface, not the mapper).
--
-- Filtering here instead means listPublicPartners needs no change at all:
-- its `select('*')` returns the same four columns it always did, over the
-- flagged rows only. It also means the restriction cannot be forgotten by a
-- future second consumer of this view, the way a `.filter()` in a reader or
-- a component would have to be repeated at each call site.
--
-- `create or replace view`, not drop-and-recreate: only the WHERE clause is
-- new and the output column list is untouched, so this is not the case
-- 0017's note rules out ("renaming a view column requires drop and
-- recreate"). Unlike a fresh `create view`, a replace does not re-apply the
-- pg_default_acl residue every other view in this schema has to revoke --
-- verified against this Postgres, the relacl came back identical before and
-- after (anon=r, authenticated=r), so there is nothing to strip and no grant
-- to restore. G3 and G11 in tests/rls/schema-guards.test.ts assert that
-- catalog-wide regardless -- respectively that no view is anonymously
-- writable, and that the anon-selectable view set still equals the registry.
--
-- The view stays a single-table projection and therefore stays
-- auto-updatable (pg_relation_is_updatable returns 28 with the WHERE clause
-- in place, checked directly), so it remains in
-- tests/rls/public-views.test.ts's WRITABLE_SHAPE_VIEWS group, where an
-- anonymous write is refused by the GRANT check (42501) rather than by
-- Postgres refusing the view shape outright.
create or replace view public.partners_public
with (security_invoker = false) as
select p.name, p.logo_url, p.website_url, p.sort_order
from public.partners p
where p.is_ai_hub_partner;
