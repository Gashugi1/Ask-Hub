import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

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

  it('declares no colour value — tokens are SP1 Task 2', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('does not round-trip to google fonts', () => {
    expect(css).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
  });
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
