import en from '@/locales/en.json';
import fr from '@/locales/fr.json';
import pt from '@/locales/pt.json';
import ar from '@/locales/ar.json';

export const LOCALES = ['en', 'fr', 'pt', 'ar'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

const dictionaries: Record<Locale, Record<string, string>> = {
  en: en as Record<string, string>,
  fr: fr as Record<string, string>,
  pt: pt as Record<string, string>,
  ar: ar as Record<string, string>,
};

/**
 * Look up a user-facing string.
 *
 * Returns the key itself when missing, so a gap shows up in the UI as an
 * obvious token rather than as blank space. Falls back to English per key,
 * not per file, which is what lets the fr/pt/ar stubs ship empty and be
 * filled in a string at a time (PRD 12.4).
 *
 * `locale` is typed `Locale`, not `string`: a typo like `'en-GB'` or `'es'`
 * would otherwise be accepted and silently serve English, which is exactly
 * the class of bug a missing-translation fallback is good at hiding.
 *
 * **How the locale will reach this function.** SP6 adds the switcher; SP2 and
 * SP3 write every page before then, so the mechanism is recorded here to stop
 * two sub-projects inventing two incompatible ones. The intent:
 *
 *  - The selected locale is a **request-scoped** value, resolved once per
 *    request from the URL segment (`/[locale]/...`) with a cookie as the
 *    fallback for a URL that carries none, and defaulting to `DEFAULT_LOCALE`.
 *  - Server components receive it by **passing it down explicitly** — read it
 *    where the route params are already in hand and thread it through, or
 *    bind it once with a small `getT(locale)` wrapper. Do not reach for a
 *    module-level mutable "current locale": a Next server is shared across
 *    concurrent requests, and a module global would leak one visitor's locale
 *    into another's response.
 *  - Client components receive it from a React context provided by the
 *    locale-aware layout, never by re-reading the cookie in the browser.
 *
 * Until SP6 lands, callers pass no locale and every string resolves to
 * English. Write call sites so that adding the argument later is additive:
 * take the locale as a parameter rather than assuming the default.
 */
export function t(
  key: string,
  vars?: Record<string, string | number>,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const fallback = dictionaries[DEFAULT_LOCALE];
  const raw = dictionaries[locale]?.[key] ?? fallback[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
