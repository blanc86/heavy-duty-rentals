import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, Input, ScrollX, Select } from "@/components/ui";
import { AdminBookingControls } from "@/components/admin/booking-controls";
import { listAdminBookings } from "@/lib/admin/repository";
import { getDictionary } from "@/lib/i18n";
import { formatDate, isLocale, localePath, type Locale } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Allowlisted so a crafted `?status=` cannot be interpolated into the query. */
const STATUSES = [
  "pending_payment",
  "confirmed",
  "active",
  "completed",
  "cancelled",
  "expired",
] as const;

export default async function AdminBookingsPage({
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

  const status =
    typeof sp.status === "string" && STATUSES.includes(sp.status as never) ? sp.status : undefined;
  const search = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim() : undefined;

  const bookings = await listAdminBookings({ locale, status, search });

  return (
    <>
      <h1 className="mb-5 text-2xl font-bold tracking-tight text-steel-950">
        {dict.admin.bookings}
      </h1>

      <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="q" className="mb-1.5 block text-sm font-medium text-steel-800">
            {dict.common.search}
          </label>
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={search ?? ""}
            placeholder="RNT-… / name"
          />
        </div>
        <div>
          <label htmlFor="status" className="mb-1.5 block text-sm font-medium text-steel-800">
            {dict.common.status}
          </label>
          <Select id="status" name="status" defaultValue={status ?? ""}>
            <option value="">{dict.common.all}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </div>
        <button
          type="submit"
          className="min-h-[2.75rem] rounded-[--radius-control] bg-steel-900 px-4 text-sm font-semibold text-white hover:bg-steel-800"
        >
          {dict.common.apply}
        </button>
      </form>

      <Card>
        <ScrollX>
          <table className="w-full min-w-[58rem] text-sm">
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
                  {dict.booking.duration}
                </th>
                <th scope="col" className="px-4 py-2.5 text-start font-semibold text-steel-700">
                  {dict.filters.location}
                </th>
                <th scope="col" className="px-4 py-2.5 text-start font-semibold text-steel-700">
                  {dict.common.status}
                </th>
                <th scope="col" className="px-4 py-2.5 text-start font-semibold text-steel-700">
                  {dict.account.paymentStatus}
                </th>
                <th scope="col" className="px-4 py-2.5 text-end font-semibold text-steel-700">
                  {dict.common.total}
                </th>
                <th scope="col" className="px-4 py-2.5 text-start">
                    {dict.admin.actions}
                  </th>
                </tr>
            </thead>
            <tbody>
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-steel-500">
                    {dict.common.noResults}
                  </td>
                </tr>
              ) : (
                bookings.map((b) => (
                  <tr key={b.id} className="border-b border-steel-100 last:border-0">
                    <td className="px-4 py-2.5">
                      <Link
                        href={localePath(locale, `/booking/${b.reference}`)}
                        className="font-medium text-steel-900 underline underline-offset-2 numeric-latin"
                      >
                        {b.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-steel-700">
                      {b.customerName}
                      {b.companyName && (
                        <span className="block text-xs text-steel-500">{b.companyName}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-steel-700">
                      {b.className}
                      {b.assetCode && (
                        <span className="block text-xs text-steel-500 numeric-latin">
                          {b.assetCode}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-steel-700 numeric-latin">
                      {formatDate(b.startDate, locale)} → {formatDate(b.endDate, locale)}
                    </td>
                    <td className="px-4 py-2.5 text-steel-700">{b.siteCity ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge
                        tone={
                          b.status === "confirmed" || b.status === "active"
                            ? "available"
                            : b.status === "pending_payment"
                              ? "warning"
                              : b.status === "cancelled" || b.status === "expired"
                                ? "danger"
                                : "neutral"
                        }
                      >
                        {b.status.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-steel-700">{b.paymentStatus ?? "—"}</td>
                    {/* The CHARGED amount, so this column reconciles against
                        the revenue tile and the tax invoice. The deposit is
                        shown beneath it rather than folded in, because it is
                        not collected online. */}
                    <td className="px-4 py-2.5 text-end font-medium text-steel-950 numeric-latin">
                      {formatMoney(b.chargedNowHalalas, locale, b.currency)}
                      {b.depositHalalas > 0n && (
                        <span className="block text-xs font-normal text-steel-500">
                          + {formatMoney(b.depositHalalas, locale, b.currency)}{" "}
                          {dict.booking.depositLine.toLowerCase()}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-2.5">
                      <AdminBookingControls reference={b.reference} status={b.status} dict={dict} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollX>
      </Card>
    </>
  );
}
