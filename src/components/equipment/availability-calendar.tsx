import type { DayAvailability } from "@/lib/availability";
import type { Dictionary } from "@/lib/i18n";
import { formatDate, formatNumber, type Locale } from "@/lib/i18n/config";

/**
 * Availability calendar.
 *
 * A Server Component rendering a real 60-day view built from actual
 * reservations and maintenance blackouts. It ships no JavaScript.
 *
 * This is the feature the whole system exists for: the buyer's first question
 * is "is it free on the 14th", and every competitor answers it with a phone
 * call. It is also the reason we must never fake it — a calendar that shows
 * green for a machine that is out on hire is worse than no calendar.
 */
export function AvailabilityCalendar({
  days,
  locale,
  dict,
}: {
  days: DayAvailability[];
  locale: Locale;
  dict: Dictionary;
}) {
  if (days.length === 0) {
    return (
      <p className="rounded-[--radius-card] border border-dashed border-steel-300 px-4 py-6 text-center text-sm text-steel-500">
        {dict.common.notAvailable}
      </p>
    );
  }

  // Group into weeks starting Sunday, which is the Saudi working week.
  const first = days[0];
  if (!first) return null;

  const leadingBlanks = new Date(`${first.date}T00:00:00Z`).getUTCDay();
  const cells: (DayAvailability | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...days,
  ];

  const weekdayLabels = Array.from({ length: 7 }, (_, i) => {
    // 2026-03-01 is a Sunday, so this yields Sun..Sat in the right order.
    const date = new Date(Date.UTC(2026, 2, 1 + i));
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-SA", {
      weekday: "short",
      timeZone: "UTC",
    }).format(date);
  });

  const maxUnits = Math.max(...days.map((d) => d.totalUnits), 1);

  return (
    <div className="rounded-[--radius-card] border border-steel-200 bg-white p-4">
      <div
        role="grid"
        aria-label={dict.a11y.calendar}
        className="grid grid-cols-7 gap-1 text-center"
      >
        {weekdayLabels.map((label) => (
          <div
            key={label}
            role="columnheader"
            className="pb-1 text-2xs font-semibold uppercase tracking-wide text-steel-500"
          >
            {label}
          </div>
        ))}

        {cells.map((day, index) => {
          if (!day) return <div key={`blank-${index}`} role="gridcell" aria-hidden="true" />;

          const ratio = day.availableUnits / maxUnits;
          const tone =
            day.availableUnits === 0
              ? "bg-[--color-danger-bg] text-[--color-danger] border-[--color-danger]/20"
              : ratio <= 0.34
                ? "bg-[--color-warning-bg] text-[--color-warning] border-[--color-warning]/20"
                : "bg-[--color-available-bg] text-[--color-available] border-[--color-available]/20";

          const date = new Date(`${day.date}T00:00:00Z`);

          return (
            <div
              key={day.date}
              role="gridcell"
              // The accessible name carries the full meaning — a screen-reader
              // user gets "14 March, 3 available", not just a coloured square.
              aria-label={`${formatDate(date, locale)}: ${
                day.availableUnits === 0
                  ? dict.equipment.noUnitsAvailable
                  : dict.equipment.unitsAvailable.replace(
                      "{count}",
                      formatNumber(day.availableUnits, locale),
                    )
              }`}
              title={`${formatDate(date, locale)} — ${formatNumber(day.availableUnits, locale)}/${formatNumber(day.totalUnits, locale)}`}
              className={`rounded border px-1 py-1.5 text-xs ${tone}`}
            >
              <span className="block font-semibold numeric-latin">
                {formatNumber(date.getUTCDate(), locale)}
              </span>
              <span className="block text-2xs numeric-latin">
                {formatNumber(day.availableUnits, locale)}
              </span>
            </div>
          );
        })}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-steel-600">
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-[--color-available]/20 bg-[--color-available-bg]" />
          {dict.equipment.availableNow}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-[--color-warning]/20 bg-[--color-warning-bg]" />
          {locale === "ar" ? "توفر محدود" : "Limited"}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-[--color-danger]/20 bg-[--color-danger-bg]" />
          {locale === "ar" ? "غير متاح" : "Unavailable"}
        </li>
      </ul>
    </div>
  );
}
