-- Per-figure provenance on the two stat rails (Task 12p).
--
-- Why this migration exists: the client has confirmed the About-page
-- figures in headline_stats and compute_metrics are real and will arrive
-- as a dataset they provide, so the requirement was never "don't invent
-- them" -- it is "record where each one came from and who vouched for
-- it". Until now that accountability lived only in ATTESTED_STATS inside
-- a seed script, which guards the seed path and nothing else. Both
-- tables have no provenance columns, so an editor typing a figure
-- straight into the admin Site Content screen bypasses the mechanism
-- entirely -- a *more* likely route for a fabricated number to reach a
-- public page than the seed ever was. This migration makes provenance
-- structural: a figure without it becomes impossible to insert or
-- update, not merely discouraged by convention.
--
-- Separation this establishes, worth stating explicitly because it is
-- easy to blur: total reach, growth, views, clicks, sessions and users
-- are Google Analytics' to report at runtime (via settings.
-- ga4_measurement_id / ga4_property_id), not ours to store. These two
-- tables are exclusively for client-dataset figures -- headline_stats
-- and compute_metrics -- never a cache of anything GA4 supplies.
-- Likewise the live-resource count is a true `count(*) where
-- status='live'` computed on read; it needs neither storage nor
-- attestation here.
--
-- Both tables are verified empty (0 rows each), so `add column ... not
-- null` needs no default and no backfill.

alter table public.headline_stats
  add column source text not null,
  add column attested_by text not null,
  add column attested_on date not null;

alter table public.compute_metrics
  add column source text not null,
  add column attested_by text not null,
  add column attested_on date not null;

-- NOT NULL alone is not the guarantee: an empty string satisfies it
-- while supplying no provenance at all, which would make the whole
-- mechanism cosmetic. A non-blank check on source and attested_by closes
-- that. attested_on is a date, so NOT NULL alone is sufficient -- there
-- is no "blank date" to smuggle through.
alter table public.headline_stats
  add constraint headline_stats_source_not_blank
    check (length(btrim(source)) > 0),
  add constraint headline_stats_attested_by_not_blank
    check (length(btrim(attested_by)) > 0);

alter table public.compute_metrics
  add constraint compute_metrics_source_not_blank
    check (length(btrim(source)) > 0),
  add constraint compute_metrics_attested_by_not_blank
    check (length(btrim(attested_by)) > 0);

-- Deliberately NO default on any of the three columns, on either table.
-- A default would let a row exist with placeholder provenance (a
-- fabricated-looking figure with genuine-looking attestation), which is
-- precisely the failure this migration exists to prevent. Every insert
-- must state its own source, attester and date; there is nothing
-- sensible to fall back to.

comment on column public.headline_stats.source is
  'Traceability to the specific delivery a figure came from: dataset name plus the version or date it was received, e.g. ''AI Hub programme dataset, received 2026-08-04''. A bare ''client dataset'' satisfies the NOT NULL/non-blank constraints but defeats the point -- if the client later sends a revised set, this is what lets you tell which figures came from which delivery.';
comment on column public.compute_metrics.source is
  'Traceability to the specific delivery a figure came from: dataset name plus the version or date it was received, e.g. ''AI Hub programme dataset, received 2026-08-04''. A bare ''client dataset'' satisfies the NOT NULL/non-blank constraints but defeats the point -- if the client later sends a revised set, this is what lets you tell which figures came from which delivery.';

-- @sensitive: same class of value as updates_log.actor_name and
-- audit_log.actor_name (0007_logs.sql) -- a staff display name, not a
-- system account. Marking it is what makes "a staff member's name never
-- reaches the public About page" structural: tests/rls/
-- schema-guards.test.ts's G7 asserts no *_public view depends on an
-- @sensitive column, resolved alias-proof through pg_rewrite/pg_depend.
-- source and attested_on are deliberately NOT marked @sensitive: neither
-- is personal, and over-marking would block a future, plausible decision
-- to show provenance publicly to build trust in the figures.
comment on column public.headline_stats.attested_by is
  '@sensitive Denormalised staff display name of the admin who ingested and vouched for this figure; never surfaced on the public site.';
comment on column public.compute_metrics.attested_by is
  '@sensitive Denormalised staff display name of the admin who ingested and vouched for this figure; never surfaced on the public site.';

comment on column public.headline_stats.attested_on is
  'Date the figure was attested/ingested, not necessarily the date it occurred.';
comment on column public.compute_metrics.attested_on is
  'Date the figure was attested/ingested, not necessarily the date it occurred.';
