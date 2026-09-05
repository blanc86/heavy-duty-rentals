import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";
import { getBookingForActor } from "@/lib/booking/repository";
import { ensureInvoiceForBooking, getInvoiceView } from "@/lib/invoicing/service";
import { getDictionary } from "@/lib/i18n";
import { formatDate, formatNumber, isLocale, localePath, type Locale } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: getDictionary(locale).booking.downloadInvoice,
    robots: { index: false, follow: false },
  };
}

/**
 * VAT invoice, print-optimised.
 *
 * Rendered as HTML rather than a generated PDF, deliberately: Arabic text
 * shaping and bidirectional layout in a JS PDF library is a well-known source
 * of broken output, and a browser already does both correctly. The customer
 * prints to PDF and gets typographically correct Arabic.
 *
 * The trade-off is noted in docs/FINAL_REVIEW.md — server-side PDF generation
 * is the right answer once a ZATCA integration requires a PDF/A-3 with embedded
 * XML anyway.
 */
export default async function InvoicePage({
  params,
}: {
  params: Promise<{ locale: string; reference: string }>;
}) {
  const { locale: rawLocale, reference } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDictionary(locale);

  const actor = await getActor();
  if (!actor) {
    redirect(
      localePath(locale, `/login?next=${encodeURIComponent(`/${locale}/booking/${reference}/invoice`)}`),
    );
  }

  // Scoped: another customer's invoice is a 404, not a 403.
  const booking = await getBookingForActor(actor, reference, locale);
  if (!booking) notFound();

  await ensureInvoiceForBooking(booking.id);
  const invoice = await getInvoiceView(booking.id);

  if (!invoice) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-steel-700">
          {locale === "ar"
            ? "تصدر الفاتورة بعد تأكيد الحجز واكتمال الدفع."
            : "The invoice is issued once the booking is confirmed and payment has completed."}
        </p>
      </div>
    );
  }

  const money = (value: bigint) => formatMoney(value, locale, invoice.currency);

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-3xl px-6 py-10 print:px-0 print:py-0">
        {/* Not-cleared notice. Shown until a real ZATCA integration clears the
            invoice — we do not let a demo invoice masquerade as a tax document. */}
        {!invoice.isZatcaCleared && (
          <div className="mb-6 rounded border border-[--color-warning]/40 bg-[--color-warning-bg] p-3 text-xs text-steel-800">
            <strong>
              {locale === "ar" ? "غير مُصدَّقة من هيئة الزكاة والضريبة والجمارك" : "Not ZATCA-cleared"}
            </strong>{" "}
            —{" "}
            {locale === "ar"
              ? "هذه الفاتورة صحيحة هيكلياً ولكن لم تُرسل إلى منصة فاتورة. لا تُستخدم كمستند ضريبي حتى يتم تفعيل التكامل."
              : "This invoice is structurally correct but has not been submitted to the Fatoora platform. Do not use it as a tax document until the integration is enabled."}
          </div>
        )}

        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-steel-300 pb-6">
          <div>
            <h1 className="text-xl font-bold text-steel-950">
              {locale === "ar" ? "فاتورة ضريبية" : "Tax Invoice"}
            </h1>
            <p className="mt-1 text-sm text-steel-600">
              {locale === "ar" ? "رقم الفاتورة" : "Invoice number"}:{" "}
              <span className="font-medium text-steel-900 numeric-latin">{invoice.invoiceNumber}</span>
            </p>
            {invoice.issuedAt && (
              <p className="text-sm text-steel-600">
                {dict.common.date}:{" "}
                <span className="numeric-latin">{formatDate(invoice.issuedAt, locale)}</span>
              </p>
            )}
            <p className="text-sm text-steel-600">
              {dict.booking.bookingReference}:{" "}
              <span className="numeric-latin">{booking.reference}</span>
            </p>
          </div>

          <div className="text-sm text-steel-700 sm:text-end">
            <p className="font-bold text-steel-950">{invoice.sellerName}</p>
            {invoice.sellerAddress && <p>{invoice.sellerAddress}</p>}
            {invoice.sellerVatNumber && (
              <p>
                {dict.footer.vatNumber}:{" "}
                <span className="numeric-latin">{invoice.sellerVatNumber}</span>
              </p>
            )}
            {invoice.sellerCrNumber && (
              <p>
                {dict.footer.crNumber}:{" "}
                <span className="numeric-latin">{invoice.sellerCrNumber}</span>
              </p>
            )}
          </div>
        </header>

        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-steel-500">
            {locale === "ar" ? "فاتورة إلى" : "Bill to"}
          </h2>
          <p className="mt-1 font-medium text-steel-950">{invoice.buyerName}</p>
          {invoice.buyerAddress && <p className="text-sm text-steel-700">{invoice.buyerAddress}</p>}
          {invoice.buyerVatNumber && (
            <p className="text-sm text-steel-700">
              {dict.footer.vatNumber}:{" "}
              <span className="numeric-latin">{invoice.buyerVatNumber}</span>
            </p>
          )}
          {booking.poNumber && (
            <p className="text-sm text-steel-700">
              {dict.booking.poNumber}: <span className="numeric-latin">{booking.poNumber}</span>
            </p>
          )}
        </section>

        {/* The line-item table does not fit a 375px phone, and this page is
            read on one as often as it is printed. Scrolling it inside its own
            box keeps the invoice legible without the whole document sliding
            sideways. `print:overflow-visible` so a printer still gets the
            complete table rather than a clipped one. */}
        <div className="mt-8 overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[30rem] text-sm print:min-w-0">
          <thead>
            <tr className="border-y border-steel-300">
              <th scope="col" className="py-2 text-start font-semibold text-steel-700">
                {locale === "ar" ? "الوصف" : "Description"}
              </th>
              <th scope="col" className="py-2 text-end font-semibold text-steel-700">
                {locale === "ar" ? "المبلغ" : "Amount"}
              </th>
              <th scope="col" className="py-2 text-end font-semibold text-steel-700">
                {locale === "ar" ? "الضريبة" : "VAT"}
              </th>
              <th scope="col" className="py-2 text-end font-semibold text-steel-700">
                {dict.common.total}
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, index) => (
              <tr key={index} className="border-b border-steel-200">
                <td className="py-2.5 text-steel-800">
                  {locale === "ar" ? line.descriptionAr : line.descriptionEn}
                </td>
                <td className="py-2.5 text-end text-steel-900 numeric-latin">
                  {money(line.lineSubtotalHalalas)}
                </td>
                <td className="py-2.5 text-end text-steel-900 numeric-latin">
                  {money(line.vatHalalas)}
                </td>
                <td className="py-2.5 text-end font-medium text-steel-950 numeric-latin">
                  {money(line.lineTotalHalalas)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={3} className="py-2 text-end font-normal text-steel-600">
                {dict.booking.subtotal}
              </th>
              <td className="py-2 text-end font-medium text-steel-950 numeric-latin">
                {money(invoice.subtotalHalalas)}
              </td>
            </tr>
            <tr>
              <th scope="row" colSpan={3} className="py-2 text-end font-normal text-steel-600">
                {dict.booking.vat.replace("{rate}", formatNumber(invoice.vatRatePpm / 10000, locale))}
              </th>
              <td className="py-2 text-end font-medium text-steel-950 numeric-latin">
                {money(invoice.vatHalalas)}
              </td>
            </tr>
            <tr className="border-t-2 border-steel-400">
              <th scope="row" colSpan={3} className="pt-3 text-end font-bold text-steel-950">
                {dict.common.total}
              </th>
              <td className="pt-3 text-end text-lg font-bold text-steel-950 numeric-latin">
                {money(invoice.totalHalalas)}
              </td>
            </tr>
          </tfoot>
          </table>
        </div>

        {/* The deposit is NOT on the invoice: it is refundable, is not revenue,
            and carries no VAT. Including it would overstate taxable turnover. */}
        {booking.depositHalalas > 0n && (
          <p className="mt-4 text-xs text-steel-500">
            {locale === "ar"
              ? `يُحتجز تأمين قابل للاسترداد بقيمة ${money(booking.depositHalalas)} بشكل منفصل ولا يخضع لضريبة القيمة المضافة.`
              : `A refundable deposit of ${money(booking.depositHalalas)} is held separately and is not subject to VAT.`}
          </p>
        )}

        <p className="mt-10 border-t border-steel-200 pt-4 text-center text-xs text-steel-500 print:hidden">
          {locale === "ar"
            ? "استخدم طباعة المتصفح لحفظ الفاتورة كملف PDF."
            : "Use your browser's print function to save this invoice as a PDF."}
        </p>
      </div>
    </div>
  );
}
