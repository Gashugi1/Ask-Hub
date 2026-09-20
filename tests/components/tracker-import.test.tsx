// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { t } from '@/lib/i18n';
import { IMPORT_MAX_BYTES, type ImportReport } from '@/lib/admin/tracker-import';

/**
 * The import screen's client half.
 *
 * The action is mocked, so nothing here says anything about permissions or
 * what reaches the database — `tests/rls/admin-actions-import.test.ts` covers
 * that against the real tables. What only this file can answer is whether the
 * screen sends the **file** rather than its own verdicts, and whether it
 * reports the server's numbers rather than its preview's.
 */
const actions = vi.hoisted(() => ({
  importTrackerResources: vi.fn(),
}));

vi.mock('@/lib/actions/resources', () => actions);

const TrackerImport = (await import('@/components/admin/TrackerImport')).default;

afterEach(() => {
  cleanup();
  actions.importTrackerResources.mockReset();
});

const HEAD =
  'Resource Title,Provider,Proposed Category,One-Sentence Summary,Application / Registration Link';
const GOOD = 'Compute Accelerator,CINECA,Compute,GPU hours for teams.,https://example.org/a';
const FILE = `${HEAD}\r\n${GOOD}`;

function report(over: Partial<ImportReport> = {}): ImportReport {
  return {
    fileProblem: null,
    rows: [],
    imported: 0,
    createdPartners: [],
    preApproved: false,
    ...over,
  };
}

/** A File whose `text()` resolves, which jsdom's own File does not implement. */
function csvFile(text: string, size = text.length): File {
  return {
    name: 'tracker.csv',
    size,
    text: async () => text,
  } as unknown as File;
}

async function upload(text: string, size?: number) {
  render(<TrackerImport existing={[]} partners={[]} />);
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [csvFile(text, size)] });
  fireEvent.change(input);
}

describe('TrackerImport', () => {
  it('previews the file without calling the server', async () => {
    await upload(FILE);
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());

    expect(screen.getByRole('status').textContent).toBe(
      t('admin.import.summary', { passing: 1, total: 1, rejected: 0 }),
    );
    expect(actions.importTrackerResources).not.toHaveBeenCalled();
  });

  it('refuses an oversized file before reading it', async () => {
    await upload(FILE, IMPORT_MAX_BYTES + 1);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());

    expect(screen.getByRole('alert').textContent).toContain('larger than');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('sends the file text, not its own verdicts', async () => {
    actions.importTrackerResources.mockResolvedValue(report({ imported: 1 }));
    await upload(FILE);
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: t('admin.import.confirm', { count: 1 }) }));

    await waitFor(() => expect(actions.importTrackerResources).toHaveBeenCalledTimes(1));
    // The whole point: the browser is authority over which file to import and
    // nothing else, so the payload is the bytes it parsed.
    expect(actions.importTrackerResources).toHaveBeenCalledWith({ csv: FILE });
  });

  it('reports the server’s counts, not the preview’s', async () => {
    // A row the preview passed can still be rejected on commit — somebody
    // else may have imported it in between.
    actions.importTrackerResources.mockResolvedValue(
      report({
        imported: 0,
        rows: [
          {
            row: 1,
            title: 'Compute Accelerator',
            provider: 'CINECA',
            category: 'Compute',
            deadline: '',
            ok: false,
            code: 'duplicateExisting',
            detail: 'Compute Accelerator',
            newPartner: false,
            payload: null,
          },
        ],
      }),
    );
    await upload(FILE);
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: t('admin.import.confirm', { count: 1 }) }));

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(
        t('admin.import.done', { imported: 0, rejected: 1 }),
      ),
    );
    expect(screen.getByText(/Already in the directory/)).toBeTruthy();
  });

  it('shows one alert when the action throws, and no report', async () => {
    // Production replaces a thrown message with an opaque digest, so the
    // wording has to come from a locale key.
    actions.importTrackerResources.mockRejectedValue(new Error('digest'));
    await upload(FILE);
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: t('admin.import.confirm', { count: 1 }) }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(t('admin.error.generic')));
  });

  it('warns when the file carries no approval gate columns', async () => {
    // A tracker re-exported without its Status column would otherwise import
    // ungated rows straight to the public directory.
    await upload(FILE);
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());

    // Not an alert: the component keeps one alert for failures, so this
    // warning is read in flow with the table it is about.
    expect(
      screen.getByText(t('admin.import.preApprovedWarning', { count: 1 })),
    ).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('offers no import button when nothing passes', async () => {
    await upload(`${HEAD}\r\nNo Link,CINECA,Compute,A summary.,`);
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());

    expect(screen.getByText(t('admin.import.nothingToImport'))).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('surfaces a file-level problem and never enables the import', async () => {
    await upload('Provider,Notes\r\nCINECA,x');
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());

    expect(screen.getByRole('alert').textContent).toContain('Missing required tracker columns');
    expect(screen.queryByRole('status')).toBeNull();
  });
});
