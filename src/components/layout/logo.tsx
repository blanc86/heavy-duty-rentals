import Link from "next/link";
import { BUSINESS } from "@/content/business";
import type { Locale } from "@/lib/i18n/config";
import { href } from "@/lib/site";
import { cn } from "@/components/ui";

/**
 * The TechSteps logo.
 *
 * The company's logo is bilingual — TECHSTEPS, the gear-and-crane mark, then
 * تكستيب — and far too wide for a header at that size. So each language shows
 * the half of it that reads in that language: the English wordmark with the
 * mark on English pages, the mark with the Arabic wordmark on Arabic ones. Both
 * are cut from the original artwork in public/brand, not redrawn.
 *
 * On a phone narrower than 380 px the mark stands alone, so the call and menu
 * buttons keep their room. A <picture> switches between them, which means the
 * browser downloads only the one it shows. SVG needs no resizing, so this
 * bypasses next/image deliberately.
 */
const WORDMARK = {
  en: { light: "/brand/logo-en.svg", dark: "/brand/logo-en-on-dark.svg", width: 1076, height: 225 },
  ar: { light: "/brand/logo-ar.svg", dark: "/brand/logo-ar-on-dark.svg", width: 955, height: 234 },
} as const;

const MARK = { light: "/brand/mark.svg", dark: "/brand/mark-on-dark.svg", width: 312, height: 225 } as const;

export function Logo({
  locale,
  onDark = false,
  compactOnPhone = true,
  className,
}: {
  locale: Locale;
  onDark?: boolean;
  /** Show only the mark below 380 px. Off where there is room, as in the footer. */
  compactOnPhone?: boolean;
  className?: string;
}) {
  const wordmark = WORDMARK[locale];
  const tone = onDark ? "dark" : "light";

  return (
    <Link href={href(locale)} className={cn("inline-flex shrink-0 items-center rounded-sm", className)}>
      <picture className="block h-full">
        {compactOnPhone && (
          <source media="(min-width: 380px)" srcSet={wordmark[tone]} width={wordmark.width} height={wordmark.height} />
        )}
        <img
          src={compactOnPhone ? MARK[tone] : wordmark[tone]}
          width={compactOnPhone ? MARK.width : wordmark.width}
          height={compactOnPhone ? MARK.height : wordmark.height}
          alt={BUSINESS.name[locale]}
          decoding="async"
          className="block h-full w-auto"
        />
      </picture>
    </Link>
  );
}
