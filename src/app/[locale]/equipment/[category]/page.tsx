import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EquipmentCard } from "@/components/equipment/equipment-card";
import { Alert, Container, EmptyState, SectionHeading } from "@/components/ui";
import { getCategoryBySlug, listCategories, searchClasses } from "@/lib/catalog/repository";
import { getDictionary } from "@/lib/i18n";
import { formatNumber, isLocale, localePath, type Locale } from "@/lib/i18n/config";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";

/**
 * Equipment CATEGORY landing page.
 *
 * A real, indexable page per category — "mobile cranes", "forklifts" — which is
 * where the head search volume sits. Distinct from the filtered listing, which
 * is deliberately noindexed: this page has its own copy, its own metadata and
 * its own canonical, so it is a destination rather than a query permutation.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; category: string }>;
}): Promise<Metadata> {
  const { locale, category } = await params;
  if (!isLocale(locale)) return {};

  const found = await getCategoryBySlug(category, locale);
  if (!found) return {};

  const title = found.meta_title ?? `${found.name} for Rent in Saudi Arabia`;
  const description = found.meta_description ?? found.description ?? title;

  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}/equipment/${category}`,
      languages: {
        en: `/en/equipment/${category}`,
        ar: `/ar/equipment/${category}`,
        "x-default": `/en/equipment/${category}`,
      },
    },
    openGraph: { title, description, type: "website" },
  };
}

export async function generateStaticParams() {
  // Enumerated so the crawler finds every category from the sitemap and from
  // internal links, not only by guessing slugs.
  return [];
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: string; category: string }>;
}) {
  const { locale: rawLocale, category } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDictionary(locale);

  const found = await getCategoryBySlug(category, locale);
  if (!found) notFound();

  const [results, allCategories] = await Promise.all([
    searchClasses({ locale, categorySlug: category, perPage: 48, sort: "capacity" }),
    listCategories(locale),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: dict.nav.home, path: `/${locale}` },
              { name: dict.equipment.title, path: `/${locale}/equipment` },
              { name: found.name, path: `/${locale}/equipment/${category}` },
            ]),
          ),
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
              <Link href={localePath(locale, "/equipment")} className="hover:underline">
                {dict.equipment.title}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-steel-800" aria-current="page">
              {found.name}
            </li>
          </ol>
        </nav>

        <SectionHeading level={1} title={found.name} description={found.description ?? undefined} />

        <p className="mb-6 text-sm text-steel-600">
          <span className="font-semibold text-steel-900 numeric-latin">
            {formatNumber(results.total, locale)}
          </span>{" "}
          {locale === "ar" ? "طراز متاح للإيجار" : "models available to rent"} ·{" "}
          <Link
            href={`${localePath(locale, "/equipment")}?category=${category}`}
            className="underline underline-offset-2"
          >
            {dict.equipment.checkAvailability}
          </Link>
        </p>

        {results.items.length === 0 ? (
          <EmptyState title={dict.filters.noMatch} />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.items.map((item) => (
              <li key={item.id} className="relative">
                <EquipmentCard item={item} locale={locale} dict={dict} />
              </li>
            ))}
          </ul>
        )}

        <Alert tone="warning" title={dict.equipment.safetyNotice} className="mt-10">
          {dict.equipment.safetyBody}
        </Alert>

        {/* Internal linking across categories: helps crawl discovery and gives
            a buyer who picked the wrong category a route out. */}
        <section className="mt-10">
          <SectionHeading title={dict.home.popularCategories} level={2} />
          <ul className="flex flex-wrap gap-2">
            {allCategories
              .filter((c) => c.slug !== category)
              .map((c) => (
                <li key={c.id}>
                  <Link
                    href={localePath(locale, `/equipment/${c.slug}`)}
                    className="inline-flex rounded-full border border-steel-300 bg-white px-3 py-1.5 text-sm text-steel-700 hover:border-steel-500"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      </Container>
    </>
  );
}
