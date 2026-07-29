/**
 * Provisioning is the only path to a user (PRD §3 and §14.3): there is no
 * public sign-up route, and signup is disabled at the Supabase project level
 * (see supabase/config.toml, guarded by tests/structure/env-contract.test.ts).
 * This script creates the initial admin accounts directly against the Auth
 * admin API using the service_role key.
 *
 * No `@/*` imports here: vitest aliases `@` to `./src`, but `tsx` does not,
 * so a module that typechecks and passes tests would still crash at runtime.
 * The Supabase client is built inline from `@supabase/supabase-js`.
 *
 * Usage: npx tsx scripts/provision-admins.ts admin1@example.org admin2@example.org
 */
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { randomBytes } from 'node:crypto';

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
 * real, promoted account with a password printed -- before the process ends.
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

const client = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Meets supabase/config.toml's password_requirements (PRD 14.3-adjacent). */
function generatePassword(length = 20): string {
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%^&*-_=+?';
  const pick = (chars: string) => chars[randomBytes(1)[0]! % chars.length]!;

  const required = [pick(lower), pick(upper), pick(digits), pick(symbols)];
  const rest = Array.from({ length: Math.max(length - required.length, 0) }, () =>
    pick(lower + upper + digits + symbols),
  );
  const combined = [...required, ...rest];
  // Fisher-Yates using the same CSPRNG, so position doesn't leak which
  // characters were the "required" ones.
  for (let i = combined.length - 1; i > 0; i -= 1) {
    const j = randomBytes(1)[0]! % (i + 1);
    [combined[i], combined[j]] = [combined[j]!, combined[i]!];
  }
  return combined.join('');
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
  password?: string;
}

async function provisionOne(email: string): Promise<ProvisionResult> {
  // createUser, not inviteUserByEmail: an invite requires a working mail
  // provider, and SPF/DKIM has not landed for this project yet. A generated
  // password delivered out-of-band is the only path that works today.
  const password = generatePassword();
  const created = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  let userId: string;
  let outcome: ProvisionResult['outcome'];

  if (created.error) {
    // "Already registered" is an expected outcome, not a failure: the email
    // was provisioned before, and this run should promote, not error.
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
    // regex below is kept only as a fallback for an older Auth server that
    // does not populate `code` at all.
    const isAlreadyRegistered =
      created.error.code === 'email_exists' ||
      created.error.code === 'user_already_exists' ||
      created.error.code === 'identity_already_exists' ||
      /already been registered|already exists/i.test(created.error.message);
    if (!isAlreadyRegistered) {
      stepFail(`createUser failed for ${email}: ${created.error.message}`);
    }
    const existingId = await findUserIdByEmail(email);
    if (!existingId) {
      stepFail(`${email} was reported already registered but could not be found via listUsers`);
    }
    userId = existingId;
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

  const profileId = await waitForProfileId(userId, email);
  const { error: updateError } = await client
    .from('profiles')
    .update({ role: 'admin', is_active: true })
    .eq('id', profileId);
  if (updateError) stepFail(`promoting ${email} to admin failed: ${updateError.message}`);

  return { email, outcome, password: outcome === 'created' ? password : undefined };
}

function printResult(result: ProvisionResult): void {
  if (result.outcome === 'created') {
    console.log(`  ${result.email}: created`);
    // Printed once, to stdout only, immediately after this email's own
    // provisioning succeeds -- never written to a file, never logged a
    // second time, and never batched until the end. A later email's failure
    // must not cost this password its only printed copy: the account this
    // password belongs to is already real and already promoted to admin by
    // the time this line runs.
    console.log(`    temporary password: ${result.password}`);
    console.log(
      '    Deliver this password securely (not by plain email) and require ' +
        'a change at first sign-in.',
    );
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
