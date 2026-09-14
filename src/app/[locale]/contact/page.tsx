import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EnquiryForm, type EquipmentOption } from "@/components/contact/enquiry-form";
import { Breadcrumbs, FaqList } from "@/components/marketing/sections";
import { SiteImage } from "@/components/equipment/machine-image";
import { JsonLd } from "@/components/seo/json-ld";
import { ClockIcon, Container, MailIcon, PhoneIcon, PinIcon, WhatsAppIcon } from "@/components/ui";
import { BUSINESS, SERVICE_AREAS } from "@/content/business";
import { FAQS } from "@/content/faqs";
import { activeCategories, machinesIn } from "@/lib/catalog";
import { mailtoHref, telHref, whatsappHref } from "@/lib/contact";
import { getDictionary } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { alternates, href } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    title: dict.meta.contactTitle,
    description: dict.meta.contactDescription,
    alternates: alternates(locale, "/contact"),
    openGraph: { title: dict.meta.contactTitle, description: dict.meta.contactDescription },
  };
}

/**
 * CONTACT.
 *
 * Built from the reference the client supplied — contact methods on one side,
 * an enquiry form on the other — and reworked around how people actually
 * contact a rental company here:
 *
 *  - WhatsApp comes first and is the largest target. It is where Saudi buyers
 *    already talk to suppliers, and a message reaches a person.
 *  - Each method says what it is best for, so the visitor picks the right one
 *    instead of hesitating between three.
 *  - The form asks for only name and phone, and opens in WhatsApp or email
 *    rather than disappearing into an inbox with no confirmation.
 *  - On a phone the methods come first; the form follows for anyone who
 *    prefers to write it all down.
 *
 * Address, hours and a map appear only once the business supplies them —
 * see content/business.ts. Nothing is shown in their place.
 */
export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const crumbs = [
    { name: dict.common.home, path: "/" },
    { name: dict.nav.contact, path: "/contact" },
  ];

  const equipmentOptions: EquipmentOption[] = activeCategories().flatMap((category) =>
    machinesIn(category.slug).map((machine) => ({
      value: machine.slug,
      label: machine.name[locale],
      group: category.name[locale],
    })),
  );

  const methodClass =
    "group flex items-start gap-4 rounded-card border border-steel-200 bg-white p-5 transition-colors duration-150 hover:border-steel-900";

  return (
    <>
      <section className="relative isolate overflow-hidden bg-steel-900 text-white">
        <SiteImage imageKey="banner/excavators-at-dusk" locale={locale} sizes="100vw" fill eager className="-z-20 opacity-40" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-steel-950 via-steel-950/85 to-steel-950/50 rtl:bg-gradient-to-l" />
        <Container className="py-12 sm:py-16">
          <Breadcrumbs locale={locale} dict={dict} crumbs={crumbs} onDark />
          <h1 className="mt-4 max-w-3xl text-h1 text-white">{dict.contact.title}</h1>
          <p className="mt-4 max-w-2xl text-lg text-steel-200">{dict.contact.intro}</p>
        </Container>
      </section>

      <Container className="grid gap-12 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:gap-14">
        {/* METHODS -------------------------------------------------------- */}
        <div className="grid content-start gap-4">
          <a
            href={whatsappHref(dict.messages.general)}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-4 rounded-card bg-whatsapp-600 p-6 text-white transition-colors duration-150 hover:bg-whatsapp-700"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/15">
              <WhatsAppIcon className="h-7 w-7" />
            </span>
            <span>
              <span className="block font-display text-[1.6rem] leading-tight font-bold">{dict.contact.whatsappTitle}</span>
              <span className="mt-0.5 block text-lg font-semibold ltr-nums">{BUSINESS.whatsapp.display}</span>
              <span className="mt-1 block text-white/85">{dict.contact.whatsappBody}</span>
            </span>
          </a>

          <a href={telHref()} className={methodClass}>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-steel-900 text-brand-500">
              <PhoneIcon className="h-6 w-6" />
            </span>
            <span>
              <span className="block font-display text-[1.5rem] leading-tight font-bold text-steel-900">{dict.contact.callTitle}</span>
              <span className="mt-0.5 block text-lg font-semibold text-steel-900 ltr-nums group-hover:underline underline-offset-4">
                {BUSINESS.phone.display}
              </span>
              <span className="mt-1 block text-steel-600">{dict.contact.callBody}</span>
            </span>
          </a>

          <a href={mailtoHref({ subject: dict.messages.emailSubject })} className={methodClass}>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-steel-900 text-brand-500">
              <MailIcon className="h-6 w-6" />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-[1.5rem] leading-tight font-bold text-steel-900">{dict.contact.emailTitle}</span>
              <span className="mt-0.5 block text-lg font-semibold break-all text-steel-900 ltr-nums group-hover:underline underline-offset-4">
                {BUSINESS.email}
              </span>
              <span className="mt-1 block text-steel-600">{dict.contact.emailBody}</span>
            </span>
          </a>

          {(BUSINESS.hours || BUSINESS.address) && (
            <div className="grid gap-4 rounded-card border border-steel-200 bg-steel-50 p-5">
              {BUSINESS.hours && (
                <p className="flex items-start gap-3">
                  <ClockIcon className="mt-1 text-steel-700" />
                  <span>
                    <span className="block font-semibold text-steel-900">{dict.contact.hoursTitle}</span>
                    <span className="text-steel-700">{BUSINESS.hours[locale]}</span>
                  </span>
                </p>
              )}
              {BUSINESS.address && (
                <p className="flex items-start gap-3">
                  <PinIcon className="mt-1 text-steel-700" />
                  <span>
                    <span className="block font-semibold text-steel-900">{dict.contact.addressTitle}</span>
                    <span className="text-steel-700">{BUSINESS.address[locale]}</span>
                    {BUSINESS.mapsUrl && (
                      <a
                        href={BUSINESS.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block font-semibold text-steel-900 underline underline-offset-4"
                      >
                        {dict.contact.directions}
                      </a>
                    )}
                  </span>
                </p>
              )}
            </div>
          )}

          <div className="rounded-card border border-steel-200 p-5">
            <h2 className="flex items-center gap-2.5 text-[1.35rem]">
              <PinIcon className="text-steel-700" />
              {dict.contact.areasTitle}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {SERVICE_AREAS.map((area) => (
                <li key={area.slug}>
                  <Link
                    href={href(locale, `/service-areas/${area.slug}`)}
                    className="inline-flex min-h-10 items-center rounded-full bg-steel-100 px-3.5 font-semibold text-steel-800 hover:bg-steel-200"
                  >
                    {area.city[locale]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* FORM ----------------------------------------------------------- */}
        <section
          id="quote"
          aria-labelledby="quote-title"
          className="scroll-mt-24 rounded-card border border-steel-200 bg-white p-6 shadow-[0_1px_2px_rgb(18_25_32/0.06),0_12px_32px_-18px_rgb(18_25_32/0.25)] sm:p-8"
        >
          <h2 id="quote-title" className="text-h2">
            {dict.contact.formTitle}
          </h2>
          <p className="mt-2 mb-6 text-steel-600">{dict.contact.formIntro}</p>
          <EnquiryForm dict={dict} equipmentOptions={equipmentOptions} />
        </section>
      </Container>

      <section aria-labelledby="next-steps" className="border-t border-steel-200 bg-steel-100 py-14 sm:py-16">
        <Container>
          <h2 id="next-steps" className="text-h2">
            {dict.contact.nextTitle}
          </h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {dict.contact.next.map((step, index) => (
              <li key={step} className="flex gap-4">
                <span aria-hidden="true" className="font-display text-[2.75rem] leading-none font-bold text-steel-500 ltr-nums">
                  {index + 1}
                </span>
                <p className="pt-1 text-steel-800">{step}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section aria-labelledby="contact-faq" className="py-14 sm:py-16">
        <Container className="grid gap-10 lg:grid-cols-[1fr_2fr]">
          <h2 id="contact-faq" className="text-h2">
            {dict.home.faqTitle}
          </h2>
          <FaqList faqs={FAQS.slice(0, 4)} locale={locale} />
        </Container>
      </section>

      <JsonLd data={breadcrumbJsonLd(locale, crumbs)} />
    </>
  );
}
