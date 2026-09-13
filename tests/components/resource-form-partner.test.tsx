// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { t } from '@/lib/i18n';
import type { ResourceInput } from '@/lib/schemas/resource';

/**
 * The `partner` field of the resource form, which is a foreign key to
 * `partners(name)` and was a free-text input until migration 0014 made that
 * wrong. The server action is the guard (`assertKnownPartner`, covered against
 * the real tables in `tests/rls/resource-partner-fk.test.ts`); this file covers
 * the two things only the screen can answer.
 *
 * The actions are mocked, so nothing here says anything about permissions,
 * validation on the server, or what reaches the database. What it does say is
 * whether the form *calls* them — "did not submit" is the assertion, not "was
 * refused".
 */
const actions = vi.hoisted(() => ({
  createResource: vi.fn(async () => ({ id: 'created' })),
  updateResource: vi.fn(async () => {}),
  deleteResource: vi.fn(async () => ({ ok: true })),
}));

vi.mock('@/lib/actions/resources', () => actions);

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const ResourceForm = (await import('@/components/admin/ResourceForm')).default;

const KNOWN = ['Amazon Web Services', 'Google', 'NVIDIA'];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** A stored resource whose every other field is already valid, so only `partner` is in question. */
function stored(partner: string): ResourceInput & { id: string } {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'GPU allocation programme',
    partner,
    partnerTier: 'network',
    resourceType: 'Credits',
    needPrimary: 'compute',
    needSecondary: null,
    subCategory: null,
    description: 'Leonardo GPU hours for African AI teams.',
    actionLabel: 'Apply',
    externalUrl: 'https://example.org/apply',
    bannerImageUrl: null,
    countriesEligible: ['Kenya'],
    sectorsEligible: [],
    stagesEligible: ['Building'],
    geoScope: 'specific',
    deadline: null,
    status: 'pipeline',
    isFeatured: false,
    exclusivity: null,
    sortOrder: null,
  };
}

/**
 * The `partner` control, found by its own label rather than by position among
 * the form's inputs. Anchored at both ends so it cannot match "Partner tier",
 * with the trailing `\s*\*?` absorbing the required-field marker the label
 * carries. The control is looked up as an element and its tag asserted
 * separately: a regression to `<input type="text">` must fail saying so,
 * rather than as an unreadable error about a missing `options` property.
 */
function partnerField(): HTMLElement {
  return screen.getByLabelText(new RegExp(`^${t('column.partnerName')}\\s*\\*?$`));
}

function partnerSelect(): HTMLSelectElement {
  const field = partnerField();
  expect(field.tagName, 'the partner field is not a select').toBe('SELECT');
  return field as HTMLSelectElement;
}

function optionValues(): string[] {
  return [...partnerSelect().options].map((option) => option.value);
}

describe('the partner field offers the partners it was given', () => {
  it('renders one option per known partner, plus the placeholder', () => {
    render(<ResourceForm partners={KNOWN} />);
    expect(optionValues()).toEqual(['', ...KNOWN]);
  });

  it('submits the partner name, which is the value the foreign key checks', async () => {
    render(<ResourceForm initial={stored('Google')} partners={KNOWN} />);
    fireEvent.change(partnerSelect(), { target: { value: 'NVIDIA' } });
    fireEvent.click(screen.getByText(t('admin.resources.form.submitUpdate')));

    await waitFor(() => expect(actions.updateResource).toHaveBeenCalledTimes(1));
    const [, input] = actions.updateResource.mock.calls[0] as unknown as [string, ResourceInput];
    expect(input.partner).toBe('NVIDIA');
  });
});

describe('editing a resource whose stored partner is not in the list', () => {
  /**
   * Not reachable while the foreign key stands — `on update cascade` follows a
   * rename and `on delete restrict` refuses to remove a referenced partner, so
   * a stored partner is in `partners` by construction. The behaviour is pinned
   * anyway because of what the alternative looks like on screen, measured with
   * the option removed: the control falls back to displaying the first real
   * partner, so the field claims a partner the row does not have. What it
   * *submits* is React state, still the stored value, so nothing is silently
   * rewritten — the defect is a form that misreports the row it is editing and
   * then rejects a value the curator cannot see selected.
   */
  it('keeps the stored value visible and selected rather than dropping it', () => {
    render(<ResourceForm initial={stored('Departed Partner')} partners={KNOWN} />);
    expect(optionValues()).toEqual(['', 'Departed Partner', ...KNOWN]);
    expect(partnerSelect().value).toBe('Departed Partner');
  });

  it('refuses to submit it, naming the value and the remedy', async () => {
    render(<ResourceForm initial={stored('Departed Partner')} partners={KNOWN} />);
    fireEvent.click(screen.getByText(t('admin.resources.form.submitUpdate')));

    const message = t('admin.resources.form.partnerUnknown', { partner: 'Departed Partner' });
    await waitFor(() => expect(screen.getByText(message)).toBeTruthy());
    // The localised message, not the generic save failure — and not a raw
    // constraint violation, which is what the operator used to be shown.
    expect(screen.queryByText(t('admin.error.generic'))).toBeNull();
    expect(actions.updateResource).not.toHaveBeenCalled();
  });

  it('saves once a known partner is chosen', async () => {
    render(<ResourceForm initial={stored('Departed Partner')} partners={KNOWN} />);
    fireEvent.change(partnerSelect(), { target: { value: 'Google' } });
    fireEvent.click(screen.getByText(t('admin.resources.form.submitUpdate')));

    await waitFor(() => expect(actions.updateResource).toHaveBeenCalledTimes(1));
  });
});
