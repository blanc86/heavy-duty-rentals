export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/**
 * Arabic is a peer locale, not a translation layer bolted onto an English
 * site. It gets its own URL segment, its own metadata, its own canonical, and
 * full RTL mirroring — because for a large share of Saudi site engineers and
 * procurement staff it is the primary language, and a half-Arabic page reads
 * as foreign and untrustworthy.
 */
export const LOCALE_CONFIG: Record<
  Locale,
  { dir: "ltr" | "rtl"; label: string; htmlLang: string; intlLocale: string }
> = {
  en: { dir: "ltr", label: "English", htmlLang: "en", intlLocale: "en-SA" },
  ar: { dir: "rtl", label: "العربية", htmlLang: "ar", intlLocale: "ar-SA" },
};

/** Dates are shown in Riyadh time wherever the site is built or served. */
const TIMEZONE = "Asia/Riyadh";

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Dates are formatted in Asia/Riyadh regardless of where the server runs.
 * A rental starting "on the 14th" means the 14th in Riyadh, not in UTC.
 */
export function formatDate(date: Date, locale: Locale, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(LOCALE_CONFIG[locale].intlLocale, {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    ...opts,
  }).format(date);
}
