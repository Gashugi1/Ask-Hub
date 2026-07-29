/**
 * Seeds the launch-placeholder content transcribed in scripts/seed-data.ts
 * (partners, resources, programmes, site_content) into Postgres via the
 * service_role key. Idempotent: every table is upserted on the real
 * constraint that already exists for it, so running this twice updates the
 * same rows in place rather than duplicating them.
 *
 * Order matters: partners must land before resources, because
 * resources.partner is a foreign key to partners(name)
 * (supabase/migrations/0014_partner_logos.sql, resources_partner_fkey).
 *
 * Upsert keys, matching the real constraints (not invented ones):
 *   - partners     on `name`        (primary key, 0014_partner_logos.sql)
 *   - resources    on `partner,name` (resources_partner_name_key, 0013_reconcile_partners.sql)
 *   - programmes   on `seed_key`     (unique, 0006_site.sql)
 *   - site_content on `key,locale`   (unique, 0006_site.sql)
 *
 * Does NOT seed impact_stories, headline_stats, compute_metrics (no source
 * data / blocked pending attested figures — see scripts/seed-data.ts's
 * header) or the four tables that would carry a real subscriber's email, a
 * public submitter's proposal, a digest send history, or per-visit
 * analytics (fabricated personal data and reporting history must never
 * enter a real system). Deliberately, this file never writes to — and never
 * even names — any of those four tables; tests/seed.test.ts asserts that
 * absence with a static source check, which is exactly why this comment
 * describes them instead of naming them.
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
import { PARTNERS, RESOURCES, PROGRAMMES, SITE_CONTENT } from './seed-data';

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
  programmes: number;
  site_content: number;
}

/**
 * Upserts every array from scripts/seed-data.ts, in FK-safe order, and
 * returns how many rows each upsert affected. Safe to call repeatedly: every
 * table is upserted on a real constraint, never inserted blindly.
 */
export async function seed(): Promise<SeedSummary> {
  // 1. partners — must land first: resources.partner is a foreign key to
  // partners(name).
  const partnerRows = PARTNERS.map((name) => ({
    name,
    // Both null: the prototype has no partner URLs and the client has not
    // supplied any yet (see scripts/seed-data.ts's partners section).
    logo_url: null,
    website_url: null,
  }));
  const { data: partnersResult, error: partnersError } = await client
    .from('partners')
    .upsert(partnerRows, { onConflict: 'name' })
    .select('name');
  if (partnersError) throw new Error(`partners upsert failed: ${partnersError.message}`);

  // 2. resources — depends on partners existing above.
  const { data: resourcesResult, error: resourcesError } = await client
    .from('resources')
    .upsert([...RESOURCES], { onConflict: 'partner,name' })
    .select('id');
  if (resourcesError) throw new Error(`resources upsert failed: ${resourcesError.message}`);

  // 3. programmes — independent of partners/resources.
  const { data: programmesResult, error: programmesError } = await client
    .from('programmes')
    .upsert([...PROGRAMMES], { onConflict: 'seed_key' })
    .select('id');
  if (programmesError) throw new Error(`programmes upsert failed: ${programmesError.message}`);

  // 4. site_content — independent of everything else.
  const { data: siteContentResult, error: siteContentError } = await client
    .from('site_content')
    .upsert([...SITE_CONTENT], { onConflict: 'key,locale' })
    .select('id');
  if (siteContentError) {
    throw new Error(`site_content upsert failed: ${siteContentError.message}`);
  }

  return {
    partners: partnersResult?.length ?? 0,
    resources: resourcesResult?.length ?? 0,
    programmes: programmesResult?.length ?? 0,
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
// unconditionally in both, and only ends with this file's name when tsx
// itself is the entrypoint.
const isMain = process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js');
if (isMain) {
  seed()
    .then((summary) => {
      console.log('Seed complete:');
      console.log(`  partners:     ${summary.partners}`);
      console.log(`  resources:    ${summary.resources}`);
      console.log(`  programmes:   ${summary.programmes}`);
      console.log(`  site_content: ${summary.site_content}`);
    })
    .catch((error) => {
      fail(error instanceof Error ? error.message : String(error));
    });
}
