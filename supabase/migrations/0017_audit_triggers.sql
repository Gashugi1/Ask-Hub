-- The audit spine.
--
-- Why the database writes these rows rather than the server action that caused
-- them: audit_log has no insert policy for any role (0007_logs.sql), so an
-- action running on the caller's session cannot insert its own audit row. The
-- obvious workaround -- do the mutation on the caller's client and the audit
-- insert on the service_role client -- puts the two writes on two connections,
-- which means two transactions, which means the pair can end up inconsistent
-- in either direction: a committed mutation with no audit row, or an audit row
-- for a mutation that rolled back. On an accountability surface for a UN
-- programme the first is unacceptable as a normal operating mode, and it is
-- also a large security concession: it would put a key that bypasses RLS
-- entirely on the critical path of the product's most common write.
--
-- A trigger runs inside the statement that fired it. So the audit row shares
-- the mutation's transaction, an exception in the trigger aborts the mutation,
-- and there is no code path that can produce a successful unaudited write.
-- The mutation itself still runs as the caller and is still subject to its own
-- RLS policies -- nothing here widens what anyone may write, it only records
-- what they did.
--
-- SECURITY DEFINER is required because audit_log denies INSERT to every role.
-- These functions are owned by the role that owns every base table in this
-- schema (asserted by schema guard G8), and that owner is not subject to
-- audit_log's policies. That is load-bearing: audit_log must NEVER be given
-- `force row level security`, or every audited write in the product starts
-- failing at once.
--
-- The append-only triggers in 0007 are unaffected: they raise on UPDATE and
-- DELETE only, and this function only ever inserts.

-- Sentence case, NOT initcap. `initcap('resource_type')` gives "Resource Type"
-- and `initcap('in_discussion')` gives "In Discussion", while PRD 4.15's own
-- examples are "Status Pipeline to Live" and "Stage In discussion" -- first
-- letter only, the rest left alone. Capitalising every word would also mangle
-- any value that happens to be a phrase.
create or replace function public.audit_sentence_case(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(p_value, '') = '' then ''
    else upper(left(replace(p_value, '_', ' '), 1)) || substr(replace(p_value, '_', ' '), 2)
  end;
$$;

revoke all on function public.audit_sentence_case(text) from public, anon, authenticated;

-- The change_summary formatter (PRD 4.15: generated at write time, keyed on
-- entity_type and action, prose rather than a JSON dump).
--
-- Composing English in SQL is a deliberate, documented exception to the
-- project's no-hardcoded-strings rule, not an oversight. An audit entry is an
-- immutable historical record: it has to read at any later date exactly as it
-- read when written, which is the opposite of what translating it at display
-- time would do -- localising the contents would re-render history in
-- whichever language the reader picked. Everything AROUND the log (column
-- headers, filters, action badges, the `system` actor) is localised normally.
--
-- p_entity_type is accepted and currently unused: PRD 4.15 defines the
-- formatter as keyed on entity_type and action, and per-entity phrasing should
-- be a change in this one function rather than a new signature threaded
-- through fifteen triggers.
create or replace function public.audit_change_summary(
  p_action public.audit_action,
  p_entity_type text,
  p_diff jsonb
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_keys text[];
  v_key text;
  v_from text;
  v_to text;
begin
  if p_action = 'created' then
    return 'Created';
  elsif p_action = 'deleted' then
    return 'Deleted';
  end if;

  select array_agg(k.key order by k.key)
    into v_keys
    from jsonb_object_keys(coalesce(p_diff, '{}'::jsonb)) as k(key);

  if v_keys is null then
    return 'Edited';
  end if;

  if array_length(v_keys, 1) = 1 then
    v_key := v_keys[1];
    v_from := coalesce(p_diff -> v_key ->> 'from', '');
    v_to := coalesce(p_diff -> v_key ->> 'to', '');

    -- Enum-shaped and other lower_snake values get sentence case so the
    -- sentence reads as PRD 4.15's examples do: 'pipeline' -> 'Pipeline',
    -- 'in_discussion' -> 'In discussion'. Anything else -- a stat value like
    -- "150+", a paragraph of copy -- is left exactly as stored: a summary must
    -- not restyle the content it is reporting.
    if v_from ~ '^[a-z][a-z_]*$' then
      v_from := public.audit_sentence_case(v_from);
    end if;
    if v_to ~ '^[a-z][a-z_]*$' then
      v_to := public.audit_sentence_case(v_to);
    end if;

    -- The from-to form is used consistently rather than the shorter
    -- new-value-only phrasing PRD 4.15 shows for a stage change: it reproduces
    -- that section's first example exactly ("Status Pipeline to Live") and
    -- carries strictly more information than the third.
    --
    -- Note also where 4.15's second example lands. "Updated 'extended network'
    -- stat to 150+" names the entity and the change in one string; here those
    -- are two columns, and the Audit Log renders them side by side -- ITEM
    -- "Headline stat: Extended network", CHANGE "Value 120+ to 150+". The
    -- sentence the operator reads across the row is the PRD's; nothing was
    -- dropped.
    if v_from <> '' and length(v_from) <= 80 and length(v_to) <= 80 then
      return public.audit_sentence_case(v_key) || ' ' || v_from || ' to ' || v_to;
    elsif length(v_to) <= 80 then
      return 'Updated ' || replace(v_key, '_', ' ') || ' to ' || v_to;
    else
      return 'Updated ' || replace(v_key, '_', ' ');
    end if;
  end if;

  return 'Updated ' || array_length(v_keys, 1) || ' fields: '
    || (select string_agg(replace(k, '_', ' '), ', ' order by k) from unnest(v_keys) as k);
end;
$$;

revoke all on function public.audit_change_summary(public.audit_action, text, jsonb)
  from public, anon, authenticated;

comment on function public.audit_change_summary(public.audit_action, text, jsonb) is
  'Renders audit_log.change_summary from a diff at write time (PRD 4.15). English by design: an audit entry must read later exactly as it read when written.';

-- The trigger body. One function for every audited table; per-table variation
-- comes in as trigger arguments:
--
--   TG_ARGV[0]  entity_type      e.g. 'resource', 'site_content', 'user'
--   TG_ARGV[1]  label columns    comma-separated candidates, first non-blank
--                                wins. A list rather than a single column
--                                because profiles.full_name is `not null
--                                default ''`, so an account invited but not
--                                yet named would otherwise log as "User: user"
--                                -- 'full_name,email' keeps the record
--                                identifiable without a second mechanism.
--   TG_ARGV[2]  label prefix     '' for resources (bare name, PRD 4.15),
--                                'Partnership: ' etc. for everything else
--   TG_ARGV[3]  redact list      comma-separated columns whose VALUES must
--                                never reach audit_log
--
-- There is deliberately NO dynamic SQL in this function. Per-column access
-- goes through to_jsonb(new) / to_jsonb(old) by key, so even a future caller
-- who controls the trigger arguments cannot make it execute a statement.
-- Together with `set search_path = ''` and the revoke below, and with the fact
-- that a trigger function called directly errors with "trigger functions can
-- only be called as triggers" before its body runs, this exposes no callable
-- privilege-escalation surface.
--
-- The actor is resolved from auth.uid() and never from an argument. An action
-- cannot attribute its mutation to someone else, because it does not write the
-- audit row at all.
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

comment on function public.audit_row_change() is
  'Writes the audit_log row for a mutation, inside that mutation''s own transaction. Actor comes from auth.uid(), never from an argument. A failure here aborts the mutation, which is the point: there is no path to a successful unaudited write.';

-- One trigger per base table that has any write policy -- all fifteen, not
-- only the eight the launch screens touch. The deferred tables cost one line
-- each, and covering them now means no future screen can ship against an
-- unaudited table by omission. Guard G15 asserts this set stays complete.
--
-- AFTER, not BEFORE: the row must be recorded as it ended up, including the id
-- a default generated and the updated_at set_updated_at wrote.

create trigger resources_audit
  after insert or update or delete on public.resources
  for each row execute function public.audit_row_change('resource', 'name', '', '');

create trigger partners_audit
  after insert or update or delete on public.partners
  for each row execute function public.audit_row_change('partner', 'name', 'Partner: ', '');

create trigger partnerships_audit
  after insert or update or delete on public.partnerships
  for each row execute function public.audit_row_change('partnership', 'organisation', 'Partnership: ', '');

create trigger submissions_audit
  after insert or update or delete on public.submissions
  for each row execute function public.audit_row_change('submission', 'resource_name,organisation', 'Submission: ', 'submitter_email,source_ip_hash');

create trigger subscribers_audit
  after insert or update or delete on public.subscribers
  for each row execute function public.audit_row_change('subscriber', 'email', 'Subscriber: ', 'email,confirm_token,unsubscribe_token');

create trigger contact_messages_audit
  after insert or update or delete on public.contact_messages
  for each row execute function public.audit_row_change('contact_message', 'email', 'Contact: ', 'email,name,message,source_ip_hash');

create trigger digest_sends_audit
  after insert or update or delete on public.digest_sends
  for each row execute function public.audit_row_change('digest_send', 'subject', 'Digest: ', '');

create trigger site_content_audit
  after insert or update or delete on public.site_content
  for each row execute function public.audit_row_change('site_content', 'key', 'Site content: ', '');

create trigger headline_stats_audit
  after insert or update or delete on public.headline_stats
  for each row execute function public.audit_row_change('headline_stat', 'label', 'Headline stat: ', '');

create trigger compute_metrics_audit
  after insert or update or delete on public.compute_metrics
  for each row execute function public.audit_row_change('compute_metric', 'label', 'Compute metric: ', '');

create trigger programmes_audit
  after insert or update or delete on public.programmes
  for each row execute function public.audit_row_change('programme', 'title', 'Programme: ', '');

create trigger impact_stories_audit
  after insert or update or delete on public.impact_stories
  for each row execute function public.audit_row_change('impact_story', 'organisation', 'Impact story: ', '');

create trigger updates_log_audit
  after insert or update or delete on public.updates_log
  for each row execute function public.audit_row_change('update_note', 'text', 'Update: ', '');

create trigger settings_audit
  after insert or update or delete on public.settings
  for each row execute function public.audit_row_change('setting', 'key', 'Setting: ', '');

create trigger profiles_audit
  after insert or update or delete on public.profiles
  for each row execute function public.audit_row_change('user', 'full_name,email', 'User: ', '');
