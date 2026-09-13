import { STAGES } from '@/lib/reference';
import type { ResourceInput } from '@/lib/schemas/resource';
import type { ReviewSubmission } from './types';

/** The three fields a submission may lack that a resource cannot. */
export type IncompleteField = 'organisation' | 'link' | 'need';

/**
 * Thrown by `submissionToResourceInput` when the suggestion cannot become a
 * resource as it stands. The reviewer's remedy is "Edit first", which uses
 * `submissionResourceDraft` and tolerates the gap.
 */
export class SubmissionIncomplete extends Error {
  constructor(public readonly field: IncompleteField) {
    super(`submission is missing its ${field}`);
    this.name = 'SubmissionIncomplete';
  }
}

/**
 * A resource draft from a suggestion, with the tracker importer's defaults
 * for everything the form did not ask (src/lib/admin/tracker-import.ts's
 * `toPayload`, whose reasoning applies unchanged):
 *
 * - `partnerTier: 'network'` -- the only tier that asserts nothing about a
 *   partnership the suggestion knows nothing about.
 * - `countriesEligible` and `sectorsEligible` empty, meaning open to all.
 *   The form's country and sector chips are folded into the description as
 *   prose by `composeSuggestionDescription`, where the reviewer reads them;
 *   promoting a visitor's chips straight into eligibility data would let a
 *   stranger write a UN surface's structured fields.
 * - `geoScope: 'global'`, every stage, `actionLabel: 'Apply'`, no deadline,
 *   no banner, not featured, and `status: 'live'` because approving is
 *   publishing.
 *
 * **Reads none of the three personal fields.** Submitter name, submitter
 * email and the programme contact stay on the submission for the reviewer;
 * nothing here copies them anywhere a visitor could read. A test asserts
 * the output carries none of their values.
 *
 * Missing fields become empty strings so the form can prefill what it has;
 * `submissionToResourceInput` is the strict form for a one-click approval.
 */
export function submissionResourceDraft(
  sub: Pick<ReviewSubmission, 'resourceName' | 'organisation' | 'need' | 'link' | 'description'>,
): ResourceInput {
  const need = sub.need ?? 'training';
  return {
    name: sub.resourceName,
    partner: sub.organisation ?? '',
    partnerTier: 'network',
    resourceType: need === 'training' ? 'Course' : 'Programme',
    needPrimary: need,
    needSecondary: null,
    subCategory: null,
    description: sub.description,
    actionLabel: 'Apply',
    externalUrl: sub.link ?? '',
    bannerImageUrl: null,
    countriesEligible: [],
    sectorsEligible: [],
    stagesEligible: [...STAGES],
    geoScope: 'global',
    deadline: null,
    status: 'live',
    isFeatured: false,
    exclusivity: null,
    sortOrder: null,
  };
}

/**
 * The strict form, for "Approve & publish": every field the resource needs
 * must be on the suggestion, or the reviewer is told which one is not.
 */
export function submissionToResourceInput(
  sub: Pick<ReviewSubmission, 'resourceName' | 'organisation' | 'need' | 'link' | 'description'>,
): ResourceInput {
  if (!sub.organisation) throw new SubmissionIncomplete('organisation');
  if (!sub.link) throw new SubmissionIncomplete('link');
  if (!sub.need) throw new SubmissionIncomplete('need');
  return submissionResourceDraft(sub);
}
