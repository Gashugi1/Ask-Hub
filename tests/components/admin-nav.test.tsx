// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { t } from '@/lib/i18n';

/**
 * The phone-width menu: closed until the button opens it, and closed again
 * by navigating (the pathname changing), without an effect that sets state.
 * Whether the button and the collapsed list are visible at a given width is
 * CSS (globals.css) and is not what jsdom can see; what it can see is the
 * state the CSS keys on.
 */
const nav = vi.hoisted(() => ({ pathname: '/admin' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

const AdminNav = (await import('@/components/admin/AdminNav')).default;

const ITEMS = [
  { href: '/admin', labelKey: 'admin.nav.dashboard' },
  { href: '/admin/resources', labelKey: 'admin.nav.resources' },
];

afterEach(() => {
  cleanup();
  nav.pathname = '/admin';
});

describe('AdminNav', () => {
  it('starts collapsed and the button opens and closes it', () => {
    render(<AdminNav brand={<span>brand</span>} items={ITEMS} />);
    const button = screen.getByRole('button', { name: t('admin.nav.menu') });
    const list = document.getElementById('admin-nav')!;
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(list.className).toBe('admin-nav');

    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(list.className).toContain('admin-nav--open');

    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes when the pathname changes, as it does after a screen is chosen', () => {
    const { rerender } = render(<AdminNav brand={<span>brand</span>} items={ITEMS} />);
    fireEvent.click(screen.getByRole('button', { name: t('admin.nav.menu') }));
    expect(document.getElementById('admin-nav')!.className).toContain('admin-nav--open');

    nav.pathname = '/admin/resources';
    rerender(<AdminNav brand={<span>brand</span>} items={ITEMS} />);
    expect(document.getElementById('admin-nav')!.className).toBe('admin-nav');
    expect(screen.getByRole('button', { name: t('admin.nav.menu') }).getAttribute('aria-expanded')).toBe('false');
  });

  it('lists every screen it is given, marking the current one', () => {
    render(<AdminNav brand={<span>brand</span>} items={ITEMS} />);
    const current = screen.getByRole('link', { name: t('admin.nav.dashboard') });
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: t('admin.nav.resources') }).getAttribute('aria-current')).toBeNull();
  });
});
