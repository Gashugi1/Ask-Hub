import en from '@/locales/en.json';
import fr from '@/locales/fr.json';
import pt from '@/locales/pt.json';
import ar from '@/locales/ar.json';

export const DEFAULT_LOCALE = 'en';

export const LOCALES = ['en', 'fr', 'pt', 'ar'] as const;

export type Locale = (typeof LOCALES)[number];

const dictionaries: Record<string, Record<string, string>> = {
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
 * The locale switcher is SP6. Callers pass no locale until then.
 */
export function t(
  key: string,
  vars?: Record<string, string | number>,
  locale: string = DEFAULT_LOCALE,
): string {
  const fallback = dictionaries[DEFAULT_LOCALE]!;
  const raw = dictionaries[locale]?.[key] ?? fallback[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
