import type { SupabaseClient } from '@supabase/supabase-js';
import { serviceClient } from './clients';

/**
 * Fixture rows created by the DB suites, and how they get removed again.
 *
 * Every suite that needs a throwaway row names it with a `Date.now()` suffix
 * so concurrent and repeated runs cannot collide. Nothing removed them, so
 * the local database accumulated them run after run: at the time this was
 * written 354 of 374 `resources` rows, every row in `partnerships` and
 * `digest_sends`, and 32 of 35 `profiles` were fixtures.
 *
 * That is not merely untidy. Fixture resources are inserted with
 * `status = 'live'`, so they flow through `resources_public` exactly as real
 * content does: `next build` prerenders a detail page for each one, and the
 * page count climbed from 171 to 189 across a single afternoon. Any check of
 * the form "I looked at the rendered output and counted N" is then measuring
 * fixtures, which is how a claim about real content came to be off by a
 * factor of six in this branch's own review notes.
 *
 * `tests/helpers/clients.ts` already carried a workaround for the same leak:
 * `findUserId` pages through the whole auth user list because "the user list
 * grows past a single page once the stack has run for a while without a
 * db:reset". That paging is still correct, but it should no longer be load
 * bearing.
 */

/**
 * A 13-digit epoch-millisecond stamp, not merely thirteen digits in a row.
 *
 * Anchored on `1[7-9]` — epoch ms has been in that range since 2023 and stays
 * there until 2033 — and guarded by digit boundaries on both sides, so a real
 * resource whose name happens to contain a long number (a grant reference, a
 * dataset size) is not mistaken for a fixture. Deletion is driven by this
 * pattern, so it errs towards leaving a row alone.
 */
const FIXTURE_STAMP_RE = /(?<!\d)1[7-9]\d{11}(?!\d)/;

/**
 * Fixtures that deliberately carry no stamp, and so are invisible to the
 * pattern above.
 *
 * Both are upserted under a fixed name precisely so they survive across runs
 * and can be referenced by later inserts -- `tests/rls/resources.test.ts:19`
 * and `tests/rls/public-views.test.ts:62`. That made them permanently
 * unsweepable: they sat in `partners` alongside Google, Microsoft and the
 * African Development Bank, and `partners_public` served them to anonymous
 * readers.
 *
 * Matched on the exact, whole string. These are not names a curated partner
 * directory for a UN programme could plausibly hold, but exact matching means
 * even a real partner whose name merely contained one of them is untouched.
 */
const STABLE_FIXTURE_NAMES: ReadonlySet<string> = new Set([
  'Test Partner',
  'Public View Partner',
]);

/** The stamp every fixture name should carry. Use this, not a bare `Date.now()`. */
export function fixtureStamp(): number {
  return Date.now();
}

/** Whether a value looks like a fixture identifier this module owns. */
export function isFixtureValue(value: string | null | undefined): boolean {
  if (typeof value !== 'string') return false;
  return STABLE_FIXTURE_NAMES.has(value) || FIXTURE_STAMP_RE.test(value);
}

/**
 * Refuse to sweep anything but a local database.
 *
 * This function deletes rows with the `service_role` key, which bypasses RLS
 * entirely. It resolves its target from `process.env.SUPABASE_URL`, and
 * `vitest.config.ts` loads `.env.test` with dotenv -- which does NOT overwrite
 * a variable already present in the environment. So an exported SUPABASE_URL
 * silently wins, and every `vitest` invocation runs this sweep, including a
 * single unit file.
 *
 * That is not a theoretical path. `scripts/seed.ts:98-109` and
 * `scripts/provision-admins.ts:83-95` read the SAME variable names and both
 * already guard against exactly this, and the documented remote-seed workflow
 * (`SEED_CONFIRM_REMOTE=1 SUPABASE_URL=https://... npm run seed`) puts remote
 * credentials into the developer's shell. The guard on the seeding path is
 * what makes the unguarded test path reachable.
 *
 * Deliberately unlike those two scripts, there is NO confirmation escape
 * hatch. Seeding a remote database is a real if rare intention; sweeping one
 * from a test run never is. And this throws rather than warning: every other
 * failure in this module is warned-and-skipped because housekeeping must not
 * turn a green suite red, but a sweep pointed at the wrong database is the one
 * failure that must stop the run before it touches anything.
 */
export function assertLoopbackTarget(rawUrl = process.env.SUPABASE_URL): void {
  if (!rawUrl) {
    throw new Error(
      'fixture cleanup: SUPABASE_URL is not set. Refusing to run against an ' +
        'unknown target.',
    );
  }
  let hostname: string;
  try {
    hostname = new URL(rawUrl).hostname;
  } catch {
    throw new Error(`fixture cleanup: SUPABASE_URL is not a valid URL: ${rawUrl}`);
  }
  const isLoopback =
    hostname === '127.0.0.1' ||
    hostname === 'localhost' ||
    hostname === '::1' ||
    hostname === '[::1]';
  if (!isLoopback) {
    throw new Error(
      `fixture cleanup: refusing to delete rows from non-loopback host ${hostname}. ` +
        'This sweep deletes with the service_role key, which bypasses RLS. There is ' +
        'no confirmation flag: point SUPABASE_URL at a local stack instead.',
    );
  }
}

/** How many rows were removed from each table, for reporting. */
export type CleanupTally = Record<string, number>;

/**
 * PostgREST exposes no regular-expression operator, so the pattern cannot be
 * pushed down into the delete. Reading the candidate column and filtering in
 * TypeScript keeps the discriminator in one place and needs no new
 * dependency; the row counts involved are in the hundreds.
 */
async function idsMatching(
  svc: SupabaseClient,
  table: string,
  columns: readonly string[],
  key = 'id',
): Promise<string[]> {
  const { data, error } = await svc.from(table).select([key, ...columns].join(','));
  if (error) throw new Error(`reading ${table} for cleanup: ${error.message}`);
  // supabase-js types a string `select()` as possibly yielding parse errors
  // per row, so the result is not directly indexable. The shape is known here
  // -- the columns are named literals a few lines up -- and the final
  // type guard drops anything that is not a string key rather than trusting
  // the cast blindly.
  const rows = (data ?? []) as unknown as Record<string, string | null>[];
  return rows
    .filter((row) => columns.some((c) => isFixtureValue(row[c])))
    .map((row) => row[key])
    .filter((value): value is string => typeof value === 'string');
}

/**
 * Delete by primary key in chunks, so a large backlog cannot exceed the URL
 * length. The key is a parameter because `partners` has no `id` column at
 * all — it is keyed by `name`, which is also what `resources.partner`
 * references.
 */
async function deleteIds(
  svc: SupabaseClient,
  table: string,
  ids: readonly string[],
  key = 'id',
): Promise<number> {
  const CHUNK = 100;
  let removed = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { error } = await svc.from(table).delete().in(key, chunk);
    // A RESTRICT violation here means real data references this row, which is
    // a reason to keep it. Surface it rather than failing the run: cleanup is
    // housekeeping, and a suite must not go red because one row was pinned.
    if (error) {
      console.warn(`[fixtures] could not delete ${chunk.length} row(s) from ${table}: ${error.message}`);
      continue;
    }
    removed += chunk.length;
  }
  return removed;
}

/**
 * Remove every fixture row this repository's suites create.
 *
 * Order follows the foreign keys, which are not all cascading:
 * `resources.partner` and `submissions.target_resource_id` are both
 * RESTRICT, so children go first. `auth.users` is deleted last and takes
 * `profiles` with it, which is why `profiles` is not deleted directly.
 *
 * The three stable role users in `TEST_USERS` carry no stamp and are
 * deliberately left in place — recreating them on every run is slower and
 * buys nothing.
 */
export async function cleanupFixtures(client?: SupabaseClient): Promise<CleanupTally> {
  // Before any client is constructed, and regardless of whether one was
  // passed in: the target is read from the environment either way.
  // Before any client is constructed, and regardless of whether one was
  // passed in: the target is read from the environment either way.
  assertLoopbackTarget();
  const svc = client ?? serviceClient();
  const tally: CleanupTally = {};

  const resourceIds = await idsMatching(svc, 'resources', ['name']);

  if (resourceIds.length > 0) {
    // engagement_events.resource_id is SET NULL, so these would survive as
    // orphaned analytics rows rather than blocking the delete. They are still
    // fixtures and still pollute any event-count assertion.
    const { data: events } = await svc
      .from('engagement_events')
      .select('id,resource_id')
      .in('resource_id', resourceIds);
    const eventIds = (events ?? []).map((e) => (e as { id: string }).id);
    if (eventIds.length > 0) {
      tally.engagement_events = await deleteIds(svc, 'engagement_events', eventIds);
    }

    // RESTRICT: a submission pointing at a fixture resource pins it.
    const { data: subs } = await svc
      .from('submissions')
      .select('id,target_resource_id')
      .in('target_resource_id', resourceIds);
    const pinning = (subs ?? []).map((s) => (s as { id: string }).id);
    if (pinning.length > 0) {
      tally.submissions = await deleteIds(svc, 'submissions', pinning);
    }
  }

  const ownSubmissions = await idsMatching(svc, 'submissions', [
    'resource_name',
    'organisation',
    'submitter_email',
  ]);
  if (ownSubmissions.length > 0) {
    tally.submissions = (tally.submissions ?? 0) + (await deleteIds(svc, 'submissions', ownSubmissions));
  }

  if (resourceIds.length > 0) {
    tally.resources = await deleteIds(svc, 'resources', resourceIds);
  }

  // `partners` is keyed by `name`; the rest carry a uuid `id`. Partners come
  // after resources because `resources.partner` is RESTRICT — a fixture
  // partner still referenced by a real resource is left alone and warned about.
  //
  // programmes, impact_stories and updates_log joined this list with
  // tests/rls/role-matrix.test.ts, which is the first suite to write to any
  // of them with stamped fixtures. The first two are not merely untidy if
  // left behind: programmes_public and impact_stories_public are both
  // anon-readable (tests/rls/public-views.test.ts's registry), so a stranded
  // fixture is invented content on a public page for a UN programme, which
  // is the exact failure CLAUDE.md's "never fabricate data" rule names.
  // updates_log is matched on `text` because that is its only NOT NULL
  // identifier column; that column is freer-form than the others here, so
  // note that FIXTURE_STAMP_RE's digit boundaries are what keep a real
  // update note containing a long number from being swept.
  for (const [table, columns, key] of [
    ['partners', ['name'], 'name'],
    ['partnerships', ['organisation'], 'id'],
    ['digest_sends', ['subject'], 'id'],
    ['contact_messages', ['name', 'email'], 'id'],
    ['subscribers', ['email'], 'id'],
    ['programmes', ['title'], 'id'],
    ['impact_stories', ['organisation'], 'id'],
    ['updates_log', ['text'], 'id'],
    // The two most fabrication-sensitive tables in the schema, and the last
    // to be swept. Both are anon-readable through headline_stats_public and
    // compute_metrics_public, and both carry NOT NULL source/attested_by/
    // attested_on -- so a row here is, by construction, a figure a named
    // person is recorded as having vouched for. A stranded fixture is not
    // untidy test data; it is an invented attested statistic on a UN
    // programme's public surface, which is CLAUDE.md's first hard rule.
    //
    // Until this entry existed, every suite touching them relied on its own
    // afterAll, so a run killed between insert and hook left one behind
    // permanently with nothing to reclaim it.
    //
    // Matched on `label` rather than `value`: value holds the figure itself
    // ('18', '4.2M'), which carries no stamp and could collide with real
    // content.
    ['headline_stats', ['label'], 'id'],
    ['compute_metrics', ['label'], 'id'],
  ] as const) {
    const ids = await idsMatching(svc, table, columns, key);
    if (ids.length > 0) tally[table] = await deleteIds(svc, table, ids, key);
  }

  tally['auth.users'] = await deleteFixtureUsers(svc);

  return tally;
}

/**
 * Throwaway auth users, which cascade to `profiles`.
 *
 * Paged in full for the same reason `findUserId` pages: the backlog this
 * function exists to clear is exactly what pushed the list past one page.
 */
async function deleteFixtureUsers(svc: SupabaseClient): Promise<number> {
  const doomed: string[] = [];
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listing auth users for cleanup: ${error.message}`);
    for (const user of data.users) {
      if (isFixtureValue(user.email)) doomed.push(user.id);
    }
    if (data.users.length < perPage) break;
    page += 1;
  }
  let removed = 0;
  for (const id of doomed) {
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) {
      console.warn(`[fixtures] could not delete auth user ${id}: ${error.message}`);
      continue;
    }
    removed += 1;
  }
  return removed;
}

/** Format a tally for a one-line run summary; empty when nothing was removed. */
export function describeTally(tally: CleanupTally): string {
  const parts = Object.entries(tally)
    .filter(([, n]) => n > 0)
    .map(([table, n]) => `${table} ${n}`);
  return parts.join(', ');
}
