import Link from "next/link";
import type { Dictionary } from "@/lib/i18n";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { BusinessSettings } from "@/lib/settings";

/**
 * Site footer.
 *
 * Carries the identity disclosures the Saudi e-commerce framework expects to
 * be visible — trade name, working contact, CR and VAT numbers — plus the
 * policy links that must be published and reachable before an order completes
 * (docs/research.md §7).
 *
 * The values come from settings and are DEMO PLACEHOLDERS until the business
 * replaces them; nothing here asserts a real registration.
 */
export function SiteFooter({
  locale,
  dict,
  business,
}: {
  locale: Locale;
  dict: Dictionary;
  business: BusinessSettings;
}) {
  const name = locale === "ar" ? business.companyNameAr : business.companyNameEn;
  const address = locale === "ar" ? business.addressAr : business.addressEn;

  const columns = [
    {
      title: dict.footer.equipment,
      links: [
        { href: "/equipment", label: dict.equipment.allEquipment },
        { href: "/equipment/mobile-cranes", label: locale === "ar" ? "رافعات متحركة" : "Mobile cranes" },
        { href: "/equipment/forklifts", label: locale === "ar" ? "رافعات شوكية" : "Forklifts" },
        { href: "/equipment/excavators", label: locale === "ar" ? "حفارات" : "Excavators" },
        { href: "/compare", label: dict.nav.compare },
      ],
    },
    {
      title: dict.footer.company,
      links: [
        {
          href: "/for-contractors",
          label: locale === "ar" ? "للمقاولين" : "For contractors",
        },
        { href: "/about", label: dict.nav.about },
        { href: "/locations", label: dict.nav.locations },
        { href: "/safety", label: dict.nav.safety },
        { href: "/guides", label: dict.nav.guides },
      ],
    },
    {
      title: dict.footer.support,
      links: [
        { href: "/how-it-works", label: dict.nav.howItWorks },
        { href: "/faq", label: dict.nav.faq },
        { href: "/contact", label: dict.nav.contact },
        { href: "/account/support", label: dict.account.support },
      ],
    },
    {
      title: dict.footer.legal,
      links: [
        { href: "/legal/terms", label: dict.footer.terms },
        { href: "/legal/rental-terms", label: dict.footer.rentalTerms },
        { href: "/legal/privacy", label: dict.footer.privacy },
        { href: "/legal/cancellation", label: dict.footer.cancellation },
      ],
    },
  ];

  return (
    <footer className="mt-16 border-t border-steel-200 bg-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <p className="text-sm font-bold text-steel-950">{name}</p>
            <address className="mt-2 space-y-1 text-sm not-italic text-steel-600">
              <p>{address}</p>
              <p>
                <a href={`tel:${business.phone.replace(/\s/g, "")}`} className="hover:underline">
                  <span className="numeric-latin">{business.phone}</span>
                </a>
              </p>
              <p>
                <a href={`mailto:${business.email}`} className="hover:underline">
                  {business.email}
                </a>
              </p>
            </address>
          </div>

          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-steel-500">
                {column.title}
              </h2>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={localePath(locale, link.href)}
                      className="text-sm text-steel-700 hover:text-steel-950 hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-steel-200 pt-6 text-xs text-steel-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © <span className="numeric-latin">{new Date().getFullYear()}</span> {name}.{" "}
            {dict.footer.rights}
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <span>
              {dict.footer.crNumber}: <span className="numeric-latin">{business.crNumber}</span>
            </span>
            <span>
              {dict.footer.vatNumber}: <span className="numeric-latin">{business.vatNumber}</span>
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
