create type public.app_role as enum ('admin', 'editor', 'viewer');

create type public.resource_status as enum ('live', 'pipeline', 'reference');

create type public.need_type as enum
  ('compute', 'training', 'funding', 'accelerator', 'partners');

create type public.geo_scope as enum
  ('global', 'all_africa', 'partner_countries', 'specific');

create type public.partner_tier as enum
  ('strategic', 'network', 'institutional', 'other');

create type public.submission_type as enum ('new_resource', 'update_suggestion');

create type public.submission_status as enum ('pending', 'approved', 'rejected');

-- Stable keys; display labels live in locales/en.json (stage.*).
-- PRD 16.3 records the unresolved conflict with the client brief's
-- lead/exploring/negotiating/agreement. Prototype labels implemented.
create type public.partnership_stage as enum
  ('prospecting', 'in_discussion', 'active', 'delivered');

create type public.audit_action as enum
  ('published', 'edited', 'created', 'deleted',
   'approved', 'rejected', 'role_changed', 'digest_sent');
