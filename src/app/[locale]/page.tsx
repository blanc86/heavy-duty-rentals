import type { Metadata } from "next";
import { cspNonce } from "@/lib/seo/nonce";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EquipmentCard } from "@/components/equipment/equipment-card";
import { HeroSearch } from "@/components/search/hero-search";
import {
  CredentialsSection,
  OperationalProofBar,
  ProjectsSection,
  TestimonialsSection,
  WhyUsSection,
} from "@/components/marketing/trust-sections";
import { ButtonLink, Card, CardBody, Container, SectionHeading } from "@/components/ui";
import { listBranches, listCategories, searchClasses } from "@/lib/catalog/repository";
import { getDictionary } from "@/lib/i18n";
import { formatNumber, isLocale, localePath, type Locale } from "@/lib/i18n/config";
import {
  getOperationalProof,
  listPublishedCredentials,
  listPublishedProjects,
  listPublishedTestimonials,
} from "@/lib/marketing/repository";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo/json-ld";
import { getBusinessSettings } from "@/lib/settings";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);

  return {
    title: dict.home.heroTitle,
    description: dict.home.heroSubtitle,
    alternates: { canonical: `/${locale}`, languages: { en: "/en", ar: "/ar", "x-default": "/en" } },
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDictionary(locale);

  const [categories, branches, popular, business, proof, testimonials, projects, credentials] =
    await Promise.all([
      listCategories(locale),
      listBranches(locale),
      searchClasses({ locale, perPage: 6, sort: "capacity" }),
      getBusinessSettings(),
      getOperationalProof(),
      listPublishedTestimonials(locale, 3),
      listPublishedProjects(locale, 3),
      listPublishedCredentials(locale),
    ]);

  return (
    <>
      <script
        type="application/ld+json"
        // CSP applies to every <script>, including a ld+json data block that
        // never executes. Without the nonce the block is refused and a crawler
        // rendering under CSP never sees the structured data — silently, since
        // the markup is still present in the HTML source.
        nonce={await cspNonce()}
        // Structured data describing what this page genuinely is. Nothing here
        // asserts a rating, a review count, or a credential the business has
        // not supplied.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            organizationJsonLd(locale, business, branches),
            websiteJsonLd(locale),
          ]),
        }}
      />

      {/* ---------------------------------------------------------------
          HERO
          A working search widget, not a video and a slogan. The buyer's
          first action is available in the first viewport on a phone.
      --------------------------------------------------------------- */}
      <section className="border-b border-steel-200 bg-steel-950">
        <Container className="py-10 sm:py-14">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
              {dict.home.heroTitle}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-steel-300 sm:text-lg">
              {dict.home.heroSubtitle}
            </p>
          </div>

          <div className="mt-7">
            <HeroSearch locale={locale} dict={dict} branches={branches} />
          </div>

          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-steel-400">
            <li className="flex items-center gap-2">
              <CheckIcon />
              {dict.home.trustAvailability}
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon />
              {dict.home.trustPricing}
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon />
              {dict.booking.paymentSecure.split(".")[0]}
            </li>
          </ul>
        </Container>
      </section>

      <OperationalProofBar proof={proof} locale={locale} />

      {/* --------------------------------------------------------------- */}
      <Container className="py-10 sm:py-14">
        <SectionHeading
          title={dict.home.popularCategories}
          action={
            <Link
              href={localePath(locale, "/equipment")}
              className="text-sm font-medium text-steel-700 underline-offset-2 hover:underline"
            >
              {dict.equipment.allEquipment} →
            </Link>
          }
        />

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((category) => (
            <li key={category.id}>
              <Link
                href={localePath(locale, `/equipment/${category.slug}`)}
                className="flex h-full flex-col rounded-[--radius-card] border border-steel-200 bg-white p-4 transition-colors hover:border-amber-500 hover:bg-amber-500/5"
              >
                <span className="text-sm font-semibold text-steel-950">{category.name}</span>
                <span className="mt-1 text-xs text-steel-500 numeric-latin">
                  {formatNumber(category.classCount, locale)}{" "}
                  {locale === "ar" ? "طراز" : category.classCount === 1 ? "model" : "models"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>

      {/* --------------------------------------------------------------- */}
      {popular.items.length > 0 && (
        <Container className="pb-10 sm:pb-14">
          <SectionHeading title={dict.home.popularEquipment} />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {popular.items.map((item) => (
              <li key={item.id} className="relative">
                <EquipmentCard item={item} locale={locale} dict={dict} />
              </li>
            ))}
          </ul>
        </Container>
      )}

      {/* ---------------------------------------------------------------
          HOW IT WORKS
          Reduces uncertainty before the buyer commits attention. Every step
          names a concrete artefact, not a feeling.
      --------------------------------------------------------------- */}
      <section className="border-y border-steel-200 bg-white">
        <Container className="py-10 sm:py-14">
          <SectionHeading title={dict.home.howItWorksTitle} />
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: dict.home.step1, body: dict.home.step1Body },
              { title: dict.home.step2, body: dict.home.step2Body },
              { title: dict.home.step3, body: dict.home.step3Body },
              { title: dict.home.step4, body: dict.home.step4Body },
            ].map((step, index) => (
              <li key={step.title} className="rounded-[--radius-card] border border-steel-200 p-4">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-steel-950 text-sm font-bold text-amber-400 numeric-latin">
                  {formatNumber(index + 1, locale)}
                </span>
                <h3 className="mt-3 text-sm font-semibold text-steel-950">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-steel-600">{step.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <WhyUsSection locale={locale} dict={dict} />

      <TestimonialsSection testimonials={testimonials} locale={locale} dict={dict} />

      <ProjectsSection projects={projects} locale={locale} dict={dict} />

      <CredentialsSection credentials={credentials} locale={locale} />

      {/* --------------------------------------------------------------- */}
      <Container className="py-10 sm:py-14">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <SectionHeading title={dict.home.byLocation} />
            <ul className="space-y-2">
              {branches.map((branch) => (
                <li key={branch.slug}>
                  <Link
                    href={localePath(locale, `/locations/${branch.slug}`)}
                    className="flex items-center justify-between gap-3 rounded-[--radius-card] border border-steel-200 bg-white px-4 py-3 transition-colors hover:border-steel-400"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-steel-950">
                        {branch.city}
                      </span>
                      <span className="block text-xs text-steel-500">{branch.region}</span>
                    </span>
                    <span className="text-xs text-steel-500 numeric-latin">
                      {formatNumber(branch.unitCount, locale)}{" "}
                      {locale === "ar" ? "وحدة" : "units"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <SectionHeading title={dict.home.guidesTitle} description={dict.home.guidesSubtitle} />
            <Card>
              <CardBody>
                <p className="text-sm leading-relaxed text-steel-700">
                  {locale === "ar"
                    ? "أدلة عملية حول اختيار سعة الرافعة المناسبة، والفرق بين الرافعات المتحركة والزاحفة، وما الذي يشمله الإيجار فعلياً."
                    : "Practical guides on choosing the right crane capacity, mobile versus crawler, and what a rental actually includes."}
                </p>
                <div className="mt-4">
                  <ButtonLink href={localePath(locale, "/guides")} variant="ghost" size="sm">
                    {dict.nav.guides}
                  </ButtonLink>
                </div>
              </CardBody>
            </Card>

            {/* Safety is a standing constraint, not a marketing section. It is
                stated plainly and never softened into a guarantee. */}
            <Card className="mt-4 border-[--color-warning]/30 bg-[--color-warning-bg]">
              <CardBody>
                <h3 className="text-sm font-semibold text-steel-950">
                  {dict.equipment.safetyNotice}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-steel-700">
                  {dict.equipment.safetyBody}
                </p>
              </CardBody>
            </Card>
          </div>
        </div>
      </Container>
    </>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 text-amber-400"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      <path d="M4 12.5l5 5L20 6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
