import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardBody, Container, SectionHeading } from "@/components/ui";
import { listBranches } from "@/lib/catalog/repository";
import { getDictionary } from "@/lib/i18n";
import { formatNumber, isLocale, localePath, type Locale } from "@/lib/i18n/config";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    title: dict.nav.locations,
    description:
      locale === "ar"
        ? "مستودعاتنا ومناطق الخدمة في المملكة العربية السعودية."
        : "Our depots and service areas across Saudi Arabia.",
    alternates: {
      canonical: `/${locale}/locations`,
      languages: { en: "/en/locations", ar: "/ar/locations", "x-default": "/en/locations" },
    },
  };
}

/**
 * Locations index.
 *
 * Lists ONLY branches flagged `isServiceArea`. There is no page for a city
 * where the business has no depot — that gate is what keeps location SEO
 * honest instead of turning it into the doorway-page farm the brief forbids.
 */
export default async function LocationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDictionary(locale);

  const branches = await listBranches(locale);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: dict.nav.home, path: `/${locale}` },
              { name: dict.nav.locations, path: `/${locale}/locations` },
            ]),
          ),
        }}
      />

      <Container className="py-8 sm:py-12">
        <SectionHeading
          level={1}
          title={dict.nav.locations}
          description={
            locale === "ar"
              ? "نخدم من مستودعات فعلية في هذه المدن. تُسعَّر التعبئة والنقل من أقرب مستودع."
              : "We serve from real depots in these cities. Mobilisation is priced from the nearest one."
          }
        />

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch) => (
            <li key={branch.slug}>
              <Card className="h-full transition-shadow hover:shadow-[--shadow-raised]">
                <CardBody>
                  <h2 className="text-lg font-bold text-steel-950">
                    <Link
                      href={localePath(locale, `/locations/${branch.slug}`)}
                      className="hover:underline"
                    >
                      {branch.city}
                    </Link>
                  </h2>
                  <p className="mt-0.5 text-sm text-steel-500">{branch.region}</p>
                  <address className="mt-3 text-sm not-italic text-steel-700">
                    {branch.address}
                  </address>
                  {branch.phone && (
                    <p className="mt-2 text-sm">
                      <a
                        href={`tel:${branch.phone.replace(/\s/g, "")}`}
                        className="text-steel-800 underline underline-offset-2 numeric-latin"
                      >
                        {branch.phone}
                      </a>
                    </p>
                  )}
                  <p className="mt-3 text-xs text-steel-500 numeric-latin">
                    {formatNumber(branch.unitCount, locale)}{" "}
                    {locale === "ar"
                      ? "وحدة في هذا المستودع"
                      : branch.unitCount === 1
                        ? "unit at this depot"
                        : "units at this depot"}
                  </p>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      </Container>
    </>
  );
}
