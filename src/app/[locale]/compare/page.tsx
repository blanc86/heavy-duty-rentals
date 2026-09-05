import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink, Card, CardBody, Container, EmptyState, ScrollX } from "@/components/ui";
import { getClassBySlug } from "@/lib/catalog/repository";
import { getDictionary } from "@/lib/i18n";
import { formatCapacity, formatNumber, isLocale, localePath, type Locale } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";
import { decodeSlugParam } from "@/lib/routing";

/** PRD C5: up to four. Past that the table stops being readable on any screen. */
const MAX_ITEMS = 4;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: getDictionary(locale).equipment.compareTitle,
    // A comparison of an arbitrary URL-chosen set is not a page worth indexing;
    // the class pages are. This also keeps a crawler from generating the
    // combinatorial explosion of every subset of the fleet.
    robots: { index: false, follow: true },
  };
}

function parseItems(raw: string | string[] | undefined): string[] {
  const value = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  const slugs = value
    .split(",")
    .map((s) => decodeSlugParam(s.trim()))
    .filter(Boolean);
  return [...new Set(slugs)].slice(0, MAX_ITEMS);
}

/**
 * Side-by-side comparison — PRD C5.
 *
 * State lives in the URL, not in a session: a site engineer comparing a 50 t
 * against a 100 t needs to paste that comparison to a procurement manager, and
 * a link that only works in the sender's browser is not a comparison anyone can
 * act on.
 *
 * Every column carries its own Book CTA, because the point of comparing is to
 * choose — making someone navigate back to a class page to act on the decision
 * they just made is where this kind of feature usually dies.
 */
export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: rawLocale } = await params;
  const sp = await searchParams;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDictionary(locale);

  const slugs = parseItems(sp.items);
  const classes = (await Promise.all(slugs.map((slug) => getClassBySlug(slug, locale)))).filter(
    (c): c is NonNullable<typeof c> => c !== null,
  );

  if (classes.length === 0) {
    return (
      <Container className="py-8 sm:py-12">
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-steel-950">
          {dict.equipment.compareTitle}
        </h1>
        <Card>
          <CardBody>
            <EmptyState
              title={dict.equipment.compareEmpty}
              action={
                <ButtonLink href={localePath(locale, "/equipment")}>
                  {dict.equipment.allEquipment}
                </ButtonLink>
              }
            />
          </CardBody>
        </Card>
      </Container>
    );
  }

  // The union of every spec label across the selected machines, in the order
  // they first appear. Comparing only the labels they happen to share would
  // silently drop the specification that decides the choice.
  const specLabels: string[] = [];
  for (const cls of classes) {
    for (const spec of cls.specs) {
      if (!specLabels.includes(spec.label)) specLabels.push(spec.label);
    }
  }

  const specValue = (cls: (typeof classes)[number], label: string) => {
    const spec = cls.specs.find((s) => s.label === label);
    if (!spec) return "—";
    return spec.unit ? `${spec.value} ${spec.unit}` : spec.value;
  };

  const removeHref = (slug: string) => {
    const rest = classes.filter((c) => c.slug !== slug).map((c) => c.slug);
    return rest.length === 0
      ? localePath(locale, "/compare")
      : localePath(locale, `/compare?items=${rest.map(encodeURIComponent).join(",")}`);
  };

  return (
    <Container className="py-8 sm:py-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-steel-950 sm:text-3xl">
          {dict.equipment.compareTitle}
        </h1>
        <Link href={localePath(locale, "/equipment")} className="text-sm text-steel-600 underline">
          {dict.equipment.allEquipment}
        </Link>
      </div>

      {slugs.length >= MAX_ITEMS && (
        <p className="mb-4 text-sm text-steel-600">{dict.equipment.compareMax}</p>
      )}

      <Card>
        <ScrollX>
          <table className="w-full text-sm">
            <caption className="sr-only">{dict.equipment.compareTitle}</caption>
            <thead>
              <tr className="border-b border-steel-200 align-bottom">
                {/* The row-label column. Empty header, but it must exist so the
                    row headers below have a column to belong to. */}
                <th scope="col" className="w-44 px-4 py-3 text-start text-xs uppercase tracking-wide text-steel-500">
                  {dict.equipment.specifications}
                </th>
                {classes.map((cls) => (
                  <th key={cls.id} scope="col" className="min-w-[13rem] px-4 py-3 text-start align-top">
                    <Link
                      href={localePath(locale, `/equipment/item/${cls.slug}`)}
                      className="block font-bold text-steel-950 hover:underline"
                    >
                      {cls.name}
                    </Link>
                    <span className="block text-xs font-normal text-steel-500">
                      {cls.manufacturer} {cls.model}
                    </span>
                    <Link
                      href={removeHref(cls.slug)}
                      className="mt-1 inline-block text-xs font-normal text-steel-500 underline"
                    >
                      {dict.equipment.removeFromCompare}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              <tr className="border-b border-steel-100">
                <th scope="row" className="px-4 py-2.5 text-start font-normal text-steel-600">
                  {dict.equipment.fromPrice}
                </th>
                {classes.map((cls) => (
                  <td key={cls.id} className="px-4 py-2.5 font-medium text-steel-900 numeric-latin">
                    {cls.fromDailyRateHalalas === null
                      ? "—"
                      : `${formatMoney(cls.fromDailyRateHalalas, locale)}${dict.common.perDay}`}
                  </td>
                ))}
              </tr>

              <tr className="border-b border-steel-100">
                <th scope="row" className="px-4 py-2.5 text-start font-normal text-steel-600">
                  {dict.equipment.capacity}
                </th>
                {classes.map((cls) => (
                  <td key={cls.id} className="px-4 py-2.5 text-steel-800 numeric-latin">
                    {cls.capacityKg === null ? "—" : formatCapacity(cls.capacityKg, locale)}
                  </td>
                ))}
              </tr>

              <tr className="border-b border-steel-100">
                <th scope="row" className="px-4 py-2.5 text-start font-normal text-steel-600">
                  {dict.equipment.operator}
                </th>
                {classes.map((cls) => (
                  <td key={cls.id} className="px-4 py-2.5 text-steel-800">
                    {cls.requiresOperator
                      ? dict.equipment.operatorRequired
                      : cls.operatorIncluded
                        ? dict.equipment.operatorAvailable
                        : "—"}
                  </td>
                ))}
              </tr>

              <tr className="border-b border-steel-100">
                <th scope="row" className="px-4 py-2.5 text-start font-normal text-steel-600">
                  {dict.equipment.minRental}
                </th>
                {classes.map((cls) => (
                  <td key={cls.id} className="px-4 py-2.5 text-steel-800 numeric-latin">
                    {formatNumber(cls.minRentalDays, locale)}{" "}
                    {cls.minRentalDays === 1 ? dict.common.day : dict.common.days}
                  </td>
                ))}
              </tr>

              <tr className="border-b border-steel-100">
                <th scope="row" className="px-4 py-2.5 text-start font-normal text-steel-600">
                  {dict.equipment.deposit}
                </th>
                {classes.map((cls) => (
                  <td key={cls.id} className="px-4 py-2.5 text-steel-800 numeric-latin">
                    {cls.depositHalalas === 0n ? "—" : formatMoney(cls.depositHalalas, locale)}
                  </td>
                ))}
              </tr>

              <tr className="border-b border-steel-100">
                <th scope="row" className="px-4 py-2.5 text-start font-normal text-steel-600">
                  {dict.equipment.fuel}
                </th>
                {classes.map((cls) => (
                  <td key={cls.id} className="px-4 py-2.5 text-steel-800">
                    {cls.fuelPolicy === "wet" ? dict.equipment.fuelWet : dict.equipment.fuelDry}
                  </td>
                ))}
              </tr>

              {specLabels.map((label) => (
                <tr key={label} className="border-b border-steel-100">
                  <th scope="row" className="px-4 py-2.5 text-start font-normal text-steel-600">
                    {label}
                  </th>
                  {classes.map((cls) => (
                    <td key={cls.id} className="px-4 py-2.5 text-steel-800 numeric-latin">
                      {specValue(cls, label)}
                    </td>
                  ))}
                </tr>
              ))}

              {/* A CTA per column — PRD C5. Comparing is how the decision gets
                  made, so the action belongs in the same place as the decision. */}
              <tr>
                <th scope="row" className="px-4 py-4 text-start font-normal text-steel-600" />
                {classes.map((cls) => (
                  <td key={cls.id} className="px-4 py-4 align-top">
                    <ButtonLink
                      href={localePath(locale, `/equipment/item/${cls.slug}`)}
                      size="md"
                      className="w-full justify-center"
                    >
                      {cls.instantBookable
                        ? dict.equipment.checkAvailability
                        : dict.equipment.requestQuote}
                    </ButtonLink>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </ScrollX>
      </Card>

      <p className="mt-4 text-xs text-steel-500">{dict.equipment.safetyBody}</p>
    </Container>
  );
}
