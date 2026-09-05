import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/i18n/config";

/**
 * Next.js 16 renamed `middleware` to `proxy`. Runs on the Node.js runtime.
 *
 * Two responsibilities, both of which must happen before rendering:
 *   1. Locale negotiation — every page lives under /en or /ar
 *   2. Content-Security-Policy with a fresh per-request nonce
 */

const PUBLIC_FILE = /\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|txt|xml|json|webmanifest|woff2?)$/i;

/**
 * Paths that must NOT be locale-prefixed.
 *
 * Webhooks in particular: a payment provider posts to a fixed URL and will not
 * follow a locale redirect. Redirecting a webhook is a silent way to lose
 * payment confirmations.
 */
const LOCALE_EXEMPT = [
  "/api",
  "/_next",
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.ico",
  "/opensearch.xml",
];

function negotiateLocale(request: NextRequest): string {
  // An explicit choice, stored when the user uses the language switcher, wins
  // over the browser's header — a returning visitor should not be re-guessed.
  const cookieLocale = request.cookies.get("hdr_locale")?.value;
  if (cookieLocale && (LOCALES as readonly string[]).includes(cookieLocale)) {
    return cookieLocale;
  }

  const header = request.headers.get("accept-language");
  if (!header) return DEFAULT_LOCALE;

  const preferences = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: (tag ?? "").toLowerCase(), quality: q ? Number.parseFloat(q) : 1 };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of preferences) {
    if (tag.startsWith("ar")) return "ar";
    if (tag.startsWith("en")) return "en";
  }
  return DEFAULT_LOCALE;
}

function buildCsp(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    // 'strict-dynamic' means scripts loaded BY a nonced script are trusted,
    // which is what lets Next.js load its chunks without allowlisting hosts.
    // 'unsafe-eval' is dev-only: React Refresh needs it, production must not.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // KNOWN RESIDUAL: React writes inline style attributes, so 'unsafe-inline'
    // stays here. It does NOT weaken script-src, which is where XSS lives.
    // Documented in docs/SECURITY.md §5.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const isDev = process.env.NODE_ENV === "development";

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, isDev);

  const isExempt =
    LOCALE_EXEMPT.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
    PUBLIC_FILE.test(pathname);

  if (!isExempt) {
    const hasLocale = LOCALES.some(
      (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
    );

    if (!hasLocale) {
      const locale = negotiateLocale(request);
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
      // 307 preserves the method and body, so a POST to an unprefixed path is
      // not silently downgraded to a GET.
      const redirect = NextResponse.redirect(url, 307);
      redirect.headers.set("Content-Security-Policy", csp);
      return redirect;
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // The pathname is not otherwise available to a Server Component, and layouts
  // need it to build the hreflang alternate for the other locale.
  requestHeaders.set("x-pathname", pathname);
  // The query string is carried SEPARATELY and deliberately: hreflang and
  // canonical URLs must stay query-free, but the user-facing language switch
  // has to preserve it, or switching to Arabic mid-checkout silently discards
  // the dates, branch and transport the customer just configured.
  requestHeaders.set("x-search", request.nextUrl.search);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets. Webhook routes are
    // matched so they still receive security headers, and are exempted from
    // the locale redirect above.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
