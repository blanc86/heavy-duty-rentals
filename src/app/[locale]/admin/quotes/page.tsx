import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, Card, EmptyState, ScrollX, Select } from "@/components/ui";
import { listAdminQuotes } from "@/lib/admin/repository";
import { getDictionary } from "@/lib/i18n";
import { formatDate, formatNumber, isLocale, type Locale } from "@/lib/i18n/config";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Allowlisted so a crafted `?status=` cannot be interpolated into the query. */
const STATUSES = [
  "requested",
  "in_review",
  "priced",
  "sent",
  "accepted",
  "rejected",
  "expired",
] as const;

/**
 * Quote requests.
 *
 * Deliberately READ-ONLY. The public form promises "we will come back with an
 * itemised quote", and until this page existed there was nowhere that promise
 * could be kept — requests landed in the database and no screen showed them.
 *
 * What it does NOT do is let someone price a lift from a table. Above the
 * instant-book capacity threshold, mobilisation cannot be quoted without a
 * route survey and a lifting engineer (docs/research.md §4) — which is the
 * whole reason these requests exist instead of a checkout. So this surfaces the
 * request, the lift figures and the contact details, and the response happens
 * by phone until the quoting workflow is built.
 */
export default async function AdminQuotesPage({
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

  const quotes = await listAdminQuotes({ locale, status });

  const liftSummary = (details: Record<string, unknown>) => {
    const parts: string[] = [];
    // Separators matter here: "420000 kg" and "42000 kg" are a tandem lift and
    // a single-crane lift, and they should not be distinguishable only by
    // counting digits.
    if (typeof details.loadWeightKg === "number")
      parts.push(`${formatNumber(details.loadWeightKg, locale)} kg`);
    if (typeof details.radiusM === "number")
      parts.push(`R ${formatNumber(details.radiusM, locale)} m`);
    if (typeof details.liftHeightM === "number")
      parts.push(`H ${formatNumber(details.liftHeightM, locale)} m`);
    return parts.join(" · ");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-steel-950">{dict.admin.quotes}</h1>

        <form className="flex items-end gap-2">
          <div>
            <label htmlFor="status" className="mb-1 block text-xs font-medium text-steel-600">
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
            className="min-h-[2.75rem] rounded-[--radius-control] bg-steel-900 px-4 text-sm font-medium text-white hover:bg-steel-800"
          >
            {dict.common.apply}
          </button>
        </form>
      </div>

      <Card>
        {quotes.length === 0 ? (
          <EmptyState title={dict.common.noResults} />
        ) : (
          <ScrollX>
            <table className="w-full min-w-[64rem] text-sm">
              <thead className="border-b border-steel-200 text-start text-xs uppercase tracking-wide text-steel-500">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-start">
                    {dict.booking.bookingReference}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start">
                    {dict.admin.customers}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start">
                    {dict.admin.equipment}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start">
                    {dict.booking.siteDetails}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start">
                    {dict.booking.stepDates}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start">
                    {dict.common.status}
                  </th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id} className="border-b border-steel-100 last:border-0 align-top">
                    <td className="px-4 py-2.5 font-medium text-steel-900 numeric-latin">
                      {q.reference}
                      <span className="block text-xs font-normal text-steel-500 numeric-latin">
                        {formatDate(q.createdAt, locale)}
                      </span>
                    </td>

                    {/* Contact details are the point of this screen: the
                        response happens by phone. */}
                    <td className="px-4 py-2.5 text-steel-700">
                      {q.contactName}
                      {q.companyName && (
                        <span className="block text-xs text-steel-500">{q.companyName}</span>
                      )}
                      <span className="block text-xs text-steel-500 numeric-latin" dir="ltr">
                        {q.contactPhone} · {q.contactEmail}
                      </span>
                    </td>

                    <td className="px-4 py-2.5 text-steel-700">
                      {q.className ?? q.descriptionRaw ?? "—"}
                      {liftSummary(q.liftDetails) && (
                        <span className="block text-xs text-steel-500 numeric-latin">
                          {liftSummary(q.liftDetails)}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-2.5 text-steel-700">{q.siteCity ?? "—"}</td>

                    <td className="px-4 py-2.5 text-steel-700 numeric-latin">
                      {q.startDate && q.endDate
                        ? `${formatDate(q.startDate, locale)} → ${formatDate(q.endDate, locale)}`
                        : "—"}
                    </td>

                    <td className="px-4 py-2.5">
                      <Badge tone={q.status === "requested" ? "warning" : "neutral"}>
                        {q.status.replace(/_/g, " ")}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollX>
        )}
      </Card>

      <p className="text-xs text-steel-500">{dict.admin.quotesReadOnlyNote}</p>
    </div>
  );
}
