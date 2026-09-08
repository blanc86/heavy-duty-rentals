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

  // Chunk into calendar weeks. A table needs real rows; a flat grid does not.
  const weeks: (DayAvailability | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div className="rounded-[--radius-card] border border-steel-200 bg-white p-4">
      {/*
        A real <table>, not `role="grid"` on a div.

        This was a CSS grid carrying `role="grid"` with flat `columnheader` and
        `gridcell` children and no rows between them. That is structurally
        invalid ARIA — a grid must contain rows, and a columnheader must sit
        inside one — so a screen reader was handed a broken grid on the single
        page the whole product exists for.

        A calendar is tabular data, so the fix is not better ARIA but none at
        all: `<table>`, `<tr>`, `<th scope="col">` and `<td>` carry the same
        meaning natively, correctly, and without a role attribute to get wrong.
      */}
      <table className="w-full table-fixed border-collapse text-center">
        <caption className="sr-only">{dict.a11y.calendar}</caption>
        <thead>
          <tr>
            {weekdayLabels.map((label) => (
              <th
                key={label}
                scope="col"
                className="pb-1 text-2xs font-semibold uppercase tracking-wide text-steel-600"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, weekIndex) => (
            <tr key={`week-${weekIndex}`}>
              {week.map((day, dayIndex) => {
                if (!day) return <td key={`blank-${weekIndex}-${dayIndex}`} className="p-0.5" />;

                const ratio = day.availableUnits / maxUnits;
                const tone =
                  day.availableUnits === 0
                    ? "bg-[--color-danger-bg] text-[--color-danger] border-[--color-danger]/20"
                    : ratio <= 0.34
                      ? "bg-[--color-warning-bg] text-[--color-warning] border-[--color-warning]/20"
                      : "bg-[--color-available-bg] text-[--color-available] border-[--color-available]/20";

                const date = new Date(`${day.date}T00:00:00Z`);
                const readout = `${formatDate(date, locale)}: ${
                  day.availableUnits === 0
                    ? dict.equipment.noUnitsAvailable
                    : dict.equipment.unitsAvailable.replace(
                        "{count}",
                        formatNumber(day.availableUnits, locale),
                      )
                }`;

                return (
                  <td key={day.date} className="p-0.5">
                    <div
                      title={`${formatDate(date, locale)} — ${formatNumber(day.availableUnits, locale)}/${formatNumber(day.totalUnits, locale)}`}
                      className={`rounded border px-1 py-1.5 text-xs ${tone}`}
                    >
                      {/* The full meaning, for anyone not seeing the colour:
                          "14 March, 3 available" rather than a green square.
                          Visually hidden rather than an aria-label, so it is
                          also available to translation and to find-in-page. */}
                      <span className="sr-only">{readout}</span>
                      <span aria-hidden="true" className="block font-semibold numeric-latin">
                        {formatNumber(date.getUTCDate(), locale)}
                      </span>
                      <span aria-hidden="true" className="block text-2xs numeric-latin">
                        {formatNumber(day.availableUnits, locale)}
                      </span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

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
