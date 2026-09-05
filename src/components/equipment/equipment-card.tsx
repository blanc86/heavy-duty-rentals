import Link from "next/link";
import { Badge, Card, DemoBadge } from "@/components/ui";
import { CompareToggle } from "./compare-tray";
import type { ClassSummary } from "@/lib/catalog/repository";
import type { Dictionary } from "@/lib/i18n";
import { formatCapacity, formatNumber, localePath, type Locale } from "@/lib/i18n/config";
import { illustrationUrl } from "@/lib/media/equipment-illustration";
import { formatMoneyCompact } from "@/lib/money";

/**
 * Equipment listing card.
 *
 * Answers, at a glance and without a click, the four questions a buyer has:
 * what is it, how big, is it free, what does it cost. The reference site
 * answers none of these without a phone call.
 *
 * When dates are in the URL, `availableUnits` is a real count from the
 * availability engine — not a decorative "Available" label.
 */
export function EquipmentCard({
  item,
  locale,
  dict,
  availableUnits,
  searchParams,
}: {
  item: ClassSummary;
  locale: Locale;
  dict: Dictionary;
  availableUnits?: number | undefined;
  searchParams?: string | undefined;
}) {
  const href =
    localePath(locale, `/equipment/item/${item.slug}`) + (searchParams ? `?${searchParams}` : "");



  return (
    <Card className="group flex flex-col overflow-hidden transition-shadow hover:shadow-[--shadow-raised]">
      <Link href={href} className="block focus-visible:outline-none">
        <div className="relative aspect-[4/3] overflow-hidden bg-steel-100">
          {/*
            A real photograph wins whenever the business has supplied one.
            Otherwise a generated technical illustration for the category — see
            lib/media/equipment-illustration.ts for why it is drawn, not stock.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element -- storage-backed key or generated SVG, not a build-time asset */}
          <img
            src={
              item.primaryImageKey
                ? `/api/media/${item.primaryImageKey}`
                : illustrationUrl(item.categorySlug, locale)
            }
            alt={item.primaryImageAlt ?? item.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />

          {item.isDemoData && (
            <div className="absolute start-2 top-2">
              <DemoBadge label={dict.common.demoData} />
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-2xs font-medium uppercase tracking-wide text-steel-500">
          {item.categoryName}
        </p>

        <h3 className="mt-1 text-base font-semibold leading-snug text-steel-950">
          <Link href={href} className="after:absolute after:inset-0 hover:underline">
            {item.name}
          </Link>
        </h3>

        <p className="mt-0.5 text-sm text-steel-600">
          {item.manufacturer} {item.model}
        </p>

        <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {item.capacityKg !== null && (
            <div className="flex gap-1">
              <dt className="text-steel-500">{dict.equipment.capacity}:</dt>
              <dd className="font-medium text-steel-900 numeric-latin">
                {formatCapacity(item.capacityKg, locale)}
              </dd>
            </div>
          )}
          <div className="flex gap-1">
            <dt className="text-steel-500">{dict.equipment.minRental}:</dt>
            <dd className="font-medium text-steel-900 numeric-latin">
              {formatNumber(item.minRentalDays, locale)}{" "}
              {item.minRentalDays === 1 ? dict.common.day : dict.common.days}
            </dd>
          </div>
        </dl>

        {/* Inclusion badges. "Wet vs dry" is the single most common source of
            quote disputes in this industry, so it is stated on the card rather
            than buried in terms. */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {availableUnits !== undefined && (
            <Badge tone={availableUnits > 0 ? "available" : "danger"}>
              {availableUnits > 0
                ? availableUnits === 1
                  ? dict.equipment.oneUnitAvailable
                  : dict.equipment.unitsAvailable.replace(
                      "{count}",
                      formatNumber(availableUnits, locale),
                    )
                : dict.equipment.noUnitsAvailable}
            </Badge>
          )}
          {item.operatorIncluded && <Badge tone="info">{dict.equipment.operatorAvailable}</Badge>}
          <Badge tone="neutral">
            {item.fuelPolicy === "wet" ? dict.equipment.fuelWet : dict.equipment.fuelDry}
          </Badge>
        </div>

        {/* flex-wrap so the CTA drops below the price rather than colliding
            with it when the card is narrow — this row carries the two things
            the buyer actually acts on. */}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-2 pt-4">
          {item.fromDailyRateHalalas !== null ? (
            <p>
              <span className="block text-2xs uppercase tracking-wide text-steel-500">
                {dict.equipment.fromPrice}
              </span>
              <span className="text-lg font-bold text-steel-950 numeric-latin">
                {formatMoneyCompact(item.fromDailyRateHalalas, locale)}
              </span>
              <span className="text-sm text-steel-600">{dict.common.perDay}</span>
            </p>
          ) : (
            <p className="text-sm font-medium text-steel-600">{dict.equipment.requestQuote}</p>
          )}

          <span className="relative z-10 inline-flex min-h-[2.25rem] shrink-0 items-center whitespace-nowrap rounded-[--radius-control] bg-steel-900 px-3 text-sm font-semibold text-white transition-colors group-hover:bg-amber-500 group-hover:text-steel-950">
            {item.instantBookable ? dict.equipment.checkAvailability : dict.equipment.requestQuote}
          </span>
        </div>

        {/* `relative z-10` so this sits above the card's stretched title link,
            which otherwise swallows the click and navigates instead. */}
        <div className="relative z-10 mt-3 border-t border-steel-100 pt-3">
          <CompareToggle slug={item.slug} dict={dict} />
        </div>
      </div>
    </Card>
  );
}
