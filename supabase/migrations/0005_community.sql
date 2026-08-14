-- citext lives here rather than being appended to 0001_extensions.sql:
-- 0001 is already committed and applied, so editing it would mean a fresh
-- `db reset` replays the change while any environment that already ran it
-- never sees it. Project convention is new numbered migrations only,
-- never append to a shipped one.
create extension if not exists citext;

-- AskHub's own partner pipeline, scoped to AskHub partners only.
-- Not an organisation-wide CRM (PRD 4.4).
create table public.partnerships (
  id uuid primary key default gen_random_uuid(),
  organisation text not null,
  partner_id uuid references public.partners(id) on delete set null,
  summary text not null default '',
  note text not null default '',
  stage public.partnership_stage not null default 'prospecting',
  owner uuid references public.profiles(id) on delete set null,
  sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- @sensitive marker read by a later schema-wide guard (a catalog scan
-- asserting no public view ever exposes a sensitive column). Recorded here
-- by the person who knows the answer, not left for that later task to
-- guess at.
comment on column public.partnerships.note is
  '@sensitive Internal pipeline note about a partner relationship; never surfaced on the public site.';

create index partnerships_stage_idx on public.partnerships (stage);

create trigger partnerships_set_updated_at
  before update on public.partnerships
  for each row execute function public.set_updated_at();

alter table public.partnerships enable row level security;

-- Per supabase/migrations/README.md: RLS alone grants nothing. A freshly
-- created table only gives `authenticated` TRUNCATE, REFERENCES, TRIGGER
-- and MAINTAIN by default -- no SELECT/INSERT/UPDATE/DELETE -- so without
-- these grants every policy below is unreachable. The revoke covers
-- `authenticated` too, not just `anon`: that same residue includes
-- TRUNCATE, which RLS cannot govern, so a role with no write policy at all
-- would otherwise still be able to empty the table outright. Revoke first,
-- then re-grant exactly the four DML verbs. anon gets nothing at all: this
-- table never gets a public view, and none of these five tables is ever
-- meant to be anon-reachable.
revoke all on table public.partnerships from anon, authenticated;
grant select, insert, update, delete on public.partnerships to authenticated;
grant all on public.partnerships to service_role;

create policy partnerships_select_authenticated
  on public.partnerships for select to authenticated
  using (public.current_app_role() is not null);

create policy partnerships_insert_staff
  on public.partnerships for insert to authenticated
  with check (public.current_app_role() in ('admin', 'editor'));

create policy partnerships_update_staff
  on public.partnerships for update to authenticated
  using (public.current_app_role() in ('admin', 'editor'))
  with check (public.current_app_role() in ('admin', 'editor'));

create policy partnerships_delete_staff
  on public.partnerships for delete to authenticated
  using (public.current_app_role() in ('admin', 'editor'));


create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  type public.submission_type not null,
  -- `restrict`, not `cascade`: deleting a resource must not silently
  -- destroy the submission history that references it -- the submission
  -- trail is the audit record of why a resource changed or was proposed,
  -- and cascades also bypass RLS entirely. This is the same reasoning as
  -- resources.partner_id (Task 5), which is also `restrict`, for the same
  -- "don't lose content as a side effect of an unrelated delete" logic.
  --
  -- Not `on delete set null` either: submissions_target_matches_type below
  -- requires target_resource_id to be non-null when type =
  -- 'update_suggestion', so the FK's generated UPDATE would violate that
  -- CHECK and roll back the parent delete anyway -- a failure mode that
  -- would look like a database bug rather than a deliberate policy.
  --
  -- The trade-off is real and accepted: deleting a resource that has
  -- submissions against it now fails with a FK violation until those
  -- submissions are dealt with explicitly. That is deliberate -- an admin
  -- acting explicitly beats losing the audit trail silently.
  target_resource_id uuid references public.resources(id) on delete restrict,
  resource_name text not null,
  organisation text,
  need public.need_type,
  link text,
  description text not null,
  submitter_email text not null,
  status public.submission_status not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  -- Abuse handling only. Never displayed (PRD 4.5).
  source_ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- PRD 4.5: target required when update_suggestion, null otherwise.
  constraint submissions_target_matches_type check (
    (type = 'update_suggestion' and target_resource_id is not null)
    or (type = 'new_resource' and target_resource_id is null)
  ),
  constraint submissions_link_https
    check (link is null or link ~* '^https://')
);

comment on column public.submissions.submitter_email is
  '@sensitive Email address supplied by the public submitter; never surfaced on the public site.';
comment on column public.submissions.source_ip_hash is
  '@sensitive Hashed IP used for abuse handling only; never displayed.';
comment on column public.submissions.rejection_reason is
  '@sensitive Internal reviewer note on why a submission was rejected; never surfaced on the public site.';

create index submissions_status_idx on public.submissions (status);
create index submissions_type_idx on public.submissions (type);

create trigger submissions_set_updated_at
  before update on public.submissions
  for each row execute function public.set_updated_at();

alter table public.submissions enable row level security;
revoke all on table public.submissions from anon, authenticated;
grant select, insert, update, delete on public.submissions to authenticated;
grant all on public.submissions to service_role;

-- All three roles read every submission, including submitter_email --
-- deliberate, per PRD 3's capability table and PRD 6.6, not an oversight
-- to be narrowed later.
create policy submissions_select_authenticated
  on public.submissions for select to authenticated
  using (public.current_app_role() is not null);

create policy submissions_insert_staff
  on public.submissions for insert to authenticated
  with check (public.current_app_role() in ('admin', 'editor'));

create policy submissions_update_staff
  on public.submissions for update to authenticated
  using (public.current_app_role() in ('admin', 'editor'))
  with check (public.current_app_role() in ('admin', 'editor'));

-- Deliberately no delete policy for any role: PRD 4.5 requires rejection
-- to be soft, retaining the row.


create table public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  categories text[] not null default '{}',
  country text,
  sector text,
  consent_at timestamptz not null default now(),
  consent_text_version text not null,
  confirm_token text not null unique,
  confirmed_at timestamptz,
  unsubscribe_token text not null unique,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.subscribers.email is
  '@sensitive Subscriber email address; never surfaced on the public site.';
comment on column public.subscribers.confirm_token is
  '@sensitive Single-use token mailed to the subscriber to confirm opt-in; must never be exposed to anyone but the token holder.';
comment on column public.subscribers.unsubscribe_token is
  '@sensitive Single-use token mailed to the subscriber to unsubscribe; must never be exposed to anyone but the token holder.';

create index subscribers_confirmed_idx on public.subscribers (confirmed_at);

create trigger subscribers_set_updated_at
  before update on public.subscribers
  for each row execute function public.set_updated_at();

alter table public.subscribers enable row level security;
revoke all on table public.subscribers from anon, authenticated;
grant select, insert, update, delete on public.subscribers to authenticated;
grant all on public.subscribers to service_role;

-- All three roles read every subscriber, including the email column --
-- deliberate, per PRD 3's capability table and PRD 6.6, not an oversight
-- to be narrowed later.
create policy subscribers_select_authenticated
  on public.subscribers for select to authenticated
  using (public.current_app_role() is not null);

create policy subscribers_insert_staff
  on public.subscribers for insert to authenticated
  with check (public.current_app_role() in ('admin', 'editor'));

create policy subscribers_update_staff
  on public.subscribers for update to authenticated
  using (public.current_app_role() in ('admin', 'editor'))
  with check (public.current_app_role() in ('admin', 'editor'));

-- PRD 14.8 requires a deletion path that genuinely removes the record.
create policy subscribers_delete_staff
  on public.subscribers for delete to authenticated
  using (public.current_app_role() in ('admin', 'editor'));


create table public.digest_sends (
  id uuid primary key default gen_random_uuid(),
  sent_at timestamptz not null default now(),
  sent_by uuid references public.profiles(id) on delete set null,
  resource_ids uuid[] not null default '{}',
  recipient_count integer not null default 0,
  subject text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.digest_sends.notes is
  '@sensitive Internal note about a digest send; never surfaced on the public site.';

-- Kept even though no authenticated role currently has an UPDATE policy on
-- this table (only select and insert below): service_role can still
-- update, and a future admin edit path will need this trigger. It is
-- presently unreachable from any authenticated role -- do not read its
-- presence as proof an update path already exists for editor/viewer/admin.
create trigger digest_sends_set_updated_at
  before update on public.digest_sends
  for each row execute function public.set_updated_at();

alter table public.digest_sends enable row level security;
revoke all on table public.digest_sends from anon, authenticated;
grant select, insert, update, delete on public.digest_sends to authenticated;
grant all on public.digest_sends to service_role;

create policy digest_sends_select_authenticated
  on public.digest_sends for select to authenticated
  using (public.current_app_role() is not null);

create policy digest_sends_insert_staff
  on public.digest_sends for insert to authenticated
  with check (public.current_app_role() in ('admin', 'editor'));


-- NOT IN THE PRD. Added deliberately: PRD 9.1 specifies only that the
-- contact form delivers to the mailbox, which assumes a working mail
-- provider. SPF/DKIM is externally blocked, so a delivery-only form
-- would silently discard every message sent before DNS lands. SP5
-- drains the undelivered rows. See design doc 5.3.4.
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  submitted_at timestamptz not null default now(),
  -- Abuse handling only. Never displayed.
  source_ip_hash text,
  delivered_at timestamptz,
  delivery_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.contact_messages.email is
  '@sensitive Email address supplied by the public sender; never surfaced on the public site.';
comment on column public.contact_messages.message is
  '@sensitive Free-text message body supplied by the public sender; never surfaced on the public site.';
comment on column public.contact_messages.source_ip_hash is
  '@sensitive Hashed IP used for abuse handling only; never displayed.';
comment on column public.contact_messages.delivery_error is
  '@sensitive Internal mail-delivery diagnostic that may echo sender-supplied details; never surfaced on the public site.';

create index contact_messages_undelivered_idx
  on public.contact_messages (submitted_at)
  where delivered_at is null;

create trigger contact_messages_set_updated_at
  before update on public.contact_messages
  for each row execute function public.set_updated_at();

alter table public.contact_messages enable row level security;
revoke all on table public.contact_messages from anon, authenticated;
grant select, insert, update, delete on public.contact_messages to authenticated;
grant all on public.contact_messages to service_role;

-- Read access matches submissions, which also carries submitter email
-- addresses and which PRD 3 makes readable by all three roles. Deliberate,
-- not an oversight to be narrowed later.
create policy contact_messages_select_authenticated
  on public.contact_messages for select to authenticated
  using (public.current_app_role() is not null);

-- Deliberately no insert policy for any role: public inserts arrive
-- through a server route holding service_role, never through a
-- client-held authenticated session. Staff may mark delivery outcomes.
create policy contact_messages_update_staff
  on public.contact_messages for update to authenticated
  using (public.current_app_role() in ('admin', 'editor'))
  with check (public.current_app_role() in ('admin', 'editor'));
