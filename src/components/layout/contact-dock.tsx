import Link from "next/link";
import { PhoneIcon, QuoteIcon, WhatsAppIcon } from "@/components/ui";
import { telHref, whatsappHref } from "@/lib/contact";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { href } from "@/lib/site";

/**
 * Persistent contact actions.
 *
 * PHONE: a bar fixed to the bottom of the screen with Call, WhatsApp and Quote,
 * where a thumb already rests. It is always the same three actions in the same
 * places, so it is learned once. The layout pads the page by the bar's height,
 * so it never covers the last lines of content — the failure Baymard's testing
 * found makes floating elements feel intrusive on mobile.
 *
 * DESKTOP: a single round WhatsApp button in the corner. The header already
 * carries the phone number and the quote button, so one more floating control
 * is enough.
 *
 * Both are server-rendered links with no JavaScript.
 */
export function ContactDock({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const itemClass =
    "flex min-h-[3.75rem] flex-1 flex-col items-center justify-center gap-1 text-[0.8rem] font-semibold";

  return (
    <>
      <nav
        aria-label={dict.mobileBar.label}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-steel-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_20px_-12px_rgb(18_25_32/0.35)] md:hidden"
      >
        <ul className="flex">
          <li className="flex flex-1">
            <a href={telHref()} className={`${itemClass} text-steel-900`}>
              <PhoneIcon />
              {dict.mobileBar.call}
            </a>
          </li>
          <li className="flex flex-1">
            <a
              href={whatsappHref(dict.messages.general)}
              target="_blank"
              rel="noopener noreferrer"
              className={`${itemClass} bg-whatsapp-600 text-white`}
            >
              <WhatsAppIcon />
              {dict.mobileBar.whatsapp}
            </a>
          </li>
          <li className="flex flex-1">
            <Link href={href(locale, "/contact")} className={`${itemClass} bg-brand-500 text-steel-950`}>
              <QuoteIcon />
              {dict.mobileBar.quote}
            </Link>
          </li>
        </ul>
      </nav>

      <a
        href={whatsappHref(dict.messages.general)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={dict.cta.chatOnWhatsapp}
        className="fixed end-6 bottom-6 z-40 hidden h-14 w-14 items-center justify-center rounded-full bg-whatsapp-600 text-white shadow-[0_8px_24px_-6px_rgb(18_25_32/0.45)] transition-transform duration-150 hover:scale-105 hover:bg-whatsapp-700 md:inline-flex"
      >
        <WhatsAppIcon className="h-7 w-7" />
      </a>
    </>
  );
}
