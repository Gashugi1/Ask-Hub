// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { t } from '@/lib/i18n';
import type { ReviewSubmission } from '@/lib/admin/types';
import type { ResourceInput } from '@/lib/schemas/resource';
import { polyfillDialog } from '../helpers/dialog';

/**
 * The queue card's affordances per submission type, and what a click sends.
 * The actions are mocked; the database boundary behind them is covered by
 * tests/rls/submission-suggest-rpc.test.ts.
 */
const actions = vi.hoisted(() => ({
  approveAndPublishSubmission: vi.fn(),
  rejectSubmission: vi.fn(),
  createResourceFromSubmission: vi.fn(),
  markSubmissionApproved: vi.fn(),
}));

vi.mock('@/lib/actions/submissions', () => actions);
vi.mock('@/lib/actions/resources', () => ({
  createResource: vi.fn(),
  updateResource: vi.fn(),
  deleteResource: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

polyfillDialog();
const ReviewCard = (await import('@/components/admin/ReviewCard')).default;


afterEach(() => {
  cleanup();
  actions.approveAndPublishSubmission.mockReset();
  actions.rejectSubmission.mockReset();
  actions.createResourceFromSubmission.mockReset();
});

const PARTNERS = ['Example Compute Co'];

const NEW: ReviewSubmission = {
  id: '00000000-0000-4000-8000-000000000001',
  type: 'new_resource',
  resourceName: 'GPU credits',
  organisation: 'Example Compute Co',
  need: 'compute',
  link: 'https://example.org/apply',
  description: 'Credits for teams.',
  submitterName: 'Ada Submitter',
  submitterEmail: 'ada@example.org',
  programmeContactEmail: null,
  createdAt: '2026-09-01T00:00:00Z',
  targetResourceId: null,
  targetResourceName: null,
};

const UPDATE: ReviewSubmission = {
  ...NEW,
  id: '00000000-0000-4000-8000-000000000002',
  type: 'update_suggestion',
  targetResourceId: '00000000-0000-4000-8000-0000000000aa',
  targetResourceName: 'Existing resource',
};

const TARGET: ResourceInput & { id: string } = {
  id: UPDATE.targetResourceId!,
  name: 'Existing resource',
  partner: 'Example Compute Co',
  partnerTier: 'network',
  resourceType: 'Programme',
  needPrimary: 'compute',
  needSecondary: null,
  subCategory: null,
  description: 'The resource the suggestion is about.',
  actionLabel: 'Apply',
  externalUrl: 'https://example.org/existing',
  bannerImageUrl: null,
  countriesEligible: [],
  sectorsEligible: [],
  stagesEligible: ['Building'],
  geoScope: 'global',
  deadline: null,
  status: 'live',
  isFeatured: false,
  exclusivity: null,
  sortOrder: null,
};

describe('ReviewCard', () => {
  it('offers a new resource Approve & publish, Edit first and Reject', () => {
    render(<ReviewCard submission={NEW} partners={PARTNERS} />);
    expect(screen.getByText(t('admin.review.approve'))).toBeTruthy();
    expect(screen.getByText(t('admin.review.editFirst'))).toBeTruthy();
    expect(screen.getByText(t('admin.review.reject'))).toBeTruthy();
    expect(screen.queryByText(t('admin.review.openResource'))).toBeNull();
  });

  it('Edit first opens the prefilled resource form in a dialog, and Cancel closes it', () => {
    render(<ReviewCard submission={NEW} partners={PARTNERS} />);
    expect(screen.queryByText(t('admin.resources.form.submitSave'))).toBeNull();

    fireEvent.click(screen.getByText(t('admin.review.editFirst')));
    const dialog = screen.getByRole('dialog', { hidden: true });
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(screen.getByDisplayValue('GPU credits')).toBeTruthy();
    expect(screen.getByDisplayValue('https://example.org/apply')).toBeTruthy();

    fireEvent.click(screen.getByText(t('admin.resources.form.cancel')));
    // Closed means unmounted: the next opening starts from the draft again.
    expect(document.querySelector('dialog')).toBeNull();
    expect(screen.queryByText(t('admin.resources.form.submitSave'))).toBeNull();
  });

  it('saving the Edit first form creates the resource from the submission and closes the dialog', async () => {
    actions.createResourceFromSubmission.mockResolvedValue({ ok: true });
    render(<ReviewCard submission={NEW} partners={PARTNERS} />);
    fireEvent.click(screen.getByText(t('admin.review.editFirst')));
    fireEvent.click(screen.getByText(t('admin.resources.form.submitSave')));

    await waitFor(() =>
      expect(actions.createResourceFromSubmission).toHaveBeenCalledWith(
        NEW.id,
        expect.objectContaining({ name: 'GPU credits', partner: 'Example Compute Co', status: 'live' }),
      ),
    );
    await waitFor(() => expect(screen.getByText(t('admin.resources.saved'))).toBeTruthy());
    expect(document.querySelector('dialog')).toBeNull();
  });

  it('offers an update suggestion Open resource to edit and Reject only, opening the target in the modal', () => {
    render(<ReviewCard submission={UPDATE} partners={PARTNERS} targetInput={TARGET} />);
    expect(screen.queryByText(t('admin.review.approve'))).toBeNull();
    expect(screen.queryByText(t('admin.review.editFirst'))).toBeNull();
    expect(screen.getByText(t('admin.review.reject'))).toBeTruthy();

    fireEvent.click(screen.getByText(t('admin.review.openResource')));
    expect(screen.getByRole('heading', { name: t('admin.resources.form.headingEdit') })).toBeTruthy();
    expect(screen.getByDisplayValue(TARGET.name)).toBeTruthy();
  });

  it('offers no Open resource to edit when the target could not be read', () => {
    render(<ReviewCard submission={UPDATE} partners={PARTNERS} targetInput={null} />);
    expect(screen.queryByText(t('admin.review.openResource'))).toBeNull();
    expect(screen.getByText(t('admin.review.reject'))).toBeTruthy();
  });

  it('shows the submitter to the reviewer', () => {
    render(<ReviewCard submission={NEW} partners={PARTNERS} />);
    expect(
      screen.getByText(
        t('admin.review.submittedBy', { name: 'Ada Submitter', email: 'ada@example.org' }),
      ),
    ).toBeTruthy();
  });

  it('sends the submission id on approve and reports the refusal by reason', async () => {
    actions.approveAndPublishSubmission.mockResolvedValue({ ok: false, reason: 'duplicate' });
    render(<ReviewCard submission={NEW} partners={PARTNERS} />);
    fireEvent.click(screen.getByText(t('admin.review.approve')));
    await waitFor(() => expect(actions.approveAndPublishSubmission).toHaveBeenCalledWith(NEW.id));
    await waitFor(() =>
      expect(screen.getByText(t('admin.review.refused.duplicate'))).toBeTruthy(),
    );
  });

  it('reports a successful reject', async () => {
    actions.rejectSubmission.mockResolvedValue({ ok: true });
    render(<ReviewCard submission={NEW} partners={PARTNERS} />);
    fireEvent.click(screen.getByText(t('admin.review.reject')));
    await waitFor(() => expect(actions.rejectSubmission).toHaveBeenCalledWith(NEW.id));
    await waitFor(() => expect(screen.getByText(t('admin.review.rejected'))).toBeTruthy());
  });
});
