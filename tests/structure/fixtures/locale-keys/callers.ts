import { t, t as translate } from '@/lib/i18n';
import * as i18n from '@/lib/i18n';

/**
 * Call shapes for `tests/structure/locale-keys.test.ts` to scan.
 *
 * Not part of the application: nothing imports this file, and
 * `scanTranslationKeys()` defaults to `src/`, which never reaches here. The
 * keys below are deliberately absent from `en.json` and must stay absent --
 * the test asserts on how each call was *recovered*, not on the dictionary,
 * and adding them to `en.json` would make the unused-copy test fail.
 *
 * Why these live in a fixture rather than in `src/`: the scanner's blind spots
 * can only be demonstrated by code that has them, and writing an aliased
 * import of `t` with a nonexistent key into a real component to prove a test
 * works would leave a raw token rendering on a page. That is precisely how the
 * gap this file closes was found -- by a reviewer temporarily doing exactly
 * that, watching all seven tests pass, and deleting it again, leaving nothing
 * behind to stop it happening a second time.
 */

/** The plain shape. A name-gated scanner catches this one. */
export function plain(): string {
  return t('probe.plain');
}

/**
 * An aliased import. This is the false negative: gating on the callee being
 * spelled `t` misses it entirely, and it is a completely ordinary thing to
 * write -- `translate` reads better than `t` in a file that uses it once.
 */
export function aliased(): string {
  return translate('probe.aliased');
}

/** A namespace import, missed by any check that only looks at bare identifiers. */
export function namespaced(): string {
  return i18n.t('probe.namespaced');
}

/**
 * A local rebinding, where the callee's *symbol* stops at this variable and
 * never reaches i18n.ts. Only resolving the call's signature reaches through.
 */
const rebound = t;
export function local(): string {
  return rebound('probe.rebound');
}

/**
 * The `via: 'type'` branch, which no call in `src/` currently exercises.
 *
 * This is the shape that branch exists for: an argument that is not a literal
 * and not a property access, but whose *type* is a finite union of string
 * literals, so every key it can produce is knowable. Delete the branch and
 * this call becomes `unresolved` -- a caller who narrowed their types as far
 * as they can be narrowed would fail the guard.
 */
type ProbeKey = 'probe.typed.one' | 'probe.typed.two';

export function typed(key: ProbeKey): string {
  return t(key);
}
