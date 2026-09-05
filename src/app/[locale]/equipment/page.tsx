import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompareTray } from "@/components/equipment/compare-tray";
import { EquipmentCard } from "@/components/equipment/equipment-card";
import { FilterPanel } from "@/components/equipment/filter-panel";
import { Alert, Container, EmptyState, Input, SectionHeading, Select } from "@/components/ui";
import { countAvailableUnits, occupiedPeriod } from "@/lib/availability";
import { listBranches, listManufacturers, searchClasses } from "@/lib/catalog/repository";
import { getDictionary } from "@/lib/i18n";
import { formatNumber, isLocale, localePath, toISODate, type Locale } from "@/lib/i18n/config";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";

type SearchParams = Record<string, string | string[] | undefined>;

function one(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  const single = Array.isArray(value) ? value[0] : value;
  return single && single.trim().length > 0 ? single.trim() : undefined;
}

/** Parse a YYYY-MM-DD form value into a UTC date, rejecting anything malformed. */
function parseDate(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { locale } = await params;
  const sp = await searchParams;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  const query = one(sp, "q");

  return {
    title: query ? `${dict.equipment.resultsFor} "${query}"` : dict.equipment.allEquipment,
    description: dict.home.heroSubtitle,
    alternates: {
      canonical: `/${locale}/equipment`,
      languages: { en: "/en/equipment", ar: "/ar/equipment", "x-default": "/en/equipment" },
    },
    // A filtered or paginated listing is not a distinct landing page. Letting
    // Google index every filter permutation is how a catalogue turns into
    // thousands of near-duplicate URLs.
    robots: Object.keys(sp).length > 0 ? { index: false, follow: true } : undefined,
  };
}

export default async function EquipmentListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale: rawLocale } = await params;
  const sp = await searchParams;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDictionary(locale);

  const query = one(sp, "q");
  const branchSlug = one(sp, "branch");
  const manufacturer = one(sp, "manufacturer");
  const sort = one(sp, "sort") as "relevance" | "price_asc" | "price_desc" | "capacity" | undefined;
  const page = Number.parseInt(one(sp, "page") ?? "1", 10) || 1;

  // Capacity filters are entered in tonnes but stored in kilograms.
  const minCapacityT = Number.parseFloat(one(sp, "minCapacity") ?? "");
  const maxCapacityT = Number.parseFloat(one(sp, "maxCapacity") ?? "");

  const startDate = parseDate(one(sp, "start"));
  const endDate = parseDate(one(sp, "end"));
  const hasDateRange = startDate !== null && endDate !== null && startDate < endDate;

  const [results, branches, manufacturers] = await Promise.all([
    searchClasses({
      locale,
      query,
      branchSlug,
      manufacturer,
      minCapacityKg: Number.isFinite(minCapacityT) ? minCapacityT * 1000 : undefined,
      maxCapacityKg: Number.isFinite(maxCapacityT) ? maxCapacityT * 1000 : undefined,
      operatorAvailable: one(sp, "operator") === "1",
      sort,
      page,
    }),
    listBranches(locale),
    listManufacturers(),
  ]);

  /**
   * When dates are supplied, resolve REAL availability per class.
   *
   * This is the point of the whole system: the buyer's actual question is "is
   * it free on my dates", and every competitor answers it with a phone call.
   * Resolved in parallel so a 24-card page stays fast.
   */
  const availability = new Map<string, number>();
  if (hasDateRange) {
    const counts = await Promise.all(
      results.items.map(async (item) => {
        const period = occupiedPeriod(startDate, endDate, 0, 0);
        const count = await countAvailableUnits({
          classId: item.id,
          period,
          branchId: undefined,
        });
        return [item.id, count] as const;
      }),
    );
    for (const [id, count] of counts) availability.set(id, count);
  }

  const carriedParams = new URLSearchParams();
  if (startDate) carriedParams.set("start", toISODate(startDate));
  if (endDate) carriedParams.set("end", toISODate(endDate));
  const carried = carriedParams.toString();

  const totalPages = Math.max(1, Math.ceil(results.total / results.perPage));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: dict.nav.home, path: `/${locale}` },
              { name: dict.equipment.title, path: `/${locale}/equipment` },
            ]),
          ),
        }}
      />

      <Container className="py-6 sm:py-10">
        <SectionHeading
          level={1}
          title={query ? `${dict.equipment.resultsFor} "${query}"` : dict.equipment.allEquipment}
          description={
            hasDateRange
              ? undefined
              : locale === "ar"
                ? "أضف تواريخ الإيجار لعرض التوفر الفعلي لكل معدة."
                : "Add your rental dates to see real availability for every machine."
          }
        />

        {/* Date range: the single most valuable control on the page, so it
            sits above the results rather than inside a collapsed filter panel. */}
        <form
          method="get"
          className="mb-6 rounded-[--radius-card] border border-steel-200 bg-white p-4"
        >
          {query && <input type="hidden" name="q" value={query} />}
          {branchSlug && <input type="hidden" name="branch" value={branchSlug} />}
          {manufacturer && <input type="hidden" name="manufacturer" value={manufacturer} />}

          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <label htmlFor="start" className="mb-1.5 block text-sm font-medium text-steel-800">
                {dict.booking.startDate}
              </label>
              <Input
                id="start"
                name="start"
                type="date"
                defaultValue={startDate ? toISODate(startDate) : ""}
                min={toISODate(new Date())}
                className="numeric-latin"
              />
            </div>
            <div>
              <label htmlFor="end" className="mb-1.5 block text-sm font-medium text-steel-800">
                {dict.booking.endDate}
              </label>
              <Input
                id="end"
                name="end"
                type="date"
                defaultValue={endDate ? toISODate(endDate) : ""}
                min={toISODate(new Date())}
                className="numeric-latin"
              />
            </div>
            <button
              type="submit"
              className="min-h-[2.75rem] rounded-[--radius-control] bg-amber-500 px-5 text-sm font-semibold text-steel-950 hover:bg-amber-400"
            >
              {dict.equipment.checkAvailability}
            </button>
          </div>
        </form>

        <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <details open className="lg:open">
              <summary className="mb-3 cursor-pointer list-none rounded-[--radius-control] border border-steel-300 px-4 py-2.5 text-sm font-semibold text-steel-900 lg:hidden">
                {dict.filters.title}
              </summary>
              <div className="rounded-[--radius-card] border border-steel-200 bg-white p-4">
                <FilterPanel
                  locale={locale}
                  dict={dict}
                  filters={[
                    {
                      key: "capacityKg",
                      labelEn: "Capacity",
                      labelAr: "الحمولة",
                      type: "range",
                      unit: "t",
                      step: 1,
                      sortOrder: 1,
                    },
                  ]}
                  manufacturers={manufacturers}
                  branches={branches}
                  current={{
                    q: query,
                    branch: branchSlug,
                    manufacturer,
                    minCapacity: one(sp, "minCapacity"),
                    maxCapacity: one(sp, "maxCapacity"),
                    operator: one(sp, "operator"),
                    start: startDate ? toISODate(startDate) : undefined,
                    end: endDate ? toISODate(endDate) : undefined,
                  }}
                />
              </div>
            </details>
          </aside>

          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-steel-600">
                <span className="font-semibold text-steel-900 numeric-latin">
                  {formatNumber(results.total, locale)}
                </span>{" "}
                {dict.common.results}
              </p>

              <form method="get" className="flex items-center gap-2">
                {query && <input type="hidden" name="q" value={query} />}
                {branchSlug && <input type="hidden" name="branch" value={branchSlug} />}
                {startDate && <input type="hidden" name="start" value={toISODate(startDate)} />}
                {endDate && <input type="hidden" name="end" value={toISODate(endDate)} />}
                <label htmlFor="sort" className="text-sm text-steel-600">
                  {dict.equipment.sortBy}
                </label>
                <Select id="sort" name="sort" defaultValue={sort ?? "relevance"} className="w-auto">
                  <option value="relevance">{dict.equipment.sortRelevance}</option>
                  <option value="price_asc">{dict.equipment.sortPriceLow}</option>
                  <option value="price_desc">{dict.equipment.sortPriceHigh}</option>
                  <option value="capacity">{dict.equipment.sortCapacity}</option>
                </Select>
                <button
                  type="submit"
                  className="min-h-[2.75rem] rounded-[--radius-control] border border-steel-300 px-3 text-sm font-medium text-steel-700 hover:bg-steel-100"
                >
                  {dict.common.apply}
                </button>
              </form>
            </div>

            {results.items.length === 0 ? (
              <EmptyState
                title={dict.filters.noMatch}
                description={
                  locale === "ar"
                    ? "جرّب توسيع نطاق الحمولة أو إزالة بعض عوامل التصفية."
                    : "Try widening the capacity range or removing some filters."
                }
                action={
                  <Link
                    href={localePath(locale, "/equipment")}
                    className="text-sm font-medium text-steel-800 underline"
                  >
                    {dict.filters.resetFilters}
                  </Link>
                }
              />
            ) : (
              <>
                <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {results.items.map((item) => (
                    <li key={item.id} className="relative">
                      <EquipmentCard
                        item={item}
                        locale={locale}
                        dict={dict}
                        availableUnits={hasDateRange ? (availability.get(item.id) ?? 0) : undefined}
                        searchParams={carried || undefined}
                      />
                    </li>
                  ))}
                </ul>

                {totalPages > 1 && (
                  <nav aria-label={dict.a11y.pagination} className="mt-8 flex justify-center gap-2">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => {
                      const pageParams = new URLSearchParams(
                        Object.entries(sp).flatMap(([k, v]) =>
                          v === undefined ? [] : [[k, Array.isArray(v) ? (v[0] ?? "") : v]],
                        ),
                      );
                      pageParams.set("page", String(n));
                      return (
                        <Link
                          key={n}
                          href={`${localePath(locale, "/equipment")}?${pageParams.toString()}`}
                          aria-current={n === page ? "page" : undefined}
                          className={
                            n === page
                              ? "grid h-10 min-w-10 place-items-center rounded-[--radius-control] bg-steel-900 px-3 text-sm font-semibold text-white numeric-latin"
                              : "grid h-10 min-w-10 place-items-center rounded-[--radius-control] border border-steel-300 px-3 text-sm text-steel-700 hover:bg-steel-100 numeric-latin"
                          }
                        >
                          {formatNumber(n, locale)}
                        </Link>
                      );
                    })}
                  </nav>
                )}
              </>
            )}

            {!hasDateRange && results.items.length > 0 && (
              <Alert tone="info" className="mt-6">
                {locale === "ar"
                  ? "التوفر يُعرض بعد إدخال تواريخ الإيجار. كل معدة وحدة فعلية لها جدول توفر خاص بها."
                  : "Availability appears once you enter rental dates. Every machine is a real unit with its own calendar."}
              </Alert>
            )}
          </div>
        </div>
      </Container>

      {/* Fixed-position tray; renders nothing until two machines are picked. */}
      <CompareTray locale={locale} dict={dict} />
    </>
  );
}
