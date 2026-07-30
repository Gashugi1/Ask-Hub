// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const getSiteContent = vi.fn(async () => ({}) as Record<string, string>);

vi.mock('@/lib/public/readers', () => ({ getSiteContent }));

// No global setup file wires up automatic cleanup between tests (that is
// normally done via @testing-library/jest-dom's setup or a test-environment
// preset), so each render() would otherwise accumulate in the shared jsdom
// document and a later test could see a previous test's markup.
afterEach(cleanup);

/**
 * PRD 5.8: Privacy and Terms ship a factual holding sentence and render
 * `site_content` over it the moment the reviewed copy arrives. This guards
 * CLAUDE.md's "never fabricate data" rule from the other direction -- there
 * is no policy text to invent, so the only way to go wrong here is a page
 * that ships blank. Both the pending-sentence path and the site_content path
 * need their own assertion: passing one does not imply the other still
 * takes priority when content exists.
 */
describe('/privacy site_content fallback', () => {
  beforeEach(() => {
    getSiteContent.mockReset();
  });

  it('renders the pending sentence when there is no privacy_body', async () => {
    getSiteContent.mockResolvedValue({});
    const { default: PrivacyPage } = await import('@/app/(public)/privacy/page');
    const element = await PrivacyPage();
    render(element);

    expect(
      screen.getByText(
        'The privacy notice is being finalised. For any question about how the AI Hub for Sustainable Development handles your data, write to the address below.',
      ),
    ).toBeTruthy();
  });

  it('renders privacy_body and not the pending sentence when content exists', async () => {
    getSiteContent.mockResolvedValue({ privacy_body: 'Reviewed privacy text.' });
    const { default: PrivacyPage } = await import('@/app/(public)/privacy/page');
    const element = await PrivacyPage();
    render(element);

    expect(screen.getByText('Reviewed privacy text.')).toBeTruthy();
    expect(
      screen.queryByText(
        'The privacy notice is being finalised. For any question about how the AI Hub for Sustainable Development handles your data, write to the address below.',
      ),
    ).toBeNull();
  });
});

describe('/terms site_content fallback', () => {
  beforeEach(() => {
    getSiteContent.mockReset();
  });

  it('renders the pending sentence when there is no terms_body', async () => {
    getSiteContent.mockResolvedValue({});
    const { default: TermsPage } = await import('@/app/(public)/terms/page');
    const element = await TermsPage();
    render(element);

    expect(
      screen.getByText('The terms of use are being finalised. For any question, write to the address below.'),
    ).toBeTruthy();
  });

  it('renders terms_body and not the pending sentence when content exists', async () => {
    getSiteContent.mockResolvedValue({ terms_body: 'Reviewed terms text.' });
    const { default: TermsPage } = await import('@/app/(public)/terms/page');
    const element = await TermsPage();
    render(element);

    expect(screen.getByText('Reviewed terms text.')).toBeTruthy();
    expect(
      screen.queryByText('The terms of use are being finalised. For any question, write to the address below.'),
    ).toBeNull();
  });
});
