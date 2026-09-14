"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/components/ui";

/**
 * Switch to the same page in the other language.
 *
 * Most pages share a path across languages; guides do not, because their slugs
 * are translated. `guideSlugs` maps each guide's English slug to its Arabic one
 * so the switch lands on the translated article instead of a 404.
 *
 * The choice is remembered in a cookie that the proxy reads on the bare "/"
 * visit, so a returning visitor is not re-guessed from their browser language.
 *
 * No aria-label: the link's name is its visible text ("English", "العربية"),
 * marked with its own lang. Overriding it with a longer label in the page's
 * language would break WCAG 2.5.3 — a voice-control user saying "click
 * English" must be able to activate the link that says English.
 */
export function LocaleSwitch({
  locale,
  label,
  guideSlugs,
  className,
}: {
  locale: Locale;
  label: string;
  guideSlugs: { en: string; ar: string }[];
  className?: string;
}) {
  const pathname = usePathname();
  const target: Locale = locale === "en" ? "ar" : "en";

  const segments = pathname.split("/").filter(Boolean);
  segments[0] = target;
  if (segments[1] === "guides" && segments[2]) {
    const current = decodeURIComponent(segments[2]);
    const match = guideSlugs.find((slug) => slug[locale] === current);
    if (match) segments[2] = match[target];
  }
  const destination = `/${segments.map(encodeURIComponent).join("/")}`;

  return (
    <Link
      href={destination}
      hrefLang={target}
      lang={target}
      onClick={() => {
        document.cookie = `hdr_locale=${target}; path=/; max-age=31536000; samesite=lax`;
      }}
      className={cn(
        "inline-flex min-h-11 items-center rounded-control px-3 text-[0.95rem] font-semibold",
        target === "ar" ? "font-arabic" : "font-sans",
        className,
      )}
    >
      {label}
    </Link>
  );
}
