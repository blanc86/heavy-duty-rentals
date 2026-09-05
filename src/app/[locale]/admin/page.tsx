import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardBody, ScrollX } from "@/components/ui";
import { getOpsDashboard, listAdminBookings } from "@/lib/admin/repository";
import { getDictionary } from "@/lib/i18n";
import { formatDate, formatNumber, isLocale, localePath, type Locale } from "@/lib/i18n/config";
import { formatMoney, type Halalas } from "@/lib/money";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDictionary(locale);

  const [ops, recent] = await Promise.all([
    getOpsDashboard(),
    listAdminBookings({ locale, limit: 10 }),
  ]);

  const money = (value: Halalas) => formatMoney(value, locale);

  // Period-over-period change: a revenue figure without a direction is
  // decoration, not information.
  const revenueChange =
    ops.revenue.previous30DaysHalalas === 0n
      ? null
      : Math.round(
          (Number(ops.revenue.last30DaysHalalas - ops.revenue.previous30DaysHalalas) /
            Number(ops.revenue.previous30DaysHalalas)) *
            100,
        );

  const tiles: {
    label: string;
    value: string;
    hint?: string;
    tone?: "neutral" | "danger" | "warning" | "available";
  }[] = [
    {
      label: `${dict.admin.revenue} (30d)`,
      value: money(ops.revenue.last30DaysHalalas),
      hint:
        revenueChange === null
          ? undefined
          : `${revenueChange >= 0 ? "+" : ""}${formatNumber(revenueChange, locale)}% vs prior 30d`,
    },
    {
      label: dict.admin.utilization,
      value: `${formatNumber(ops.fleet.utilizationPercent, locale)}%`,
      hint: `${formatNumber(ops.fleet.onHireUnits, locale)} / ${formatNumber(ops.fleet.totalUnits, locale)} ${locale === "ar" ? "على الإيجار" : "on hire"}`,
    },
    {
      label: dict.admin.activeRentals,
      value: formatNumber(ops.bookings.active, locale),
      hint: `${formatNumber(ops.bookings.upcoming, locale)} ${locale === "ar" ? "قادمة" : "upcoming"}`,
    },
    {
      label: dict.admin.upcomingReturns,
      value: formatNumber(ops.bookings.returnsDueNext7Days, locale),
      hint: locale === "ar" ? "خلال 7 أيام" : "next 7 days",
    },
    {
      label: dict.admin.overdueRentals,
      value: formatNumber(ops.bookings.overdue, locale),
      tone: ops.bookings.overdue > 0 ? "danger" : "neutral",
    },
    {
      label: dict.admin.pendingPayments,
      value: formatNumber(ops.bookings.pendingPayment, locale),
      hint: money(ops.revenue.pendingHalalas),
      tone: ops.bookings.pendingPayment > 0 ? "warning" : "neutral",
    },
    {
      label: dict.admin.availableUnits,
      value: formatNumber(ops.fleet.availableUnits, locale),
      hint: `${formatNumber(ops.fleet.maintenanceUnits, locale)} ${locale === "ar" ? "في الصيانة" : "in maintenance"}`,
    },
    {
      label: locale === "ar" ? "مدفوعات فاشلة (30 يوم)" : "Failed payments (30d)",
      value: formatNumber(ops.failedPayments, locale),
      tone: ops.failedPayments > 0 ? "warning" : "neutral",
    },
  ];

  return (
    <>
      <h1 className="mb-5 text-2xl font-bold tracking-tight text-steel-950">
        {dict.admin.dashboard}
      </h1>

      <ul className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.label}>
            <Card
              className={
                tile.tone === "danger"
                  ? "border-[--color-danger]/30"
                  : tile.tone === "warning"
                    ? "border-[--color-warning]/30"
                    : undefined
              }
            >
              <CardBody className="py-4">
                <p className="text-xs text-steel-600">{tile.label}</p>
                <p className="mt-1 text-xl font-bold text-steel-950 numeric-latin">{tile.value}</p>
                {tile.hint && (
                  <p className="mt-0.5 text-xs text-steel-500 numeric-latin">{tile.hint}</p>
                )}
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-steel-950">{dict.admin.newBookings}</h2>
          <Link
            href={localePath(locale, "/admin/bookings")}
            className="text-sm font-medium text-steel-700 underline-offset-2 hover:underline"
          >
            {dict.common.showMore} →
          </Link>
        </div>

        <Card>
          <ScrollX>
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="border-b border-steel-200 bg-steel-50">
                  <th scope="col" className="px-4 py-2.5 text-start font-semibold text-steel-700">
                    {dict.booking.bookingReference}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start font-semibold text-steel-700">
                    {dict.admin.customers}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start font-semibold text-steel-700">
                    {dict.equipment.title}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start font-semibold text-steel-700">
                    {dict.booking.startDate}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start font-semibold text-steel-700">
                    {dict.common.status}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-end font-semibold text-steel-700">
                    {dict.common.total}
                  </th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-steel-500">
                      {dict.common.noResults}
                    </td>
                  </tr>
                ) : (
                  recent.map((booking) => (
                    <tr key={booking.id} className="border-b border-steel-100 last:border-0">
                      <td className="px-4 py-2.5 font-medium text-steel-900 numeric-latin">
                        {booking.reference}
                      </td>
                      <td className="px-4 py-2.5 text-steel-700">
                        {booking.customerName}
                        {booking.companyName && (
                          <span className="block text-xs text-steel-500">{booking.companyName}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-steel-700">
                        {booking.className}
                        {booking.assetCode && (
                          <span className="block text-xs text-steel-500 numeric-latin">
                            {booking.assetCode}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-steel-700 numeric-latin">
                        {formatDate(booking.startDate, locale)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge
                          tone={
                            booking.status === "confirmed" || booking.status === "active"
                              ? "available"
                              : booking.status === "pending_payment"
                                ? "warning"
                                : booking.status === "cancelled" || booking.status === "expired"
                                  ? "danger"
                                  : "neutral"
                          }
                        >
                          {booking.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      {/* Charged, not total-with-deposit: this sits next to the
                          revenue tile and must agree with it. */}
                      <td className="px-4 py-2.5 text-end font-medium text-steel-950 numeric-latin">
                        {formatMoney(booking.chargedNowHalalas, locale, booking.currency)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollX>
        </Card>
      </section>
    </>
  );
}
