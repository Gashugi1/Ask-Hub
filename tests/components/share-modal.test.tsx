// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import ShareModal from '@/components/public/ShareModal';
import { t } from '@/lib/i18n';

const URL_UNDER_TEST = 'https://example.test/resources/r1';
const TITLE = 'Cloud credits programme';

/**
 * Replace `navigator.clipboard` for one test. jsdom does not implement it, so
 * the undefined case below is the environment's own default -- which is also
 * exactly what a browser on a non-secure origin presents.
 */
function withClipboard(clipboard: unknown) {
  Object.defineProperty(navigator, 'clipboard', {
    value: clipboard,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  withClipboard(undefined);
});

function openPanel() {
  render(<ShareModal url={URL_UNDER_TEST} title={TITLE} />);
  fireEvent.click(screen.getByText(t('share.open')));
}

describe('ShareModal copy', () => {
  it('reports success and writes the share text to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    withClipboard({ writeText });
    openPanel();

    fireEvent.click(screen.getByText(t('share.copyLink')));

    await waitFor(() => expect(screen.getByText(t('share.copied'))).toBeTruthy());
    expect(writeText).toHaveBeenCalledTimes(1);
    const written = writeText.mock.calls[0]?.[0] as string;
    expect(written).toContain(URL_UNDER_TEST);
    expect(written).toContain(TITLE);
    expect(screen.queryByText(t('share.copyFailed'))).toBeNull();
  });

  it('surfaces the failure when navigator.clipboard is undefined', async () => {
    // The non-secure-origin case: the property access throws a TypeError
    // before the await is reached, so an unguarded call rejected with nothing
    // on screen and the label still reading "Copy link".
    withClipboard(undefined);
    const onError = vi.fn();
    window.addEventListener('unhandledrejection', onError);
    openPanel();

    expect(() => fireEvent.click(screen.getByText(t('share.copyLink')))).not.toThrow();

    await waitFor(() => expect(screen.getByText(t('share.copyFailed'))).toBeTruthy());
    expect(screen.queryByText(t('share.copied'))).toBeNull();
    expect(onError).not.toHaveBeenCalled();
    window.removeEventListener('unhandledrejection', onError);
  });

  it('surfaces the failure when writeText rejects', async () => {
    withClipboard({ writeText: vi.fn().mockRejectedValue(new Error('not allowed')) });
    openPanel();

    expect(() => fireEvent.click(screen.getByText(t('share.copyLink')))).not.toThrow();

    await waitFor(() => expect(screen.getByText(t('share.copyFailed'))).toBeTruthy());
    expect(screen.queryByText(t('share.copied'))).toBeNull();
  });

  it('offers the full share text, selected, so it can be copied by hand', async () => {
    withClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    openPanel();
    fireEvent.click(screen.getByText(t('share.copyLink')));

    const fallback = (await screen.findByLabelText(t('share.manualCopy'))) as HTMLTextAreaElement;
    expect(fallback.value).toContain(URL_UNDER_TEST);
    expect(fallback.value).toContain(TITLE);
    expect(document.activeElement).toBe(fallback);
    expect(fallback.selectionStart).toBe(0);
    expect(fallback.selectionEnd).toBe(fallback.value.length);
  });

  it('forgets a previous copy when the panel is closed and reopened', async () => {
    withClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
    openPanel();
    fireEvent.click(screen.getByText(t('share.copyLink')));
    await waitFor(() => expect(screen.getByText(t('share.copied'))).toBeTruthy());

    fireEvent.click(screen.getByText(t('share.close')));
    fireEvent.click(screen.getByText(t('share.open')));

    // "Link copied" on reopening would claim something happened this session
    // that did not.
    expect(screen.queryByText(t('share.copied'))).toBeNull();
    expect(screen.getByText(t('share.copyLink'))).toBeTruthy();
  });

  it('forgets a previous failure when the panel is closed and reopened', async () => {
    withClipboard(undefined);
    openPanel();
    fireEvent.click(screen.getByText(t('share.copyLink')));
    await waitFor(() => expect(screen.getByText(t('share.copyFailed'))).toBeTruthy());

    fireEvent.click(screen.getByText(t('share.close')));
    fireEvent.click(screen.getByText(t('share.open')));

    expect(screen.queryByText(t('share.copyFailed'))).toBeNull();
  });
});
