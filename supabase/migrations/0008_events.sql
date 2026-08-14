-- First-party event log (PRD 4.16, 8.3), sitting alongside GA4 so reach
-- reporting does not depend solely on a third party. Contains no IP
-- addresses, no raw user agents, and no personal identifiers.
-- No updated_at: append-only event stream, same reasoning as audit_log
-- in 0007_logs.sql.
create table public.engagement_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  resource_id uuid references public.resources(id) on delete set null,
  need public.need_type,
  is_featured boolean,
  search_term text,
  filter_key text,
  filter_value text,
  -- Coarse, from edge geolocation. Not an identifier.
  country_code text,
  occurred_at timestamptz not null default now(),
  -- Rotating, non-reversible. No cross-session identity (PRD 8.3).
  session_hash text not null,
  is_bot boolean not null default false,
  created_at timestamptz not null default now(),
  -- GA4 event names are fixed by CLAUDE.md/PRD 8.3: exactly these five.
  -- Adding a sixth is a deliberate migration, not a client typo silently
  -- accepted -- a plain `text not null` column would let 'lol' insert
  -- exactly as easily as 'resource_view'.
  constraint engagement_events_event_name_fixed
    check (event_name in (
      'resource_view', 'apply_click', 'search_performed', 'filter_used', 'export_clicked'
    )),
  constraint engagement_events_country_code_shape
    check (country_code is null or country_code ~ '^[A-Z]{2}$')
);

comment on column public.engagement_events.session_hash is
  '@sensitive Rotating, non-reversible per-session identifier with no cross-session identity; never surfaced on the public site.';

-- PRD 8.3 forbids a full table scan per dashboard page load. Creating
-- these with the table is materially less disruptive than adding them
-- once it carries traffic.
create index engagement_events_occurred_at_idx
  on public.engagement_events (occurred_at desc);
create index engagement_events_name_time_idx
  on public.engagement_events (event_name, occurred_at desc);
create index engagement_events_resource_idx
  on public.engagement_events (resource_id);
-- Bot rows are excluded from every reported figure, so the reporting
-- path only ever reads this partial index.
create index engagement_events_human_idx
  on public.engagement_events (occurred_at desc)
  where is_bot = false;

alter table public.engagement_events enable row level security;

-- Per supabase/migrations/README.md: RLS alone grants nothing. A freshly
-- created table only gives `authenticated` TRUNCATE, REFERENCES, TRIGGER
-- and MAINTAIN by default -- no SELECT/INSERT/UPDATE/DELETE -- so without
-- these grants the select policy below is unreachable, and TRUNCATE
-- (which RLS cannot govern) would let viewer empty the log outright.
-- Revoke first, then re-grant exactly the four DML verbs. As with
-- audit_log, `authenticated` holds the INSERT grant here and is stopped
-- from using it by there being NO insert policy: append-only is
-- expressed by the absent policy, not by withholding the grant.
revoke all on table public.engagement_events from anon, authenticated;
grant select, insert, update, delete on public.engagement_events to authenticated;
grant all on public.engagement_events to service_role;

-- Read for all three roles: the reporting screens are visible to
-- viewer per PRD 3.
create policy engagement_events_select_authenticated
  on public.engagement_events for select to authenticated
  using (public.current_app_role() is not null);

-- No insert, update or delete policy for ANY role. Client events are
-- posted to a server route that validates, rate limits, flags bots and
-- writes with service_role (PRD 8.3) -- never a client-held
-- authenticated session.
