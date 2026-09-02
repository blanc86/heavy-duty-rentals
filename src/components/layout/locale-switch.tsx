"use client";

import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";

/**
 * Language switch.
 *
 * A client component ONLY so it can persist the choice in a cookie. The proxy
 * reads that cookie on the next visit, so a returning Arabic-speaking user is
 * never re-guessed from their browser headers.
 *
 * It is still a real <a>: it works with JavaScript disabled, and it is
 * crawlable, which matters because these links are how Google discovers the
 * Arabic side of the site.
 */
export function LocaleSwitch({
  href,
  label,
  targetLocale,
}: {
  href: string;
  label: string;
  targetLocale: Locale;
}) {
  return (
    <Link
      href={href}
      hrefLang={targetLocale}
      lang={targetLocale}
      onClick={() => {
        // 1 year, Lax, not HttpOnly — it is a UI preference, not a credential.
        document.cookie = `hdr_locale=${targetLocale}; path=/; max-age=31536000; samesite=lax`;
      }}
      className="rounded-[--radius-control] border border-steel-300 px-2.5 py-2 text-sm font-medium text-steel-800 transition-colors hover:bg-steel-100"
    >
      {label}
    </Link>
  );
}
