/**
 * The one question every test-suite database client must answer first: is this
 * a local database?
 *
 * This lived in `fixtures.ts` and guarded only the fixture sweep. That was the
 * right place while the sweep was the only thing that deleted rows, and while
 * no cloud project existed. Both premises changed: `askhub-staging` is real,
 * and an audit for that deployment found the guard did not cover the suite
 * itself.
 *
 * The gap, precisely. `vitest.config.ts` loads `.env.test` with
 * `override: true`, so an exported shell variable cannot redirect a run -- that
 * half holds. But `tests/helpers/clients.ts` built `serviceClient()` from
 * `process.env.SUPABASE_URL` with no check at all, and
 * `tests/helpers/global-setup.ts` caught the sweep's refusal and merely
 * `console.warn`ed it. So a `.env.test` pointing at a remote project would
 * decline to sweep, print one warning above the summary, and then run the whole
 * RLS suite -- which inserts, updates and deletes with the `service_role` key,
 * bypassing RLS -- against that project. The only thing standing in the way was
 * the contents of one gitignored file.
 *
 * It lives in its own module because `fixtures.ts` imports `serviceClient` from
 * `clients.ts`, so `clients.ts` cannot import back from `fixtures.ts` without a
 * cycle. Both now import from here.
 */

/** Hostnames that mean "the stack on this machine". */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

/**
 * Thrown for a non-local target specifically, so callers can tell "pointed at
 * the wrong database" from "the local database is not answering". The first
 * must stop a run; the second is ordinary local trouble.
 */
export class RemoteDatabaseError extends Error {
  readonly hostname: string;

  constructor(hostname: string, context: string) {
    super(
      `${context}: refusing to run against non-loopback host ${hostname}. The test suite ` +
        `writes with the service_role key, which bypasses RLS, so a remote target would be ` +
        `mutated directly. Point SUPABASE_URL in .env.test at a local stack. There is no ` +
        `confirmation flag for this.`,
    );
    this.name = 'RemoteDatabaseError';
    this.hostname = hostname;
  }
}

/**
 * Refuse anything but a local database.
 *
 * Compares the parsed hostname rather than substring-matching, so
 * `https://localhost.example.com` is refused. Deliberately no escape hatch:
 * `scripts/seed.ts` and `scripts/provision-admins.ts` accept
 * `SEED_CONFIRM_REMOTE=1` because seeding a remote project is a real
 * intention, but running the test suite against one never is.
 */
export function assertLoopbackTarget(
  rawUrl = process.env.SUPABASE_URL,
  context = 'test database target',
): void {
  if (!rawUrl) {
    throw new Error(`${context}: SUPABASE_URL is not set. Refusing to run against an unknown target.`);
  }
  let hostname: string;
  try {
    hostname = new URL(rawUrl).hostname;
  } catch {
    throw new Error(`${context}: SUPABASE_URL is not a valid URL: ${rawUrl}`);
  }
  if (!LOOPBACK_HOSTS.has(hostname)) {
    throw new RemoteDatabaseError(hostname, context);
  }
}
