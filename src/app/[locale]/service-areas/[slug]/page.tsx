import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryTile } from "@/components/equipment/category-tile";
import { ContactBand, FaqList, PageHeader } from "@/components/marketing/sections";
import { JsonLd } from "@/components/seo/json-ld";
import { ProjectCard } from "@/components/trust/project-card";
import { ActionLink, Container, SectionHeading, WhatsAppIcon } from "@/components/ui";
import { SERVICE_AREAS } from "@/content/business";
import { FAQS } from "@/content/faqs";
import { activeCategories } from "@/lib/catalog";
import { projectsIn } from "@/lib/projects";
import { whatsappHref } from "@/lib/contact";
import { getDictionary, t } from "@/lib/i18n";
import { LOCALES, isLocale, type Locale } from "@/lib/i18n/config";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { alternates, href } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => SERVICE_AREAS.map((area) => ({ locale, slug: area.slug })));
}

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const area = SERVICE_AREAS.find((a) => a.slug === slug);
  if (!area) return {};
  const dict = getDictionary(locale);
  const title = t(dict.meta.areaTitle, { city: area.city[locale] });
  const description = t(dict.meta.areaDescription, { city: area.city[locale] });
  return { title, description, alternates: alternates(locale, `/service-areas/${area.slug}`), openGraph: { title, description } };
}

/**
 * A city page.
 *
 * Worth indexing only if it is worth reading, so beyond the city name it
 * carries planning advice specific to working there (content/business.ts).
 * Every equipment category links from here, which is the internal linking a
 * "crane rental Jubail" search needs to find the crane pages.
 */
export default async function ServiceAreaPage({ params }: { params: Params }) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const area = SERVICE_AREAS.find((a) => a.slug === slug);
  if (!area) notFound();
  const dict = getDictionary(locale);
  const city = area.city[locale];
  const crumbs = [
    { name: dict.common.home, path: "/" },
    { name: dict.nav.serviceAreas, path: "/service-areas" },
    { name: city, path: `/service-areas/${area.slug}` },
  ];
  const others = SERVICE_AREAS.filter((a) => a.slug !== area.slug);
  const projects = projectsIn(area.slug);

  return (
    <>
      <PageHeader
        locale={locale}
        dict={dict}
        crumbs={crumbs}
        title={t(dict.areas.cityHeading, { city })}
        intro={t(dict.areas.cityIntro, { city, region: area.region[locale], nearby: area.nearby[locale] })}
      >
        <div className="mt-6">
          <ActionLink variant="whatsapp" href={whatsappHref(t(dict.messages.area, { city }))} newTab>
            <WhatsAppIcon />
            {t(dict.areas.enquire, { city })}
          </ActionLink>
        </div>
      </PageHeader>

      <section aria-labelledby="planning" className="py-14 sm:py-16">
        <Container>
          <div className="max-w-3xl border-s-4 border-brand-500 ps-6">
            <h2 id="planning" className="text-h2">
              {t(dict.areas.planningTitle, { city })}
            </h2>
            <p className="mt-4 text-lg text-steel-700">{area.planning[locale]}</p>
          </div>
        </Container>
      </section>

      {projects.length > 0 && (
        <section aria-labelledby="city-projects" className="border-t border-steel-200 py-14 sm:py-16">
          <Container>
            <SectionHeading id="city-projects" title={t(dict.projects.inCity, { city })} />
            <ul className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <li key={project.slug} className="flex">
                  <ProjectCard project={project} locale={locale} dict={dict} className="w-full" />
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      <section aria-labelledby="city-equipment" className="border-t border-steel-200 bg-steel-50 py-14 sm:py-16">
        <Container>
          <SectionHeading id="city-equipment" title={t(dict.areas.equipmentInCity, { city })} />
          <ul className="mt-8 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
            {activeCategories().map((category) => (
              <li key={category.slug}>
                <CategoryTile category={category} locale={locale} />
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="area-faq" className="py-14 sm:py-16">
        <Container className="grid gap-10 lg:grid-cols-[1fr_2fr]">
          <SectionHeading id="area-faq" title={dict.home.faqTitle} />
          <FaqList faqs={[FAQS[0], FAQS[4], FAQS[6]].filter((faq) => faq !== undefined)} locale={locale} />
        </Container>
      </section>

      <nav aria-labelledby="other-areas" className="border-t border-steel-200 py-12">
        <Container>
          <h2 id="other-areas" className="text-[1.6rem]">
            {dict.areas.otherAreas}
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {others.map((other) => (
              <li key={other.slug}>
                <Link
                  href={href(locale, `/service-areas/${other.slug}`)}
                  className="inline-flex min-h-11 items-center rounded-full border border-steel-300 px-4 font-semibold text-steel-800 hover:border-steel-900"
                >
                  {other.city[locale]}
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </nav>

      <ContactBand locale={locale} dict={dict} whatsappMessage={t(dict.messages.area, { city })} />
      <JsonLd data={breadcrumbJsonLd(locale, crumbs)} />
    </>
  );
}
