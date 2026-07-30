import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

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

/** Every file under dir, recursively. Returns [] when dir does not exist. */
function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/**
 * The manifest is a gitignored build artifact that `npm test` does not
 * produce, so every assertion in this file is only as current as the last
 * `npm run build`.
 *
 * A missing manifest is caught above and is loud. A *stale* one is the
 * dangerous case: delete a route, run `npm test` without rebuilding, and every
 * assertion below passes against a route table that no longer exists — a green
 * suite certifying a structure the repository does not have. Comparing mtimes
 * turns that silent false pass into an explicit instruction.
 *
 * Deliberately ordered first in the file so the diagnostic is the first thing
 * a reader sees rather than being buried under whatever the stale manifest
 * happens to make fail.
 */
describe('the build manifest these assertions read is current', () => {
  it('is newer than every file under src/app', () => {
    expect(existsSync(MANIFEST), `${MANIFEST} is missing — run \`npm run build\``).toBe(
      true,
    );

    const manifestMtime = statSync(MANIFEST).mtimeMs;
    const stale = walk('src/app')
      .map((file) => ({ file, mtime: statSync(file).mtimeMs }))
      .filter(({ mtime }) => mtime > manifestMtime)
      .map(({ file }) => file);

    expect(
      stale,
      `${MANIFEST} predates ${stale.length} file(s) under src/app, so the route ` +
        `assertions in this file would check a stale route table — run ` +
        `\`npm run build\` and re-run the suite. Newer: ${stale.join(', ')}`,
    ).toEqual([]);
  });
});

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

  it('serves about, privacy and terms from the (public) group', () => {
    expect(routes()['/(public)/about/page']).toBe('/about');
    expect(routes()['/(public)/privacy/page']).toBe('/privacy');
    expect(routes()['/(public)/terms/page']).toBe('/terms');
  });

  it('builds /impact even though it returns 404 at runtime', () => {
    // PRD 5.7: the page is built and gated behind feature_public_impact_page,
    // which is off at launch. The gate lives in the page (it calls notFound()
    // when the flag is false), not in the route table — so its presence here
    // is correct, and its absence would mean the page had been deleted rather
    // than gated. tests/components/impact-gate.test.ts covers the 404 itself.
    expect(routes()['/(public)/impact/page']).toBe('/impact');
  });

  it('builds only the public pages SP2a owns', () => {
    // PRD 5's full public surface. /resources/[id] arrives with SP2a Task 5.
    // Anything else appearing here means scope has crept — the alerts and
    // suggest-a-resource modals are SP2b, and there is deliberately no
    // /directory route because PRD 5.1 item 8 puts the directory on the home
    // page, where the query string is the shareable filter state.
    const publicUrls = Object.entries(routes())
      .filter(([source]) => source.startsWith('/(public)/'))
      .map(([, url]) => url);
    expect(publicUrls.sort()).toEqual(['/', '/about', '/impact', '/privacy', '/terms']);
  });
});

describe('placeholder pages', () => {
  // The public home stopped being a placeholder in SP2a Task 4, which puts
  // the directory on it; Task 6 adds the bands above. The two admin
  // placeholders stay until SP3.
  const PLACEHOLDERS = [
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
    // src/app/api reserves the route.ts filename and treats directories as
    // URL segments, so a 'use server' module has no business there. Asserted
    // against the tree itself rather than against the README that explains
    // it — a doc-exists check would name this invariant without guarding it.
    const offenders = walk('src/app/api')
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .filter((file) => /['"]use server['"]/.test(readFileSync(file, 'utf8')));
    expect(
      offenders,
      `'use server' found under src/app/api: ${offenders.join(', ')}`,
    ).toEqual([]);
  });

  it('documents why server actions live outside the route tree', () => {
    expect(existsSync('src/lib/actions/README.md')).toBe(true);
  });

  it('documents which sub-project adds each api endpoint', () => {
    const readme = readFileSync('src/app/api/README.md', 'utf8');
    for (const endpoint of ['events', 'contact', 'submissions', 'subscribers']) {
      expect(readme, `README does not mention ${endpoint}`).toContain(endpoint);
    }
  });
});
