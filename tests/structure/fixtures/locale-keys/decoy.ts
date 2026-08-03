/**
 * A function that happens to be called `t` and has nothing to do with i18n.
 *
 * The other half of the guard: resolving the callee must not collapse into
 * "anything spelled `t`". A scanner that matched on the name alone would
 * report the key below as a missing translation, and the fix for that false
 * positive -- a hand-maintained ignore list -- is how a guard acquires a
 * ratchet nobody dares tighten again.
 */
function t(value: string): string {
  return value.trim();
}

export function decoy(): string {
  return t('probe.decoy.is.not.a.translation.key');
}
