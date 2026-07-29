import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/app/globals.css', 'utf8');

const REQUIRED_TOKENS: Record<string, string> = {
  '--color-primary': '#1F5FBF',
  '--color-navy': '#1A2332',
  '--color-deep-blue': '#003D60',
  '--color-orange': '#F06428',
  '--color-hairline': '#DDE5EE',
  '--color-need-compute': '#1F5FBF',
  '--color-need-training': '#0E7A8A',
  '--color-need-funding': '#B4691F',
  '--color-need-accelerator': '#6C3FA8',
  '--color-need-partners': '#0E7A54',
};

describe('design tokens', () => {
  for (const [token, value] of Object.entries(REQUIRED_TOKENS)) {
    it(`defines ${token} as ${value}`, () => {
      expect(css).toMatch(new RegExp(`${token}\\s*:\\s*${value}`, 'i'));
    });
  }

  it('self-hosts Outfit rather than fetching from Google Fonts', () => {
    expect(css).toContain('/fonts/outfit-latin.woff2');
    expect(css).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
  });
});
