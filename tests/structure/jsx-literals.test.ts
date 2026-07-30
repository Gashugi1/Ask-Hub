import { describe, it, expect } from 'vitest';
import { findUserFacingLiterals, isAllowedLiteral } from './jsx-literals';

function find(code: string) {
  return findUserFacingLiterals('probe.tsx', code).map((l) => l.text);
}

describe('isAllowedLiteral', () => {
  it('allows punctuation and separators', () => {
    for (const text of ['·', '—', '/', '&', '·  ·', '()', ':']) {
      expect(isAllowedLiteral(text), text).toBe(true);
    }
  });

  it('allows urls and paths', () => {
    for (const text of ['https://example.org', 'mailto:x@y.org', '/resources', 'tel:+100']) {
      expect(isAllowedLiteral(text), text).toBe(true);
    }
  });

  it('allows dotted and hyphenated technical identifiers', () => {
    for (const text of ['application/ld+json', 'site.footer', 'data-route', 'utf-8']) {
      expect(isAllowedLiteral(text), text).toBe(true);
    }
  });

  it('rejects any bare word or sentence', () => {
    for (const text of ['Apply', 'Compute', 'Closed', 'Search resources', 'No results found']) {
      expect(isAllowedLiteral(text), text).toBe(false);
    }
  });
});

describe('findUserFacingLiterals', () => {
  it('flags a JSX text node', () => {
    expect(find('const A = () => <p>Apply now</p>;')).toEqual(['Apply now']);
  });

  it('flags a string expression child', () => {
    expect(find("const A = () => <p>{'Apply now'}</p>;")).toEqual(['Apply now']);
  });

  it('flags a template literal child with no substitutions', () => {
    expect(find('const A = () => <p>{`Apply now`}</p>;')).toEqual(['Apply now']);
  });

  it('flags the four user-facing attributes', () => {
    const code = `
      const A = () => (
        <div>
          <button aria-label="Close the dialog" />
          <abbr title="United Nations" />
          <input placeholder="Search resources" />
          <img alt="Partner logo" />
        </div>
      );`;
    expect(find(code).sort()).toEqual(
      ['Close the dialog', 'Partner logo', 'Search resources', 'United Nations'].sort(),
    );
  });

  it('ignores className, data attributes, href and other non-copy attributes', () => {
    const code = `
      const A = () => (
        <a className="text-navy underline" data-route="/about" href="/about" rel="noopener" target="_blank" id="apply" />
      );`;
    expect(find(code)).toEqual([]);
  });

  it('ignores a t() call and any other expression', () => {
    expect(find("const A = () => <p>{t('cta.apply')}</p>;")).toEqual([]);
    expect(find('const A = () => <p>{resource.name}</p>;')).toEqual([]);
  });

  it('ignores whitespace-only text between elements', () => {
    expect(find('const A = () => (\n  <div>\n    <span />\n  </div>\n);')).toEqual([]);
  });

  it('honours a per-occurrence exemption comment on the same line', () => {
    const code = 'const A = () => <p>AskHub</p>; // i18n-exempt: product name, never translated';
    expect(find(code)).toEqual([]);
  });

  it('honours a per-occurrence exemption comment on the line above', () => {
    const code = [
      'const A = () => (',
      '  // i18n-exempt: product name, never translated',
      '  <p>AskHub</p>',
      ');',
    ].join('\n');
    expect(find(code)).toEqual([]);
  });

  it('reports the line number of each offender', () => {
    const code = ['const A = () => (', '  <p>Apply now</p>', ');'].join('\n');
    expect(findUserFacingLiterals('probe.tsx', code)[0]?.line).toBe(2);
  });
});
