// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { t } from '@/lib/i18n';
import { polyfillDialog } from '../helpers/dialog';

/**
 * The public form's client half: what it offers, what it hides, and what it
 * sends. The action is mocked; tests/rls/submission-suggest-rpc.test.ts
 * covers the database function it calls.
 */
const actions = vi.hoisted(() => ({
  submitResourceSuggestion: vi.fn(),
}));

vi.mock('@/lib/actions/suggestions', () => actions);

const SuggestResourceModal = (await import('@/components/public/SuggestResourceModal')).default;

polyfillDialog();

afterEach(() => {
  cleanup();
  actions.submitResourceSuggestion.mockReset();
});

function openForm() {
  render(<SuggestResourceModal />);
  fireEvent.click(screen.getByRole('button', { name: t('contact.suggestAction') }));
}

/**
 * Labels are matched on their own text: a required field's label also
 * carries an aria-hidden " *" marker, which an exact match would trip on.
 */
function byLabel(label: string) {
  return screen.getByLabelText((text) => text.replace(/\s*\*$/, '') === label);
}

function fill(label: string, value: string) {
  fireEvent.change(byLabel(label), { target: { value } });
}

describe('SuggestResourceModal', () => {
  it('renders the eleven fields in the prototype order', () => {
    openForm();
    for (const key of [
      'resourceName',
      'organisation',
      'need',
      'description',
      'link',
      'deadline',
      'programmeContactEmail',
      'submitterName',
      'submitterEmail',
    ]) {
      expect(byLabel(t(`suggest.field.${key}`))).toBeTruthy();
    }
    expect(screen.getByText(t('suggest.field.sectors'))).toBeTruthy();
    expect(screen.getByText(t('suggest.field.countries'))).toBeTruthy();
  });

  it('keeps the honeypot out of reach', () => {
    openForm();
    const honeypot = document.querySelector('input[name="website"]') as HTMLInputElement;
    expect(honeypot.tabIndex).toBe(-1);
    expect(honeypot.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(honeypot.getAttribute('autocomplete')).toBe('off');
  });

  it('toggles chips, and a country choice turns Open to all off', () => {
    openForm();
    const energy = screen.getByRole('button', { name: 'Energy' });
    fireEvent.click(energy);
    expect(energy.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(energy);
    expect(energy.getAttribute('aria-pressed')).toBe('false');

    const openToAll = screen.getByRole('button', { name: t('suggest.openToAll') });
    fireEvent.click(openToAll);
    expect(openToAll.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Kenya' }));
    expect(openToAll.getAttribute('aria-pressed')).toBe('false');
  });

  it('names the missing fields without calling the action', () => {
    openForm();
    fireEvent.click(screen.getByRole('button', { name: t('suggest.submit') }));
    expect(screen.getByText(t('suggest.error.resourceName'))).toBeTruthy();
    expect(screen.getByText(t('suggest.error.link'))).toBeTruthy();
    expect(actions.submitResourceSuggestion).not.toHaveBeenCalled();
  });

  it('sends the parsed suggestion and shows the confirmation', async () => {
    actions.submitResourceSuggestion.mockResolvedValue({ ok: true });
    openForm();
    fill(t('suggest.field.resourceName'), 'GPU credits');
    fill(t('suggest.field.organisation'), 'Example Compute Co');
    fill(t('suggest.field.description'), 'Credits for teams.');
    fill(t('suggest.field.link'), 'https://example.org/apply');
    fill(t('suggest.field.submitterName'), 'Ada');
    fill(t('suggest.field.submitterEmail'), 'Ada@Example.org');
    fireEvent.click(screen.getByRole('button', { name: 'Kenya' }));
    fireEvent.click(screen.getByRole('button', { name: t('suggest.submit') }));

    await waitFor(() => expect(actions.submitResourceSuggestion).toHaveBeenCalledTimes(1));
    const sent = actions.submitResourceSuggestion.mock.calls[0]![0];
    expect(sent.submitterEmail).toBe('ada@example.org');
    expect(sent.countries).toEqual(['Kenya']);
    expect(sent.deadline).toBeNull();
    expect(sent.website).toBe('');
    await waitFor(() => expect(screen.getByText(t('suggest.sentHeading'))).toBeTruthy());
  });

  it('tells a rate-limited visitor to wait rather than to fix the form', async () => {
    actions.submitResourceSuggestion.mockResolvedValue({ ok: false, reason: 'rateLimited' });
    openForm();
    fill(t('suggest.field.resourceName'), 'GPU credits');
    fill(t('suggest.field.organisation'), 'Example Compute Co');
    fill(t('suggest.field.description'), 'Credits for teams.');
    fill(t('suggest.field.link'), 'https://example.org/apply');
    fill(t('suggest.field.submitterName'), 'Ada');
    fill(t('suggest.field.submitterEmail'), 'ada@example.org');
    fireEvent.click(screen.getByRole('button', { name: t('suggest.submit') }));
    await waitFor(() => expect(screen.getByText(t('suggest.rateLimited'))).toBeTruthy());
  });
});
