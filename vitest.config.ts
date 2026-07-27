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
