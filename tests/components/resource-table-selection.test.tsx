// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { t } from '@/lib/i18n';
import type { AdminResource } from '@/lib/admin/types';

/**
 * The resources table's selection and the header's bulk publish.
 *
 * The actions are mocked, so nothing here says anything about permissions
 * or what reaches the database -- `tests/rls/admin-actions-resources.test.ts`
 * covers the batch update against the real tables. What only this file can
 * answer is what the screen offers to whom, and which ids a click sends.
 */
const actions = vi.hoisted(() => ({
  publishResources: vi.fn(),
  deleteResource: vi.fn(),
  setResourceStatus: vi.fn(),
  setResourceFeatured: vi.fn(),
}));

vi.mock('@/lib/actions/resources', () => actions);
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const ResourceTable = (await import('@/components/admin/ResourceTable')).default;
const { ResourceSelectionProvider, PublishSelectedButton } = await import(
  '@/components/admin/ResourceSelection'
);

afterEach(() => {
  cleanup();
  actions.publishResources.mockReset();
});

function row(id: string, status: AdminResource['status']): AdminResource {
  return {
    id,
    name: `Resource ${id}`,
    partner: 'CINECA',
    partnerTier: 'strategic',
    resourceType: 'Credits',
    subCategory: null,
    needPrimary: 'compute',
    needSecondary: null,
    geoScope: 'global',
    countriesEligible: [],
    sectorsEligible: [],
    stagesEligible: [],
    deadline: null,
    status,
    isFeatured: false,
    sortOrder: null,
  };
}

const ROWS = [row('a', 'pipeline'), row('b', 'live'), row('c', 'reference')];

/** The page's shape: the header button and the table under one provider. */
function mount(canWrite: boolean) {
  render(
    <ResourceSelectionProvider rows={ROWS}>
      {canWrite ? <PublishSelectedButton /> : null}
      <ResourceTable rows={ROWS} canWrite={canWrite} />
    </ResourceSelectionProvider>,
  );
}

describe('ResourceTable selection', () => {
  it('offers a viewer no checkbox, no publish button and no delete', () => {
    mount(false);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryByText(/Publish selected/)).toBeNull();
    expect(screen.queryByText(t('admin.resources.actions.delete'))).toBeNull();
  });

  it('shows no publish button until something is selected', () => {
    mount(true);
    expect(screen.getAllByRole('checkbox')).toHaveLength(ROWS.length + 1);
    expect(screen.queryByText(/Publish selected/)).toBeNull();
  });

  it('counts everything selected, as the prototype does', () => {
    mount(true);
    fireEvent.click(screen.getByLabelText(t('admin.resources.selectAll')));
    expect(screen.getByText(t('admin.resources.publishSelected', { count: 3 }))).toBeTruthy();
  });

  it('says so, and writes nothing, when the selection is all live', async () => {
    mount(true);
    fireEvent.click(screen.getByLabelText(t('admin.resources.selectRow', { name: 'Resource b' })));
    fireEvent.click(screen.getByText(t('admin.resources.publishSelected', { count: 1 })));
    await waitFor(() => expect(screen.getByText(t('admin.resources.alreadyLive'))).toBeTruthy());
    expect(actions.publishResources).not.toHaveBeenCalled();
  });

  it('sends only the publishable ids, then clears the selection and reports the count', async () => {
    actions.publishResources.mockResolvedValue({ published: 2 });
    mount(true);
    fireEvent.click(screen.getByLabelText(t('admin.resources.selectAll')));
    fireEvent.click(screen.getByText(t('admin.resources.publishSelected', { count: 3 })));

    await waitFor(() => expect(actions.publishResources).toHaveBeenCalledTimes(1));
    expect(actions.publishResources).toHaveBeenCalledWith(['a', 'c']);
    await waitFor(() =>
      expect(screen.getByText(t('admin.resources.publishedCount', { count: 2 }))).toBeTruthy(),
    );
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes.every((box) => !box.checked)).toBe(true);
    expect(screen.queryByText(/Publish selected/)).toBeNull();
  });

  it('select-all toggles off again from a full selection', () => {
    mount(true);
    const all = screen.getByLabelText(t('admin.resources.selectAll')) as HTMLInputElement;
    fireEvent.click(all);
    expect(all.checked).toBe(true);
    fireEvent.click(all);
    expect(all.checked).toBe(false);
    expect(screen.queryByText(/Publish selected/)).toBeNull();
  });
});
