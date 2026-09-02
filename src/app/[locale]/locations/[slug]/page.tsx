import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EquipmentCard } from "@/components/equipment/equipment-card";
import { Alert, Card, CardBody, Container, SectionHeading } from "@/components/ui";
import { getBranchBySlug, listBranches, searchClasses } from "@/lib/catalog/repository";
import { getDictionary } from "@/lib/i18n";
import { formatNumber, isLocale, localePath, type Locale } from "@/lib/i18n/config";
import { branchJsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";

/**
 * Branch / location landing page.
 *
 * This is the "crane rental Dammam" page. It exists ONLY for a branch flagged
 * `isServiceArea` — `getBranchBySlug` reads from that filtered list, so a city
 * with no depot 404s. That single guard is what separates legitimate local SEO
 * from mass-generated doorway pages, and it is enforced in code rather than in
 * a content policy someone has to remember.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};

  const branch = await getBranchBySlug(slug, locale);
  if (!branch) return {};

  const title =
    locale === "ar"
      ? `تأجير المعدات الثقيلة في ${branch.city}`
      : `Heavy Equipment Rental in ${branch.city}`;
  const description =
    locale === "ar"
      ? `استأجر الرافعات والحفارات والرافعات الشوكية والمعدات الثقيلة في ${branch.city}. تحقق من التوفر الفعلي واحجز عبر الإنترنت.`
      : `Rent cranes, excavators, forklifts and heavy plant in ${branch.city}. Check real availability and book online.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}/locations/${slug}`,
      languages: {
        en: `/en/locations/${slug}`,
        ar: `/ar/locations/${slug}`,
        "x-default": `/en/locations/${slug}`,
      },
    },
    openGraph: { title, description, type: "website" },
  };
}

export default async function BranchPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDictionary(locale);

  const branch = await getBranchBySlug(slug, locale);
  // No depot, no page. A "crane rental in <city we do not serve>" page would be
  // a lie to both the customer and the crawler.
  if (!branch) notFound();

  const [available, otherBranches] = await Promise.all([
    searchClasses({ locale, branchSlug: slug, perPage: 24, sort: "capacity" }),
    listBranches(locale),
  ]);

  const title =
    locale === "ar"
      ? `تأجير المعدات الثقيلة في ${branch.city}`
      : `Heavy Equipment Rental in ${branch.city}`;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            branchJsonLd({
              locale,
              slug: branch.slug,
              name: branch.name,
              city: branch.city,
              region: branch.region,
              address: branch.address,
              phone: branch.phone,
              latitude: branch.latitude,
              longitude: branch.longitude,
            }),
            breadcrumbJsonLd([
              { name: dict.nav.home, path: `/${locale}` },
              { name: dict.nav.locations, path: `/${locale}/locations` },
              { name: branch.city, path: `/${locale}/locations/${slug}` },
            ]),
          ]),
        }}
      />

      <Container className="py-6 sm:py-10">
        <nav aria-label={dict.a11y.breadcrumb} className="mb-4 text-sm">
          <ol className="flex flex-wrap items-center gap-1.5 text-steel-500">
            <li>
              <Link href={localePath(locale, "/")} className="hover:underline">
                {dict.nav.home}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href={localePath(locale, "/locations")} className="hover:underline">
                {dict.nav.locations}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-steel-800" aria-current="page">
              {branch.city}
            </li>
          </ol>
        </nav>

        <SectionHeading level={1} title={title} />

        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div>
            <p className="text-base leading-relaxed text-steel-700">
              {locale === "ar"
                ? `نشغّل مستودعاً في ${branch.city} (${branch.region}). تُسعَّر التعبئة والنقل من هذا المستودع حسب المسافة إلى موقعك وفئة نقل المعدة، ويظهر كل بند بشكل منفصل قبل الدفع.`
                : `We operate a depot in ${branch.city} (${branch.region}). Mobilisation is priced from this depot based on the distance to your site and the machine's transport class, and every element is itemised before you pay.`}
            </p>

            {available.items.length > 0 && (
              <section className="mt-8">
                <SectionHeading
                  title={
                    locale === "ar"
                      ? `المعدات المتوفرة في ${branch.city}`
                      : `Equipment available in ${branch.city}`
                  }
                  level={2}
                />
                <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {available.items.map((item) => (
                    <li key={item.id} className="relative">
                      <EquipmentCard
                        item={item}
                        locale={locale}
                        dict={dict}
                        searchParams={`branch=${slug}`}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <Alert tone="warning" title={dict.equipment.safetyNotice} className="mt-8">
              {dict.equipment.safetyBody}
            </Alert>
          </div>

          <aside className="lg:sticky lg:top-20 lg:self-start">
            <Card>
              <CardBody>
                <h2 className="text-base font-bold text-steel-950">{branch.name}</h2>
                <address className="mt-2 text-sm not-italic leading-relaxed text-steel-700">
                  {branch.address}
                </address>
                {branch.phone && (
                  <p className="mt-3 text-sm">
                    <a
                      href={`tel:${branch.phone.replace(/\s/g, "")}`}
                      className="font-medium text-steel-900 underline underline-offset-2 numeric-latin"
                    >
                      {branch.phone}
                    </a>
                  </p>
                )}
                <p className="mt-3 text-sm text-steel-600 numeric-latin">
                  {formatNumber(branch.unitCount, locale)}{" "}
                  {locale === "ar" ? "وحدة في هذا المستودع" : "units at this depot"}
                </p>

                <Link
                  href={`${localePath(locale, "/equipment")}?branch=${slug}`}
                  className="mt-4 inline-flex min-h-[2.75rem] w-full items-center justify-center rounded-[--radius-control] bg-amber-500 px-4 text-sm font-semibold text-steel-950 hover:bg-amber-400"
                >
                  {dict.equipment.checkAvailability}
                </Link>
              </CardBody>
            </Card>

            <Card className="mt-4">
              <CardBody>
                <h2 className="mb-2 text-sm font-semibold text-steel-950">{dict.nav.locations}</h2>
                <ul className="space-y-1.5">
                  {otherBranches
                    .filter((b) => b.slug !== slug)
                    .map((b) => (
                      <li key={b.slug}>
                        <Link
                          href={localePath(locale, `/locations/${b.slug}`)}
                          className="text-sm text-steel-700 hover:underline"
                        >
                          {b.city}
                        </Link>
                      </li>
                    ))}
                </ul>
              </CardBody>
            </Card>
          </aside>
        </div>
      </Container>
    </>
  );
}
