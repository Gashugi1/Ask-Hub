/**
 * Plain helpers for `src/lib/actions/resources.ts`, kept in a module with no
 * `'use server'` directive. A `'use server'` file may only export async
 * functions — Next enforces this at build time ("Server Actions must be
 * async functions") — so a synchronous helper like this one cannot live
 * there and still be exported for a unit test to import directly.
 *
 * Every helper here is synchronous, and that is now a rule rather than a
 * coincidence: `tests/structure/action-role-checks.test.ts` treats every
 * exported async function under `src/lib/actions` as a server action and
 * requires it to open with `requireRole`. A helper that needs the database
 * belongs on the other side of that line — the reader layer
 * (`src/lib/admin/readers.ts`) fetches, and the function here decides.
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

/** Postgres `foreign_key_violation`, as PostgREST forwards it in `error.code`. */
const FOREIGN_KEY_VIOLATION = '23503';

/** The constraint 0014_partner_logos.sql put on `resources.partner`. */
const PARTNER_FK = 'resources_partner_fkey';
const UNIQUE_VIOLATION = '23505';
/** `unique (partner, name)`, from 0013_reconcile_partners.sql. */
const PARTNER_NAME_KEY = 'resources_partner_name_key';

/**
 * What a caller is told when the partner they submitted is not in `partners`.
 *
 * One function so the pre-flight check below and the constraint-violation
 * translation say the same thing, and so a test can assert the message
 * without copying its wording. It names the offending value and the remedy,
 * which `insert or update on table "resources" violates foreign key
 * constraint "resources_partner_fkey"` does neither of.
 *
 * This is the *server's* message: the server log, and a developer running
 * locally. It is not the channel the admin screen uses — Next replaces the
 * message of an error thrown out of a server action with an opaque digest
 * before it reaches the browser in production, so `ResourceForm` produces the
 * localised equivalent itself from `src/locales/en.json` rather than reading
 * anything off the thrown error. Deliberately not routed through `t()`: this
 * string is not user-facing copy in the i18n sense, and a server action's
 * thrown message has no locale to resolve against.
 */
export function unknownPartnerMessage(partner: string): string {
  return `"${partner}" is not a known partner — choose one from the list`;
}

/**
 * Refuse a resource write whose `partner` names no row in `partners`.
 *
 * `resources.partner` is `text not null references partners(name)`
 * (0014_partner_logos.sql). `resourceInput` checks the shape of that string —
 * trimmed, non-empty, at most 200 characters — and can check nothing about
 * whether it names a row, having no database access, so before this check the
 * first thing to object to `partner: "Googel"` was Postgres, and its message
 * reached the operator as a generic failure. Zod cannot take this over:
 * `resourceInput` is imported by `ResourceForm`, a client component that calls
 * `safeParse` synchronously in the browser, and a refinement that has to be
 * awaited cannot run there at all.
 *
 * The select on the form is UX; this is the check. CLAUDE.md: UI gating is
 * not security, and a server action can be invoked directly with any string
 * in the field.
 *
 * `known` comes from `readPartnerNames()`, which reads on the caller's own
 * RLS-bound client — the same query the form's select is built from, so the
 * two cannot disagree about what counts as a partner. They are still separate
 * reads: the list can change between the page render and the save, which is
 * the whole reason the form's copy of this check is not the only one. Two
 * further consequences, stated rather than left to be discovered:
 *
 *  - Membership is exact JavaScript string equality, and nothing here folds
 *    case or trims (`resourceInput` has already trimmed). That agrees with the
 *    constraint: `partners.name` is the primary key under this database's
 *    `default` collation, which is deterministic, so Postgres compares it
 *    byte-for-byte too and a partner differing only in case is a different row.
 *  - A row the caller's role cannot SELECT is treated as not existing, while a
 *    foreign-key check inside Postgres is not subject to RLS. Today no such
 *    row exists: `partners_select_authenticated` admits every staff role. A
 *    narrower policy later would make this refuse a partner the constraint
 *    would have accepted.
 *
 * Not a substitute for handling the constraint violation itself, and not
 * claimed to be: a partner not yet referenced by any resource can be deleted
 * between that read and the insert. `resourceWriteError` below covers the
 * window.
 */
export function assertKnownPartner(partner: string, known: readonly string[]): void {
  if (!known.includes(partner)) throw new Error(unknownPartnerMessage(partner));
}

/**
 * The error to throw for a failed resource insert or update.
 *
 * Only one database failure has a better wording than its own: a violation of
 * `resources_partner_fkey` means the submitted partner does not exist, and
 * saying so is actionable where the raw constraint text is not. Everything
 * else keeps the existing `<action> failed: <message>` shape — guessing at a
 * friendlier phrasing for a constraint this function does not recognise would
 * be inventing a diagnosis.
 *
 * Why both the code and the constraint name, when `resources.partner` is the
 * only foreign key `resources` has today and the code alone would in fact be
 * enough: so that it is still enough after the second one is added. The pair
 * is what keeps this from renaming an unrelated referential failure into a
 * confident, wrong statement about the partner.
 *
 * The name is matched against the message text because PostgREST does not
 * surface `constraint_name` as a field of its own; Postgres puts it in the
 * message (`... violates foreign key constraint "resources_partner_fkey"`).
 * `details` is checked as well, defensively — for this violation it holds the
 * offending key rather than the constraint name, so it is the message that
 * does the work today.
 */
export function resourceWriteError(
  action: string,
  error: { code?: string | null; message: string; details?: string | null },
  partner: string,
  name?: string,
): Error {
  const mentionsPartnerFk =
    (error.message ?? '').includes(PARTNER_FK) || (error.details ?? '').includes(PARTNER_FK);
  if (error.code === FOREIGN_KEY_VIOLATION && mentionsPartnerFk) {
    return new Error(unknownPartnerMessage(partner));
  }
  if (isDuplicateResource(error)) {
    return new Error(duplicateResourceMessage(partner, name ?? ''));
  }
  return new Error(`${action} failed: ${error.message}`);
}

/**
 * Whether a failed write collided with `unique (partner, name)`.
 *
 * Matched on the code *and* the constraint name for the same reason
 * `resourceWriteError` matches the foreign key that way: `resources` may grow
 * a second unique constraint, and the pair is what stops this reporting an
 * unrelated collision as "this resource already exists".
 *
 * Returns a boolean rather than a message because the bulk import needs to
 * decide per row -- it reports a *code* the client renders through `t()`,
 * since Next replaces a thrown message with an opaque digest in production.
 */
export function isDuplicateResource(error: {
  code?: string | null;
  message: string;
  details?: string | null;
}): boolean {
  const mentionsKey =
    (error.message ?? '').includes(PARTNER_NAME_KEY) ||
    (error.details ?? '').includes(PARTNER_NAME_KEY);
  return error.code === UNIQUE_VIOLATION && mentionsKey;
}

export function duplicateResourceMessage(partner: string, name: string): string {
  return `"${name}" already exists for ${partner}`;
}
