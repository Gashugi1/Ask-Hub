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
 * CLAUDE.md: no hardcoded colours, use design tokens. SP1 Task 2 lands the
 * real `@theme` block in `src/app/globals.css` — the one place a colour
 * literal is *supposed* to appear, because that block is the definition
 * site of the tokens everything else must reference. Narrowed here, not
 * deleted: the brief's own comment on this guard is explicit that deleting
 * it would let SP2 and SP3 land hardcoded colours in components with
 * nothing to catch them.
 *
 * Everywhere else a colour literal is still the exact defect this guard
 * exists to catch — including the rest of `globals.css` outside `@theme`
 * (the `@font-face` blocks, the `body` rule) and, most likely in practice,
 * a component's `style={{ color: '#1F5FBF' }}` or a `bg-[#1F5FBF]`
 * arbitrary Tailwind value in a `.tsx` file.
 *
 * Two widenings kept from the original guard, both still load-bearing:
 *
 *  - Every notation, not only hex. Tailwind v4 tokens are conventionally
 *    written in `oklch()` (and the `@theme` block's own shadow uses
 *    `rgb()`), so a hex-only guard would have missed the single most
 *    likely form of the mistake it exists to catch.
 *  - Every file under `src/`, not `globals.css` alone. A hardcoded colour is
 *    far more likely to arrive as `style={{ color: '#1F5FBF' }}` or a
 *    `bg-[#1F5FBF]` arbitrary value in a `.tsx` file than in CSS.
 */
describe('no hardcoded colour outside the @theme token block', () => {
  function sourceFiles(dir = 'src', out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) sourceFiles(full, out);
      else if (/\.(ts|tsx|css|json)$/.test(entry)) out.push(full);
    }
    return out;
  }

  /**
   * Which lines of `globals.css` fall inside its `@theme { ... }` block,
   * found by brace depth from the `@theme` keyword rather than a fixed line
   * range, so the exemption tracks the block as it grows and does not leak
   * into the `@font-face` or `body` rules that sit outside it in the same
   * file.
   */
  function themeBlockLines(lines: string[]): boolean[] {
    const inside = new Array<boolean>(lines.length).fill(false);
    let depth = 0;
    let inTheme = false;
    lines.forEach((line, i) => {
      if (!inTheme) {
        if (!line.includes('@theme')) return;
        inTheme = true;
      }
      inside[i] = true;
      for (const ch of line) {
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
      }
      if (depth <= 0) inTheme = false;
    });
    return inside;
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
    it(`declares no ${notation} colour value outside @theme`, () => {
      const offenders = sourceFiles()
        .flatMap((file) => {
          const lines = readFileSync(file, 'utf8').split('\n');
          const exempt =
            file === 'src/app/globals.css' ? themeBlockLines(lines) : lines.map(() => false);
          return lines
            .map((text, index) => ({ file, line: index + 1, text, exempt: exempt[index] }))
            .filter(({ text, exempt }) => !exempt && pattern.test(text));
        })
        .map(({ file, line, text }) => `${file}:${line}: ${text.trim()}`);

      expect(
        offenders,
        `hardcoded ${notation} colour outside @theme — use a design token`,
      ).toEqual([]);
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
