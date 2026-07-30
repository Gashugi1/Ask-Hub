import { describe, it, expect } from 'vitest';
import { isFixtureValue, fixtureStamp } from '../helpers/fixtures';

/**
 * The fixture discriminator decides what gets deleted from the database, so
 * the case that matters is the negative one: a real row must never look like
 * a fixture. The names below are taken verbatim from live rows in the local
 * database, including the ones most likely to trip a naive "contains digits"
 * check.
 */
describe('isFixtureValue', () => {
  it('matches the Date.now() suffix every DB suite actually uses', () => {
    // Sampled from rows the suites left behind before cleanup existed.
    for (const name of [
      'Rolling resource 1785417824768',
      'Anon probe 1785417823229',
      'audit-viewer-1785411537823',
      'Live and visible 1785411491391',
      'doomed-1785411492933@askhub.test',
      'unsolicited-signup-1785417823329@askhub.test',
    ]) {
      expect(isFixtureValue(name), name).toBe(true);
    }
  });

  it('never matches a real resource name', () => {
    // Real live content, read out of `resources` where the name carries no
    // stamp. If this test ever fails, cleanup is about to delete client data.
    for (const name of [
      'Meta Llama Impact Grants',
      'Mercy Corps Ventures',
      'Orange Ventures Africa',
      'Safaricom Spark Venture Fund',
      'GSMA Innovation Fund — Africa',
      'State of AI Report',
      'EU AI Act Summary',
      'AfriLabs Talent Hub & AI Community',
      'NVIDIA Inception',
      'Zindi Community',
      'Stanford Machine Learning Specialisation',
      'Kaggle Datasets & Competitions',
      'CINECA Leonardo',
    ]) {
      expect(isFixtureValue(name), name).toBe(false);
    }
  });

  it('requires a plausible epoch-millisecond value, not any thirteen digits', () => {
    // A grant reference or dataset identifier can easily be thirteen digits
    // long. Only the 1[7-9] range is treated as a stamp, which covers 2023
    // to 2033 -- comfortably beyond this project's life.
    expect(isFixtureValue('Grant 2024000000001')).toBe(false);
    expect(isFixtureValue('Dataset 9999999999999')).toBe(false);
    expect(isFixtureValue('Reference 1234567890123')).toBe(false);
  });

  it('requires exactly thirteen digits, bounded on both sides', () => {
    // Twelve digits is pre-2001; fourteen is a different kind of identifier.
    // Neither is a Date.now() this decade, and a longer run of digits that
    // merely contains a valid stamp must not count.
    expect(isFixtureValue('Short 178541149139')).toBe(false);
    expect(isFixtureValue('Long 17854114913911')).toBe(false);
    expect(isFixtureValue('Embedded 917854114913911')).toBe(false);
  });

  it('handles absent values rather than throwing', () => {
    // Nullable columns are read straight out of the row, so null and
    // undefined reach this function on ordinary rows.
    expect(isFixtureValue(null)).toBe(false);
    expect(isFixtureValue(undefined)).toBe(false);
    expect(isFixtureValue('')).toBe(false);
  });

  it('recognises a stamp it generates right now', () => {
    // Guards the range assumption above against the clock: if this fails,
    // epoch ms has left the 1[7-9] range and the pattern needs widening.
    expect(isFixtureValue(`Suite fixture ${fixtureStamp()}`)).toBe(true);
  });
});
