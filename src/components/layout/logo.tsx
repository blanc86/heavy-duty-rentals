import Link from "next/link";
import { BUSINESS } from "@/content/business";
import type { Locale } from "@/lib/i18n/config";
import { href } from "@/lib/site";
import { cn } from "@/components/ui";

/**
 * Wordmark.
 *
 * A PLACEHOLDER for the company's real logo, built to stand in without looking
 * like one: a yellow block with a single boom line — the angle of a crane jib
 * under load — beside the name in the display face. Swap the <svg> and text for
 * the real mark when it exists; the size and link behaviour can stay.
 */
export function Logo({ locale, onDark = false, className }: { locale: Locale; onDark?: boolean; className?: string }) {
  return (
    <Link
      href={href(locale)}
      className={cn("flex items-center gap-2.5 rounded-sm", className)}
      aria-label={BUSINESS.name[locale]}
    >
      <svg viewBox="0 0 40 40" className="h-9 w-9 shrink-0" aria-hidden="true">
        <rect width="40" height="40" rx="3" fill="#f4b000" />
        <path d="M8 31 L31 10" stroke="#121920" strokeWidth="4" strokeLinecap="square" />
        <path d="M31 10 V21" stroke="#121920" strokeWidth="2.5" />
        <rect x="27.5" y="21" width="7" height="5" fill="#121920" />
        <rect x="6" y="30" width="12" height="4" fill="#121920" />
      </svg>
      {/* Below 380 px the name gives way to the mark: the Arabic name is wide
          enough to push the call and menu buttons off a small phone. The link
          keeps the full name as its accessible label either way. */}
      <span
        className={cn(
          "hidden font-display text-[1.15rem] leading-none font-bold tracking-tight whitespace-nowrap min-[380px]:inline min-[420px]:text-[1.35rem]",
          onDark ? "text-white" : "text-steel-900",
        )}
      >
        {BUSINESS.name[locale]}
      </span>
    </Link>
  );
}
