import { describe, it, expect } from 'vitest';
import {
  suggestionInput,
  composeSuggestionDescription,
  SUGGESTION_DESCRIPTION_MAX,
} from '@/lib/schemas/suggestion';
import { resourceInput } from '@/lib/schemas/resource';
import { COUNTRIES, SECTORS } from '@/lib/reference';

const VALID = {
  resourceName: 'GPU credits',
  organisation: 'Example Compute Co',
  need: 'compute',
  sectors: ['Energy'],
  countries: ['Kenya'],
  openToAll: false,
  description: 'Credits for early-stage teams.',
  link: 'https://example.org/apply',
  deadline: null,
  programmeContactEmail: '',
  submitterName: 'Ada Submitter',
  submitterEmail: 'Ada@Example.org',
  website: '',
};

describe('suggestionInput', () => {
  it('accepts the form as the visitor sends it and lowercases the email', () => {
    const parsed = suggestionInput.parse(VALID);
    expect(parsed.submitterEmail).toBe('ada@example.org');
  });

  it('insists on https', () => {
    expect(suggestionInput.safeParse({ ...VALID, link: 'http://example.org' }).success).toBe(false);
    expect(suggestionInput.safeParse({ ...VALID, link: 'example.org' }).success).toBe(false);
  });

  it('refuses a filled honeypot', () => {
    expect(suggestionInput.safeParse({ ...VALID, website: 'http://spam.example' }).success).toBe(
      false,
    );
  });

  it('accepts an empty programme contact and lowercases a given one', () => {
    expect(suggestionInput.parse(VALID).programmeContactEmail).toBe('');
    expect(
      suggestionInput.parse({ ...VALID, programmeContactEmail: 'Team@Example.org' })
        .programmeContactEmail,
    ).toBe('team@example.org');
    expect(
      suggestionInput.safeParse({ ...VALID, programmeContactEmail: 'not-an-address' }).success,
    ).toBe(false);
  });

  it('refuses a country or sector that is not on the list', () => {
    expect(suggestionInput.safeParse({ ...VALID, countries: ['Atlantis'] }).success).toBe(false);
    expect(suggestionInput.safeParse({ ...VALID, sectors: ['Mining'] }).success).toBe(false);
  });
});

describe('composeSuggestionDescription', () => {
  it('appends one line of countries, sectors and deadline', () => {
    const text = composeSuggestionDescription(
      suggestionInput.parse({ ...VALID, deadline: '2026-12-31' }),
    );
    expect(text.startsWith(VALID.description)).toBe(true);
    expect(text).toContain('Kenya');
    expect(text).toContain('Energy');
    expect(text).toContain('2026-12-31');
  });

  it('says open to all and all sectors when nothing was chosen', () => {
    const text = composeSuggestionDescription(
      suggestionInput.parse({ ...VALID, countries: [], sectors: [], openToAll: true }),
    );
    expect(text).toContain('Open to all countries');
    expect(text).toContain('All sectors');
    expect(text).toContain('Rolling');
  });

  it('carries none of the three personal fields', () => {
    // The prototype appends the contact address here and then publishes the
    // description. This must never contain an address of any kind.
    const text = composeSuggestionDescription(
      suggestionInput.parse({ ...VALID, programmeContactEmail: 'team@example.org' }),
    );
    expect(text).not.toContain('@');
    expect(text).not.toContain('Ada Submitter');
  });

  it('fits the resource description cap in the worst case', () => {
    const text = composeSuggestionDescription(
      suggestionInput.parse({
        ...VALID,
        description: 'x'.repeat(SUGGESTION_DESCRIPTION_MAX),
        countries: [...COUNTRIES],
        sectors: [...SECTORS],
        deadline: '2026-12-31',
      }),
    );
    expect(resourceInput.shape.description.safeParse(text).success).toBe(true);
  });
});
