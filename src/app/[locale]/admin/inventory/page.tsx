import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, Card, ScrollX, Select } from "@/components/ui";
import { listAdminUnits } from "@/lib/admin/repository";
import { listBranches } from "@/lib/catalog/repository";
import { getDictionary } from "@/lib/i18n";
import { formatDate, formatNumber, isLocale, type Locale } from "@/lib/i18n/config";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Allowlisted so a crafted `?status=` cannot reach the query as a raw enum cast. */
const UNIT_STATUSES = [
  "available",
  "reserved",
  "rented",
  "in_transit",
  "maintenance",
  "inspection",
  "out_of_service",
] as const;

export default async function AdminInventoryPage({
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
    typeof sp.status === "string" && UNIT_STATUSES.includes(sp.status as never)
      ? sp.status
      : undefined;
  const branchSlug = typeof sp.branch === "string" && sp.branch ? sp.branch : undefined;

  const [units, branches] = await Promise.all([
    listAdminUnits({ locale, status, branchSlug }),
    listBranches(locale),
  ]);

  const soon = Date.now() + 30 * 86_400_000;

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-steel-950">
        {dict.admin.inventory}
      </h1>
      <p className="mb-5 text-sm text-steel-600">
        {locale === "ar"
          ? "كل صف هنا معدة فعلية برقم تسلسلي وجدول توفر خاص بها."
          : "Every row is a physical machine with its own serial number and availability calendar."}
      </p>

      <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="branch" className="mb-1.5 block text-sm font-medium text-steel-800">
            {dict.filters.location}
          </label>
          <Select id="branch" name="branch" defaultValue={branchSlug ?? ""}>
            <option value="">{dict.common.all}</option>
            {branches.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.city}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="status" className="mb-1.5 block text-sm font-medium text-steel-800">
            {dict.common.status}
          </label>
          <Select id="status" name="status" defaultValue={status ?? ""}>
            <option value="">{dict.common.all}</option>
            {UNIT_STATUSES.map((s) => (
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
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-steel-200 bg-steel-50">
                <th scope="col" className="px-4 py-2.5 text-start font-semibold text-steel-700">
                  {locale === "ar" ? "رمز الأصل" : "Asset code"}
                </th>
                <th scope="col" className="px-4 py-2.5 text-start font-semibold text-steel-700">
                  {dict.equipment.title}
                </th>
                <th scope="col" className="px-4 py-2.5 text-start font-semibold text-steel-700">
                  {dict.filters.location}
                </th>
                <th scope="col" className="px-4 py-2.5 text-start font-semibold text-steel-700">
                  {dict.common.status}
                </th>
                <th scope="col" className="px-4 py-2.5 text-end font-semibold text-steel-700">
                  {locale === "ar" ? "ساعات التشغيل" : "Hours"}
                </th>
                <th scope="col" className="px-4 py-2.5 text-start font-semibold text-steel-700">
                  {locale === "ar" ? "الفحص القادم" : "Next inspection"}
                </th>
                <th scope="col" className="px-4 py-2.5 text-start font-semibold text-steel-700">
                  {locale === "ar" ? "على الإيجار" : "On hire"}
                </th>
              </tr>
            </thead>
            <tbody>
              {units.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-steel-500">
                    {dict.common.noResults}
                  </td>
                </tr>
              ) : (
                units.map((u) => {
                  const inspectionSoon =
                    u.nextInspectionDueAt !== null && u.nextInspectionDueAt.getTime() < soon;
                  return (
                    <tr key={u.id} className="border-b border-steel-100 last:border-0">
                      <td className="px-4 py-2.5 font-medium text-steel-900 numeric-latin">
                        {u.assetCode}
                        {u.serialNumber && (
                          <span className="block text-xs font-normal text-steel-500">
                            {u.serialNumber}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-steel-700">
                        {u.className}
                        {u.yearOfManufacture && (
                          <span className="block text-xs text-steel-500 numeric-latin">
                            {u.yearOfManufacture}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-steel-700">{u.branchCity}</td>
                      <td className="px-4 py-2.5">
                        <Badge
                          tone={
                            u.status === "available"
                              ? "available"
                              : u.status === "maintenance" || u.status === "inspection"
                                ? "warning"
                                : u.status === "out_of_service"
                                  ? "danger"
                                  : "info"
                          }
                        >
                          {u.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-end text-steel-700 numeric-latin">
                        {formatNumber(u.engineHours, locale)}
                      </td>
                      <td className="px-4 py-2.5 numeric-latin">
                        {u.nextInspectionDueAt ? (
                          <span
                            className={
                              inspectionSoon
                                ? "font-medium text-[--color-warning]"
                                : "text-steel-700"
                            }
                          >
                            {formatDate(u.nextInspectionDueAt, locale)}
                          </span>
                        ) : (
                          <span className="text-steel-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-steel-700 numeric-latin">
                        {u.currentBookingReference ?? "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </ScrollX>
      </Card>
    </>
  );
}
