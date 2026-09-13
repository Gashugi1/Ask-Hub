// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { t } from '@/lib/i18n';
import type { ReviewSubmission } from '@/lib/admin/types';

/**
 * The queue card's affordances per submission type, and what a click sends.
 * The actions are mocked; the database boundary behind them is covered by
 * tests/rls/submission-suggest-rpc.test.ts.
 */
const actions = vi.hoisted(() => ({
  approveAndPublishSubmission: vi.fn(),
  rejectSubmission: vi.fn(),
}));

vi.mock('@/lib/actions/submissions', () => actions);
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const ReviewCard = (await import('@/components/admin/ReviewCard')).default;

afterEach(() => {
  cleanup();
  actions.approveAndPublishSubmission.mockReset();
  actions.rejectSubmission.mockReset();
});

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

describe('ReviewCard', () => {
  it('offers a new resource Approve & publish, Edit first and Reject', () => {
    render(<ReviewCard submission={NEW} />);
    expect(screen.getByText(t('admin.review.approve'))).toBeTruthy();
    expect(screen.getByText(t('admin.review.editFirst')).getAttribute('href')).toBe(
      `/admin/resources/new?submission=${NEW.id}`,
    );
    expect(screen.getByText(t('admin.review.reject'))).toBeTruthy();
    expect(screen.queryByText(t('admin.review.openResource'))).toBeNull();
  });

  it('offers an update suggestion Open resource to edit and Reject only', () => {
    render(<ReviewCard submission={UPDATE} />);
    expect(screen.getByText(t('admin.review.openResource')).getAttribute('href')).toBe(
      `/admin/resources/${UPDATE.targetResourceId}?submission=${UPDATE.id}`,
    );
    expect(screen.queryByText(t('admin.review.approve'))).toBeNull();
    expect(screen.queryByText(t('admin.review.editFirst'))).toBeNull();
    expect(screen.getByText(t('admin.review.reject'))).toBeTruthy();
  });

  it('shows the submitter to the reviewer', () => {
    render(<ReviewCard submission={NEW} />);
    expect(
      screen.getByText(
        t('admin.review.submittedBy', { name: 'Ada Submitter', email: 'ada@example.org' }),
      ),
    ).toBeTruthy();
  });

  it('sends the submission id on approve and reports the refusal by reason', async () => {
    actions.approveAndPublishSubmission.mockResolvedValue({ ok: false, reason: 'duplicate' });
    render(<ReviewCard submission={NEW} />);
    fireEvent.click(screen.getByText(t('admin.review.approve')));
    await waitFor(() => expect(actions.approveAndPublishSubmission).toHaveBeenCalledWith(NEW.id));
    await waitFor(() =>
      expect(screen.getByText(t('admin.review.refused.duplicate'))).toBeTruthy(),
    );
  });

  it('reports a successful reject', async () => {
    actions.rejectSubmission.mockResolvedValue({ ok: true });
    render(<ReviewCard submission={NEW} />);
    fireEvent.click(screen.getByText(t('admin.review.reject')));
    await waitFor(() => expect(actions.rejectSubmission).toHaveBeenCalledWith(NEW.id));
    await waitFor(() => expect(screen.getByText(t('admin.review.rejected'))).toBeTruthy());
  });
});
