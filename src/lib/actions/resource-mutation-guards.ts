/**
 * Plain helpers for `src/lib/actions/resources.ts`, kept in a module with no
 * `'use server'` directive. A `'use server'` file may only export async
 * functions — Next enforces this at build time ("Server Actions must be
 * async functions") — so a synchronous helper like this one cannot live
 * there and still be exported for a unit test to import directly.
 */

/**
 * PostgREST returns `{ error: null, status: 204 }` for an UPDATE or DELETE
 * whose `.eq('id', ...)` matches zero rows — a missing id and an RLS refusal
 * both look exactly like this, with no error to catch. Without checking the
 * row count, `updateResource`/`deleteResource`/`setResourceStatus`/
 * `setResourceFeatured` would report success, evict the cache tag, and let
 * `ResourceForm` navigate away as though the save landed, for a write that
 * changed nothing — reachable today through a stale tab or a concurrent
 * delete. `.select('id')` on the mutation makes the affected rows visible so
 * this can be checked; the message deliberately does not claim the row was
 * missing, since it may instead have been refused by RLS — this function
 * cannot and must not guess which, so it reports only what is true of both.
 */
export function assertRowAffected(action: string, rows: readonly { id: string }[] | null): void {
  if (!rows || rows.length === 0) {
    throw new Error(
      `${action} affected no row: the resource may not exist, or the write may not be permitted`,
    );
  }
}
