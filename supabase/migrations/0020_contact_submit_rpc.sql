-- The public contact form's write path.
--
-- `public.contact_messages` deliberately has no insert policy and no grant for
-- `anon` (0005_community.sql): the table is a staff inbox, and exposing it
-- directly to PostgREST would let anyone post arbitrary rows, at any rate,
-- into any column -- including `delivered_at`, letting a submitter mark their
-- own message as already handled.
--
-- The obvious shortcut is to write it with the `service_role` client from a
-- server action. That is refused here on purpose, and
-- tests/structure/service-role-containment.test.ts enforces the refusal:
-- `service_role` bypasses RLS entirely, so it removes the database's
-- permission model from the write path altogether, and it is the wrong tool
-- for a write that a narrowly scoped function can express exactly.
-- src/lib/actions/README.md names the alternative in as many words -- "the
-- narrowly scoped security definer RPC pattern ... one transaction, caller's
-- role re-checked in the database, typed parameters, no dynamic SQL" -- and
-- this is that function.
--
-- What this buys over an anon insert policy: the caller can write exactly one
-- shape of row into exactly three columns. `id`, `submitted_at` and
-- `created_at` come from their defaults; `source_ip_hash`, `delivered_at` and
-- `delivery_error` stay null because no parameter can reach them. There is no
-- SELECT here either, so the function grants no way to read the inbox back --
-- a submitter cannot enumerate other people's messages, which an insert
-- policy plus a select grant could easily be misconfigured into allowing.

create function public.submit_contact_message(
  p_name    text,
  p_email   text,
  p_message text
)
returns void
language plpgsql
security definer
-- Empty search_path is not decoration on a security definer function: without
-- it, a caller who can create objects could shadow an unqualified name and
-- have it execute as the function's owner. Every reference below is
-- schema-qualified so the empty path costs nothing.
set search_path = ''
as $$
begin
  -- Bounds mirror src/lib/schemas/contact.ts, which is the primary boundary.
  -- Repeating them here is defence in depth, not duplication for its own sake:
  -- this function is reachable by anyone holding the anon key, with or without
  -- the application in front of it, so it cannot assume Zod has run.
  --
  -- These are the table's own NOT NULLs made actionable. A bare insert would
  -- reject a null but happily store a message of pure whitespace.
  if p_name is null or btrim(p_name) = '' or length(btrim(p_name)) > 120 then
    raise exception 'contact: name must be 1-120 characters' using errcode = '22023';
  end if;

  -- Not a full RFC 5322 parse, and not trying to be: the address is checked
  -- properly by Zod at the application boundary, and the only job here is to
  -- refuse something that is obviously not an address at all. 254 is the RFC
  -- 5321 maximum for a complete address.
  if p_email is null
     or btrim(p_email) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or length(btrim(p_email)) > 254 then
    raise exception 'contact: a valid email address is required' using errcode = '22023';
  end if;

  if p_message is null or btrim(p_message) = '' or length(btrim(p_message)) > 4000 then
    raise exception 'contact: message must be 1-4000 characters' using errcode = '22023';
  end if;

  -- Lowercased on the way in, matching src/lib/schemas/contact.ts, so one
  -- address submitted with different capitalisation is stored one way.
  insert into public.contact_messages (name, email, message)
  values (btrim(p_name), lower(btrim(p_email)), btrim(p_message));
end;
$$;

-- `create function` grants EXECUTE to PUBLIC by default, which would include
-- every future role. Revoke first, then grant the two roles that need it.
-- `authenticated` is included because a signed-in staff member browsing the
-- public site is `authenticated`, not `anon`, and the contact form must not
-- break for them.
revoke all on function public.submit_contact_message(text, text, text) from public;
grant execute on function public.submit_contact_message(text, text, text) to anon, authenticated;
