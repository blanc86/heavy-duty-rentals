import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryTile } from "@/components/equipment/category-tile";
import { SiteImage } from "@/components/equipment/machine-image";
import { ContactBand, PageHeader, ServiceAreaLinks } from "@/components/marketing/sections";
import { JsonLd } from "@/components/seo/json-ld";
import { CertificationsSection } from "@/components/trust/certifications-section";
import { CheckIcon, Container, MinusIcon } from "@/components/ui";
import { BUSINESS } from "@/content/business";
import { activeCategories } from "@/lib/catalog";
import { getDictionary } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { alternates } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    title: dict.meta.aboutTitle,
    description: dict.meta.aboutDescription,
    alternates: alternates(locale, "/about"),
    openGraph: { title: dict.meta.aboutTitle, description: dict.meta.aboutDescription },
  };
}

/**
 * ABOUT.
 *
 * What a professional buyer checks before trusting a supplier with a lift:
 * what they supply, how they work, and who is responsible for what on site.
 * It deliberately has no founding story, headcount or client list — none has
 * been provided, and an invented one would be the first thing a procurement
 * team discovered. The company registration block appears once CR and VAT
 * numbers are supplied; in Saudi Arabia those are a trust signal in their own
 * right. Certifications sit here as well as on the home page, because About is
 * where a supplier-approval checklist sends people.
 */
export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const crumbs = [
    { name: dict.common.home, path: "/" },
    { name: dict.nav.about, path: "/about" },
  ];

  return (
    <>
      <PageHeader locale={locale} dict={dict} crumbs={crumbs} title={dict.about.title} intro={dict.about.lead} />

      <Container className="grid gap-12 py-14 sm:py-20 lg:grid-cols-2 lg:items-center">
        <div className="overflow-hidden rounded-card">
          <SiteImage
            imageKey="banner/riyadh-skyline"
            locale={locale}
            sizes="(min-width: 1024px) 560px, 100vw"
            className="aspect-[16/10] h-auto w-full"
          />
        </div>
        <div>
          <h2 className="text-h2">{dict.about.whatTitle}</h2>
          <p className="mt-4 text-lg text-steel-700">{dict.about.whatBody}</p>
          <h2 className="mt-10 text-h2">{dict.about.howTitle}</h2>
          <ul className="mt-4 space-y-3">
            {dict.about.howPoints.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <CheckIcon className="mt-1 h-5 w-5 text-whatsapp-600" />
                <span className="text-steel-800">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </Container>

      <section aria-labelledby="responsibilities" className="border-y border-steel-200 bg-steel-100 py-14 sm:py-20">
        <Container>
          <div className="max-w-2xl">
            <h2 id="responsibilities" className="text-h2">
              {dict.about.safetyTitle}
            </h2>
            <p className="mt-3 text-lg text-steel-700">{dict.about.safetyIntro}</p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-card border-t-4 border-brand-500 bg-white p-6">
              <h3 className="text-[1.6rem]">{dict.about.weProvideTitle}</h3>
              <ul className="mt-4 space-y-3">
                {dict.about.weProvide.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckIcon className="mt-1 h-5 w-5 text-steel-900" />
                    <span className="text-steel-800">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-card border-t-4 border-steel-900 bg-white p-6">
              <h3 className="text-[1.6rem]">{dict.about.youProvideTitle}</h3>
              <ul className="mt-4 space-y-3">
                {dict.about.youProvide.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <MinusIcon className="mt-1 h-5 w-5 text-steel-700" />
                    <span className="text-steel-800">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      <CertificationsSection locale={locale} dict={dict} />

      <section aria-labelledby="range" className="border-t border-steel-200 py-14 sm:py-20">
        <Container>
          <h2 id="range" className="text-h2">
            {dict.equipment.indexTitle}
          </h2>
          <ul className="mt-8 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
            {activeCategories().map((category) => (
              <li key={category.slug}>
                <CategoryTile category={category} locale={locale} />
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="about-areas" className="border-t border-steel-200 bg-steel-50 py-14 sm:py-20">
        <Container>
          <h2 id="about-areas" className="text-h2">
            {dict.home.areasTitle}
          </h2>
          <p className="mt-3 max-w-2xl text-lg text-steel-700">{dict.home.areasIntro}</p>
          <ServiceAreaLinks locale={locale} dict={dict} className="mt-8" />
        </Container>
      </section>

      {/* Shown only once the business has supplied at least one of these. */}
      {(BUSINESS.crNumber || BUSINESS.vatNumber || BUSINESS.foundedYear) && (
        <section aria-labelledby="registration" className="py-12">
          <Container>
            <h2 id="registration" className="text-[1.6rem]">
              {dict.about.registrationTitle}
            </h2>
            <dl className="mt-4 grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-2">
              {BUSINESS.foundedYear && (
                <>
                  <dt className="text-steel-600">{dict.about.foundedYear}</dt>
                  <dd className="font-semibold ltr-nums">{BUSINESS.foundedYear}</dd>
                </>
              )}
              {BUSINESS.crNumber && (
                <>
                  <dt className="text-steel-600">{dict.about.crNumber}</dt>
                  <dd className="font-semibold ltr-nums">{BUSINESS.crNumber}</dd>
                </>
              )}
              {BUSINESS.vatNumber && (
                <>
                  <dt className="text-steel-600">{dict.about.vatNumber}</dt>
                  <dd className="font-semibold ltr-nums">{BUSINESS.vatNumber}</dd>
                </>
              )}
            </dl>
          </Container>
        </section>
      )}

      <ContactBand locale={locale} dict={dict} title={dict.about.ctaTitle} body={dict.about.ctaBody} />

      <JsonLd data={breadcrumbJsonLd(locale, crumbs)} />
    </>
  );
}
