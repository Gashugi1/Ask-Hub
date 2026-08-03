import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureTestUsers, roleClient, serviceClient } from '../helpers/clients';
import { fixtureStamp } from '../helpers/fixtures';
import { EXPIRING_SOON_DAYS } from '@/lib/deadline';

/**
 * `readResourceCounts` builds its client with `createAdminReadClient()`,
 * which resolves the caller from `next/headers`'s `cookies()` and therefore
 * has no meaning outside a Next request. Only that construction step is
 * replaced, and it is replaced with a client signed in as the admin test
 * user — *not* the service_role client, which would bypass RLS and make this
 * suite prove the count against rows the real screen might not be allowed to
 * see. Everything downstream is the real thing: real SQL against the local
 * database, the real `deadlineInfo` call, the real arithmetic.
 */
let cached: Promise<SupabaseClient> | null = null;
vi.mock('@/lib/admin/client', () => ({
  createAdminReadClient: () => (cached ??= roleClient('admin')),
}));

const { readResourceCounts } = await import('@/lib/admin/readers');

/**
 * The AI Hub admin Dashboard's fourth card, "Deadlines within 14 days"
 * (src/app/(admin)/admin/page.tsx:24), is `EXPIRING_SOON_DAYS` reaching a
 * leadership reporting surface. Until this suite it was the one consumer of
 * `src/lib/deadline.ts` with no coverage at all: `filterAdminResources`'s
 * Expiring tab is pinned by tests/unit/admin-resource-view.test.ts, but
 * nothing exercised `readResourceCounts`, which asks `deadlineInfo` the same
 * question through a second, independent call site.
 *
 * Asserted as deltas, never as absolutes. The local database holds seeded
 * content plus whatever other suites have inserted, so an absolute count
 * would be asserting fixture data — and, under CLAUDE.md's never-fabricate
 * rule, a hardcoded expected total on a reporting figure is exactly the
 * wrong habit to encode in a test.
 */
describe('the admin dashboard expiring-soon count', () => {
  const createdIds: string[] = [];
  const stamp = fixtureStamp();

  function inDays(days: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  async function insertResource(name: string, deadline: string | null): Promise<void> {
    const { data, error } = await serviceClient()
      .from('resources')
      .insert({
        name,
        partner: 'Public View Partner',
        partner_tier: 'strategic',
        resource_type: 'Credits',
        need_primary: 'compute',
        description: 'dashboard count fixture',
        external_url: 'https://example.org/dashboard-count',
        status: 'live',
        deadline,
      })
      .select('id')
      .single();
    if (error) throw error;
    createdIds.push(data!.id as string);
  }

  beforeAll(async () => {
    await ensureTestUsers();
    const { error } = await serviceClient()
      .from('partners')
      .upsert({ name: 'Public View Partner' }, { onConflict: 'name', ignoreDuplicates: true });
    if (error) throw error;
  });

  afterAll(async () => {
    if (createdIds.length === 0) return;
    await serviceClient().from('resources').delete().in('id', createdIds);
  });

  it('counts a deadline exactly 14 days out and stops at 15', async () => {
    const before = await readResourceCounts();

    await insertResource(`Dashboard boundary in ${EXPIRING_SOON_DAYS} ${stamp}`, inDays(EXPIRING_SOON_DAYS));
    const atBoundary = await readResourceCounts();
    // The inclusive edge of EXPIRING_SOON_DAYS, read off the dashboard's own
    // reader rather than off deadlineInfo directly.
    expect(atBoundary.expiringSoon).toBe(before.expiringSoon + 1);
    // Proves the reader is actually seeing the new row, so the +0 assertion
    // below cannot be satisfied by RLS hiding everything from this client.
    expect(atBoundary.live).toBe(before.live + 1);

    await insertResource(`Dashboard past boundary ${stamp}`, inDays(EXPIRING_SOON_DAYS + 1));
    const beyond = await readResourceCounts();
    expect(beyond.expiringSoon).toBe(atBoundary.expiringSoon);
    expect(beyond.live).toBe(atBoundary.live + 1);
  });

  it('counts neither a closed deadline nor a rolling one as expiring soon', async () => {
    const before = await readResourceCounts();

    await insertResource(`Dashboard already closed ${stamp}`, inDays(-1));
    await insertResource(`Dashboard rolling ${stamp}`, null);
    const after = await readResourceCounts();

    // A past deadline is Closed, not Expiring soon, and it stays `live` —
    // CLAUDE.md's status rule seen from the counting side: the closed row
    // still lands in the `live` tally.
    expect(after.expiringSoon).toBe(before.expiringSoon);
    expect(after.live).toBe(before.live + 2);
  });
});
