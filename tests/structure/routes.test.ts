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

  it('serves the password reset request at /admin/forgot-password', () => {
    expect(routes()['/(admin)/admin/forgot-password/page']).toBe('/admin/forgot-password');
  });

  it('serves the admin resources table at /admin/resources', () => {
    expect(routes()['/(admin)/admin/resources/page']).toBe('/admin/resources');
  });

  it('serves the bulk import at /admin/resources/import', () => {
    // A sibling of /new rather than a query on the table: it is its own screen
    // with its own role gate.
    expect(routes()['/(admin)/admin/resources/import/page']).toBe('/admin/resources/import');
  });

  it('serves the review queue at /admin/review', () => {
    expect(routes()['/(admin)/admin/review/page']).toBe('/admin/review');
  });

  it('serves the settings screen at /admin/settings', () => {
    expect(routes()['/(admin)/admin/settings/page']).toBe('/admin/settings');
  });

  it('serves the reach and engagement placeholder at /admin/reach', () => {
    expect(routes()['/(admin)/admin/reach/page']).toBe('/admin/reach');
  });

  it('serves the admin audit log at /admin/audit', () => {
    expect(routes()['/(admin)/admin/audit/page']).toBe('/admin/audit');
  });

  it('exposes the health route handler at /api/health', () => {
    expect(routes()['/api/health/route']).toBe('/api/health');
  });

  it('never leaks a route group name into a public URL', () => {
    for (const url of Object.values(routes())) {
      expect(url, `${url} contains a route group segment`).not.toMatch(/\(|\)/);
    }
  });

  it('serves privacy and terms from the (public) group', () => {
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

  it('serves resource detail from the (public) group at /resources/[id]', () => {
    expect(routes()['/(public)/resources/[id]/page']).toBe('/resources/[id]');
  });

  it('keeps resource detail resolvable for rows published after the build', () => {
    // generateStaticParams pre-renders the resources that were live at build
    // time, but a resource published from the admin portal afterwards must
    // still resolve without a rebuild. That depends on dynamicParams staying
    // at its default of true, which shows up as the segment appearing in
    // prerender-manifest.json's dynamicRoutes. Setting dynamicParams = false
    // would leave the pre-rendered ids working and 404 every later one — a
    // failure that is invisible until the client publishes something.
    const manifest = JSON.parse(
      readFileSync('.next/prerender-manifest.json', 'utf8'),
    ) as { dynamicRoutes?: Record<string, unknown> };
    expect(Object.keys(manifest.dynamicRoutes ?? {})).toContain('/resources/[id]');
  });

  it('builds only the public pages SP2a owns', () => {
    // PRD 5's full public surface. Anything else appearing here means scope
    // has crept — the alerts and suggest-a-resource modals are SP2b, and there
    // is deliberately no /directory route because PRD 5.1 item 8 puts the
    // directory on the home page, where the query string is the shareable
    // filter state.
    //
    // /contact is PRD 9.1's contact form (name, email, message), added on the
    // client's request that the public surface match the prototype, which has
    // a Contact view of its own. Only the storage half exists: §9.1 also
    // requires the message be delivered to the mailbox with reply-to set,
    // rate limited and spam protected, and §9.4 makes delivery wait on a
    // transactional email provider that has not been chosen. The row lands in
    // contact_messages with delivered_at null, which is what marks it
    // undelivered rather than silently claiming it was sent.
    const publicUrls = Object.entries(routes())
      .filter(([source]) => source.startsWith('/(public)/'))
      .map(([, url]) => url);
    expect(publicUrls.sort()).toEqual([
      '/',
      '/contact',
      '/impact',
      '/privacy',
      '/resources/[id]',
      '/terms',
    ]);
  });
});

// Both admin placeholders became real screens in SP3 Task 2. Nothing under
// src/app is a placeholder any more, so the former `describe('placeholder
// pages', ...)` block — which looped over a PLACEHOLDERS array to build its
// `it`s — is removed rather than kept with an empty array: Vitest treats a
// `describe` that registers zero tests as a failure ("No test found in
// suite"), so an inert loop is not actually harmless here.

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

  it('documents why server actions live outside the route tree, and the rules that apply there', () => {
    // This used to be `expect(existsSync(...)).toBe(true)`, which truncating
    // the file to zero bytes passed — the exact shape the test above declines
    // to use, sitting ten lines below it.
    //
    // A doc cannot guard an invariant, so this does not pretend to. What it
    // guards is that the written contract for src/lib/actions still states
    // every rule a *machine* guard enforces elsewhere, because each of those
    // guards fails with a message that assumes the reader can go and find out
    // why the rule exists. Delete the paragraph and the guard survives with
    // its reason gone; that is what this catches.
    const readme = readFileSync('src/lib/actions/README.md', 'utf8');

    // The placement reason, which is the thing the file is named for.
    for (const reason of ['src/app/api', 'route.ts']) {
      expect(readme, `the README no longer explains the placement in terms of ${reason}`).toContain(
        reason,
      );
    }

    // One entry per rule that a test in tests/structure asserts against the
    // action modules themselves. The comment names the enforcing guard so a
    // failure here is traceable to what it leaves unexplained.
    const enforcedRules: [rule: string, enforcedBy: string][] = [
      ['requireRole', 'tests/structure/action-role-checks.test.ts'],
      ['revalidateTag', 'tests/structure/revalidation-contract.test.ts'],
      ['createAdminSupabase', 'tests/structure/service-role-containment.test.ts'],
      ['audit_log', 'the append-only policies in tests/rls'],
      ['Zod', 'the schema suites in tests/unit'],
    ];
    for (const [rule, enforcedBy] of enforcedRules) {
      expect(
        readme,
        `${rule} is enforced by ${enforcedBy} but is no longer explained in ` +
          `src/lib/actions/README.md`,
      ).toContain(rule);
    }
  });

  it('documents every api endpoint that exists, and names the sub-project adding each planned one', () => {
    const readme = readFileSync('src/app/api/README.md', 'utf8');

    // The half that guards rather than describes: every route handler the
    // build actually produced must be documented. A `toContain('events')`
    // check is satisfied by the word appearing anywhere in prose, and says
    // nothing at all about the endpoints that exist.
    const live = Object.values(routes()).filter((url) => url.startsWith('/api/'));
    expect(live.length, 'no /api route in the manifest — this assertion would be vacuous').
      toBeGreaterThan(0);
    for (const url of live) {
      expect(readme, `${url} is built but undocumented in src/app/api/README.md`).toContain(url);
    }

    // The planned ones, each of which must appear as a real table row whose
    // third column names the sub-project that adds it. Read as cells rather
    // than as a regex over the whole line: the notes column mentions SP5 for
    // the contact endpoint's email delivery, so a line-wide `.*SP\d` is
    // satisfied by a row whose sub-project cell has been emptied — which is
    // precisely the "matched something, guarded nothing" failure this file is
    // being cleaned of.
    const cellsOf = (endpoint: string): string[] => {
      const line = readme
        .split('\n')
        .find((row) => row.includes(`\`POST /api/${endpoint}\``));
      return line ? line.split('|').map((cell) => cell.trim()) : [];
    };
    for (const endpoint of ['events', 'contact', 'submissions', 'subscribers']) {
      const cells = cellsOf(endpoint);
      expect(cells[1], `/api/${endpoint} has no row in the endpoint table`).toBe(
        `\`POST /api/${endpoint}\``,
      );
      expect(
        cells[3],
        `/api/${endpoint} does not name the sub-project that adds it`,
      ).toMatch(/^SP\d$/);
    }
  });
});
