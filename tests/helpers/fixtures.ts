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

/** The stamp every fixture name should carry. Use this, not a bare `Date.now()`. */
export function fixtureStamp(): number {
  return Date.now();
}

/** Whether a value looks like a fixture identifier this module owns. */
export function isFixtureValue(value: string | null | undefined): boolean {
  return typeof value === 'string' && FIXTURE_STAMP_RE.test(value);
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
  for (const [table, columns, key] of [
    ['partners', ['name'], 'name'],
    ['partnerships', ['organisation'], 'id'],
    ['digest_sends', ['subject'], 'id'],
    ['contact_messages', ['name', 'email'], 'id'],
    ['subscribers', ['email'], 'id'],
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
