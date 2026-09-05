import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RentalConfigurator } from "@/components/booking/rental-configurator";
import { AvailabilityCalendar } from "@/components/equipment/availability-calendar";
import { EquipmentCard } from "@/components/equipment/equipment-card";
import {
  Alert,
  Badge,
  Card,
  CardBody,
  Container,
  DemoBadge,
  ScrollX,
  SectionHeading,
} from "@/components/ui";
import { getAvailabilityCalendar } from "@/lib/availability";
import { getClassBySlug, listBranches, searchClasses } from "@/lib/catalog/repository";
import { db } from "@/lib/db";
import { addonOptions } from "@/lib/db/schema/pricing";
import { getDictionary } from "@/lib/i18n";
import { formatCapacity, formatNumber, isLocale, localePath, type Locale } from "@/lib/i18n/config";
import { illustrationUrl } from "@/lib/media/equipment-illustration";
import { formatMoneyCompact } from "@/lib/money";
import { breadcrumbJsonLd, equipmentJsonLd } from "@/lib/seo/json-ld";
import { and, eq, isNull, or } from "drizzle-orm";

type Params = { locale: string; slug: string };
type SearchParams = Record<string, string | string[] | undefined>;

function one(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  const single = Array.isArray(value) ? value[0] : value;
  return single?.trim() || undefined;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};

  const item = await getClassBySlug(slug, locale);
  if (!item) return {};

  const title = item.metaTitle ?? `${item.name} — ${item.manufacturer} ${item.model}`;
  const description =
    item.metaDescription ?? item.description?.slice(0, 300) ?? `${item.name} rental in Saudi Arabia.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}/equipment/item/${slug}`,
      // Both locales share the slug, so the alternate pair is exact.
      languages: {
        en: `/en/equipment/item/${slug}`,
        ar: `/ar/equipment/item/${slug}`,
        "x-default": `/en/equipment/item/${slug}`,
      },
    },
    openGraph: { title, description, type: "website" },
  };
}

export default async function EquipmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale: rawLocale, slug } = await params;
  const sp = await searchParams;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDictionary(locale);

  const item = await getClassBySlug(slug, locale);
  if (!item) notFound();

  const calendarFrom = new Date();
  const calendarTo = new Date();
  calendarTo.setDate(calendarTo.getDate() + 59);

  const [branches, addons, calendar, related] = await Promise.all([
    listBranches(locale),
    db
      .select({
        code: addonOptions.code,
        name: locale === "ar" ? addonOptions.nameAr : addonOptions.nameEn,
        description: locale === "ar" ? addonOptions.descriptionAr : addonOptions.descriptionEn,
        pricingModel: addonOptions.pricingModel,
        maxQuantity: addonOptions.maxQuantity,
      })
      .from(addonOptions)
      .where(
        and(
          eq(addonOptions.isActive, true),
          or(eq(addonOptions.classId, item.id), isNull(addonOptions.classId)),
        ),
      ),
    getAvailabilityCalendar({ classId: item.id, from: calendarFrom, to: calendarTo }),
    searchClasses({ locale, categorySlug: item.categorySlug, perPage: 4 }),
  ]);

  const branchesForConfigurator = item.availableBranches
    .map((available) => {
      const full = branches.find((b) => b.slug === available.slug);
      return full ? { id: full.id, slug: full.slug, city: full.city } : null;
    })
    .filter((b): b is { id: string; slug: string; city: string } => b !== null);

  const specGroups = item.specs.reduce<Record<string, typeof item.specs>>((acc, spec) => {
    const key = spec.group ?? "";
    (acc[key] ??= []).push(spec);
    return acc;
  }, {});

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            equipmentJsonLd({
              locale,
              name: item.name,
              description: item.description,
              manufacturer: item.manufacturer,
              model: item.model,
              slug: item.slug,
              imageKeys: item.images.map((i) => i.storageKey),
              dailyRateHalalas: item.fromDailyRateHalalas,
              inStock: item.totalUnits > 0,
              // No reviews exist yet, so no aggregateRating is emitted. We do
              // not fabricate ratings to win a rich result.
              reviews: undefined,
            }),
            breadcrumbJsonLd([
              { name: dict.nav.home, path: `/${locale}` },
              { name: dict.equipment.title, path: `/${locale}/equipment` },
              { name: item.categoryName, path: `/${locale}/equipment/${item.categorySlug}` },
              { name: item.name, path: `/${locale}/equipment/item/${item.slug}` },
            ]),
          ]),
        }}
      />

      <Container className="py-6 sm:py-8">
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
            <li>
              <Link
                href={localePath(locale, `/equipment/${item.categorySlug}`)}
                className="hover:underline"
              >
                {item.categoryName}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-steel-800" aria-current="page">
              {item.name}
            </li>
          </ol>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[1fr_24rem] xl:grid-cols-[1fr_26rem]">
          {/* ---------------------------------------------------------------
              LEFT: the machine
          --------------------------------------------------------------- */}
          <div>
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium uppercase tracking-wide text-steel-500">
                  {item.categoryName}
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-steel-950 sm:text-3xl">
                  {item.name}
                </h1>
                <p className="mt-1 text-base text-steel-600">
                  {item.manufacturer} {item.model}
                </p>
              </div>
              {item.isDemoData && <DemoBadge label={dict.common.demoData} />}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {item.capacityKg && (
                <Badge tone="neutral">
                  {dict.equipment.capacity}:{" "}
                  <span className="numeric-latin">
                    {formatCapacity(item.capacityKg, locale)}
                  </span>
                </Badge>
              )}
              <Badge tone={item.fuelPolicy === "wet" ? "available" : "neutral"}>
                {item.fuelPolicy === "wet" ? dict.equipment.fuelWet : dict.equipment.fuelDry}
              </Badge>
              {item.requiresOperator && <Badge tone="info">{dict.equipment.operatorRequired}</Badge>}
              <Badge tone="neutral">
                {dict.equipment.minRental}:{" "}
                <span className="numeric-latin">
                  {formatNumber(item.minRentalDays, locale)}{" "}
                  {item.minRentalDays === 1 ? dict.common.day : dict.common.days}
                </span>
              </Badge>
            </div>

            <figure className="mt-5">
            <div className="aspect-[16/10] overflow-hidden rounded-[--radius-card] border border-steel-200 bg-steel-100">
              {/* eslint-disable-next-line @next/next/no-img-element -- storage-backed key or generated SVG, not a build-time asset */}
              <img
                src={
                  item.images[0]
                    ? `/api/media/${item.images[0].storageKey}`
                    : illustrationUrl(item.categorySlug, locale)
                }
                alt={item.images[0]?.alt ?? item.name}
                className="h-full w-full object-cover"
                // Above the fold on mobile, so it is the LCP element and must
                // not be lazy-loaded.
                fetchPriority="high"
              />
            </div>

            {/*
              CC BY and CC BY-SA REQUIRE attribution. Rendering it from the
              database rather than a hardcoded credit line means the obligation
              survives a redesign. The business's own photography carries no
              attribution row and this renders nothing.
            */}
            {item.images[0]?.attribution && (
              <figcaption className="mt-2 text-xs text-steel-500">
                {locale === "ar" ? "الصورة:" : "Photo:"}{" "}
                {item.images[0].attribution.sourceUrl ? (
                  <a
                    href={item.images[0].attribution.sourceUrl}
                    rel="noopener nofollow"
                    target="_blank"
                    className="underline underline-offset-2"
                  >
                    {item.images[0].attribution.author ?? "Wikimedia Commons"}
                  </a>
                ) : (
                  (item.images[0].attribution.author ?? "Wikimedia Commons")
                )}
                {" · "}
                {item.images[0].attribution.licenceUrl ? (
                  <a
                    href={item.images[0].attribution.licenceUrl}
                    rel="noopener nofollow license"
                    target="_blank"
                    className="underline underline-offset-2"
                  >
                    {item.images[0].attribution.licence}
                  </a>
                ) : (
                  item.images[0].attribution.licence
                )}
                {" · "}
                <span>
                  {locale === "ar"
                    ? "صورة توضيحية لمعدة مماثلة، وليست لهذه الوحدة."
                    : "Illustrative photo of a comparable machine, not this unit."}
                </span>
              </figcaption>
            )}
            </figure>

            {item.description && (
              <p className="mt-5 text-base leading-relaxed text-steel-700">{item.description}</p>
            )}

            {/* --- INCLUSIONS. The #1 abandonment cause is not knowing what
                    the price covers, so it is stated high on the page and in
                    plain language rather than buried in terms. --- */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Card>
                <CardBody>
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-steel-950">
                    <span className="text-[--color-available]">✓</span>
                    {dict.equipment.included}
                  </h2>
                  <ul className="space-y-1.5 text-sm text-steel-700">
                    {item.inclusions.map((inclusion) => (
                      <li key={inclusion} className="flex gap-2">
                        <span aria-hidden="true" className="text-[--color-available]">
                          •
                        </span>
                        {inclusion}
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>

              <Card>
                <CardBody>
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-steel-950">
                    <span className="text-[--color-danger]">✕</span>
                    {dict.equipment.notIncluded}
                  </h2>
                  <ul className="space-y-1.5 text-sm text-steel-700">
                    {item.exclusions.map((exclusion) => (
                      <li key={exclusion} className="flex gap-2">
                        <span aria-hidden="true" className="text-steel-400">
                          •
                        </span>
                        {exclusion}
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            </div>

            {/* --- Specifications --- */}
            <section className="mt-8">
              <SectionHeading title={dict.equipment.specifications} />
              <ScrollX>
                <table className="w-full min-w-[24rem] border-collapse text-sm">
                  <caption className="sr-only">{dict.equipment.specifications}</caption>
                  <tbody>
                    {Object.entries(specGroups).flatMap(([group, specs]) => [
                      ...(group
                        ? [
                            <tr key={`group-${group}`}>
                              <th
                                colSpan={2}
                                scope="colgroup"
                                className="bg-steel-100 px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-steel-600"
                              >
                                {group}
                              </th>
                            </tr>,
                          ]
                        : []),
                      ...specs.map((spec) => (
                        <tr key={`${group}-${spec.label}`} className="border-b border-steel-200">
                          <th scope="row" className="w-1/2 px-3 py-2.5 text-start font-medium text-steel-700">
                            {spec.label}
                          </th>
                          <td className="px-3 py-2.5 text-steel-950 numeric-latin">
                            {spec.value}
                            {spec.unit ? ` ${spec.unit}` : ""}
                          </td>
                        </tr>
                      )),
                    ])}
                  </tbody>
                </table>
              </ScrollX>
            </section>

            {/* --- Availability calendar --- */}
            <section className="mt-8">
              <SectionHeading
                title={dict.filters.availability}
                description={
                  locale === "ar"
                    ? "عدد الوحدات المتاحة في كل يوم، محسوب من الحجوزات الفعلية وفترات الصيانة."
                    : "Units free each day, computed from real reservations and maintenance windows."
                }
              />
              <AvailabilityCalendar days={calendar} locale={locale} dict={dict} />
            </section>

            {/* --- Where it is --- */}
            {item.availableBranches.length > 0 && (
              <section className="mt-8">
                <SectionHeading title={dict.filters.location} />
                <ul className="grid gap-2 sm:grid-cols-2">
                  {item.availableBranches.map((branch) => (
                    <li key={branch.slug}>
                      <Link
                        href={localePath(locale, `/locations/${branch.slug}`)}
                        className="flex items-center justify-between gap-3 rounded-[--radius-card] border border-steel-200 bg-white px-4 py-3 hover:border-steel-400"
                      >
                        <span className="text-sm font-medium text-steel-900">{branch.city}</span>
                        <span className="text-xs text-steel-500 numeric-latin">
                          {formatNumber(branch.unitCount, locale)}{" "}
                          {locale === "ar" ? "وحدة" : branch.unitCount === 1 ? "unit" : "units"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* --- Documents (public only) --- */}
            {item.documents.length > 0 && (
              <section className="mt-8">
                <SectionHeading title={dict.equipment.documents} />
                <ul className="space-y-2">
                  {item.documents.map((doc) => (
                    <li key={doc.id}>
                      <a
                        href={`/api/documents/${doc.id}`}
                        className="flex items-center justify-between gap-3 rounded-[--radius-card] border border-steel-200 bg-white px-4 py-3 text-sm hover:border-steel-400"
                      >
                        <span className="font-medium text-steel-900">{doc.title}</span>
                        <span className="text-xs text-steel-500 numeric-latin">
                          {Math.round(doc.sizeBytes / 1024)} KB
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* --- SAFETY. Never softened into a guarantee. --- */}
            <Alert tone="warning" title={dict.equipment.safetyNotice} className="mt-8">
              {item.safetyNotes ?? dict.equipment.safetyBody}
            </Alert>
          </div>

          {/* ---------------------------------------------------------------
              RIGHT: the transaction. Sticky on desktop so the price and CTA
              stay in view while the buyer reads the specs.
          --------------------------------------------------------------- */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            {item.fromDailyRateHalalas !== null && (
              <p className="mb-3 text-sm text-steel-600">
                {dict.equipment.fromPrice}{" "}
                <span className="text-xl font-bold text-steel-950 numeric-latin">
                  {formatMoneyCompact(item.fromDailyRateHalalas, locale)}
                </span>
                <span className="text-steel-600">{dict.common.perDay}</span>
              </p>
            )}

            {!item.instantBookable && (
              <Alert tone="info" className="mb-3">
                {dict.equipment.quoteOnlyReason}
              </Alert>
            )}

            <RentalConfigurator
              locale={locale}
              dict={dict}
              classId={item.id}
              classSlug={item.slug}
              instantBookable={item.instantBookable}
              minRentalDays={item.minRentalDays}
              branches={branchesForConfigurator}
              addons={addons.map((a) => ({
                code: a.code,
                name: a.name,
                description: a.description,
                pricingModel: a.pricingModel,
                maxQuantity: a.maxQuantity,
              }))}
              initialStart={one(sp, "start")}
              initialEnd={one(sp, "end")}
            />
          </aside>
        </div>

        {/* --- Related --- */}
        {related.items.length > 1 && (
          <section className="mt-12">
            <SectionHeading title={dict.equipment.relatedEquipment} />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {related.items
                .filter((r) => r.id !== item.id)
                .slice(0, 4)
                .map((r) => (
                  <li key={r.id} className="relative">
                    <EquipmentCard item={r} locale={locale} dict={dict} />
                  </li>
                ))}
            </ul>
          </section>
        )}
      </Container>
    </>
  );
}
