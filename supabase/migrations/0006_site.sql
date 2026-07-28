-- Editable site content: programmes, impact stories and the two stat rails
-- shown on the public site, plus per-key/locale page copy (site_content)
-- and global configuration (settings). All six live in Postgres rather
-- than the repo so an editor's change appears without a rebuild (CLAUDE.md
-- "Public pages are cached and revalidated on write").

create table public.programmes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  timeframe text not null default '',
  description text not null default '',
  sort_order integer,
  -- Nullable, unique conflict target for a later task's launch-content
  -- seed upsert. Not `unique (title)`: title is not a real product
  -- invariant and would constrain every admin-created row forever, purely
  -- to make one upsert convenient. Admin-created rows carry seed_key null;
  -- a nullable unique column permits any number of nulls. Also lets admin
  -- screens distinguish launch-seeded content from curated content.
  seed_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.impact_stories (
  id uuid primary key default gen_random_uuid(),
  organisation text not null,
  country text not null default '',
  description text not null default '',
  sort_order integer,
  -- Nullable, unique conflict target for a later task's launch-content
  -- seed upsert. Not `unique (organisation)`: an organisation can
  -- genuinely have more than one impact story, so that constraint would
  -- make the seed silently overwrite one story with another the next time
  -- it ran. seed_key gives the seed an exact target without constraining
  -- admin-created rows, which carry seed_key null.
  seed_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- value is text, not numeric: PRD 4.10 examples include "7,000+".
create table public.headline_stats (
  id uuid primary key default gen_random_uuid(),
  value text not null,
  label text not null,
  is_hero boolean not null default false,
  sort_order integer,
  -- Nullable, unique conflict target for a later task's launch-content
  -- seed upsert. Not `unique (label)`: label is not a real product
  -- invariant and would constrain every admin-created row forever, purely
  -- to make one upsert convenient. This table is seeded with zero rows
  -- here (CLAUDE.md: never fabricate leadership-reporting metrics) --
  -- seed_key exists so a later task can seed it with real, sourced figures
  -- without guessing at a conflict target then.
  seed_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.compute_metrics (
  id uuid primary key default gen_random_uuid(),
  value text not null,
  label text not null,
  sub_note text,
  sort_order integer,
  -- Nullable, unique conflict target for a later task's launch-content
  -- seed upsert, for the same reason as headline_stats.seed_key above.
  -- This table is seeded with zero rows here.
  seed_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.site_content (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  value text not null default '',
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Already a genuine invariant (one value per key per locale) -- this
  -- table needs no seed_key.
  unique (key, locale)
);

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at triggers
create trigger programmes_set_updated_at before update on public.programmes
  for each row execute function public.set_updated_at();
create trigger impact_stories_set_updated_at before update on public.impact_stories
  for each row execute function public.set_updated_at();
create trigger headline_stats_set_updated_at before update on public.headline_stats
  for each row execute function public.set_updated_at();
create trigger compute_metrics_set_updated_at before update on public.compute_metrics
  for each row execute function public.set_updated_at();
create trigger site_content_set_updated_at before update on public.site_content
  for each row execute function public.set_updated_at();
create trigger settings_set_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- RLS: editor and admin write the content tables; settings is admin-only.
alter table public.programmes enable row level security;
alter table public.impact_stories enable row level security;
alter table public.headline_stats enable row level security;
alter table public.compute_metrics enable row level security;
alter table public.site_content enable row level security;
alter table public.settings enable row level security;

-- Per supabase/migrations/README.md: RLS alone grants nothing. A freshly
-- created table only gives `authenticated` TRUNCATE, REFERENCES, TRIGGER
-- and MAINTAIN by default -- no SELECT/INSERT/UPDATE/DELETE -- so without
-- these grants every policy below is unreachable. The revoke covers
-- `authenticated` too, not just `anon`: that same residue includes
-- TRUNCATE, which RLS cannot govern, so a role with no write policy at all
-- (viewer, on every table here; editor, on settings) would otherwise still
-- be able to empty the table outright. Revoke first, then re-grant exactly
-- the four DML verbs. anon gets nothing at all: none of these six tables
-- is anon-reachable -- the public-safe views arrive in a later task.
revoke all on table public.programmes from anon, authenticated;
grant select, insert, update, delete on public.programmes to authenticated;
grant all on public.programmes to service_role;

revoke all on table public.impact_stories from anon, authenticated;
grant select, insert, update, delete on public.impact_stories to authenticated;
grant all on public.impact_stories to service_role;

revoke all on table public.headline_stats from anon, authenticated;
grant select, insert, update, delete on public.headline_stats to authenticated;
grant all on public.headline_stats to service_role;

revoke all on table public.compute_metrics from anon, authenticated;
grant select, insert, update, delete on public.compute_metrics to authenticated;
grant all on public.compute_metrics to service_role;

revoke all on table public.site_content from anon, authenticated;
grant select, insert, update, delete on public.site_content to authenticated;
grant all on public.site_content to service_role;

revoke all on table public.settings from anon, authenticated;
grant select, insert, update, delete on public.settings to authenticated;
grant all on public.settings to service_role;

create policy programmes_select_authenticated on public.programmes
  for select to authenticated using (public.current_app_role() is not null);
-- `for all` covers insert, update AND delete: admin and editor can delete
-- a programme, not just create or edit one. Stated explicitly here rather
-- than left as an implication of `for all`.
create policy programmes_write_staff on public.programmes
  for all to authenticated
  using (public.current_app_role() in ('admin', 'editor'))
  with check (public.current_app_role() in ('admin', 'editor'));

create policy impact_stories_select_authenticated on public.impact_stories
  for select to authenticated using (public.current_app_role() is not null);
-- `for all` covers insert, update AND delete: admin and editor can delete
-- an impact story, not just create or edit one.
create policy impact_stories_write_staff on public.impact_stories
  for all to authenticated
  using (public.current_app_role() in ('admin', 'editor'))
  with check (public.current_app_role() in ('admin', 'editor'));

create policy headline_stats_select_authenticated on public.headline_stats
  for select to authenticated using (public.current_app_role() is not null);
-- `for all` covers insert, update AND delete: admin and editor can delete
-- a headline stat, not just create or edit one.
create policy headline_stats_write_staff on public.headline_stats
  for all to authenticated
  using (public.current_app_role() in ('admin', 'editor'))
  with check (public.current_app_role() in ('admin', 'editor'));

create policy compute_metrics_select_authenticated on public.compute_metrics
  for select to authenticated using (public.current_app_role() is not null);
-- `for all` covers insert, update AND delete: admin and editor can delete
-- a compute metric, not just create or edit one.
create policy compute_metrics_write_staff on public.compute_metrics
  for all to authenticated
  using (public.current_app_role() in ('admin', 'editor'))
  with check (public.current_app_role() in ('admin', 'editor'));

create policy site_content_select_authenticated on public.site_content
  for select to authenticated using (public.current_app_role() is not null);
-- `for all` covers insert, update AND delete: admin and editor can delete
-- a site_content row, not just create or edit one.
create policy site_content_write_staff on public.site_content
  for all to authenticated
  using (public.current_app_role() in ('admin', 'editor'))
  with check (public.current_app_role() in ('admin', 'editor'));

-- PRD 3: Settings is admin-only. editor gets no write policy here.
create policy settings_select_authenticated on public.settings
  for select to authenticated using (public.current_app_role() is not null);
create policy settings_write_admin on public.settings
  for all to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

-- Baseline configuration. Both feature flags off at launch (PRD 7). These
-- are configuration defaults, not the fabricated leadership metrics
-- CLAUDE.md forbids -- headline_stats and compute_metrics deliberately get
-- no rows at all here (see column comments above): a later task seeds
-- those, empty, so the reporting panels render an explicit empty state
-- until a human supplies real figures with sources. programmes and
-- impact_stories likewise get schema only, no rows.
-- GA4 ids are empty: the admin Site engagement section shows its
-- not-connected state until they are set, which is correct per 6.4.
insert into public.settings (key, value) values
  ('ga4_measurement_id',          '""'::jsonb),
  ('ga4_property_id',             '""'::jsonb),
  ('contact_email',               '"aihubfordevelopment@undp.org"'::jsonb),
  ('feature_innovator_profiles',  'false'::jsonb),
  ('feature_public_impact_page',  'false'::jsonb);
