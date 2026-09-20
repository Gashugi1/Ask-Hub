'use server';

import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase/server';
import { suggestionInput, composeSuggestionDescription } from '@/lib/schemas/suggestion';

export type SuggestionOutcome =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'rateLimited' | 'failed' };

/** Postgres errcodes the function raises: invalid_parameter_value, program_limit_exceeded. */
const INVALID = '22023';
const RATE_LIMITED = '54000';

/**
 * A keyed hash of the caller's address, for the function's per-network
 * limit. The address itself is never stored (PRD 4.5), and the hash is
 * keyed with `SUBMISSION_IP_PEPPER` so a stored hash cannot be reversed by
 * hashing the IPv4 space. With no pepper configured the hash is omitted
 * rather than computed unkeyed, and the per-address and global limits still
 * hold.
 */
async function sourceIpHash(): Promise<string> {
  const pepper = process.env.SUBMISSION_IP_PEPPER;
  if (!pepper) return '';
  const forwarded = (await headers()).get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim();
  if (!ip) return '';
  return createHash('sha256').update(`${ip}${pepper}`).digest('hex');
}

/**
 * The public form's write. The one action in this folder that must not
 * `requireRole`: its caller is a visitor with no session by definition, and
 * it is registered as such in tests/structure/admin-guard-allowlist.ts.
 *
 * It runs on the visitor's own client -- `anon` -- and calls the
 * `submit_resource_suggestion` function from migration 0024, which is the
 * only write that role can reach on `submissions`. Never the service-role
 * client: the function is the boundary, and it re-checks every cap and
 * enforces the rate limit for a caller who never touches this code.
 *
 * Returns rather than throws, in `signIn`'s shape: Next strips a thrown
 * error's message in production, and "slow down" and "fix this" are
 * different messages. A `54000` is the function's rate limit; `22023` is a
 * cap this schema should already have caught, reported as invalid.
 * Anything else is `failed`, which the screen shows as a generic retry.
 */
export async function submitResourceSuggestion(input: unknown): Promise<SuggestionOutcome> {
  const parsed = suggestionInput.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  const suggestion = parsed.data;

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('submit_resource_suggestion', {
    p_resource_name: suggestion.resourceName,
    p_organisation: suggestion.organisation,
    p_need: suggestion.need,
    p_link: suggestion.link,
    p_description: composeSuggestionDescription(suggestion),
    p_programme_contact_email: suggestion.programmeContactEmail,
    p_submitter_name: suggestion.submitterName,
    p_submitter_email: suggestion.submitterEmail,
    p_source_ip_hash: await sourceIpHash(),
  });
  // no-revalidate: a pending submission is read by no public page; it reaches
  // the directory only when a reviewer approves it, and that action revalidates.
  if (!error) return { ok: true };
  if (error.code === RATE_LIMITED) return { ok: false, reason: 'rateLimited' };
  if (error.code === INVALID) return { ok: false, reason: 'invalid' };
  return { ok: false, reason: 'failed' };
}
