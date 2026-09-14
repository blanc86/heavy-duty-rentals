import { BUSINESS } from "@/content/business";
import { GUIDES } from "@/content/guides";
import { ActionLink, ButtonLink, PhoneIcon, WhatsAppIcon } from "@/components/ui";
import { telHref, whatsappHref } from "@/lib/contact";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { href } from "@/lib/site";
import { LocaleSwitch } from "./locale-switch";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { NavLinks } from "./nav-links";

/**
 * Site header.
 *
 * Five links and a quote button — research across rental sites found the ones
 * that convert keep navigation short and put the phone number where a site
 * manager's eye goes first. The phone number is a real tap target on desktop
 * too: plenty of procurement staff call from a desk with a softphone.
 *
 * The background is solid, not a translucent blur. backdrop-filter makes the
 * header the containing block for fixed-position descendants, which shrank the
 * full-screen mobile menu to the height of the header bar.
 */
export function SiteHeader({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const items = [
    { href: href(locale), label: dict.nav.home },
    { href: href(locale, "/equipment"), label: dict.nav.equipment },
    { href: href(locale, "/projects"), label: dict.nav.projects },
    { href: href(locale, "/about"), label: dict.nav.about },
    { href: href(locale, "/contact"), label: dict.nav.contact },
  ];
  const guideSlugs = GUIDES.map((guide) => guide.slug);

  return (
    <header className="sticky top-0 z-40 border-b border-steel-200 bg-white">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-5 sm:px-8 lg:h-[4.5rem]">
        <Logo locale={locale} className="h-8 min-[380px]:h-7 sm:h-9 lg:h-10" />

        <nav aria-label={dict.nav.primary} className="ms-6 hidden lg:block">
          <NavLinks
            items={items}
            className="flex items-center gap-1"
            linkClassName="relative inline-flex h-[4.5rem] items-center px-3 text-[1rem] font-semibold text-steel-600 hover:text-steel-950"
          />
        </nav>

        <div className="ms-auto flex items-center gap-1 sm:gap-2">
          <a
            href={telHref()}
            className="hidden items-center gap-2 rounded-control px-3 py-2 font-semibold text-steel-900 hover:bg-steel-100 xl:inline-flex"
          >
            <PhoneIcon className="h-[1.1rem] w-[1.1rem]" />
            <span className="ltr-nums">{BUSINESS.phone.display}</span>
          </a>

          <LocaleSwitch
            locale={locale}
            label={dict.nav.switchLanguage}
            guideSlugs={guideSlugs}
            className="text-steel-700 hover:bg-steel-100 hover:text-steel-950"
          />

          {/* Visibility lives on a wrapper: the button's own `inline-flex` would
              otherwise compete with `hidden` in the same class list, and which
              one wins depends on stylesheet order, not on intent. */}
          <div className="hidden sm:block">
            <ButtonLink href={href(locale, "/contact")} className="min-h-11">
              {dict.cta.getQuote}
            </ButtonLink>
          </div>

          {/* On a phone the call button stays in the bar itself: one tap, no menu. */}
          <a
            href={telHref()}
            aria-label={`${dict.cta.call} ${BUSINESS.phone.display}`}
            className="inline-flex h-11 w-11 items-center justify-center rounded-control text-steel-900 hover:bg-steel-100 lg:hidden"
          >
            <PhoneIcon className="h-5 w-5" />
          </a>

          <MobileMenu
            items={items}
            openLabel={dict.nav.openMenu}
            closeLabel={dict.nav.closeMenu}
            menuLabel={dict.nav.primary}
            brand={<Logo locale={locale} compactOnPhone={false} className="h-full" />}
          >
            <ButtonLink href={href(locale, "/contact")} className="w-full">
              {dict.cta.getQuote}
            </ButtonLink>
            <ActionLink variant="whatsapp" href={whatsappHref(dict.messages.general)} newTab className="w-full">
              <WhatsAppIcon />
              {dict.cta.chatOnWhatsapp}
            </ActionLink>
            <ActionLink variant="outline" href={telHref()} className="w-full">
              <PhoneIcon />
              <span>
                {dict.cta.call} <span className="ltr-nums">{BUSINESS.phone.display}</span>
              </span>
            </ActionLink>
          </MobileMenu>
        </div>
      </div>
    </header>
  );
}
