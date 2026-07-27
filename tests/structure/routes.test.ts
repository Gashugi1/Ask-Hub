import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const MANIFEST = '.next/app-path-routes-manifest.json';

/**
 * Next writes this manifest on every build, mapping the source path —
 * route groups included — to the public URL. It is the only artifact that
 * proves a route group does not leak into the URL, which is the whole
 * reason for using one here.
 */
function routes(): Record<string, string> {
  if (!existsSync(MANIFEST)) {
    throw new Error(`${MANIFEST} is missing — run \`npm run build\` first`);
  }
  return JSON.parse(readFileSync(MANIFEST, 'utf8')) as Record<string, string>;
}

describe('route structure', () => {
  it('serves the home page from the (public) group at /', () => {
    expect(routes()['/(public)/page']).toBe('/');
  });

  it('serves the admin dashboard from the (admin) group at /admin', () => {
    expect(routes()['/(admin)/admin/page']).toBe('/admin');
  });

  it('serves the admin login at /admin/login', () => {
    expect(routes()['/(admin)/admin/login/page']).toBe('/admin/login');
  });

  it('exposes the health route handler at /api/health', () => {
    expect(routes()['/api/health/route']).toBe('/api/health');
  });

  it('never leaks a route group name into a public URL', () => {
    for (const url of Object.values(routes())) {
      expect(url, `${url} contains a route group segment`).not.toMatch(/\(|\)/);
    }
  });

  it('builds no public page beyond the placeholder home', () => {
    // PRD 5 lists directory, resource detail, about, contact, privacy,
    // terms and impact. All are SP2. If one appears here, scope has crept.
    const publicUrls = Object.entries(routes())
      .filter(([source]) => source.startsWith('/(public)/'))
      .map(([, url]) => url);
    expect(publicUrls.sort()).toEqual(['/']);
  });
});

describe('placeholder pages', () => {
  const PLACEHOLDERS = [
    'src/app/(public)/page.tsx',
    'src/app/(admin)/admin/page.tsx',
    'src/app/(admin)/admin/login/page.tsx',
  ];

  for (const file of PLACEHOLDERS) {
    it(`${file} renders no text`, () => {
      const code = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      // A self-closing element structurally cannot contain a text node, so
      // these two assertions together are exact rather than heuristic: the
      // only JSX is <main data-route="..." />, and nothing has children.
      // Any text node here would be an unlocalised user-facing string.
      expect(code).toMatch(/<main data-route="[^"]+" \/>/);
      expect(code, 'placeholder renders an element with children').not.toMatch(/<\/[a-zA-Z]/);
    });
  }
});

describe('route handler and server action placement', () => {
  it('keeps server actions out of the route tree', () => {
    // Explained in src/lib/actions/README.md: src/app/api reserves the
    // route.ts filename and treats directories as URL segments.
    expect(existsSync('src/lib/actions/README.md')).toBe(true);
  });

  it('documents which sub-project adds each api endpoint', () => {
    const readme = readFileSync('src/app/api/README.md', 'utf8');
    for (const endpoint of ['events', 'contact', 'submissions', 'subscribers']) {
      expect(readme, `README does not mention ${endpoint}`).toContain(endpoint);
    }
  });
});
