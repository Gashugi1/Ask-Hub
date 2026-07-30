import { describe, it, expect } from 'vitest';
import { readActionFunctions, cacheTagMembers } from './action-modules';

/**
 * CLAUDE.md: "Public pages are cached and revalidated on write
 * (`revalidateTag` / `revalidatePath`). Site Content edits must appear without
 * a rebuild." PRD 6.7 and 13.4 say the same for resources.
 *
 * The failure this guards against is quiet by construction. An action that
 * stops calling `revalidateTag` still succeeds, still writes its audit row,
 * still returns, and still shows the editor their new value on the admin
 * screen — which reads uncached, per request. The only visible symptom is on
 * the public site, where the old value keeps being served until something else
 * happens to evict the tag. Nobody notices in review and no runtime test sees
 * it, because the revalidation is a side effect on a cache the test process
 * does not have.
 *
 * So the contract is asserted at the source: every exported action that
 * inserts, updates, upserts or deletes either reaches `revalidateTag` — directly
 * or through its module's documented wrapper — or carries an explicit
 * `// no-revalidate: <reason>` comment.
 *
 * **Silence is not allowed to mean "nothing to invalidate".** An action that
 * says nothing is indistinguishable from an action that forgot, and there are
 * six legitimately-silent actions in this folder today (the `compute_metrics`
 * and `programmes` verbs, whose tables no public reader queries and which
 * therefore have no CACHE_TAGS entry to call) plus four in `users.ts`. Letting
 * those pass by absence would mean any future forgetting passes too. Writing
 * the reason costs one line and is the difference between a guard and a
 * formality.
 *
 * This is a source-level assertion and needs no database, so it lives in
 * tests/structure/ with the other structural guards rather than in tests/rls/.
 */

describe('mutating server actions state their cache contract', () => {
  it('finds mutating actions at all', () => {
    // Without this, a rename of the mutating verbs or of src/lib/actions would
    // leave the assertion below iterating over nothing and passing forever.
    const mutating = readActionFunctions().filter((fn) => fn.mutates);
    expect(
      mutating.length,
      'no mutating server action was detected — the assertion below would be vacuous',
    ).toBeGreaterThan(10);
  });

  it('either revalidates a tag or says in a comment why it does not', () => {
    const offenders = readActionFunctions()
      .filter((fn) => fn.mutates)
      .filter((fn) => !fn.revalidates && fn.noRevalidateReasons.length === 0)
      .map((fn) => `${fn.file}: ${fn.name}`);

    expect(
      offenders,
      'a mutating server action neither invalidates a cache tag nor says why it does not. An ' +
        'action that stops revalidating fails silently: the write succeeds, the admin screen ' +
        'shows the new value because it renders per request, and the public site keeps serving ' +
        'the old one until something else evicts the tag. Call `revalidateTag(CACHE_TAGS.x, ' +
        '{ expire: 0 })` (or the module’s wrapper), or add `// no-revalidate: <reason>` inside ' +
        'the function stating which public surface is unaffected and why. Silence is not an ' +
        `option, because silence is what forgetting looks like. Offenders:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('names only tags that exist in CACHE_TAGS', () => {
    const members = cacheTagMembers();
    expect(members.size, 'CACHE_TAGS parsed as empty — the assertion would be vacuous').toBeGreaterThan(
      3,
    );

    const offenders = readActionFunctions().flatMap((fn) =>
      fn.cacheTags
        .filter((tag) => !members.has(tag))
        .map((tag) => `${fn.file}: ${fn.name} uses CACHE_TAGS.${tag}`),
    );

    expect(
      offenders,
      'a server action invalidates a tag that CACHE_TAGS (src/lib/public/cache.ts) does not ' +
        'declare. A tag nothing listens to reads like working invalidation and is not — the ' +
        'call succeeds, the page stays stale. CACHE_TAGS is the shared SP2a/SP3 interface ' +
        'precisely so two sub-projects cannot invent two spellings of one tag; add the reader ' +
        `and the tag together rather than the tag alone. Offenders:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('gives every no-revalidate comment a stated reason', () => {
    // `// no-revalidate:` with nothing after it would satisfy the escape hatch
    // while saying nothing, which is the shape this whole file rejects. The
    // helper's pattern requires a non-space character after the colon; this
    // asserts something more useful than one character.
    const offenders = readActionFunctions()
      .filter((fn) => fn.noRevalidateReasons.some((reason) => reason.length < 20))
      .map((fn) => `${fn.file}: ${fn.name}`);

    expect(
      offenders,
      'a `// no-revalidate:` comment carries no real reason. State which public surface reads ' +
        `the table and why this write cannot make it stale. Offenders:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
