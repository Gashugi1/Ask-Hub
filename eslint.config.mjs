import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Not project source. `.claude/` is gitignored, but ESLint's flat config
    // does not consult .gitignore, so a git worktree created under
    // `.claude/worktrees/` gets walked as if it were part of this checkout —
    // a second copy of the tree plus whatever build output it carries. That
    // reported 1,340 errors and 16,645 warnings from files no one here edits,
    // which made `npm run lint` unusable as a gate: a real error in src/ was
    // indistinguishable from the noise. Scoped to the directory rather than
    // the worktree name, since the next worktree will have a different one.
    ".claude/**",
  ]),
]);

export default eslintConfig;
