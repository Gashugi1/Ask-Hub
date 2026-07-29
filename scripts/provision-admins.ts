/**
 * Provisioning is the only path to a user (PRD §3 and §14.3): there is no
 * public sign-up route, and signup is disabled at the Supabase project level
 * (see supabase/config.toml, guarded by tests/structure/env-contract.test.ts).
 * This script creates the initial admin accounts directly against the Auth
 * admin API using the service_role key.
 *
 * The operator supplies each new admin's password interactively (hidden,
 * asked twice, validated locally against supabase/config.toml's password
 * policy before it is ever sent to the Auth API). There is no generated
 * secret: the script never prints, logs, or writes a password anywhere,
 * because there is nothing of that kind to print -- the operator already
 * knows the password they typed. An email that is already registered is
 * promoted to admin instead of re-created, and no password is collected for
 * it, since one would never be used.
 *
 * No `@/*` imports here: vitest aliases `@` to `./src`, but `tsx` does not,
 * so a module that typechecks and passes tests would still crash at runtime.
 * The Supabase client is built inline from `@supabase/supabase-js`.
 *
 * Usage: npx tsx scripts/provision-admins.ts admin1@example.org admin2@example.org
 */
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';

// Same override variable as the rest of the project's scripts/tests use to
// pick an env file, defaulted the way the seed's contract requires: reading
// SUPABASE_URL ?? NEXT_PUBLIC_SUPABASE_URL while defaulting to .env.local (the
// dev stack's file), not .env.test (the test stack's file) -- the two must
// not be keyed off the same override variable with different defaults, or one
// setting is guaranteed wrong for the other.
const envFile = process.env.SEED_ENV_FILE ?? '.env.local';
loadEnv({ path: envFile });

function fail(message: string): never {
  console.error(`provision-admins: ${message}`);
  process.exit(1);
}

/**
 * Thrown by per-email provisioning steps instead of exiting immediately, so
 * `main()` can report which emails already succeeded -- and already hold a
 * real, promoted account -- before the process ends.
 */
class ProvisionStepError extends Error {}

function stepFail(message: string): never {
  throw new ProvisionStepError(message);
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

// Provisioning against production is possible but never accidental: refuse
// any non-loopback host unless explicitly confirmed.
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

const emails = process.argv.slice(2).filter((value) => value.length > 0);
if (emails.length < 2) {
  fail(
    `at least two admin emails are required, got ${emails.length}. ` +
      'PRD §3: a single admin is a lockout risk -- one deactivation or one ' +
      'lost credential would strand the tenant with no way to self-recover.',
  );
}

// Provisioning an admin is a deliberate human act: the operator must be
// present to type each password. A pipe, redirect, or CI runner reaching
// this line has no operator behind it, so refuse loudly now rather than
// hanging on a prompt that will never be answered, or silently reading
// piped bytes as if they were a typed password.
if (!process.stdin.isTTY) {
  fail(
    'stdin is not a terminal. This script collects admin passwords ' +
      'interactively and refuses to run where there is no operator present ' +
      'to type them -- piping input, redirecting from a file, and running ' +
      'under CI are all refused for the same reason.',
  );
}

const client = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// supabase/config.toml is the source of truth for both of these values
// (`minimum_password_length` and `password_requirements =
// "lower_upper_letters_digits_symbols"`). Hardcoded here, with this comment
// naming the file, rather than parsed at runtime: this project has no TOML
// parser dependency, and adding one is out of scope for this script. If
// config.toml's policy ever changes, this constant and the checks below must
// change with it.
const MIN_PASSWORD_LENGTH = 12;

/**
 * Checks a candidate password against supabase/config.toml's policy before
 * it is ever sent to the Auth API. Returns undefined when the password is
 * acceptable, or a message naming the single unmet requirement otherwise --
 * checked in a fixed order so the operator sees one concrete thing to fix at
 * a time rather than a generic rejection after they've already typed it
 * twice.
 */
function passwordProblem(password: string): string | undefined {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `must be at least ${MIN_PASSWORD_LENGTH} characters (got ${password.length})`;
  }
  if (!/[a-z]/.test(password)) return 'must contain a lowercase letter';
  if (!/[A-Z]/.test(password)) return 'must contain an uppercase letter';
  if (!/[0-9]/.test(password)) return 'must contain a digit';
  if (!/[^A-Za-z0-9]/.test(password)) return 'must contain a symbol';
  return undefined;
}

/**
 * Reads one line from stdin without echoing it to the terminal. Node has no
 * built-in hidden-input primitive, so this mutes the terminal manually: raw
 * mode delivers keystrokes to the process one at a time instead of letting
 * the OS's tty driver echo and line-buffer them, so a character is only ever
 * added to `value` in memory -- it is never written back to the screen.
 *
 * Restoring raw mode is not optional and is guaranteed on every exit from
 * this function -- a normal Enter, a stream error, or Ctrl-C -- by funnelling
 * every path through the single `finish()` closure below before the promise
 * ever settles. A script that exits with raw mode still on leaves the
 * operator's shell producing no visible input until they run `stty sane`,
 * which is its own support ticket and unrelated to whatever actually failed.
 */
function readHiddenLine(promptText: string): Promise<string> {
  const stdin = process.stdin;
  process.stdout.write(promptText);

  return new Promise<string>((resolve, reject) => {
    let value = '';
    let settled = false;

    const finish = (outcome: { ok: true; value: string } | { ok: false; error: Error }) => {
      if (settled) return;
      settled = true;
      stdin.removeListener('data', onData);
      stdin.removeListener('error', onStreamError);
      process.removeListener('SIGINT', onSigint);
      // Unconditional restore, before either resolve/reject or process.exit
      // below runs, so the terminal is never left echo-disabled regardless
      // of which of the three paths (Enter, stream error, Ctrl-C) got here.
      if (stdin.isTTY) stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write('\n');
      if (outcome.ok) resolve(outcome.value);
      else reject(outcome.error);
    };

    // Ctrl-C arrives as a raw 0x03 byte, not a SIGINT, while raw mode is on
    // (raw mode is precisely what disables the tty driver's normal
    // translation of that keystroke into a signal). A SIGINT can still
    // arrive independently of the keystroke -- e.g. an external `kill -INT`
    // -- so both are handled and both restore the terminal the same way
    // before exiting.
    const onSigint = () => {
      finish({ ok: false, error: new Error('interrupted') });
      process.exit(130);
    };
    const onStreamError = (error: Error) => {
      finish({ ok: false, error });
    };
    const onData = (chunk: Buffer) => {
      for (const char of chunk.toString('utf8')) {
        if (char === '') {
          onSigint();
          return;
        }
        if (char === '\r' || char === '\n') {
          finish({ ok: true, value });
          return;
        }
        if (char === '' || char === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };

    process.on('SIGINT', onSigint);
    stdin.on('error', onStreamError);
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.on('data', onData);
  });
}

/**
 * Collects one admin's password interactively: hidden, asked twice, checked
 * against passwordProblem() before the confirmation prompt even runs so a
 * doomed password doesn't cost the operator a second hidden entry, and
 * re-prompted (not aborted) on either a validation failure or a mismatch --
 * a typo here is a lockout on the only path to a user, and the operator
 * cannot discover it until a sign-in attempt fails later.
 */
async function promptNewPassword(email: string): Promise<string> {
  for (;;) {
    const password = await readHiddenLine(`  Password for ${email}: `);
    const problem = passwordProblem(password);
    if (problem) {
      console.log(`    rejected: ${problem}. Try again.`);
      continue;
    }
    const confirmation = await readHiddenLine(`  Confirm password for ${email}: `);
    if (confirmation !== password) {
      console.log('    passwords did not match. Try again.');
      continue;
    }
    return password;
  }
}

async function findUserIdByEmail(email: string): Promise<string | undefined> {
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) stepFail(`listUsers failed while looking up ${email}: ${error.message}`);
    const found = data.users.find((u) => u.email === email);
    if (found) return found.id;
    if (data.users.length < perPage) return undefined;
    page += 1;
  }
}

/**
 * `handle_new_user()` (supabase/migrations/0003_profiles.sql) mints the
 * `profiles` row on `auth.users` insert. Immediately reading it back assumes
 * that trigger has already committed, which is not guaranteed. Retry briefly
 * rather than failing outright, and if the row still never appears, say so
 * plainly instead of continuing as if it had.
 */
async function waitForProfileId(userId: string, email: string): Promise<string> {
  const attempts = 5;
  const delayMs = 250;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const { data, error } = await client
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) stepFail(`profiles lookup failed for ${email}: ${error.message}`);
    if (data) return data.id;
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  stepFail(
    `profiles row for ${email} (user_id ${userId}) never appeared after ` +
      `${attempts} attempts. handle_new_user() may be missing or failing -- ` +
      'this user exists in auth.users with no matching profile and needs manual attention.',
  );
}

interface ProvisionResult {
  email: string;
  outcome: 'created' | 'promoted';
}

async function provisionOne(email: string): Promise<ProvisionResult> {
  // Checked up front, before any password is collected: an email that
  // already has an account is promoted, not re-created, so a password
  // collected for it would be silently discarded. Prompting only on the
  // branch where the password is actually used is what keeps the prompt
  // meaningful to the operator.
  const existingId = await findUserIdByEmail(email);

  let userId: string;
  let outcome: ProvisionResult['outcome'];

  if (existingId) {
    userId = existingId;
    outcome = 'promoted';
  } else {
    const password = await promptNewPassword(email);

    // createUser, not inviteUserByEmail: an invite requires a working mail
    // provider, and SPF/DKIM has not landed for this project yet. The
    // operator-supplied password above is the only path that works today.
    const created = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (created.error) {
      // "Already registered" is an expected outcome here too: the lookup
      // above is not atomic with this call, so a narrow race is possible
      // where the account was created between the two. Handle it the same
      // way as the up-front check -- promote, don't error -- and simply
      // discard the password just collected for this one race-window case,
      // rather than treating it as a hard failure.
      //
      // Checked against `.code` first: GoTrue's documented, versioned
      // `ErrorCode` union (@supabase/auth-js error-codes.d.ts) includes
      // `email_exists` and `user_already_exists` for exactly this case. Verified
      // empirically against the installed @supabase/supabase-js@2.110.8 on the
      // local stack: calling createUser with an email that already exists
      // returns `{ code: 'email_exists', message: 'A user with this email
      // address has already been registered' }`. The message text is rendered
      // by the Auth server, not the SDK, so it can be rephrased by a Supabase
      // Auth upgrade independently of this package's version -- the message
      // regex below is kept only as a documented fallback for an older Auth
      // server that does not populate `code` at all.
      const isAlreadyRegistered =
        created.error.code === 'email_exists' ||
        created.error.code === 'user_already_exists' ||
        created.error.code === 'identity_already_exists' ||
        /already been registered|already exists/i.test(created.error.message);
      if (!isAlreadyRegistered) {
        stepFail(`createUser failed for ${email}: ${created.error.message}`);
      }
      const raceId = await findUserIdByEmail(email);
      if (!raceId) {
        stepFail(`${email} was reported already registered but could not be found via listUsers`);
      }
      userId = raceId;
      outcome = 'promoted';
    } else {
      // Null-check before dereferencing: createUser resolving without an error
      // is not itself a guarantee the user payload is present.
      if (!created.data.user) {
        stepFail(`createUser for ${email} returned no error but no user either`);
      }
      userId = created.data.user.id;
      outcome = 'created';
    }
  }

  const profileId = await waitForProfileId(userId, email);
  const { error: updateError } = await client
    .from('profiles')
    .update({ role: 'admin', is_active: true })
    .eq('id', profileId);
  if (updateError) stepFail(`promoting ${email} to admin failed: ${updateError.message}`);

  return { email, outcome };
}

function printResult(result: ProvisionResult): void {
  if (result.outcome === 'created') {
    console.log(`  ${result.email}: created`);
  } else {
    console.log(`  ${result.email}: already existed, promoted to admin`);
  }
}

async function main() {
  const results: ProvisionResult[] = [];
  console.log('Provisioning admins:');
  for (const email of emails) {
    let result: ProvisionResult;
    try {
      result = await provisionOne(email);
    } catch (error) {
      const stepMessage = error instanceof ProvisionStepError ? error.message : undefined;
      const provisioned = results.map((r) => r.email);
      fail(
        `provisioning ${email} failed: ` +
          (stepMessage ?? (error instanceof Error ? error.message : String(error))) +
          (provisioned.length > 0
            ? `\nPartial run: ${provisioned.join(', ')} ${
                provisioned.length === 1 ? 'was' : 'were'
              } already provisioned and promoted to admin before this failure. ` +
              'That account is real and was not rolled back -- do not attempt to ' +
              're-provision it, and do not assume this run left no trace.'
            : '\nNo accounts were provisioned before this failure.'),
      );
    }
    printResult(result);
    results.push(result);
  }

  const { count, error: countError } = await client
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin')
    .eq('is_active', true);
  if (countError) fail(`could not verify the active-admin floor: ${countError.message}`);

  const activeAdminCount = count ?? 0;
  console.log(`\nActive admins after this run: ${activeAdminCount}`);
  if (activeAdminCount < 2) {
    fail(
      `only ${activeAdminCount} active admin(s) exist after this run. PRD §3 ` +
        'requires at least two so a single deactivation or lost credential ' +
        'cannot strand the tenant with no way to self-recover.',
    );
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
