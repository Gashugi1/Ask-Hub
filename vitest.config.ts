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
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
});
