'use server';

import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { createAdminReadClient } from '@/lib/admin/client';
import { readPartnerNames, readSubmissionForReview } from '@/lib/admin/readers';
import { ensureProvider } from '@/lib/admin/partners';
import {
  submissionToResourceInput,
  SubmissionIncomplete,
} from '@/lib/admin/submission-to-resource';
import { resourceInput, toRow, type ResourceInput } from '@/lib/schemas/resource';
import { CACHE_TAGS } from '@/lib/public/cache';
import {
  assertRowAffected,
  assertKnownPartner,
  isDuplicateResource,
  resourceWriteError,
} from './resource-mutation-guards';

const id = z.string().uuid();

export type ApproveOutcome =
  | { ok: true; resourceId: string }
  | { ok: false; reason: 'notPending' | 'incomplete' | 'duplicate' };

/**
 * The review queue's actions. Every one opens with its own requireRole, for
 * the reason src/lib/actions/README.md gives: an action can be invoked
 * directly, with no page in the path.
 *
 * Returned outcomes rather than thrown errors for the refusals a reviewer
 * can act on: Next strips the message from an error thrown in a production
 * server action, so "already reviewed", "missing a link" and "a resource
 * with that name exists" would all reach the screen as the same generic
 * failure. Anything unexpected still throws.
 */

/**
 * "Approve & publish": the suggestion becomes a live resource in one click.
 *
 * Two statements, not one transaction -- the resource insert, then the
 * status update -- because the caller's client has no way to open one and
 * the alternative is a security definer RPC for a path a reviewer runs a
 * few times a week. The status predicate on the update (`eq('status',
 * 'pending')`) is what stops two reviewers approving the same suggestion at
 * once: the second insert trips `unique (partner, name)` and returns
 * `duplicate`, and the second update matches no row. The documented
 * failure mode is "resource exists, submission still pending", which a
 * retry surfaces as `duplicate` and the message tells the reviewer to
 * reject the suggestion or edit the resource by hand.
 *
 * An organisation the registry has never seen is created name-only first
 * (`ensureProvider`, the same step every resource writer takes), and the
 * provider list is re-read so `assertKnownPartner` judges the post-insert
 * state.
 */
export async function approveAndPublishSubmission(rawId: unknown): Promise<ApproveOutcome> {
  const actor = await requireRole(['admin', 'editor']);
  const submissionId = id.parse(rawId);
  const submission = await readSubmissionForReview(submissionId);
  if (!submission || submission.type !== 'new_resource') return { ok: false, reason: 'notPending' };

  let parsed: ResourceInput;
  try {
    parsed = resourceInput.parse(submissionToResourceInput(submission));
  } catch (error) {
    if (error instanceof SubmissionIncomplete || error instanceof z.ZodError) {
      return { ok: false, reason: 'incomplete' };
    }
    throw error;
  }

  const supabase = await createAdminReadClient();
  const { created: partnerCreated } = await ensureProvider(supabase, parsed.partner);
  assertKnownPartner(parsed.partner, await readPartnerNames());

  const inserted = await supabase.from('resources').insert(toRow(parsed)).select('id').single();
  if (inserted.error) {
    if (isDuplicateResource(inserted.error)) return { ok: false, reason: 'duplicate' };
    throw resourceWriteError('approveAndPublishSubmission', inserted.error, parsed.partner, parsed.name);
  }

  const { data, error } = await supabase
    .from('submissions')
    .update({ status: 'approved', reviewed_by: actor.profileId, reviewed_at: new Date().toISOString() })
    .eq('id', submissionId)
    .eq('status', 'pending')
    .select('id');
  if (error) throw new Error(`approveAndPublishSubmission failed (submissions): ${error.message}`);
  assertRowAffected('approveAndPublishSubmission', data);

  revalidateTag(CACHE_TAGS.resources, { expire: 0 });
  if (partnerCreated) revalidateTag(CACHE_TAGS.partners, { expire: 0 });
  return { ok: true, resourceId: inserted.data.id };
}

/**
 * "Edit first", completed: the reviewer has corrected the prefilled form and
 * saved it. The same sequence as `approveAndPublishSubmission` -- provider
 * ensured, resource inserted, submission marked approved -- but over the
 * reviewer's edited fields rather than the suggestion's own. Not simply
 * `createResource` followed by `markSubmissionApproved`: the two writes and
 * the status predicate belong together so a suggestion cannot be approved
 * without its resource landing.
 */
export async function createResourceFromSubmission(
  rawSubmissionId: unknown,
  input: unknown,
): Promise<ApproveOutcome> {
  const actor = await requireRole(['admin', 'editor']);
  const submissionId = id.parse(rawSubmissionId);
  const parsed = resourceInput.parse(input);
  const submission = await readSubmissionForReview(submissionId);
  if (!submission) return { ok: false, reason: 'notPending' };

  const supabase = await createAdminReadClient();
  const { created: partnerCreated } = await ensureProvider(supabase, parsed.partner);
  assertKnownPartner(parsed.partner, await readPartnerNames());

  const inserted = await supabase.from('resources').insert(toRow(parsed)).select('id').single();
  if (inserted.error) {
    if (isDuplicateResource(inserted.error)) return { ok: false, reason: 'duplicate' };
    throw resourceWriteError('createResourceFromSubmission', inserted.error, parsed.partner, parsed.name);
  }

  const { data, error } = await supabase
    .from('submissions')
    .update({ status: 'approved', reviewed_by: actor.profileId, reviewed_at: new Date().toISOString() })
    .eq('id', submissionId)
    .eq('status', 'pending')
    .select('id');
  if (error) throw new Error(`createResourceFromSubmission failed (submissions): ${error.message}`);
  assertRowAffected('createResourceFromSubmission', data);

  revalidateTag(CACHE_TAGS.resources, { expire: 0 });
  if (partnerCreated) revalidateTag(CACHE_TAGS.partners, { expire: 0 });
  return { ok: true, resourceId: inserted.data.id };
}

/**
 * An update suggestion, applied: the reviewer opened the target resource
 * with the suggestion beside it, saved through `updateResource`, and this
 * closes the suggestion. Zero rows means it was no longer pending, which is
 * reported rather than thrown.
 */
export async function markSubmissionApproved(rawId: unknown): Promise<{ ok: boolean }> {
  const actor = await requireRole(['admin', 'editor']);
  const submissionId = id.parse(rawId);
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('submissions')
    .update({ status: 'approved', reviewed_by: actor.profileId, reviewed_at: new Date().toISOString() })
    .eq('id', submissionId)
    .eq('status', 'pending')
    .select('id');
  if (error) throw new Error(`markSubmissionApproved failed: ${error.message}`);
  // no-revalidate: a submission's status is read by no public page; the
  // resource edit that preceded this call revalidated the directory itself.
  return { ok: (data ?? []).length > 0 };
}

/**
 * "Reject". No reason is taken: the prototype asks for none, and
 * `rejection_reason` stays null. The row is kept, not deleted -- the queue
 * is the record of what was proposed.
 */
export async function rejectSubmission(rawId: unknown): Promise<{ ok: boolean }> {
  const actor = await requireRole(['admin', 'editor']);
  const submissionId = id.parse(rawId);
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('submissions')
    .update({ status: 'rejected', reviewed_by: actor.profileId, reviewed_at: new Date().toISOString() })
    .eq('id', submissionId)
    .eq('status', 'pending')
    .select('id');
  if (error) throw new Error(`rejectSubmission failed: ${error.message}`);
  // no-revalidate: a rejected suggestion never reached any public page, so
  // there is nothing cached anywhere that this write could have made stale.
  return { ok: (data ?? []).length > 0 };
}
