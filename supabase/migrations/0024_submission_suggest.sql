-- The public "Suggest a resource" form's write path, and the two columns it
-- needs that PRD 4.5's original submissions table did not have.
--
-- The prototype's form collects the submitter's name and an optional
-- programme contact address alongside the resource itself, and then --
-- because its table has nowhere to put them -- appends all three personal
-- fields to the description, which the reviewer publishes verbatim on
-- approval. That is how a private address ends up on a public card. Here
-- the two get columns of their own, both `@sensitive` from birth so the
-- schema guards (G7, G13) refuse any public view that ever projects them,
-- and the mapper that turns an approved submission into a resource
-- (src/lib/admin/submission-to-resource.ts) never reads them.
--
-- Both are nullable: the rows that exist predate the columns, and an
-- update suggestion (PRD 4.5's other submission type) has no programme
-- contact at all.
--
-- The RPC below is 0020_contact_submit_rpc.sql's pattern applied to the
-- second of the three anonymous-facing writes that file anticipated, and
-- the reasoning there is not repeated: no insert policy and no grant for
-- `anon` on the base table; no service_role client in the action; one
-- security definer function that can write exactly one shape of row into
-- exactly the columns a submitter is meant to supply. `status`,
-- `reviewed_by`, `reviewed_at`, `rejection_reason` and `target_resource_id`
-- have no parameter and so cannot be reached -- a submitter cannot approve
-- their own suggestion, and cannot file an "update" against a resource of
-- their choosing, because `type` is fixed to `new_resource` in the body.
--
-- What is new relative to 0020 is the rate limit, which lives in the
-- function rather than in the application because the function is the
-- boundary: anyone holding the public API key can call it without the
-- application in front of it, and a limit enforced only in a server action
-- would hold against nobody who mattered. Three counts, all against the
-- table's own rows, so there is no second store to keep consistent:
--
--   3 per submitter address per 60 minutes  -- a person has no reason to
--                                              suggest more, and a script
--                                              rotating addresses is caught
--                                              by the next two
--   5 per IP hash per 60 minutes            -- when the caller supplied one
--   60 in total per 10 minutes              -- a flood guard: the queue is
--                                              read by a human, and past
--                                              this rate it is not a queue
--
-- The numbers are tunable and this header is the place they are stated;
-- nothing in the application repeats them. A limit trips as errcode 54000
-- (program_limit_exceeded), distinct from 22023 for invalid input, so the
-- server action can tell "slow down" from "fix this" and say so. Because
-- the counts are ordinary reads inside the function's own transaction, two
-- simultaneous callers can each see n-1 and both get in; that is a
-- one-row overshoot on a limit that exists to stop floods, not a hole.
--
-- The two indexes make those counts a range scan rather than a table scan,
-- which matters because the function runs on every public call.

alter table public.submissions
  add column submitter_name text,
  add column programme_contact_email text;

comment on column public.submissions.submitter_name is
  '@sensitive Name supplied by the public submitter; never surfaced on the public site and never copied into a resource.';
comment on column public.submissions.programme_contact_email is
  '@sensitive Optional programme contact address supplied by the public submitter for the reviewer; never surfaced on the public site and never copied into a resource.';

create index submissions_created_at_idx on public.submissions (created_at);
create index submissions_submitter_email_created_at_idx
  on public.submissions (submitter_email, created_at);

-- The audit trigger's redact list is its fourth argument, baked in at create
-- time (0018_audit_triggers.sql), so the new columns are not covered until
-- the trigger is recreated with them named. This must travel in the same
-- migration as the columns: audit_log is readable by every role, viewer
-- included, and a submitter's name in a diff there would be exactly the
-- leak the @sensitive marker exists to prevent.
drop trigger submissions_audit on public.submissions;
create trigger submissions_audit
  after insert or update or delete on public.submissions
  for each row execute function public.audit_row_change(
    'submission',
    'resource_name,organisation',
    'Submission: ',
    'submitter_email,submitter_name,programme_contact_email,source_ip_hash'
  );

create function public.submit_resource_suggestion(
  p_resource_name           text,
  p_organisation            text,
  p_need                    text,
  p_link                    text,
  p_description             text,
  p_programme_contact_email text,
  p_submitter_name          text,
  p_submitter_email         text,
  p_source_ip_hash          text
)
returns void
language plpgsql
security definer
-- See 0020: an empty search_path is what stops a caller shadowing an
-- unqualified name on a security definer function. Every reference below is
-- schema-qualified.
set search_path = ''
as $$
declare
  v_need public.need_type;
  v_email text;
  v_contact text;
  v_recent integer;
begin
  -- Bounds mirror src/lib/schemas/suggestion.ts, which is the primary
  -- boundary; they are repeated here because this function cannot assume
  -- Zod has run (0020 says why at length).
  if p_resource_name is null or btrim(p_resource_name) = ''
     or length(btrim(p_resource_name)) > 200 then
    raise exception 'suggestion: resource name must be 1-200 characters' using errcode = '22023';
  end if;

  if p_organisation is null or btrim(p_organisation) = ''
     or length(btrim(p_organisation)) > 200 then
    raise exception 'suggestion: organisation must be 1-200 characters' using errcode = '22023';
  end if;

  -- A bad category would otherwise surface as 22P02 (invalid_text_
  -- representation) with Postgres's own wording; caught so every invalid
  -- input leaves this function the same way.
  begin
    v_need := p_need::public.need_type;
  exception when invalid_text_representation then
    raise exception 'suggestion: unknown category' using errcode = '22023';
  end;
  if v_need is null then
    raise exception 'suggestion: unknown category' using errcode = '22023';
  end if;

  -- Required, unlike the column: a suggestion nobody can follow to an
  -- application is not one the reviewer can publish, and the table's own
  -- https check is repeated so the error is this function's rather than a
  -- constraint name.
  if p_link is null or btrim(p_link) !~* '^https://\S+$'
     or length(btrim(p_link)) > 2048 then
    raise exception 'suggestion: link must be an https:// address of at most 2048 characters' using errcode = '22023';
  end if;

  if p_description is null or btrim(p_description) = ''
     or length(btrim(p_description)) > 5000 then
    raise exception 'suggestion: description must be 1-5000 characters' using errcode = '22023';
  end if;

  if p_submitter_name is null or btrim(p_submitter_name) = ''
     or length(btrim(p_submitter_name)) > 120 then
    raise exception 'suggestion: your name must be 1-120 characters' using errcode = '22023';
  end if;

  -- The same not-a-full-parse address check as 0020, lowercased on the way
  -- in so one address written two ways counts as one address for the limit
  -- below as well as for storage.
  if p_submitter_email is null
     or btrim(p_submitter_email) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or length(btrim(p_submitter_email)) > 254 then
    raise exception 'suggestion: a valid email address is required' using errcode = '22023';
  end if;
  v_email := lower(btrim(p_submitter_email));

  -- Optional: null and blank both mean "none given".
  v_contact := nullif(btrim(coalesce(p_programme_contact_email, '')), '');
  if v_contact is not null
     and (v_contact !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
          or length(v_contact) > 254) then
    raise exception 'suggestion: the contact email is not a valid address' using errcode = '22023';
  end if;
  v_contact := lower(v_contact);

  -- Rate limits, most specific first. Each is an ordinary count over the
  -- table's own rows in the windows stated in the header.
  select count(*) into v_recent
    from public.submissions s
   where s.submitter_email = v_email
     and s.created_at > now() - interval '60 minutes';
  if v_recent >= 3 then
    raise exception 'suggestion: too many suggestions from this address; try again later'
      using errcode = '54000';
  end if;

  if p_source_ip_hash is not null and btrim(p_source_ip_hash) <> '' then
    select count(*) into v_recent
      from public.submissions s
     where s.source_ip_hash = p_source_ip_hash
       and s.created_at > now() - interval '60 minutes';
    if v_recent >= 5 then
      raise exception 'suggestion: too many suggestions from this network; try again later'
        using errcode = '54000';
    end if;
  end if;

  select count(*) into v_recent
    from public.submissions s
   where s.created_at > now() - interval '10 minutes';
  if v_recent >= 60 then
    raise exception 'suggestion: the queue is receiving too many suggestions; try again later'
      using errcode = '54000';
  end if;

  insert into public.submissions (
    type, resource_name, organisation, need, link, description,
    programme_contact_email, submitter_name, submitter_email, source_ip_hash
  )
  values (
    'new_resource',
    btrim(p_resource_name),
    btrim(p_organisation),
    v_need,
    btrim(p_link),
    btrim(p_description),
    v_contact,
    btrim(p_submitter_name),
    v_email,
    nullif(btrim(coalesce(p_source_ip_hash, '')), '')
  );
end;
$$;

-- As in 0020: revoke the default PUBLIC grant, then grant the two roles a
-- visitor can be -- `authenticated` because a signed-in staff member on the
-- public site is not `anon`, and the form must not break for them.
revoke all on function public.submit_resource_suggestion(
  text, text, text, text, text, text, text, text, text
) from public;
grant execute on function public.submit_resource_suggestion(
  text, text, text, text, text, text, text, text, text
) to anon, authenticated;
