import { ar } from "./dictionaries/ar";
import { en, type Dictionary } from "./dictionaries/en";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";

const DICTIONARIES: Record<Locale, Dictionary> = { en, ar };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

/**
 * Interpolate {placeholders}. Deliberately minimal: no expression evaluation,
 * so a translated string can never execute anything.
 */
export function t(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

export { DEFAULT_LOCALE, isLocale };
export type { Locale, Dictionary };
export * from "./config";
