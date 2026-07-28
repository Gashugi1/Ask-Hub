import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const anonKey = process.env.SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export type Role = 'admin' | 'editor' | 'viewer';

export const TEST_USERS: Record<Role, { email: string; password: string }> = {
  admin: { email: 'rls-admin@askhub.test', password: 'Rls-Test-Passw0rd-A!' },
  editor: { email: 'rls-editor@askhub.test', password: 'Rls-Test-Passw0rd-E!' },
  viewer: { email: 'rls-viewer@askhub.test', password: 'Rls-Test-Passw0rd-V!' },
};

export function anonClient(): SupabaseClient {
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

export function serviceClient(): SupabaseClient {
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/**
 * Create the three role users if absent and force their profile role.
 * Idempotent: safe to call from every suite's beforeAll.
 */
export async function ensureTestUsers(): Promise<void> {
  const svc = serviceClient();
  for (const role of Object.keys(TEST_USERS) as Role[]) {
    const { email, password } = TEST_USERS[role];
    const created = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    // createUser's error is not merely advisory: a genuine failure (weak
    // password rejected, auth service misconfigured) must not be silently
    // swallowed and surface later as a confusing "could not resolve test
    // user". "Already exists" is the expected idempotent path on every run
    // after the first; anything else is a real failure and must throw.
    if (created.error && !/already been registered|already exists/i.test(created.error.message)) {
      throw new Error(`createUser failed for ${email}: ${created.error.message}`);
    }
    const userId =
      created.data.user?.id ??
      (await findUserId(svc, email));
    if (!userId) throw new Error(`could not resolve test user ${email}`);
    const { error } = await svc
      .from('profiles')
      .update({ role, is_active: true })
      .eq('user_id', userId);
    if (error) throw error;
  }
}

async function findUserId(
  svc: SupabaseClient,
  email: string,
): Promise<string | undefined> {
  // Fixture users from later suites are suffixed with Date.now(), so the
  // user list grows past a single page once the stack has run for a while
  // without a db:reset. Page through fully rather than assuming the target
  // is on page 1, or the lookup silently returns undefined.
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data } = await svc.auth.admin.listUsers({ page, perPage });
    const found = data.users.find((u) => u.email === email);
    if (found) return found.id;
    if (data.users.length < perPage) return undefined;
    page += 1;
  }
}

/** A client authenticated as the given role. */
export async function roleClient(role: Role): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword(TEST_USERS[role]);
  if (error) throw error;
  return client;
}
