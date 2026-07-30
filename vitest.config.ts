import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

// Loaded here rather than in a setup file so the DB suites added by the
// schema tasks see credentials before their module-level client factories run.
config({ path: '.env.test' });

export default defineConfig({
  test: {
    // The RLS suites added later share one Postgres instance and assert on
    // row visibility. Parallel files would interleave writes and go flaky.
    fileParallelism: false,
    // `.test.tsx` is included deliberately: component suites arrive with the
    // public surface and the admin screens. An include pattern of `.test.ts`
    // alone would skip every one of them and still report the run green.
    include: ['tests/**/*.test.{ts,tsx}'],
    // The DB suites assert on Postgres row visibility and must run in node.
    // Component suites opt into jsdom per file with a
    // `// @vitest-environment jsdom` docblock, so this default stays node.
    // Stated explicitly rather than left to Vitest's default: the default is
    // already node, so this changes no outcome today -- it exists so that a
    // future config edit reaching for a global jsdom has to delete a line
    // that says why not, rather than fill in a blank.
    environment: 'node',
    // The DB suites name every throwaway row with a `Date.now()` stamp so
    // repeated runs cannot collide, but nothing removed them: the local
    // database had accumulated 354 fixture resources against 11 real ones,
    // and every one of them is `status = 'live'`, so `next build` prerendered
    // a page for each. This sweeps them before and after every run -- before
    // as well as after, because a run that is killed never reaches its own
    // teardown and the next run should not inherit the wreckage.
    globalSetup: ['tests/helpers/global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      // Vitest does not resolve the `react-server` export condition, so
      // `server-only` would otherwise resolve to its throwing `index.js` and
      // make every server module untestable -- including the role checks
      // CLAUDE.md requires coverage for. Aliasing to the package's own no-op
      // shim keeps the marker fully meaningful in a real Next build (where the
      // `react-server` condition decides which file loads) while letting tests
      // import the module under test. Never delete the marker to make a test
      // pass: it is what turns a client import of the service_role key into a
      // build error instead of a leaked secret.
      'server-only': new URL(
        './node_modules/server-only/empty.js',
        import.meta.url,
      ).pathname,
    },
  },
});
