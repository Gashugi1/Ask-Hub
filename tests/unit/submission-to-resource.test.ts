import { describe, it, expect } from 'vitest';
import {
  submissionResourceDraft,
  submissionToResourceInput,
  SubmissionIncomplete,
} from '@/lib/admin/submission-to-resource';
import { resourceInput } from '@/lib/schemas/resource';
import { STAGES } from '@/lib/reference';
import type { ReviewSubmission } from '@/lib/admin/types';

const SUBMISSION: ReviewSubmission = {
  id: '00000000-0000-4000-8000-000000000001',
  type: 'new_resource',
  resourceName: 'GPU credits for climate teams',
  organisation: 'Example Compute Co',
  need: 'compute',
  link: 'https://example.org/apply',
  description: 'Credits for early-stage teams.\nCountries: Kenya · Sectors: Energy',
  submitterName: 'Ada Submitter',
  submitterEmail: 'ada@example.org',
  programmeContactEmail: 'contact@example.org',
  createdAt: '2026-09-01T00:00:00Z',
  targetResourceId: null,
  targetResourceName: null,
};

describe('submissionToResourceInput', () => {
  it('produces a valid resourceInput with the importer defaults', () => {
    const parsed = resourceInput.parse(submissionToResourceInput(SUBMISSION));
    expect(parsed.name).toBe(SUBMISSION.resourceName);
    expect(parsed.partner).toBe(SUBMISSION.organisation);
    expect(parsed.partnerTier).toBe('network');
    expect(parsed.resourceType).toBe('Programme');
    expect(parsed.needPrimary).toBe('compute');
    expect(parsed.externalUrl).toBe(SUBMISSION.link);
    expect(parsed.actionLabel).toBe('Apply');
    expect(parsed.stagesEligible).toEqual([...STAGES]);
    expect(parsed.geoScope).toBe('global');
    expect(parsed.countriesEligible).toEqual([]);
    expect(parsed.sectorsEligible).toEqual([]);
    expect(parsed.status).toBe('live');
    expect(parsed.deadline).toBeNull();
  });

  it('calls a training suggestion a Course, as the tracker importer does', () => {
    expect(submissionToResourceInput({ ...SUBMISSION, need: 'training' }).resourceType).toBe('Course');
  });

  it('names the missing field when the suggestion cannot be published as it stands', () => {
    expect(() => submissionToResourceInput({ ...SUBMISSION, organisation: null })).toThrow(
      SubmissionIncomplete,
    );
    try {
      submissionToResourceInput({ ...SUBMISSION, link: null });
    } catch (error) {
      expect((error as SubmissionIncomplete).field).toBe('link');
    }
    expect(() => submissionToResourceInput({ ...SUBMISSION, need: null })).toThrow(
      SubmissionIncomplete,
    );
  });

  it('never copies the submitter or the programme contact into the resource', () => {
    // The prototype flattens all three into the description and publishes
    // it. The whole reason the columns exist is that this must not happen.
    const text = JSON.stringify(submissionToResourceInput(SUBMISSION));
    expect(text).not.toContain('Ada Submitter');
    expect(text).not.toContain('ada@example.org');
    expect(text).not.toContain('contact@example.org');
  });
});

describe('submissionResourceDraft', () => {
  it('tolerates the gaps so the form can prefill what it has', () => {
    const draft = submissionResourceDraft({ ...SUBMISSION, organisation: null, link: null, need: null });
    expect(draft.partner).toBe('');
    expect(draft.externalUrl).toBe('');
    expect(draft.needPrimary).toBe('training');
    expect(draft.name).toBe(SUBMISSION.resourceName);
  });
});
