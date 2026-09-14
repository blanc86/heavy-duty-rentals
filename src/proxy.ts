import { NextResponse, type NextRequest } from "next/server";

/**
 * Language negotiation for the bare domain, and nothing else.
 *
 * Every real page lives under /en or /ar and is served straight from the CDN.
 * The only request that needs a decision is "/", which has to go somewhere, so
 * this sends Arabic-preferring browsers to /ar and everyone else to /en.
 *
 * The matcher is deliberately just "/": a proxy that ran on every request would
 * add work in front of pages that are otherwise static files.
 */

const LOCALES = ["en", "ar"] as const;

function preferredLocale(request: NextRequest): (typeof LOCALES)[number] {
  // An explicit choice made with the language switch wins over the browser.
  const saved = request.cookies.get("hdr_locale")?.value;
  if (saved === "en" || saved === "ar") return saved;

  const header = request.headers.get("accept-language") ?? "";
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag = "", q] = part.trim().split(";q=");
      return { tag: tag.toLowerCase(), quality: q ? Number.parseFloat(q) : 1 };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of ranked) {
    if (tag.startsWith("ar")) return "ar";
    if (tag.startsWith("en")) return "en";
  }
  return "en";
}

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = `/${preferredLocale(request)}`;
  const response = NextResponse.redirect(url, 307);
  // The redirect depends on these request headers; caches must key on them.
  response.headers.set("Vary", "Accept-Language, Cookie");
  return response;
}

export const config = {
  matcher: ["/"],
};
