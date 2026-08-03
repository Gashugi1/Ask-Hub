import { cleanupFixtures, describeTally } from './fixtures';

/**
 * Remove fixture rows before and after every run.
 *
 * Before, because a run that crashes or is interrupted never reaches its own
 * teardown, and the next run should still start from a clean database rather
 * than inheriting the wreckage. After, because that is the normal path.
 *
 * Running in `globalSetup` rather than a per-file `afterAll` is deliberate:
 * the leak spans eleven tables plus auth.users, and a per-file hook only
 * ever cleans what that file remembered to track. Driving cleanup from the
 * fixture-name pattern instead catches rows whose creating suite has since
 * been deleted, rows left by a run that was killed, and rows a future suite
 * creates without knowing this file exists.
 *
 * Failures here are reported and swallowed. Housekeeping must not turn a
 * green suite red, and a database that cannot be reached will fail the DB
 * suites themselves with a far clearer message.
 */

async function sweep(when: 'before' | 'after'): Promise<void> {
  try {
    const tally = await cleanupFixtures();
    const summary = describeTally(tally);
    if (summary) console.log(`[fixtures] cleared ${when} run: ${summary}`);
  } catch (error) {
    console.warn(`[fixtures] cleanup ${when} run failed: ${(error as Error).message}`);
  }
}

export async function setup(): Promise<void> {
  await sweep('before');
}

export async function teardown(): Promise<void> {
  await sweep('after');
}
