-- Let a partner's logo be an asset this application serves itself, not
-- only an absolute https URL on someone else's host.
--
-- 0014 wrote `partners_logo_https` as `logo_url ~* '^https://'`, and its
-- own note explains the intent: the client's logos arrive as image files,
-- and "a repo-relative path cannot satisfy it", so the files were to be
-- uploaded to a public Supabase Storage bucket and referenced by their
-- https URL. That happened, and it works -- but only in one place:
--
--   * The deployed project has it. The hosted Supabase behind Vercel
--     serves partner-logos/{aws,cineca,microsoft}.png and the three
--     partners carry those https URLs. Production renders them today and
--     is untouched by this migration: those values satisfied the old rule
--     and satisfy the new one unchanged.
--   * Nothing in this repository reproduces it. There is no bucket
--     migration, no upload script and no seeded logo_url, so every other
--     environment starts with none -- a fresh `db:reset` gives 19 partners
--     with a null logo, which is what a local checkout has been rendering.
--   * A local stack cannot be brought up to match, even by hand. Both
--     .env.local and .env.test point NEXT_PUBLIC_SUPABASE_URL at
--     http://127.0.0.1:54321, so a Storage public URL on that stack is
--     http:// and this very constraint rejects it. The only value that
--     satisfied the constraint was the hosted project's URL, written into
--     a database that is not that project -- a row pointing at an asset
--     the local app does not serve.
--
-- So the constraint is widened, deliberately and narrowly, to also accept a
-- site-root-relative path, and the asset pack that already sits in
-- public/partners as PNG becomes a logo source any environment can use with
-- no bucket at all. scripts/seed-data.ts's PARTNER_ASSETS wires three of
-- those files to the partners they belong to; the seed writes them only
-- where no logo is recorded, so this never disturbs the hosted rows above.
-- The result is two logo sources by environment -- Storage on the deployed
-- project, `public/` everywhere else -- which is deliberate: the deployment
-- keeps what it has, and a checkout stops depending on a bucket nobody can
-- recreate from this repository.
--
-- **This is not a loosening of the security posture, and the shape of the
-- pattern is what makes that true.** What 0014's https rule buys is two
-- things: no cleartext http fetch, and no surprise third-party host. A
-- same-origin `/partners/aws.png` gives up neither -- it inherits the
-- page's own scheme, so it is https exactly when the site is, and it can
-- only ever name an asset this application ships. The alternation is
-- anchored `^/[^/]` rather than `^/`, which is the load-bearing detail:
-- bare `^/` would admit `//evil.example/logo.png`, a protocol-relative URL
-- that browsers resolve to a *remote* host under the page's scheme. That is
-- precisely the third-party fetch the original rule existed to prevent, and
-- it would have been let in through the front door. Probed directly against
-- this Postgres: accepts /partners/aws.png and https://cdn.example/a.png;
-- rejects //evil.example/logo.png, http://x/a.png, /\evil.example/a.png,
-- ftp://x/a.png and the bare relative partners/aws.png.
--
-- Everything else about the column is untouched and still applies to a
-- path exactly as it did to a URL: partners_logo_not_svg still refuses
-- .svg/.svgz per PRD 14.5, and partners_logo_requires_site still refuses a
-- logo with no official site to link to (content rule 10.10). website_url
-- keeps its https-only rule unchanged -- that one genuinely does name an
-- external host, and there is no same-origin case for it.

alter table public.partners
  drop constraint partners_logo_https;

alter table public.partners
  add constraint partners_logo_https_or_local
    check (
      logo_url is null
      or logo_url ~* '^https://'
      or logo_url ~ '^/[^/\\]'
    );

comment on constraint partners_logo_https_or_local on public.partners is
  'A logo is either an absolute https URL or a site-root-relative path this application serves. The [^/\] class rejects protocol-relative //host and backslash-smuggled paths, both of which resolve to a remote host.';
