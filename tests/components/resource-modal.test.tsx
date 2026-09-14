// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { t } from '@/lib/i18n';
import type { ResourceInput } from '@/lib/schemas/resource';
import { polyfillDialog } from '../helpers/dialog';

/**
 * The resource modal and its form: what the provider field offers, what a
 * name outside the registry does, the two rules the prototype adds over the
 * schema, and what the footer sends. The actions are mocked --
 * tests/rls/resource-partner-fk.test.ts is where a new provider is actually
 * created against the database.
 */
const actions = vi.hoisted(() => ({
  createResource: vi.fn(),
  updateResource: vi.fn(),
  createResourceFromSubmission: vi.fn(),
  markSubmissionApproved: vi.fn(),
}));

vi.mock('@/lib/actions/resources', () => actions);
vi.mock('@/lib/actions/submissions', () => actions);

polyfillDialog();
const ResourceModal = (await import('@/components/admin/ResourceModal')).default;

afterEach(() => {
  cleanup();
  for (const fn of Object.values(actions)) fn.mockReset();
});

const KNOWN = ['CINECA', 'Google', 'NVIDIA'];

function stored(partner: string, over: Partial<ResourceInput> = {}): ResourceInput & { id: string } {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'GPU allocation',
    partner,
    partnerTier: 'strategic',
    resourceType: 'Credits',
    needPrimary: 'compute',
    needSecondary: null,
    subCategory: null,
    description: 'Compute for teams.',
    actionLabel: 'Apply now',
    externalUrl: 'https://example.org/apply',
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
    ...over,
  };
}

function providerField(): HTMLInputElement {
  return screen.getByLabelText(
    new RegExp(`^${t('admin.resources.form.label.partner')}\\s*\\*?$`),
  ) as HTMLInputElement;
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(new RegExp(`^${label}\\s*\\*?$`)), { target: { value } });
}

function save() {
  fireEvent.click(screen.getByRole('button', { name: t('admin.resources.form.submitSave') }));
}

describe('the provider field', () => {
  it('is free text with every known provider offered as a suggestion', () => {
    render(<ResourceModal mode={{ kind: 'create' }} partners={KNOWN} onClose={() => {}} />);
    const field = providerField();
    expect(field.tagName).toBe('INPUT');
    const list = document.getElementById(field.getAttribute('list')!) as HTMLDataListElement;
    expect([...list.options].map((o) => o.value)).toEqual(KNOWN);
    expect(screen.queryByText(t('admin.resources.form.newProvider'))).toBeNull();
  });

  it('says a name outside the registry will be added, and still saves with it', async () => {
    actions.createResource.mockResolvedValue({ id: 'new' });
    const onClose = vi.fn();
    render(<ResourceModal mode={{ kind: 'create' }} partners={KNOWN} onClose={onClose} />);
    fill(t('admin.resources.form.label.name'), 'Cloud credits');
    fill(t('admin.resources.form.label.partner'), 'Brand New Org');
    expect(screen.getByText(t('admin.resources.form.newProvider'))).toBeTruthy();
    fill(t('admin.resources.form.label.description'), 'Credits for teams.');
    fill(t('admin.resources.form.label.externalUrl'), 'https://example.org/apply');
    save();

    await waitFor(() => expect(actions.createResource).toHaveBeenCalledTimes(1));
    const input = actions.createResource.mock.calls[0]![0] as ResourceInput;
    expect(input.partner).toBe('Brand New Org');
    // The prototype's blank-form defaults travel with it.
    expect(input.partnerTier).toBe('network');
    expect(input.resourceType).toBe('Programme');
    expect(input.needPrimary).toBe('training');
    expect(input.actionLabel).toBe('Learn more');
    expect(input.stagesEligible).toEqual(['Getting started', 'Building']);
    expect(input.geoScope).toBe('global');
    await waitFor(() => expect(onClose).toHaveBeenCalledWith('saved'));
  });

  it('keeps a stored provider as the field value on edit, known or not', () => {
    render(
      <ResourceModal mode={{ kind: 'edit', initial: stored('Departed Org') }} partners={KNOWN} onClose={() => {}} />,
    );
    expect(providerField().value).toBe('Departed Org');
    expect(screen.getByText(t('admin.resources.form.newProvider'))).toBeTruthy();
  });
});

describe("the prototype's rules over the schema", () => {
  it('refuses a save with no eligible stage', async () => {
    render(
      <ResourceModal
        mode={{ kind: 'edit', initial: stored('Google', { stagesEligible: [] }) }}
        partners={KNOWN}
        onClose={() => {}}
      />,
    );
    save();
    await waitFor(() => expect(screen.getByText(t('admin.resources.form.needStage'))).toBeTruthy());
    expect(actions.updateResource).not.toHaveBeenCalled();
  });

  it('refuses selected-countries scope with no country chosen', async () => {
    render(
      <ResourceModal
        mode={{ kind: 'edit', initial: stored('Google', { geoScope: 'specific', countriesEligible: [] }) }}
        partners={KNOWN}
        onClose={() => {}}
      />,
    );
    save();
    await waitFor(() => expect(screen.getByText(t('admin.resources.form.needCountry'))).toBeTruthy());
    expect(actions.updateResource).not.toHaveBeenCalled();
  });

  it('shows a stored non-programme country as a chip and names it in the refusal', async () => {
    render(
      <ResourceModal
        mode={{
          kind: 'edit',
          // A row that arrived from the seed with a country outside the
          // programme's list -- the type is widened the way the database is.
          initial: stored('Google', {
            geoScope: 'specific',
            countriesEligible: ['Kenya', 'Atlantis'] as unknown as ResourceInput['countriesEligible'],
          }),
        }}
        partners={KNOWN}
        onClose={() => {}}
      />,
    );
    const chip = screen.getByRole('button', { name: 'Atlantis' });
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    save();
    await waitFor(() =>
      expect(
        screen.getByText(t('admin.resources.form.countryNotProgramme', { countries: 'Atlantis' })),
      ).toBeTruthy(),
    );
    expect(actions.updateResource).not.toHaveBeenCalled();

    // Taking the chip off is the remedy, and then the save goes through.
    actions.updateResource.mockResolvedValue(undefined);
    fireEvent.click(chip);
    save();
    await waitFor(() => expect(actions.updateResource).toHaveBeenCalledTimes(1));
  });
});

describe('the modal', () => {
  it('titles itself by mode and closes on Cancel and on × without a write', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <ResourceModal mode={{ kind: 'create' }} partners={KNOWN} onClose={onClose} />,
    );
    expect(screen.getByRole('heading', { name: t('admin.resources.form.headingCreate') })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('admin.resources.form.cancel') }));
    expect(onClose).toHaveBeenCalledWith('cancelled');
    fireEvent.click(screen.getByRole('button', { name: t('admin.resources.form.close') }));
    expect(onClose).toHaveBeenCalledTimes(2);

    rerender(
      <ResourceModal mode={{ kind: 'edit', initial: stored('Google') }} partners={KNOWN} onClose={onClose} />,
    );
    expect(screen.getByRole('heading', { name: t('admin.resources.form.headingEdit') })).toBeTruthy();
    expect(actions.createResource).not.toHaveBeenCalled();
    expect(actions.updateResource).not.toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    render(<ResourceModal mode={null} partners={KNOWN} onClose={() => {}} />);
    expect(document.querySelector('dialog')).toBeNull();
  });

  it('completes a suggestion through createResourceFromSubmission and approves it on save', async () => {
    actions.createResourceFromSubmission.mockResolvedValue({ ok: true, resourceId: 'r' });
    const onClose = vi.fn();
    const prefill: ResourceInput = { ...stored('Suggested Org'), id: undefined } as unknown as ResourceInput;
    render(
      <ResourceModal
        mode={{ kind: 'fromSubmission', prefill, submissionId: 'sub-1' }}
        partners={KNOWN}
        onClose={onClose}
      />,
    );
    expect(screen.getByText(t('admin.resources.form.submissionNote'))).toBeTruthy();
    save();
    await waitFor(() =>
      expect(actions.createResourceFromSubmission).toHaveBeenCalledWith('sub-1', expect.anything()),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledWith('saved'));
  });
});
