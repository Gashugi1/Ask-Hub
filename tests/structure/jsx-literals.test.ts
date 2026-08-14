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

  it('rejects hyphenated or slashed English, even when it looks identifier-shaped', () => {
    for (const text of [
      'Auto-closed',
      'Co-led',
      'Non-EU',
      'Sign-up',
      'Read-more',
      'AI-powered',
      'MIMIT/UNDP',
      'Compute/Training',
    ]) {
      expect(isAllowedLiteral(text), text).toBe(false);
    }
  });

  it('allows an HTML entity with no other content', () => {
    expect(isAllowedLiteral('&nbsp;')).toBe(true);
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

  it('ignores an HTML entity between elements', () => {
    expect(find('const A = () => <span>&nbsp;</span>;')).toEqual([]);
  });

  it('ignores a plain string outside any JSX', () => {
    expect(find("const label = 'Apply now';")).toEqual([]);
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

  it('honours a JSX-comment exemption on the line above, the only legal comment form inside JSX children', () => {
    const code = [
      'const A = () => (',
      '  <div>',
      '    {/* i18n-exempt: product name, never translated */}',
      '    <p>AskHub</p>',
      '  </div>',
      ');',
    ].join('\n');
    expect(find(code)).toEqual([]);
  });

  it('does not treat a marker written inside the rendered text itself as an exemption', () => {
    // `//` is not a comment inside JSX text, so this string is not a code
    // comment -- it is the literal text the guard exists to catch, and
    // writing the marker inline must not silence it.
    const code = 'const A = () => <p>AskHub // i18n-exempt: product name</p>;';
    expect(find(code)).toEqual(['AskHub // i18n-exempt: product name']);
  });

  it('reports the line number of each offender', () => {
    const code = ['const A = () => (', '  <p>Apply now</p>', ');'].join('\n');
    expect(findUserFacingLiterals('probe.tsx', code)[0]?.line).toBe(2);
  });

  it('reports kind and attribute for an attribute hit, not just the text', () => {
    const code = 'const A = () => <input aria-label="Search resources" />;';
    const [hit] = findUserFacingLiterals('probe.tsx', code);
    expect(hit?.kind).toBe('attribute');
    expect(hit?.attribute).toBe('aria-label');
  });

  it('surfaces a parse failure loudly instead of silently returning no literals', () => {
    expect(() => findUserFacingLiterals('probe.tsx', 'const A = () => <p>{</p>;')).toThrow();
  });

  describe('static strings assembled at runtime, not just bare literals', () => {
    it('flags a template literal child with a substitution', () => {
      // Each fragment is reported trimmed, same as every other kind of hit.
      expect(find('const A = () => <p>{`Showing ${n} results`}</p>;')).toEqual([
        'Showing',
        'results',
      ]);
    });

    it('does not flag a template literal whose fragments contain no letters', () => {
      expect(find('const A = () => <p>{`${a}/${b}`}</p>;')).toEqual([]);
    });

    it('flags both branches of a conditional child', () => {
      expect(find("const A = () => <p>{o ? 'Open for applications' : 'Closed'}</p>;").sort()).toEqual(
        ['Closed', 'Open for applications'].sort(),
      );
    });

    it('flags both sides of a string concatenation', () => {
      expect(find("const A = () => <p>{'Apply' + ' now'}</p>;").sort()).toEqual(
        ['Apply', 'now'].sort(),
      );
    });

    it('flags the fallback side of a nullish-coalescing child', () => {
      expect(find("const A = () => <p>{x ?? 'No results found'}</p>;")).toEqual([
        'No results found',
      ]);
    });

    it('flags the fallback side of a logical-AND child', () => {
      expect(find("const A = () => <p>{x && 'No results found'}</p>;")).toEqual([
        'No results found',
      ]);
    });

    it('flags a conditional user-facing attribute', () => {
      const code = "const A = () => <input aria-label={o ? 'Search resources' : 'Filter'} />;";
      expect(find(code).sort()).toEqual(['Filter', 'Search resources'].sort());
    });
  });
});
