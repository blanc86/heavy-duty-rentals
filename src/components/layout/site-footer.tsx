import Link from "next/link";
import { BUSINESS, SERVICE_AREAS } from "@/content/business";
import { Container, MailIcon, PhoneIcon, WhatsAppIcon } from "@/components/ui";
import { activeCategories, categoryPath } from "@/lib/catalog";
import { mailtoHref, telHref, whatsappHref } from "@/lib/contact";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { href } from "@/lib/site";
import { Logo } from "./logo";

/**
 * Footer.
 *
 * Doubles as the site's internal-link map: every equipment category and every
 * service area is one click from any page, which is how search engines find
 * and weigh those pages, and how a visitor who scrolled past everything still
 * finds the one they came for.
 */
export function SiteFooter({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const year = new Date().getFullYear();
  const linkClass = "text-steel-300 hover:text-white hover:underline underline-offset-4";

  return (
    <footer className="border-t-4 border-machine-500 bg-steel-950 text-steel-300">
      <Container className="py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo locale={locale} onDark />
            <p className="mt-4 max-w-xs">{dict.footer.about}</p>
            <ul className="mt-6 space-y-3">
              <li>
                <a href={telHref()} className="inline-flex items-center gap-2.5 text-white hover:underline underline-offset-4">
                  <PhoneIcon className="h-4 w-4 text-machine-500" />
                  <span className="ltr-nums">{BUSINESS.phone.display}</span>
                </a>
              </li>
              <li>
                <a
                  href={whatsappHref(dict.messages.general)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 text-white hover:underline underline-offset-4"
                >
                  <WhatsAppIcon className="h-4 w-4 text-machine-500" />
                  {dict.cta.chatOnWhatsapp}
                </a>
              </li>
              <li>
                <a
                  href={mailtoHref({ subject: dict.messages.emailSubject })}
                  className="inline-flex items-center gap-2.5 text-white hover:underline underline-offset-4"
                >
                  <MailIcon className="h-4 w-4 text-machine-500" />
                  <span className="ltr-nums">{BUSINESS.email}</span>
                </a>
              </li>
            </ul>
          </div>

          <nav aria-label={dict.footer.equipment}>
            <h2 className="font-display text-lg font-bold text-white">{dict.footer.equipment}</h2>
            <ul className="mt-4 space-y-2.5">
              {activeCategories().map((category) => (
                <li key={category.slug}>
                  <Link href={href(locale, categoryPath(category))} className={linkClass}>
                    {category.name[locale]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={dict.nav.serviceAreas}>
            <h2 className="font-display text-lg font-bold text-white">{dict.nav.serviceAreas}</h2>
            <ul className="mt-4 space-y-2.5">
              {SERVICE_AREAS.map((area) => (
                <li key={area.slug}>
                  <Link href={href(locale, `/service-areas/${area.slug}`)} className={linkClass}>
                    {area.city[locale]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={dict.footer.company}>
            <h2 className="font-display text-lg font-bold text-white">{dict.footer.company}</h2>
            <ul className="mt-4 space-y-2.5">
              {[
                { path: "/about", label: dict.nav.about },
                { path: "/contact", label: dict.nav.contact },
                { path: "/guides", label: dict.nav.guides },
                { path: "/faq", label: dict.nav.faq },
                { path: "/service-areas", label: dict.nav.serviceAreas },
              ].map((link) => (
                <li key={link.path}>
                  <Link href={href(locale, link.path)} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-sm text-steel-400 md:flex-row md:items-center md:justify-between">
          <p>
            © <span className="ltr-nums">{year}</span> {BUSINESS.legalName ?? BUSINESS.name[locale]}. {dict.footer.rights}
            {BUSINESS.crNumber && (
              <>
                {" "}
                {dict.footer.crNumber} <span className="ltr-nums">{BUSINESS.crNumber}</span>
              </>
            )}
            {BUSINESS.vatNumber && (
              <>
                {" "}
                {dict.footer.vatNumber} <span className="ltr-nums">{BUSINESS.vatNumber}</span>
              </>
            )}
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            <li>
              <Link href={href(locale, "/privacy")} className="hover:text-white hover:underline underline-offset-4">
                {dict.footer.privacy}
              </Link>
            </li>
            <li>
              <Link href={href(locale, "/terms")} className="hover:text-white hover:underline underline-offset-4">
                {dict.footer.terms}
              </Link>
            </li>
            <li>
              <Link href={href(locale, "/image-credits")} className="hover:text-white hover:underline underline-offset-4">
                {dict.footer.credits}
              </Link>
            </li>
          </ul>
        </div>
      </Container>
    </footer>
  );
}
