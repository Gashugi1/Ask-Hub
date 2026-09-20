/**
 * Seeds the launch-placeholder content transcribed in scripts/seed-data.ts
 * (partners, resources, site_content) into Postgres via the service_role
 * key. Idempotent in row count — running this twice never duplicates a row —
 * but deliberately NOT idempotent in the naive "full upsert" sense for two
 * tables, because a full upsert would silently overwrite work a human did in
 * the admin UI between runs. Concretely, a re-run:
 *
 *   - partners: insert-only. A provider the table lacks is inserted with
 *     both URL columns null; a provider it already has is not touched in any
 *     column (ON CONFLICT DO NOTHING). Providers are created and edited from
 *     the admin portal -- the resource modal, the tracker import and the
 *     review queue all add rows, and a logo or site link can be set on one --
 *     so a re-run must never revert that work. See the partner step itself.
 *   - resources: refreshes every *content* column (description, external
 *     URL, action label, eligibility arrays, sub-category, resource type,
 *     need, partner_tier, banner image, added_date) on conflict, but NEVER
 *     touches `status`, `is_featured`, `deadline`, or `exclusivity` on an
 *     existing row — those four are curation decisions a human makes in the
 *     admin UI (promoting a resource to live, featuring it, setting a
 *     deadline, applying an exclusivity badge), and a re-run must not revert
 *     one. A brand-new resource still inserts with the seed's own status
 *     (live/pipeline/reference) — there is no curation decision to protect
 *     yet on a row that doesn't exist.
 *   - site_content: full upsert, on purpose. This table holds only
 *     placeholder page copy (no admin curation workflow sits on top of it
 *     the way it does for resources), so refreshing every column on conflict
 *     is correct and intended: editing scripts/seed-data.ts and re-running
 *     is the update path for this content while it stays placeholder.
 *
 * Order matters: partners must land before resources, because
 * resources.partner is a foreign key to partners(name)
 * (supabase/migrations/0014_partner_logos.sql, resources_partner_fkey).
 *
 * Upsert keys, matching the real constraints (not invented ones):
 *   - partners     on `name`         (primary key, 0014_partner_logos.sql)
 *   - resources    on `partner,name` (resources_partner_name_key, 0013_reconcile_partners.sql)
 *   - site_content on `key,locale`   (unique, 0006_site.sql)
 *
 * Does NOT seed impact_stories, headline_stats, compute_metrics, or
 * programmes (no source data / blocked pending attested figures — see
 * scripts/seed-data.ts's header, which also covers why `programmes`
 * specifically joined this list on later human review) or the four tables
 * that would carry a real subscriber's email, a public submitter's
 * proposal, a digest send history, or per-visit analytics (fabricated
 * personal data and reporting history must never enter a real system).
 * Deliberately, this file never writes to — and never even names — any of
 * those four tables; tests/seed.test.ts asserts that absence with a static
 * source check, which is exactly why this comment describes them instead of
 * naming them.
 *
 * No `@/*` imports here or anywhere under scripts/ — vitest aliases `@` to
 * `./src`, but `tsx` (which runs `npm run seed`) does not, so such an import
 * would typecheck and pass tests, then crash at runtime. The one import
 * from src/ below (the generated `Database` type) uses a relative path,
 * which both vitest and tsx resolve identically.
 *
 * Env handling matches scripts/provision-admins.ts: SUPABASE_URL falls back
 * to NEXT_PUBLIC_SUPABASE_URL, SEED_ENV_FILE defaults to `.env.local`, and a
 * non-loopback URL is refused unless SEED_CONFIRM_REMOTE=1 — seeding
 * production is possible but never accidental.
 *
 * Usage: npm run seed
 */
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import type { Database } from '../src/lib/supabase/database.types';
import {
  PARTNER_ASSETS,
  PARTNERS,
  RESOURCES,
  SITE_CONTENT,
  type SeedResource,
} from './seed-data';

// Same override variable and default as provision-admins.ts and the rest of
// this project's scripts: .env.local (the dev stack's file), not .env.test
// (the test stack's file — vitest.config.ts loads that one itself, before
// this module is ever imported).
const envFile = process.env.SEED_ENV_FILE ?? '.env.local';
loadEnv({ path: envFile });

function fail(message: string): never {
  console.error(`seed: ${message}`);
  process.exit(1);
}

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  fail(
    `SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) is not set. Checked ${envFile}; ` +
      'set SEED_ENV_FILE to point elsewhere.',
  );
}
if (!serviceKey) {
  fail(
    `SUPABASE_SERVICE_ROLE_KEY is not set. Checked ${envFile}; ` +
      'set SEED_ENV_FILE to point elsewhere.',
  );
}

// Seeding production is possible but never accidental: refuse any
// non-loopback host unless explicitly confirmed. Same check as
// provision-admins.ts.
const parsedUrl = new URL(url);
const isLoopback =
  parsedUrl.hostname === '127.0.0.1' ||
  parsedUrl.hostname === 'localhost' ||
  parsedUrl.hostname === '::1' ||
  parsedUrl.hostname === '[::1]';
if (!isLoopback && process.env.SEED_CONFIRM_REMOTE !== '1') {
  fail(
    `refusing to run against non-loopback URL ${parsedUrl.hostname}. ` +
      'Set SEED_CONFIRM_REMOTE=1 to confirm this is intentional.',
  );
}

const client = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export interface SeedSummary {
  partners: number;
  resources: number;
  site_content: number;
}

/**
 * The resource columns a re-run is allowed to refresh: everything the
 * prototype transcription actually describes about the resource. Deliberately
 * excludes `status`, `is_featured`, `deadline` and `exclusivity` — see the
 * file header's curation-safety note — and `name`/`partner`, which are the
 * upsert's own match key and never need updating on themselves.
 */
function resourceContentFields(r: SeedResource) {
  return {
    partner_tier: r.partner_tier,
    resource_type: r.resource_type,
    need_primary: r.need_primary,
    need_secondary: r.need_secondary,
    sub_category: r.sub_category,
    description: r.description,
    action_label: r.action_label,
    external_url: r.external_url,
    banner_image_url: r.banner_image_url,
    countries_eligible: r.countries_eligible,
    sectors_eligible: r.sectors_eligible,
    stages_eligible: r.stages_eligible,
    geo_scope: r.geo_scope,
    added_date: r.added_date,
    sort_order: r.sort_order,
  };
}

/**
 * Upserts every array from scripts/seed-data.ts, in FK-safe order, and
 * returns how many rows now match the seed in each table. Safe to call
 * repeatedly — see the file header for exactly what a re-run does and does
 * not overwrite on `partners` and `resources`.
 */
export async function seed(): Promise<SeedSummary> {
  // 1. partners — must land first: resources.partner is a foreign key to
  // partners(name). Insert-only: `ignoreDuplicates` makes this ON CONFLICT DO
  // NOTHING, so a provider the table already has is left exactly as it is, in
  // every column. That is a structural guarantee rather than a circumstantial
  // one. An earlier version of this step relied on the observation that
  // nothing in src/ wrote to `partners`, and rewrote a flag column on every
  // run; that observation stopped being true when the tracker import and the
  // review queue started creating providers, and the admin resource modal now
  // creates them too. A seed that updates existing rows would silently undo
  // an admin's decision on the next run. It does not, because it cannot.
  const { error: partnersError } = await client
    .from('partners')
    .upsert(PARTNERS.map((name) => ({ name })), { onConflict: 'name', ignoreDuplicates: true });
  if (partnersError) throw new Error(`partners upsert failed: ${partnersError.message}`);
  // 1b. partner assets — the logo/site pair, written only where no logo is
  // recorded yet. The `is('logo_url', null)` filter is what reconciles two
  // rules that would otherwise contradict each other: a fresh database must
  // come up with the client's logos on it (so the seed has to write them),
  // and an admin-uploaded logo must survive every re-run (so the seed must
  // not overwrite one). Filtering on the null makes the write a backfill
  // rather than an assignment -- it can only ever turn "no logo" into "the
  // pack's logo", never replace a decision somebody made in the admin.
  //
  // Separate from the upsert above rather than folded into it, because
  // PostgREST's ON CONFLICT DO UPDATE has no per-row WHERE: including these
  // columns in that payload would rewrite them unconditionally, which is
  // exactly what the comment above explains must not happen.
  //
  // Both columns are set in one statement because
  // `partners_logo_requires_site` refuses a logo with no site to link to
  // (content rule 10.10) -- they cannot land separately even if we wanted
  // them to.
  for (const asset of PARTNER_ASSETS) {
    const { error } = await client
      .from('partners')
      .update({ logo_url: asset.logoUrl, website_url: asset.websiteUrl })
      .eq('name', asset.name)
      .is('logo_url', null);
    if (error) throw new Error(`partner asset update failed for ${asset.name}: ${error.message}`);
  }

  const { count: partnersCount, error: partnersCountError } = await client
    .from('partners')
    .select('name', { count: 'exact', head: true })
    .in('name', [...PARTNERS]);
  if (partnersCountError) {
    throw new Error(`partners count failed: ${partnersCountError.message}`);
  }

  // 2. resources — depends on partners existing above. Two-phase, not a
  // single upsert, because PostgREST's upsert has no per-column opt-out: any
  // column present in the payload gets overwritten on conflict, full stop.
  // A single-call upsert of the whole RESOURCES payload would silently
  // revert `status`/`is_featured`/`deadline`/`exclusivity` on every existing
  // row back to the seed's values on every re-run — including reverting an
  // admin's promotion of a resource from pipeline to live, which is exactly
  // the failure this two-phase approach exists to prevent.
  //
  // Phase 1: insert-only (`ignoreDuplicates: true` sends
  // `Prefer: resolution=ignore-duplicates`, i.e. `ON CONFLICT DO NOTHING`).
  // Brand-new resources insert with the seed's full payload, curation fields
  // included — there is no human decision to protect yet on a row that
  // doesn't exist. Existing resources are left completely untouched by this
  // phase, content and curation fields alike.
  const { error: resourcesInsertError } = await client
    .from('resources')
    .upsert([...RESOURCES], { onConflict: 'partner,name', ignoreDuplicates: true });
  if (resourcesInsertError) {
    throw new Error(`resources insert-only phase failed: ${resourcesInsertError.message}`);
  }

  // Phase 2: for every seeded resource (new or pre-existing), explicitly
  // update only the content fields, matched on the same (partner, name) key.
  // For a row phase 1 just inserted this is a no-op (the content already
  // matches). For a pre-existing, admin-curated row this refreshes content
  // from scripts/seed-data.ts while leaving status/is_featured/deadline/
  // exclusivity exactly as curation set them.
  for (const resource of RESOURCES) {
    const { error: resourceUpdateError } = await client
      .from('resources')
      .update(resourceContentFields(resource))
      .eq('partner', resource.partner)
      .eq('name', resource.name);
    if (resourceUpdateError) {
      throw new Error(
        `resources content update failed for "${resource.name}": ${resourceUpdateError.message}`,
      );
    }
  }

  const { count: resourcesCount, error: resourcesCountError } = await client
    .from('resources')
    .select('id', { count: 'exact', head: true })
    .in(
      'name',
      RESOURCES.map((r) => r.name),
    );
  if (resourcesCountError) {
    throw new Error(`resources count failed: ${resourcesCountError.message}`);
  }

  // 3. site_content — independent of everything else. Full upsert is
  // correct here: see the file header for why this table has no curation
  // workflow to protect.
  const { data: siteContentResult, error: siteContentError } = await client
    .from('site_content')
    .upsert([...SITE_CONTENT], { onConflict: 'key,locale' })
    .select('id');
  if (siteContentError) {
    throw new Error(`site_content upsert failed: ${siteContentError.message}`);
  }

  return {
    partners: partnersCount ?? 0,
    resources: resourcesCount ?? 0,
    site_content: siteContentResult?.length ?? 0,
  };
}

// Runs only when this file is the process entrypoint (`npm run seed` /
// `tsx scripts/seed.ts`), not when tests import `seed` as a module. Checked
// via process.argv rather than `import.meta.url` or `require.main`: tsx and
// vitest transpile this file to different module formats (tsx honours
// package.json's absence of "type": "module" and targets CommonJS; vitest
// always runs an ESM pipeline), so neither `import.meta` nor `require.main`
// is reliably available in both. process.argv[1] (the script path the
// process was actually launched with) is a plain runtime array available
// unconditionally in both. Matched with a leading `/` so this only fires for
// `seed.ts` itself, not `reseed.ts`, `preseed.ts`, or any other file that
// merely ends with the same four letters.
const isMain = process.argv[1]?.endsWith('/seed.ts') || process.argv[1]?.endsWith('/seed.js');
if (isMain) {
  seed()
    .then((summary) => {
      console.log('Seed complete:');
      console.log(
        `  partners:     ${summary.partners} ` +
          '(asset pack backfilled where no logo was recorded; an existing logo_url/website_url is left alone)',
      );
      console.log(`  resources:    ${summary.resources} (status/is_featured/deadline/exclusivity on existing rows untouched; content refreshed)`);
      console.log(`  site_content: ${summary.site_content} (full refresh — no curation workflow on this table)`);
    })
    .catch((error) => {
      fail(error instanceof Error ? error.message : String(error));
    });
}
