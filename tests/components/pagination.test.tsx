// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Pagination from '@/components/public/Pagination';
import { EMPTY_CRITERIA, type FilterCriteria } from '@/lib/public/filters';

afterEach(cleanup);

const criteria = (over: Partial<FilterCriteria> = {}): FilterCriteria => ({
  ...EMPTY_CRITERIA,
  ...over,
});

/**
 * The seed holds fewer resources than one page, so the pager is invisible in
 * the running application today and cannot be checked by eye. These assertions
 * are the only thing standing between it and a defect that surfaces the day
 * the client's real dataset lands.
 */
describe('the directory pager', () => {
  it('renders nothing for a single page', () => {
    // "Page 1 of 1" is furniture, and it would be the only state anyone sees
    // until the directory outgrows one page.
    const { container } = render(
      <Pagination criteria={criteria()} page={1} pageCount={1} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('links every page, and carries the page number in the URL', () => {
    render(<Pagination criteria={criteria()} page={1} pageCount={3} />);
    // Page 1 is the default, so its link is the bare directory link rather
    // than ?page=1 -- the same rule toSearchParams follows.
    expect(screen.getByRole('link', { name: '1' }).getAttribute('href')).toBe('/#directory');
    expect(screen.getByRole('link', { name: '2' }).getAttribute('href')).toBe(
      '/?page=2#directory',
    );
  });

  it('keeps the active filters in every page link', () => {
    // A pager that dropped the filters would silently widen the result set on
    // the second page, which is worse than not paginating at all.
    render(<Pagination criteria={criteria({ need: 'compute' })} page={1} pageCount={2} />);
    const second = screen.getByRole('link', { name: '2' }).getAttribute('href');
    expect(second).toContain('need=compute');
    expect(second).toContain('page=2');
  });

  it('marks the current page for assistive technology, not just visually', () => {
    render(<Pagination criteria={criteria({ page: 2 })} page={2} pageCount={3} />);
    expect(screen.getByRole('link', { name: '2' })).toHaveProperty('ariaCurrent', 'page');
    expect(screen.getByRole('link', { name: '1' }).getAttribute('aria-current')).toBeNull();
  });

  it('offers previous and next only where they lead somewhere', () => {
    render(<Pagination criteria={criteria()} page={1} pageCount={3} />);
    expect(screen.queryByRole('link', { name: 'Previous' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Next' }).getAttribute('href')).toBe(
      '/?page=2#directory',
    );

    cleanup();
    render(<Pagination criteria={criteria({ page: 3 })} page={3} pageCount={3} />);
    expect(screen.getByRole('link', { name: 'Previous' }).getAttribute('href')).toBe(
      '/?page=2#directory',
    );
    expect(screen.queryByRole('link', { name: 'Next' })).toBeNull();
  });
});
