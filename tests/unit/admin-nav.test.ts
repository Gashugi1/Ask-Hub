import { describe, it, expect } from 'vitest';
import { NAV_ITEMS, visibleNavItems, canWrite, canAdminister } from '@/lib/admin/guard';

describe('visibleNavItems', () => {
  it('shows every screen to an admin, in the prototype order', () => {
    expect(visibleNavItems('admin').map((i) => i.href)).toEqual([
      '/admin',
      '/admin/reach',
      '/admin/resources',
      '/admin/review',
      '/admin/settings',
      '/admin/audit',
    ]);
  });

  it('shows an editor the same six screens', () => {
    // The prototype's middle tier: an editor curates resources, works the
    // review queue and edits the welcome copy on Settings, so nothing is
    // hidden from them. What an editor may not do inside Settings is decided
    // by the page, which renders the admin-only cards for an admin alone.
    expect(visibleNavItems('editor').map((i) => i.href)).toEqual(
      visibleNavItems('admin').map((i) => i.href),
    );
  });

  it('shows a viewer only the read-only screens', () => {
    expect(visibleNavItems('viewer').map((i) => i.href)).toEqual([
      '/admin',
      '/admin/reach',
      '/admin/audit',
    ]);
  });

  it('links to no deferred screen', () => {
    // The screens the prototype lists but this application does not have
    // get no nav entry: a route that does not exist is a 404 waiting to be
    // clicked, and a disabled "coming soon" entry invites the question of
    // when. Reach is not on this list because it has a route -- one whose
    // whole content is the statement that reporting is not available yet.
    const hrefs = NAV_ITEMS.map((i) => i.href);
    for (const deferred of ['/admin/subscribers', '/admin/partnerships', '/admin/updates']) {
      expect(hrefs).not.toContain(deferred);
    }
  });

  it('names a locale key for every label, never a literal', () => {
    for (const item of NAV_ITEMS) {
      expect(item.labelKey).toMatch(/^admin\.nav\./);
    }
  });

  it('lists every screen for at least one role', () => {
    for (const item of NAV_ITEMS) {
      expect(item.roles.length).toBeGreaterThan(0);
    }
  });
});

describe('write predicates', () => {
  it('lets admin and editor write, and viewer never', () => {
    expect(canWrite('admin')).toBe(true);
    expect(canWrite('editor')).toBe(true);
    expect(canWrite('viewer')).toBe(false);
  });

  it('reserves administration for admin', () => {
    expect(canAdminister('admin')).toBe(true);
    expect(canAdminister('editor')).toBe(false);
    expect(canAdminister('viewer')).toBe(false);
  });
});
