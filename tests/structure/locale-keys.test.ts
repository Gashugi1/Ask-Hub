import { describe, it, expect } from 'vitest';
import en from '@/locales/en.json';
import { scanTranslationKeys, type KeyUse } from './locale-keys';

/**
 * CLAUDE.md: every user-facing string lives in `src/locales/en.json`.
 * `tests/structure/no-hardcoded-copy.test.ts` guards one half of that -- copy
 * must not be written into JSX -- and this file guards the other half: a key
 * `t()` is asked for must actually be there.
 *
 * Nothing checked that before. `t()` returns the key itself on a miss, by
 * design, so a missing entry renders as the raw token `column.partnerTier`
 * instead of "Partner tier" and no test anywhere notices. That exact failure
 * was one line away from shipping in the XLSX export header, with the whole
 * suite green: `EXPORT_COLUMNS` and the `column.*` block are two lists that
 * have to stay in step and nothing looked at them together.
 *
 * The scan runs once for the file -- it builds a TypeScript `Program` over
 * `src/`, which costs about a second -- and every assertion reads from it.
 */
const dictionary = en as Record<string, string>;
const scan = scanTranslationKeys();

const at = (use: KeyUse) => `${use.file}:${use.line}: ${use.key}`;

describe('every t() key used in src exists in en.json', () => {
  it('resolves every key', () => {
    const missing = scan.uses.filter((use) => dictionary[use.key] === undefined).map(at);
    expect(
      [...new Set(missing)],
      'these keys are asked for in src/ but are not in src/locales/en.json, so t() ' +
        'returns the key itself and the raw token renders as copy',
    ).toEqual([]);
  });

  it('resolves every call site statically, skipping none', () => {
    // A call this scanner cannot resolve is not harmless: it is a key nothing
    // checks. Reported rather than dropped, because a guard that quietly
    // ignores what it cannot read is a guard that has stopped guarding without
    // telling anyone.
    const unresolved = scan.unresolved.map(
      (call) => `${call.file}:${call.line}: t(${call.text}) — ${call.reason}`,
    );
    expect(unresolved, 't() call sites whose key could not be determined statically').toEqual(
      [],
    );
  });
});

/**
 * The scanner's own coverage, asserted positively.
 *
 * Without this, deleting the traversal and returning `{ uses: [], unresolved:
 * [] }` would leave both assertions above green -- the shape of vacuity this
 * whole exercise exists to eliminate. Each key below is recovered by a
 * different mechanism, so a regression in any one of the three shows up here
 * as a named failure rather than as a quietly shrinking corpus.
 */
describe('the scan sees the call shapes it claims to', () => {
  const found = (key: string, via: KeyUse['via']) =>
    scan.uses.some((use) => use.key === key && use.via === via);

  it('reads a plain literal key', () => {
    expect(found('site.name', 'literal'), 'no literal t() key was found at all').toBe(true);
  });

  it('enumerates a template key from the type of its substitution', () => {
    // src/lib/public/export.ts: t(`column.${c}`) over EXPORT_COLUMNS. This is
    // the pair that nearly shipped a raw key, so it is named explicitly.
    expect(found('column.addedDate', 'template')).toBe(true);
    // src/components/public/NeedBadge.tsx and four others: t(`need.${need}`).
    expect(found('need.compute', 'template')).toBe(true);
    // The admin families, each mirroring a database enum.
    expect(found('admin.users.role.viewer', 'template')).toBe(true);
    expect(found('admin.resources.geoScope.specific', 'template')).toBe(true);
  });

  it('recovers a key passed as a variable from the literals assigned to it', () => {
    // src/components/admin/AdminSidebar.tsx: t(item.labelKey), whose literals
    // live in src/lib/admin/guard.ts.
    expect(found('admin.nav.dashboard', 'property')).toBe(true);
    // src/lib/public/geo.ts: t(eligibility.key).
    expect(found('geo.unspecified', 'property')).toBe(true);
  });

  it('covers the whole of src, not one directory of it', () => {
    // A floor, not a target. 55 files call t() today; a scan that suddenly
    // sees a handful has broken its file walk or its symbol resolution, and
    // both of those failures are otherwise silent.
    expect(scan.files.length).toBeGreaterThan(40);
    expect(scan.files.some((file) => file.startsWith('src/components/public/'))).toBe(true);
    expect(scan.files.some((file) => file.startsWith('src/components/admin/'))).toBe(true);
    expect(scan.files.some((file) => file.startsWith('src/app/'))).toBe(true);
    expect(scan.files.some((file) => file.startsWith('src/lib/'))).toBe(true);
  });
});

/**
 * How the scanner decides a call is a call to i18n's `t`.
 *
 * The block above proves the scanner sees the shapes `src/` happens to
 * contain. It cannot prove what the scanner is *blind* to, and the answer used
 * to be "an aliased import": `isTranslationCall` gated on the callee being
 * spelled `t` before it resolved anything, so
 *
 *     import { t as translate } from '@/lib/i18n';
 *     export function probe() { return translate('this.key.does.not.exist'); }
 *
 * added to `src/` left all seven tests green. A reviewer demonstrated it and
 * removed it again, which left the repository exactly where it started.
 *
 * These fixtures are that demonstration, kept. They are scanned from their own
 * directory -- `src/` must not contain a `t()` call for a key that does not
 * exist, which is the very thing this guard exists to prevent -- and asserted
 * on how each key was recovered, not against `en.json`.
 */
describe('the scanner resolves the callee rather than its name', () => {
  const fixtures = scanTranslationKeys('tests/structure/fixtures/locale-keys');
  const via = (key: string) => fixtures.uses.find((use) => use.key === key)?.via;

  it('resolves every fixture call site, skipping none', () => {
    expect(
      fixtures.unresolved.map((call) => `${call.file}:${call.line}: ${call.reason}`),
      'a fixture call the scanner could not resolve',
    ).toEqual([]);
  });

  it('follows an aliased import', () => {
    // The regression that started this. `translate('probe.aliased')` is
    // invisible to any check that reads the callee's spelling.
    expect(via('probe.aliased'), 'an aliased import of t() was not seen at all').toBe('literal');
  });

  it('still sees a plain, unaliased call', () => {
    // The original coverage, asserted so that fixing the alias case cannot
    // quietly cost the ordinary one.
    expect(via('probe.plain')).toBe('literal');
  });

  it('follows a namespace import and a local rebinding', () => {
    expect(via('probe.namespaced'), 'i18n.t() was not seen').toBe('literal');
    expect(via('probe.rebound'), 'a rebound const was not seen').toBe('literal');
  });

  it('enumerates an argument whose type is a union of string literals', () => {
    // The `via: 'type'` branch, which resolves zero call sites in src/. It is
    // kept because deleting it turns the best-typed caller into a suite
    // failure, and this is the only thing that exercises it.
    expect(via('probe.typed.one')).toBe('type');
    expect(via('probe.typed.two')).toBe('type');
  });

  it('ignores a local function that merely shares the name', () => {
    // The false-positive direction. Without it, "resolve the callee" could be
    // replaced by "match the name" and only this assertion would notice.
    expect(
      fixtures.uses.map((use) => use.key),
      'a local helper named t() was scanned as if it were i18n',
    ).not.toContain('probe.decoy.is.not.a.translation.key');
  });
});

/**
 * The reverse direction: copy in `en.json` that nothing asks for.
 *
 * Weaker than the forward direction and deliberately so -- an unused key is
 * dead copy, not a broken screen -- but it is what stops `en.json` filling up
 * with strings from abandoned drafts that a translator is then paid to
 * translate. Asserted as a subset rather than an exact match: a key on this
 * list becoming used is the good outcome and must not fail a suite.
 */
const DECLARED_AHEAD_OF_USE: Record<string, string> = {
  // Content rule 10.1's attribution, asserted verbatim by
  // tests/unit/i18n.test.ts. It is the canonical wording, kept in en.json so
  // there is one place to read it from when a surface needs it.
  'site.attribution': 'content rule, asserted by tests/unit/i18n.test.ts',
  // Rule 10.1's full co-led sentence, likewise pinned verbatim by the i18n
  // test. /contact carried it until the client asked for the line to go.
  'site.footer': 'content rule, asserted by tests/unit/i18n.test.ts',
  // PRD 7's partnership pipeline stages. The Partnerships screen is SP4.
  'stage.prospecting': 'partnership pipeline, SP4',
  'stage.in_discussion': 'partnership pipeline, SP4',
  'stage.active': 'partnership pipeline, SP4',
  'stage.delivered': 'partnership pipeline, SP4',
  // The reach-and-engagement empty state, for the panels SP2b's event capture
  // makes real. `empty.ga4NotConnected` is already used; this one is not yet.
  'empty.noData': 'reach and engagement panels, SP2b',
};

describe('en.json carries no copy that src never asks for', () => {
  it('leaves unused only the keys declared ahead of their sub-project', () => {
    const used = new Set(scan.uses.map((use) => use.key));
    const unused = Object.keys(dictionary).filter(
      (key) => !used.has(key) && !(key in DECLARED_AHEAD_OF_USE),
    );
    expect(
      unused,
      'keys in src/locales/en.json that no t() call reaches — delete them, or add them ' +
        'to DECLARED_AHEAD_OF_USE with the sub-project that will use them',
    ).toEqual([]);
  });
});
