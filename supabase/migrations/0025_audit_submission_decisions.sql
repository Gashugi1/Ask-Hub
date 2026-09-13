-- A submission's review decision is logged as 'approved' or 'rejected',
-- not 'edited'.
--
-- Migration 0018 attached one trigger function to every audited table and
-- classified an UPDATE as 'published' (a resource going live), 'role_changed'
-- (a user's role) or 'edited' (anything else). The review queue did not exist
-- then, so a submission moving from pending to approved or rejected fell into
-- 'edited' -- accurate, but it hides the one thing an auditor reading the
-- submission trail wants to know, and audit_action has carried both labels
-- since 0002_enums.sql with the Audit Log screen already colouring them.
--
-- The function body is 0018's, restated in full with one added branch (a
-- plpgsql function cannot be patched in place). Everything that made it safe
-- there still holds: security definer with an empty search_path, no dynamic
-- SQL, the actor from auth.uid() and never from an argument, the revoke
-- below. Read the 0018 header for the reasoning behind each.
--
-- The change_summary for the row is unchanged and reads "Status Pending to
-- Approved" -- audit_change_summary keys on the diff, not the action, so it
-- needed no restating.

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity_type text := tg_argv[0];
  v_label_columns text[] := string_to_array(coalesce(tg_argv[1], ''), ',');
  v_label_prefix text := coalesce(tg_argv[2], '');
  v_redact text[] := case
    when coalesce(tg_argv[3], '') = '' then '{}'::text[]
    else string_to_array(tg_argv[3], ',')
  end;
  v_actor uuid;
  v_actor_name text;
  v_before jsonb;
  v_after jsonb;
  v_diff jsonb;
  v_action public.audit_action;
  v_label_column text;
  v_label_source text;
  v_label text := '';
  v_entity_id uuid;
begin
  select p.id,
         coalesce(
           nullif(btrim(p.full_name), ''),
           nullif(btrim(p.display_label), ''),
           p.email
         )
    into v_actor, v_actor_name
    from public.profiles p
   where p.user_id = auth.uid();

  -- No authenticated caller: a seed script, a migration, an ops script, or the
  -- Auth Admin API's own transaction. 'system' is accurate rather than
  -- decorative -- at that instant no person made the write. The Audit Log
  -- screen renders this sentinel through a locale key.
  if v_actor_name is null then
    v_actor_name := 'system';
  end if;

  if tg_op = 'INSERT' then
    v_before := '{}'::jsonb;
    v_after := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
  else
    v_before := to_jsonb(old);
    v_after := '{}'::jsonb;
  end if;

  -- Bookkeeping columns are noise: updated_at changes on every write by
  -- definition (set_updated_at), and created_at never changes at all.
  v_before := v_before - 'updated_at' - 'created_at';
  v_after := v_after - 'updated_at' - 'created_at';

  select coalesce(
           jsonb_object_agg(
             k.key,
             case
               when k.key = any(v_redact)
                 then jsonb_build_object('from', '[redacted]', 'to', '[redacted]')
               else jsonb_build_object('from', v_before -> k.key, 'to', v_after -> k.key)
             end
           ),
           '{}'::jsonb
         )
    into v_diff
    from jsonb_object_keys(v_before || v_after) as k(key)
   where (v_before -> k.key) is distinct from (v_after -> k.key);

  -- An update whose only difference was updated_at is not a change anyone
  -- needs a record of.
  if tg_op = 'UPDATE' and v_diff = '{}'::jsonb then
    return null;
  end if;

  if tg_op = 'INSERT' then
    v_action := 'created';
  elsif tg_op = 'DELETE' then
    v_action := 'deleted';
  elsif v_entity_type = 'resource' and v_diff ? 'status' and v_after ->> 'status' = 'live' then
    v_action := 'published';
  elsif v_entity_type = 'user' and v_diff ? 'role' then
    v_action := 'role_changed';
  elsif v_entity_type = 'submission' and v_diff ? 'status'
        and v_after ->> 'status' in ('approved', 'rejected') then
    -- The review queue's two decisions, recorded as what they are. The enum
    -- has carried both values since 0002 and the Audit Log screen already
    -- colours them; only this classification was missing. The cast is safe:
    -- the guard above admits exactly the two enum labels.
    v_action := (v_after ->> 'status')::public.audit_action;
  else
    v_action := 'edited';
  end if;

  foreach v_label_column in array v_label_columns loop
    v_label := btrim(coalesce(v_after ->> v_label_column, v_before ->> v_label_column, ''));
    if v_label <> '' then
      v_label_source := v_label_column;
      exit;
    end if;
  end loop;

  -- A label column that is itself redacted is masked rather than dropped:
  -- audit_log is readable by all three roles, viewer included, so a
  -- subscriber's or a submitter's address must not be readable there, while
  -- the fact that a specific account changed still has to be recorded.
  if v_label_source = any(v_redact) then
    v_label := case
      when position('@' in v_label) > 1
        then left(v_label, 1) || '***@' || split_part(v_label, '@', 2)
      else '[redacted]'
    end;
  end if;

  v_label := v_label_prefix || left(coalesce(nullif(v_label, ''), v_entity_type), 120);

  v_entity_id := nullif(coalesce(v_after ->> 'id', v_before ->> 'id'), '')::uuid;

  insert into public.audit_log (
    actor, actor_name, action, entity_type, entity_id, entity_label,
    change_summary, diff
  )
  values (
    v_actor,
    v_actor_name,
    v_action,
    v_entity_type,
    v_entity_id,
    v_label,
    public.audit_change_summary(v_action, v_entity_type, v_diff),
    v_diff
  );

  -- ip_hash and user_agent are left null on purpose. The only values a trigger
  -- can see are PostgREST's request.headers, which for a server action describe
  -- the Next.js server that made the call, not the operator's browser.
  -- Recording the server's own user-agent in a forensic column would be a
  -- fabricated value dressed as evidence.

  return null;
end;
$$;

revoke all on function public.audit_row_change() from public, anon, authenticated;
