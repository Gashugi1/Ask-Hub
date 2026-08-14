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
  // training and funding were darkened from #0E7A8A and #B4691F. PRD §11
  // fixes the five hues but leaves the values to be derived here, and at the
  // originals the NeedBadge pairing failed WCAG AA — see the contrast suite
  // below, which is what actually guards the property.
  '--color-need-training': '#0E7685',
  '--color-need-funding': '#9E5C1B',
  '--color-need-accelerator': '#6C3FA8',
  '--color-need-partners': '#0E7A54',
};

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Reads a token's value straight out of globals.css, so this suite tests the
 *  stylesheet rather than a copy of it kept in the test file. */
function token(name: string): string {
  const match = css.match(new RegExp(`${name}\\s*:\\s*(#[0-9A-Fa-f]{6})`));
  if (!match?.[1]) throw new Error(`token ${name} not found in globals.css`);
  return match[1];
}

const NEEDS = ['compute', 'training', 'funding', 'accelerator', 'partners'] as const;
const AA_NORMAL_TEXT = 4.5;

describe('design tokens', () => {
  for (const [token, value] of Object.entries(REQUIRED_TOKENS)) {
    it(`defines ${token} as ${value}`, () => {
      expect(css).toMatch(new RegExp(`${token}\\s*:\\s*${value}`, 'i'));
    });
  }

  /*
   * These pin a property, not a value: any future re-derivation of the need
   * palette (PRD §11 leaves the exact values open) stays legible, and the
   * regression that shipped training at 4.44:1 and funding at 3.74:1 cannot
   * come back unnoticed. Both usages are normal-size text, so both are held
   * to the 4.5:1 bar rather than the 3:1 large-text one.
   */
  describe('need colours clear WCAG AA where they are used', () => {
    for (const need of NEEDS) {
      it(`${need} badge text is legible on its own background`, () => {
        const ratio = contrast(token(`--color-need-${need}`), token(`--color-need-${need}-bg`));
        expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      });

      it(`${need} works as a solid card header behind white text`, () => {
        const ratio = contrast(token(`--color-need-${need}`), token('--color-surface'));
        expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      });
    }

    it('the welcome band CTA is legible: navy on orange, not white on orange', () => {
      const orange = token('--color-orange');
      expect(contrast(token('--color-navy'), orange)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      // The prototype renders this button white-on-orange. WelcomeBand
      // deliberately does not, and this is why.
      expect(contrast(token('--color-surface'), orange)).toBeLessThan(AA_NORMAL_TEXT);
    });

    it('the dark-band eyebrow clears the lighter end of the welcome gradient', () => {
      // The band runs navy -> deep-blue; deep-blue is the lighter of the two
      // and so the worst case for a light foreground.
      const ratio = contrast(token('--color-eyebrow-on-dark'), token('--color-deep-blue'));
      expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });
  });

  it('self-hosts Outfit rather than fetching from Google Fonts', () => {
    expect(css).toContain('/fonts/outfit-latin.woff2');
    expect(css).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
  });
});
