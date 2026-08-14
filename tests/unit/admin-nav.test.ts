import { describe, it, expect } from 'vitest';
import { NAV_ITEMS, visibleNavItems, canWrite, canAdminister } from '@/lib/admin/guard';

describe('visibleNavItems', () => {
  it('shows every launch screen to an admin', () => {
    expect(visibleNavItems('admin').map((i) => i.href)).toEqual([
      '/admin',
      '/admin/resources',
      '/admin/content',
      '/admin/settings',
      '/admin/users',
      '/admin/audit',
    ]);
  });

  it('hides Settings and Users from an editor', () => {
    const hrefs = visibleNavItems('editor').map((i) => i.href);
    expect(hrefs).not.toContain('/admin/settings');
    expect(hrefs).not.toContain('/admin/users');
    expect(hrefs).toContain('/admin/content');
  });

  it('hides Settings and Users from a viewer too', () => {
    const hrefs = visibleNavItems('viewer').map((i) => i.href);
    expect(hrefs).toEqual(['/admin', '/admin/resources', '/admin/content', '/admin/audit']);
  });

  it('links to no deferred screen', () => {
    // The deferred screens have no route (spec 2). A nav entry pointing at a
    // route that does not exist is a 404 waiting to be clicked, and a
    // disabled "coming soon" entry invites the question of when.
    const hrefs = NAV_ITEMS.map((i) => i.href);
    for (const deferred of [
      '/admin/subscribers',
      '/admin/partnerships',
      '/admin/reach',
      '/admin/review',
      '/admin/updates',
    ]) {
      expect(hrefs).not.toContain(deferred);
    }
  });

  it('names a locale key for every label, never a literal', () => {
    for (const item of NAV_ITEMS) {
      expect(item.labelKey).toMatch(/^admin\.nav\./);
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
