import type { Locale } from "@/lib/i18n/config";

/**
 * Where the site lives.
 *
 * Canonical URLs, hreflang alternates, the sitemap, Open Graph tags and
 * structured data all need ABSOLUTE URLs, and all of them must agree. Set
 * NEXT_PUBLIC_SITE_URL when the site moves to its own domain; until then the
 * Vercel production URL is the canonical host.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://heavy-duty-rentals.vercel.app").replace(
  /\/$/,
  "",
);

/** A locale-prefixed path: `href("ar", "/equipment")` → `/ar/equipment`. */
export function href(locale: Locale, path = ""): string {
  if (!path || path === "/") return `/${locale}`;
  return `/${locale}${path.startsWith("/") ? path : `/${path}`}`;
}

/** The same, as an absolute URL. */
export function absoluteUrl(locale: Locale, path = ""): string {
  return `${SITE_URL}${href(locale, path)}`;
}

/**
 * Canonical + hreflang for a page that exists in both languages at the same
 * path. Pages whose slug differs per language (guides) pass both paths.
 */
export function alternates(
  locale: Locale,
  paths: string | { en: string; ar: string },
): { canonical: string; languages: Record<string, string> } {
  const byLocale = typeof paths === "string" ? { en: paths, ar: paths } : paths;
  return {
    canonical: absoluteUrl(locale, byLocale[locale]),
    languages: {
      en: absoluteUrl("en", byLocale.en),
      ar: absoluteUrl("ar", byLocale.ar),
      "x-default": absoluteUrl("en", byLocale.en),
    },
  };
}
