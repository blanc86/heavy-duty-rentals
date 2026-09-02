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

export const TIMEZONE = "Asia/Riyadh";
export const CURRENCY = "SAR";

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function otherLocale(locale: Locale): Locale {
  return locale === "en" ? "ar" : "en";
}

export function dirFor(locale: Locale): "ltr" | "rtl" {
  return LOCALE_CONFIG[locale].dir;
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

export function formatDateTime(date: Date, locale: Locale): string {
  return formatDate(date, locale, { hour: "2-digit", minute: "2-digit" });
}

export function formatNumber(value: number, locale: Locale, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(LOCALE_CONFIG[locale].intlLocale, opts).format(value);
}

/** Build a locale-prefixed path. Every internal link goes through this. */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${clean === "/" ? "" : clean}`;
}

/** ISO date (YYYY-MM-DD) for form inputs and URLs — never localised. */
export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
