import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryTile } from "@/components/equipment/category-tile";
import { FleetStrip } from "@/components/equipment/fleet-strip";
import { MachineCard } from "@/components/equipment/machine-card";
import { SiteImage } from "@/components/equipment/machine-image";
import {
  ContactBand,
  FaqList,
  GuideLinks,
  HowItWorks,
  ServiceAreaLinks,
  WhyChooseUs,
} from "@/components/marketing/sections";
import { CertificationsSection } from "@/components/trust/certifications-section";
import { ProjectCard } from "@/components/trust/project-card";
import { ActionLink, ButtonLink, CheckIcon, Container, PhoneIcon, SectionHeading, WhatsAppIcon } from "@/components/ui";
import { BUSINESS } from "@/content/business";
import { FAQS } from "@/content/faqs";
import { activeCategories, featuredMachines } from "@/lib/catalog";
import { featuredProjects } from "@/lib/projects";
import { telHref, whatsappHref } from "@/lib/contact";
import { getDictionary } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { alternates, href } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    // The home title is the full keyword phrase, not "Home | Brand".
    title: { absolute: dict.meta.homeTitle },
    description: dict.meta.homeDescription,
    alternates: alternates(locale, "/"),
    openGraph: { title: dict.meta.homeTitle, description: dict.meta.homeDescription, url: `/${locale}` },
  };
}

/**
 * HOME.
 *
 * Section order follows what the competitor review found converts — and what
 * most Saudi rental sites get wrong:
 *
 *   1. Hero: what we rent, where, why us and how to reach us, in one screen,
 *      with the fleet visibly passing underneath.
 *   2. Categories: visitors self-select immediately (Kennards, Byrne).
 *   3. How renting works: removes "what happens if I call?" — the hesitation a
 *      site without online booking has to answer explicitly.
 *   4. Why us, then the evidence for it: certifications a procurement team
 *      files, and projects that show the kind of work the fleet does.
 *   5. Featured machines: breadth of the range, each one enquire-able.
 *   6. Where we work, FAQs, guides — for the visitor still deciding.
 *   7. Contact band: every page ends with a way to act.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);

  return (
    <>
      {/* HERO ---------------------------------------------------------------
          The photograph is the page's Largest Contentful Paint, so it is
          preloaded and sized for the viewport. The steel scrim runs
          from the reading edge — left in English, right in Arabic — so text
          sits on a consistent dark ground whatever the photo does behind it. */}
      <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-steel-900 text-white">
        <SiteImage
          imageKey="hero/excavator-golden-hour"
          locale={locale}
          sizes="100vw"
          fill
          preload
          className="-z-20 object-[70%_center]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-r from-steel-950/95 via-steel-950/80 to-steel-950/25 rtl:bg-gradient-to-l"
        />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-steel-950/90 to-transparent" />

        <Container className="pt-16 pb-10 sm:pt-24 lg:pt-28">
          <div className="max-w-2xl">
            <h1 id="hero-title" className="text-display text-white">
              {dict.home.heroTitle}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-steel-200 sm:text-xl">{dict.home.heroSubtitle}</p>

            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
              {dict.home.heroFacts.map((fact) => (
                <li key={fact} className="flex items-center gap-2 font-semibold text-white">
                  <CheckIcon className="h-[1.1rem] w-[1.1rem] text-brand-500" />
                  {fact}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={href(locale, "/contact")} className="min-h-14 px-7 text-[1.1rem]">
                {dict.cta.getQuote}
              </ButtonLink>
              <ActionLink variant="whatsapp" href={whatsappHref(dict.messages.general)} newTab className="min-h-14 px-7 text-[1.1rem]">
                <WhatsAppIcon />
                {dict.cta.chatOnWhatsapp}
              </ActionLink>
            </div>
            <p className="mt-4 text-steel-300">
              {dict.home.heroCallPrefix}{" "}
              <a href={telHref()} className="inline-flex items-center gap-1.5 font-semibold text-white underline underline-offset-4 hover:text-brand-300">
                <PhoneIcon className="h-4 w-4" />
                <span className="ltr-nums">{BUSINESS.phone.display}</span>
              </a>
            </p>
          </div>
        </Container>

        <FleetStrip locale={locale} label={dict.home.fleetLabel} />
      </section>

      {/* CATEGORIES --------------------------------------------------------- */}
      <section aria-labelledby="categories" className="py-20 sm:py-24">
        <Container>
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeading id="categories" title={dict.home.categoriesTitle} intro={dict.home.categoriesIntro} />
            <ButtonLink variant="outline" href={href(locale, "/equipment")} className="shrink-0 self-start md:self-auto">
              {dict.cta.viewAllEquipment}
            </ButtonLink>
          </div>
          <ul className="mt-10 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
            {activeCategories().map((category) => (
              <li key={category.slug}>
                <CategoryTile category={category} locale={locale} />
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <div className="border-t border-steel-200">
        <HowItWorks dict={dict} />
      </div>

      <WhyChooseUs dict={dict} />

      <CertificationsSection locale={locale} dict={dict} />

      {/* PROJECTS ----------------------------------------------------------- */}
      <section aria-labelledby="projects" className="border-t border-steel-200 bg-steel-50 py-20 sm:py-24">
        <Container>
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeading id="projects" title={dict.projects.homeTitle} intro={dict.projects.homeIntro} />
            <ButtonLink variant="outline" href={href(locale, "/projects")} className="shrink-0 self-start md:self-auto">
              {dict.projects.viewAll}
            </ButtonLink>
          </div>
          <ul className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featuredProjects().map((project) => (
              <li key={project.slug} className="flex">
                <ProjectCard project={project} locale={locale} dict={dict} className="w-full" />
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* FEATURED ----------------------------------------------------------- */}
      <section aria-labelledby="featured" className="py-20 sm:py-24">
        <Container>
          <SectionHeading id="featured" title={dict.home.featuredTitle} intro={dict.home.featuredIntro} />
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredMachines().map((machine) => (
              <li key={machine.slug} className="flex">
                <MachineCard machine={machine} locale={locale} dict={dict} className="w-full" />
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* AREAS ---------------------------------------------------------------- */}
      <section aria-labelledby="areas" className="border-t border-steel-200 bg-steel-50 py-20 sm:py-24">
        <Container>
          <SectionHeading id="areas" title={dict.home.areasTitle} intro={dict.home.areasIntro} />
          <ServiceAreaLinks locale={locale} dict={dict} className="mt-10" />
        </Container>
      </section>

      {/* FAQ ------------------------------------------------------------------ */}
      <section aria-labelledby="faq" className="py-20 sm:py-24">
        <Container className="grid gap-10 lg:grid-cols-[1fr_2fr]">
          <div>
            <SectionHeading id="faq" title={dict.home.faqTitle} />
            <ButtonLink variant="outline" href={href(locale, "/faq")} className="mt-6">
              {dict.cta.readAllFaqs}
            </ButtonLink>
          </div>
          <FaqList faqs={FAQS.slice(0, 5)} locale={locale} />
        </Container>
      </section>

      {/* GUIDES --------------------------------------------------------------- */}
      <section aria-labelledby="guides" className="border-t border-steel-200 bg-steel-50 py-20 sm:py-24">
        <Container>
          <SectionHeading id="guides" title={dict.home.guidesTitle} />
          <GuideLinks locale={locale} dict={dict} className="mt-10" />
        </Container>
      </section>

      <ContactBand locale={locale} dict={dict} />
    </>
  );
}
