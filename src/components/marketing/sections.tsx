import Link from "next/link";
import { BUSINESS, SERVICE_AREAS } from "@/content/business";
import type { Faq } from "@/content/faqs";
import { GUIDES } from "@/content/guides";
import { SiteImage } from "@/components/equipment/machine-image";
import { ActionLink, ButtonLink, CheckIcon, ChevronIcon, Container, PhoneIcon, SectionHeading, WhatsAppIcon, cn } from "@/components/ui";
import { telHref, whatsappHref } from "@/lib/contact";
import { t, type Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { href } from "@/lib/site";

/**
 * Sections shared by more than one page. Each takes the dictionary rather than
 * reading it, so a page can pass a message tailored to where the visitor is.
 */

/** The three-step process. Numbered because it genuinely is a sequence. */
export function HowItWorks({ dict, id }: { dict: Dictionary; id?: string }) {
  return (
    <section aria-labelledby={id ?? "how-it-works"} className="py-20 sm:py-24">
      <Container>
        <SectionHeading id={id ?? "how-it-works"} title={dict.home.howTitle} intro={dict.home.howIntro} />
        <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {dict.home.steps.map((step, index) => (
            <li key={step.title} className="relative md:pe-6">
              <span
                aria-hidden="true"
                className="font-display text-[4.5rem] leading-none font-bold text-steel-200 ltr-nums"
              >
                {index + 1}
              </span>
              <h3 className="mt-2 text-[1.6rem] leading-tight">{step.title}</h3>
              <p className="mt-2 text-steel-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

/** Why choose us — only claims the catalogue data supports. */
export function WhyChooseUs({ dict }: { dict: Dictionary }) {
  return (
    <section aria-labelledby="why-us" className="bg-steel-100 py-20 sm:py-24">
      <Container>
        <SectionHeading id="why-us" title={dict.home.whyTitle} intro={dict.home.whyIntro} />
        <ul className="mt-12 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {dict.home.why.map((item) => (
            <li key={item.title} className="border-t-2 border-steel-900 pt-5">
              <h3 className="text-[1.45rem] leading-tight">{item.title}</h3>
              <p className="mt-2 text-steel-700">{item.body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/**
 * The closing call to action: a dark band with the checklist of what a quote
 * needs, and all three ways to send it. Placed at the end of every page so
 * someone who read to the bottom — the most interested visitor there is —
 * never has to scroll back up to find a way to act.
 */
export function ContactBand({
  locale,
  dict,
  title,
  body,
  whatsappMessage,
}: {
  locale: Locale;
  dict: Dictionary;
  title?: string;
  body?: string;
  whatsappMessage?: string;
}) {
  return (
    <section aria-labelledby="contact-band" className="relative isolate overflow-hidden bg-steel-900 py-20 text-white sm:py-24">
      <SiteImage
        imageKey="banner/excavators-at-dusk"
        locale={locale}
        sizes="100vw"
        fill
        className="-z-10 opacity-35"
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-steel-950 via-steel-950/85 to-steel-950/40 rtl:bg-gradient-to-l" />
      <Container className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <h2 id="contact-band" className="text-h2 text-white">
            {title ?? dict.home.readyTitle}
          </h2>
          <p className="mt-4 text-lg text-steel-300">{body ?? dict.home.readyBody}</p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {dict.home.readyChecklist.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <CheckIcon className="mt-1 h-[1.1rem] w-[1.1rem] text-brand-500" />
                <span className="text-steel-200">{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <ButtonLink href={href(locale, "/contact")} className="min-h-14 text-[1.05rem]">
            {dict.cta.getQuote}
          </ButtonLink>
          <ActionLink variant="whatsapp" href={whatsappHref(whatsappMessage ?? dict.messages.general)} newTab className="min-h-14 text-[1.05rem]">
            <WhatsAppIcon />
            {dict.cta.chatOnWhatsapp}
          </ActionLink>
          <ActionLink variant="onDark" href={telHref()} className="min-h-14 text-[1.05rem] sm:col-span-2 lg:col-span-1">
            <PhoneIcon />
            <span>
              {dict.cta.call} <span className="ltr-nums">{BUSINESS.phone.display}</span>
            </span>
          </ActionLink>
        </div>
      </Container>
    </section>
  );
}

/**
 * FAQs as native disclosure widgets: keyboard- and screen-reader-accessible
 * with no JavaScript, and every answer is in the HTML for search engines.
 */
export function FaqList({ faqs, locale, className }: { faqs: Faq[]; locale: Locale; className?: string }) {
  return (
    <div className={cn("divide-y divide-steel-200 border-y border-steel-200", className)}>
      {faqs.map((faq) => (
        <details key={faq.question.en} className="group py-1">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[1.1rem] font-semibold text-steel-900 [&::-webkit-details-marker]:hidden">
            {faq.question[locale]}
            <ChevronIcon className="h-5 w-5 shrink-0 rotate-90 text-steel-500 transition-transform duration-150 group-open:-rotate-90 motion-reduce:transition-none" />
          </summary>
          <p className="max-w-3xl pb-5 text-steel-700">{faq.answer[locale]}</p>
        </details>
      ))}
    </div>
  );
}

export function ServiceAreaLinks({ locale, dict, className }: { locale: Locale; dict: Dictionary; className?: string }) {
  return (
    <ul className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-5", className)}>
      {SERVICE_AREAS.map((area) => (
        <li key={area.slug}>
          <Link
            href={href(locale, `/service-areas/${area.slug}`)}
            className="group flex h-full flex-col rounded-card border border-steel-200 bg-white p-5 hover:border-steel-900"
          >
            <span className="font-display text-[1.5rem] leading-tight font-bold text-steel-900 group-hover:underline underline-offset-4">
              {area.city[locale]}
            </span>
            <span className="mt-1 text-sm text-steel-600">{area.region[locale]}</span>
            <span className="sr-only">{t(dict.areas.cityHeading, { city: area.city[locale] })}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function GuideLinks({ locale, dict, className }: { locale: Locale; dict: Dictionary; className?: string }) {
  return (
    <ul className={cn("grid gap-5 md:grid-cols-3", className)}>
      {GUIDES.map((guide) => (
        <li key={guide.slug.en}>
          <Link
            href={href(locale, `/guides/${guide.slug[locale]}`)}
            className="group flex h-full flex-col rounded-card border border-steel-200 bg-white p-6 hover:border-steel-900"
          >
            <h3 className="text-[1.4rem] leading-tight group-hover:underline underline-offset-4">{guide.title[locale]}</h3>
            <p className="mt-2 flex-1 text-steel-600">{guide.excerpt[locale]}</p>
            <span className="mt-4 font-semibold text-steel-900">{dict.guides.read}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export interface Crumb {
  name: string;
  path: string;
}

/** Breadcrumbs, visible and in structured data. The last item is the current page. */
export function Breadcrumbs({ locale, dict, crumbs, onDark = false }: { locale: Locale; dict: Dictionary; crumbs: Crumb[]; onDark?: boolean }) {
  return (
    <nav aria-label={dict.nav.breadcrumb}>
      <ol className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-sm", onDark ? "text-steel-300" : "text-steel-600")}>
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={crumb.path} className="flex items-center gap-2">
              {last ? (
                <span aria-current="page" className={onDark ? "text-white" : "text-steel-900"}>
                  {crumb.name}
                </span>
              ) : (
                <>
                  <Link href={href(locale, crumb.path)} className="underline-offset-4 hover:underline">
                    {crumb.name}
                  </Link>
                  <ChevronIcon className="h-3.5 w-3.5 rtl:rotate-180" />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** A page heading band for inner pages. Quiet by design — the content is the page. */
export function PageHeader({
  locale,
  dict,
  crumbs,
  title,
  intro,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  crumbs: Crumb[];
  title: string;
  intro?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-steel-200 bg-steel-100">
      <Container className="py-10 sm:py-14">
        <Breadcrumbs locale={locale} dict={dict} crumbs={crumbs} />
        <h1 className="mt-4 max-w-4xl text-h1">{title}</h1>
        {intro && <p className="mt-4 max-w-2xl text-lg text-steel-700">{intro}</p>}
        {children}
      </Container>
    </div>
  );
}
