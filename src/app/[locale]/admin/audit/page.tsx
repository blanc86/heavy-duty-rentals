import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert, Badge, Card, ScrollX } from "@/components/ui";
import { listAuditEntries } from "@/lib/admin/repository";
import { getDictionary } from "@/lib/i18n";
import { formatDate, isLocale, type Locale } from "@/lib/i18n/config";
import { verifyAuditChain } from "@/lib/server/audit";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Audit log viewer, with live chain verification.
 *
 * The log is hash-chained: each entry hashes the previous entry's hash plus its
 * own canonical content. Verifying on load means a tampered or deleted row is
 * surfaced here rather than discovered during an incident.
 */
export default async function AdminAuditPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDictionary(locale);

  const [entries, chain] = await Promise.all([listAuditEntries(150), verifyAuditChain(5000)]);

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-steel-950">
        {dict.admin.auditLog}
      </h1>
      <p className="mb-5 text-sm text-steel-600">
        {locale === "ar"
          ? "سجل غير قابل للتعديل ومرتبط بسلسلة تجزئة. أي تعديل أو حذف لسجل تاريخي يكسر السلسلة ويظهر هنا."
          : "Append-only and hash-chained. Altering or deleting a historical entry breaks the chain and shows up here."}
      </p>

      {chain.ok ? (
        <Alert tone="available" className="mb-5">
          {locale === "ar"
            ? `تم التحقق من سلامة السلسلة عبر ${chain.checked} سجل.`
            : `Chain integrity verified across ${chain.checked} entries.`}
        </Alert>
      ) : (
        <Alert
          tone="danger"
          className="mb-5"
          title={locale === "ar" ? "فشل التحقق من السلسلة" : "Chain verification FAILED"}
        >
          {locale === "ar"
            ? `انكسرت السلسلة عند السجل ${chain.brokenAtId}. يشير هذا إلى تعديل في سجل التدقيق ويجب التحقيق فيه فوراً.`
            : `The chain breaks at entry ${chain.brokenAtId}. This indicates the audit log has been modified and must be investigated immediately.`}
        </Alert>
      )}

      <Card>
        <ScrollX>
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-steel-200 bg-steel-50">
                <th scope="col" className="px-4 py-2.5 text-start font-semibold text-steel-700">
                  {dict.common.date}
                </th>
                <th scope="col" className="px-4 py-2.5 text-start font-semibold text-steel-700">
                  {locale === "ar" ? "الإجراء" : "Action"}
                </th>
                <th scope="col" className="px-4 py-2.5 text-start font-semibold text-steel-700">
                  {locale === "ar" ? "المُنفِّذ" : "Actor"}
                </th>
                <th scope="col" className="px-4 py-2.5 text-start font-semibold text-steel-700">
                  {locale === "ar" ? "المورد" : "Resource"}
                </th>
                <th scope="col" className="px-4 py-2.5 text-start font-semibold text-steel-700">
                  {locale === "ar" ? "النتيجة" : "Outcome"}
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-steel-500">
                    {dict.common.noResults}
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-steel-100 last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 text-steel-600 numeric-latin">
                      {formatDate(new Date(entry.occurred_at), locale, {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-steel-900">{entry.action}</td>
                    <td className="px-4 py-2.5 text-steel-700">
                      {entry.actor_name ?? entry.actor_type}
                      {entry.actor_ip && (
                        <span className="block text-xs text-steel-500 numeric-latin">
                          {entry.actor_ip}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-steel-600">
                      {entry.resource_type ?? "—"}
                      {entry.resource_id && (
                        <span className="block text-xs text-steel-400 numeric-latin">
                          {entry.resource_id.slice(0, 8)}…
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        tone={
                          entry.outcome === "success"
                            ? "available"
                            : entry.outcome === "denied"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {entry.outcome}
                      </Badge>
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
