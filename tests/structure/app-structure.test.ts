import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REQUIRED = [
  'src/app/layout.tsx',
  'src/app/globals.css',
  'src/lib/i18n.ts',
  'src/locales/en.json',
  'src/locales/fr.json',
  'src/locales/pt.json',
  'src/locales/ar.json',
  'tsconfig.json',
  'vitest.config.ts',
  'next.config.ts',
  '.env.example',
];

// Deleting these is the point of Task 1 Step 10, and a future
// `create-next-app` rerun would quietly bring them back.
const FORBIDDEN = [
  'src/app/page.tsx',
  'public/next.svg',
  'public/vercel.svg',
  'public/file.svg',
  'public/globe.svg',
  'public/window.svg',
  'tailwind.config.ts',
  'tailwind.config.js',
  'AGENTS.md',
];

describe('app skeleton', () => {
  for (const file of REQUIRED) {
    it(`has ${file}`, () => {
      expect(existsSync(file), `${file} is missing`).toBe(true);
    });
  }

  for (const file of FORBIDDEN) {
    it(`does not have ${file}`, () => {
      expect(existsSync(file), `${file} should have been removed`).toBe(false);
    });
  }
});

describe('typescript configuration', () => {
  const tsconfig = JSON.parse(readFileSync('tsconfig.json', 'utf8')) as {
    compilerOptions: Record<string, unknown>;
  };

  it('enables strict mode', () => {
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });

  it('enables noUncheckedIndexedAccess', () => {
    expect(tsconfig.compilerOptions.noUncheckedIndexedAccess).toBe(true);
  });

  it('maps the @ alias to src', () => {
    expect(tsconfig.compilerOptions.paths).toMatchObject({ '@/*': ['./src/*'] });
  });
});

describe('globals.css', () => {
  const css = readFileSync('src/app/globals.css', 'utf8');

  it('imports tailwind', () => {
    expect(css).toContain('@import "tailwindcss"');
  });

  it('does not round-trip to google fonts', () => {
    expect(css).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
  });
});

/**
 * CLAUDE.md: no hardcoded colours, use design tokens. The token block itself
 * is SP1 Task 2, so until then the correct number of colour values in this
 * repository is zero, and SP1 Task 2 is told to rely on this guard.
 *
 * Two widenings over the original, both of which the guard needed to be
 * worth relying on:
 *
 *  - Every notation, not only hex. Tailwind v4 tokens are conventionally
 *    written in `oklch()`, so a hex-only guard would have missed the single
 *    most likely form of the mistake it exists to catch.
 *  - Every file under `src/`, not `globals.css` alone. A hardcoded colour is
 *    far more likely to arrive as `style={{ color: '#1F5FBF' }}` or a
 *    `bg-[#1F5FBF]` arbitrary value in a `.tsx` file than in the one CSS file
 *    whose comment already forbids it.
 *
 * When SP1 Task 2 lands the real `@theme` block, this guard must be narrowed
 * deliberately — to "colours only inside `@theme`" — not simply deleted.
 */
describe('no hardcoded colour anywhere in src/ — tokens are SP1 Task 2', () => {
  function sourceFiles(dir = 'src', out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) sourceFiles(full, out);
      else if (/\.(ts|tsx|css|json)$/.test(entry)) out.push(full);
    }
    return out;
  }

  const NOTATIONS: Record<string, RegExp> = {
    // 3, 4, 6 or 8 digits. Anchored on a non-word character so a URL
    // fragment or a `#1` issue reference is not a colour.
    hex: /(?<![\w#])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![0-9a-z])/i,
    oklch: /\boklch\(/i,
    rgb: /\brgba?\(/i,
    hsl: /\bhsla?\(/i,
  };

  for (const [notation, pattern] of Object.entries(NOTATIONS)) {
    it(`declares no ${notation} colour value`, () => {
      const offenders = sourceFiles()
        .flatMap((file) =>
          readFileSync(file, 'utf8')
            .split('\n')
            .map((line, index) => ({ file, line: index + 1, text: line }))
            .filter(({ text }) => pattern.test(text)),
        )
        .map(({ file, line, text }) => `${file}:${line}: ${text.trim()}`);

      expect(offenders, `hardcoded ${notation} colour — use a design token`).toEqual([]);
    });
  }
});

describe('root layout', () => {
  const layout = readFileSync('src/app/layout.tsx', 'utf8');

  it('sets noindex metadata for the gated review deploy', () => {
    expect(layout).toMatch(/robots:\s*\{\s*index:\s*false/);
  });

  it('does not import a font from next/font/google', () => {
    expect(layout).not.toContain('next/font/google');
  });

  it('takes its title and description from the locale file', () => {
    // <title> and <meta description> are user-facing, so they go through t().
    expect(layout).toMatch(/title:\s*t\(/);
    expect(layout).toMatch(/description:\s*t\(/);
  });
});
