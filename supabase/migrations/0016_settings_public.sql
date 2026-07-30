-- Feature flags are the one row class in public.settings a public page must
-- read: /impact is built and 404-gated on feature_public_impact_page (PRD 5.7).
-- anon holds nothing on public.settings, so without this view the only way to
-- resolve the flag while rendering a public page is the service_role client --
-- which would put a key that bypasses RLS entirely on the critical path of an
-- anonymous page render. CLAUDE.md is explicit that anonymous reads go through
-- public-safe views; this is that view.
--
-- The where clause is an allow-list, not a deny-list. settings also holds
-- ga4_property_id and contact_email; a deny-list would expose the next key
-- anyone adds. Adding a key to the public surface must be a deliberate edit
-- here, visible in a diff.
create view public.settings_public
with (security_invoker = false) as
select s.key, s.value
from public.settings s
where s.key in ('feature_innovator_profiles', 'feature_public_impact_page');

-- Same pg_default_acl residue every view in this schema picks up the moment
-- it is created: a bare `create view` hands anon a `Dxtm` grant (TRUNCATE,
-- REFERENCES, TRIGGER, MAINTAIN), not merely nothing. Revoke before granting.
revoke all on public.settings_public from anon, authenticated;
grant select on public.settings_public to anon, authenticated;

comment on view public.settings_public is
  'Public-safe projection of the two feature flags only. Never widen the key allow-list without a matching entry in tests/rls/security-allowlist.ts.';
