import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert, Card, ScrollX } from "@/components/ui";
import { getUtilizationByClass } from "@/lib/admin/repository";
import { getDictionary } from "@/lib/i18n";
import { formatNumber, isLocale, type Locale } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Fleet utilization.
 *
 * The report that decides capital allocation: which classes are earning and
 * which are sitting in the yard. Maintenance windows are excluded from
 * rentable time, so a machine that was in the workshop is not counted against
 * demand — otherwise a maintenance problem reads as a market problem.
 */
export default async function AdminUtilizationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDictionary(locale);

  const rows = await getUtilizationByClass(locale, 30);
  const withUnits = rows.filter((r) => r.totalUnits > 0);

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-steel-950">
        {dict.admin.utilization}
      </h1>
      <p className="mb-5 text-sm text-steel-600">
        {locale === "ar"
          ? "معدل التشغيل = وقت التأجير ÷ الوقت القابل للتأجير خلال آخر 30 يوماً. تُستبعد فترات الصيانة من الوقت القابل للتأجير."
          : "Utilization = rented time ÷ rentable time over the last 30 days. Maintenance windows are excluded from rentable time."}
      </p>

      {withUnits.length === 0 ? (
        <Alert tone="info">{dict.common.noResults}</Alert>
      ) : (
        <Card>
          <ScrollX>
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-steel-200 bg-steel-50">
                  <th scope="col" className="px-4 py-2.5 text-start font-semibold text-steel-700">
                    {dict.equipment.title}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start font-semibold text-steel-700">
                    {dict.filters.category}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-end font-semibold text-steel-700">
                    {dict.admin.totalUnits}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-end font-semibold text-steel-700">
                    {locale === "ar" ? "أيام مؤجرة" : "Rented days"}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start font-semibold text-steel-700">
                    {dict.admin.utilization}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-end font-semibold text-steel-700">
                    {dict.admin.revenue}
                  </th>
                </tr>
              </thead>
              <tbody>
                {withUnits.map((row) => (
                  <tr key={row.classId} className="border-b border-steel-100 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-steel-900">{row.className}</td>
                    <td className="px-4 py-2.5 text-steel-600">{row.categoryName}</td>
                    <td className="px-4 py-2.5 text-end text-steel-700 numeric-latin">
                      {formatNumber(row.totalUnits, locale)}
                    </td>
                    <td className="px-4 py-2.5 text-end text-steel-700 numeric-latin">
                      {formatNumber(row.rentedDays, locale)} /{" "}
                      {formatNumber(row.availableDays, locale)}
                    </td>
                    <td className="px-4 py-2.5">
                      {/* A bar, not a chart library: one number per row, read
                          at a glance, with the figure still present for
                          screen readers and for anyone who needs the exact
                          value. */}
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-24 shrink-0 overflow-hidden rounded-full bg-steel-200"
                          role="img"
                          aria-label={`${row.utilizationPercent}%`}
                        >
                          <div
                            className={
                              row.utilizationPercent >= 70
                                ? "h-full rounded-full bg-[--color-available]"
                                : row.utilizationPercent >= 40
                                  ? "h-full rounded-full bg-[--color-warning]"
                                  : "h-full rounded-full bg-[--color-danger]"
                            }
                            style={{ width: `${Math.max(row.utilizationPercent, 2)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-steel-800 numeric-latin">
                          {formatNumber(row.utilizationPercent, locale)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-end font-medium text-steel-950 numeric-latin">
                      {formatMoney(row.revenueHalalas, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollX>
        </Card>
      )}
    </>
  );
}
