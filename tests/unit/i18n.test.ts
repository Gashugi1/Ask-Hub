import { describe, it, expect } from 'vitest';
import { t, DEFAULT_LOCALE } from '@/lib/i18n';
import en from '@/locales/en.json';
import fr from '@/locales/fr.json';
import pt from '@/locales/pt.json';
import ar from '@/locales/ar.json';

const dictionary = en as Record<string, string>;

describe('t()', () => {
  it('resolves a known key', () => {
    expect(t('site.name')).toBe('AI Hub for Sustainable Development');
  });

  it('returns the key itself for a missing lookup so gaps are visible', () => {
    // A blank string would hide the gap; the key renders as an obvious token.
    expect(t('does.not.exist')).toBe('does.not.exist');
  });

  it('interpolates named variables', () => {
    expect(t('deadline.daysLeft', { count: 6 })).toBe('6 days left');
  });

  it('leaves an unsupplied placeholder visibly intact', () => {
    expect(t('deadline.daysLeft')).toBe('{count} days left');
  });

  it('falls back to English for an unknown locale', () => {
    expect(t('site.name', undefined, 'xx')).toBe(dictionary['site.name']);
  });

  it('defaults to English', () => {
    expect(DEFAULT_LOCALE).toBe('en');
  });
});

describe('en.json hygiene', () => {
  it('is flat — no nested objects', () => {
    for (const [key, value] of Object.entries(dictionary)) {
      expect(typeof value, `${key} is not a string`).toBe('string');
    }
  });

  it('has no empty values', () => {
    for (const [key, value] of Object.entries(dictionary)) {
      expect(value, `empty value for ${key}`).not.toBe('');
    }
  });

  it('ships fr, pt and ar stubs', () => {
    // PRD 12.4: adding a locale file makes that locale selectable with no
    // code change. The switcher itself is SP6.
    for (const stub of [fr, pt, ar]) {
      expect(typeof stub).toBe('object');
    }
  });
});

describe('PRD 10 content rules', () => {
  const all = JSON.stringify(en);

  it('uses the co-led attribution', () => {
    expect(all).toContain('co-led by MIMIT and UNDP');
  });

  it('never says "powered by" or "implemented by"', () => {
    expect(all).not.toMatch(/powered by|implemented by/i);
  });

  it('carries the exact footer wording from rule 10.1', () => {
    expect(dictionary['site.footer']).toBe(
      'Co-led by the Ministry of Enterprises and Made in Italy and the United Nations Development Programme.',
    );
  });

  it('never says "the Hub" alone', () => {
    // Rule 10.2: always "AI Hub" or "AI Hub for Sustainable Development".
    expect(all).not.toMatch(/\bthe Hub\b(?! for)/);
  });

  it('uses one mailbox only', () => {
    expect(dictionary['site.contactEmail']).toBe('aihubfordevelopment@undp.org');
    expect(all).not.toMatch(/info@|partnerships@/i);
  });

  it('states curation once, globally, with no per-resource Verified badge', () => {
    // Rule 10.8 and PRD 16.1.
    expect(dictionary['site.curationStatement']).toBe(
      'Every resource is curated and verified by the AI Hub team.',
    );
    expect(all).not.toMatch(/"[^"]*\bVerified\b[^"]*"/);
  });

  it('offers no "Global programmes" country filter value', () => {
    // Rule 10.6.
    expect(all).not.toMatch(/Global programmes/i);
  });

  it('carries no fabricated metric from the prototype GADATA block', () => {
    // PRD 8.4: a plausible fake number reaching production is a
    // launch-blocking defect. These are the prototype's invented figures.
    for (const figure of ['14,698', '12,840', '17,650', '2,583']) {
      expect(all, `fabricated figure ${figure}`).not.toContain(figure);
    }
  });
});
