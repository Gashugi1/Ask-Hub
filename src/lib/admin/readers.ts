import 'server-only';
import { createAdminReadClient } from './client';
import { deadlineInfo } from '@/lib/deadline';

export interface ResourceCounts {
  live: number;
  pipeline: number;
  reference: number;
  expiringSoon: number;
}

/**
 * Uncached, deliberately. Admin reads are per-request: an editor who has just
 * saved must see their own write, and `unstable_cache` here would serve them
 * the row they just replaced. Caching belongs to the public surface, which is
 * the same read for every visitor.
 *
 * These four numbers are counted from `resources` and are therefore real.
 * Nothing on the Dashboard may show a figure that is not (CLAUDE.md).
 */
export async function readResourceCounts(): Promise<ResourceCounts> {
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase.from('resources').select('status, deadline');
  if (error) throw new Error(`admin read failed (resources): ${error.message}`);

  const rows = data ?? [];
  return {
    live: rows.filter((r) => r.status === 'live').length,
    pipeline: rows.filter((r) => r.status === 'pipeline').length,
    reference: rows.filter((r) => r.status === 'reference').length,
    // deadlineInfo returns a four-value `state`, not booleans:
    // 'rolling' | 'open' | 'expiring' | 'closed', with EXPIRING_SOON_DAYS = 14.
    // Use it; do not re-implement the 14-day rule here.
    expiringSoon: rows.filter((r) => deadlineInfo(r.deadline).state === 'expiring').length,
  };
}
