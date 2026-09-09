import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, Input, ScrollX } from "@/components/ui";
import { listAdminCustomers } from "@/lib/admin/repository";
import { getDictionary } from "@/lib/i18n";
import { formatDate, formatNumber, isLocale, localePath, type Locale } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Customers.
 *
 * Since checkout stopped requiring an account, "who are my customers" is no
 * longer answerable from a list of registrations — there are none. It is
 * answerable from the bookings themselves, grouped by the email each was made
 * with, which is what this page shows.
 *
 * The whole section sits behind the admin layout's platform-admin gate.
 */
export default async function AdminCustomersPage({
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

  const search = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim() : undefined;
  const customers = await listAdminCustomers({ search });

  const repeat = customers.filter((c) => c.bookingCount > 1).length;
  const totalCharged = customers.reduce((sum, c) => sum + c.lifetimeChargedHalalas, 0n);

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-steel-950">
        {dict.admin.customers}
      </h1>
      <p className="mb-5 text-sm text-steel-600">{dict.admin.customersIntro}</p>

      {/* Two numbers that change what an owner does next: how many people come
          back, and what the listed customers are worth. Both are computed from
          the rows on screen, so they always agree with the table below them. */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {[
          { label: dict.admin.customers, value: formatNumber(customers.length, locale) },
          { label: dict.admin.repeatCustomers, value: formatNumber(repeat, locale) },
          { label: dict.admin.lifetimeValue, value: formatMoney(totalCharged, locale) },
        ].map((tile) => (
          <Card key={tile.label}>
            <div className="px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-steel-500">
                {tile.label}
              </p>
              <p className="mt-1 text-xl font-bold text-steel-950 numeric-latin">{tile.value}</p>
            </div>
          </Card>
        ))}
      </div>

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
            placeholder={dict.admin.customersSearchHint}
          />
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
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-steel-200 bg-steel-50">
                <th scope="col" className="px-4 py-2.5 text-start font-semibold text-steel-700">
                  {dict.auth.fullName}
                </th>
                <th scope="col" className="px-4 py-2.5 text-start font-semibold text-steel-700">
                  {dict.auth.email}
                </th>
                <th scope="col" className="px-4 py-2.5 text-end font-semibold text-steel-700">
                  {dict.admin.bookings}
                </th>
                <th scope="col" className="px-4 py-2.5 text-end font-semibold text-steel-700">
                  {dict.admin.lifetimeValue}
                </th>
                <th scope="col" className="px-4 py-2.5 text-start font-semibold text-steel-700">
                  {dict.admin.lastBooked}
                </th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-steel-500">
                    {dict.common.noResults}
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.userId} className="border-b border-steel-100 last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-steel-900">{c.fullName}</span>
                      {c.companyName && (
                        <span className="block text-xs text-steel-500">{c.companyName}</span>
                      )}
                      {/* Says how this person can be reached, not what they
                          are worth: a guest has no password, so "email them
                          the reference" is the only route back in. */}
                      {c.isGuest && (
                        <Badge tone="neutral" className="mt-1">
                          {dict.admin.guestCustomer}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-steel-700">
                      <a
                        href={`mailto:${c.email}`}
                        className="underline underline-offset-2 numeric-latin"
                        dir="ltr"
                      >
                        {c.email}
                      </a>
                      {c.phone && (
                        <span className="block text-xs text-steel-500 numeric-latin" dir="ltr">
                          {c.phone}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-end text-steel-700 numeric-latin">
                      {formatNumber(c.bookingCount, locale)}
                      {c.cancelledCount > 0 && (
                        <span className="block text-xs text-steel-500">
                          {formatNumber(c.cancelledCount, locale)} {dict.admin.cancelledSuffix}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-end font-medium text-steel-900 numeric-latin">
                      {formatMoney(c.lifetimeChargedHalalas, locale)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-steel-700 numeric-latin">
                      {formatDate(c.lastBookedAt, locale)}
                      <Link
                        href={localePath(locale, `/admin/bookings?q=${encodeURIComponent(c.fullName)}`)}
                        className="block text-xs text-steel-500 underline underline-offset-2"
                      >
                        {dict.admin.viewBookings}
                      </Link>
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
