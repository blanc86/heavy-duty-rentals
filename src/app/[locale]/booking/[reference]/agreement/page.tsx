import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";
import { getBookingForActor } from "@/lib/booking/repository";
import { getDictionary } from "@/lib/i18n";
import { formatDate, formatNumber, isLocale, localePath, type Locale } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";
import { getBusinessSettings, refundPercentForNotice } from "@/lib/settings";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: getDictionary(locale).booking.termsTitle,
    robots: { index: false, follow: false },
  };
}

/**
 * Rental agreement.
 *
 * Renders the exact terms the customer accepted, with the version and the
 * timestamp of acceptance recorded on the booking.
 *
 * IMPORTANT: we record ACCEPTANCE. We do not claim this constitutes a legally
 * binding electronic signature — that requires a compliant e-signature provider
 * the business must contract with. The `signatureProvider` /
 * `signatureReference` columns exist for that integration. Claiming legal
 * validity we have not established would be exactly the kind of unsupported
 * assertion the brief forbids.
 */
export default async function AgreementPage({
  params,
}: {
  params: Promise<{ locale: string; reference: string }>;
}) {
  const { locale: rawLocale, reference } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDictionary(locale);
  const isArabic = locale === "ar";

  const actor = await getActor();
  if (!actor) {
    redirect(
      localePath(
        locale,
        // See the booking detail page: guests return via reference + email.
        `/booking?ref=${encodeURIComponent(reference)}`,
      ),
    );
  }

  const booking = await getBookingForActor(actor, reference, locale);
  if (!booking) notFound();

  const business = await getBusinessSettings();
  const money = (value: bigint) => formatMoney(value, locale, booking.currency);

  const clauses = isArabic
    ? [
        {
          title: "١. المعدة ومدة الإيجار",
          body: `يوافق المؤجر على تأجير المعدة الموضحة أعلاه للمستأجر للفترة المحددة. تبدأ مدة الإيجار من تاريخ التسليم إلى الموقع وتنتهي عند استلام المعدة من الموقع، وليس عند توقف الاستخدام.`,
        },
        {
          title: "٢. الأسعار والدفع",
          body: `الأسعار الموضحة في تفاصيل الحجز نهائية وتشمل جميع البنود المذكورة. تُحتسب ضريبة القيمة المضافة بالنسبة السارية وقت إصدار الفاتورة. أي تمديد للمدة يُسعَّر ويُفوتر بشكل منفصل.`,
        },
        {
          title: "٣. التأمين",
          body: `مبلغ التأمين قابل للاسترداد ويُحتجز بشكل منفصل عن قيمة الإيجار ولا تُحتسب عليه ضريبة القيمة المضافة. يغطي الأضرار التي تتجاوز الاستهلاك الطبيعي والملحقات المفقودة ونقص الوقود. تُفصَّل أي خصومات بعد فحص الإرجاع.`,
        },
        {
          title: "٤. مسؤوليات المستأجر",
          body: `يتحمل المستأجر مسؤولية تجهيز الموقع وتقييم تحمل التربة وخطة الرفع وبيان الطريقة والتصاريح اللازمة. ويلتزم بتوفير مدخل آمن ومناسب للمعدة ومركبات النقل.`,
        },
        {
          title: "٥. السلامة",
          body: `يجب أن يؤكد مهندس رفع مؤهل مدى ملاءمة المعدة لأي عملية رفع محددة. تُقدَّم جداول الأحمال والمواصفات للاسترشاد فقط ولا تشكل تحديداً هندسياً للملاءمة. لا يجوز تشغيل المعدة إلا بواسطة أشخاص مؤهلين ومرخصين.`,
        },
        {
          title: "٦. الأضرار والفقد",
          body: `يتحمل المستأجر مسؤولية أي ضرر أو فقد للمعدة أثناء فترة الإيجار، باستثناء الاستهلاك الطبيعي والأعطال الميكانيكية غير الناتجة عن سوء الاستخدام.`,
        },
        {
          title: "٧. الإلغاء",
          body: `تُطبَّق سياسة الإلغاء المتدرجة الموضحة أدناه بناءً على مدة الإشعار المسبق قبل تاريخ بدء الإيجار.`,
        },
        {
          title: "٨. الإرجاع",
          body: `تُعاد المعدة بالحالة التي استُلمت بها، مع مستوى الوقود ذاته وجميع الملحقات. يُجرى فحص عند الإرجاع ويوثَّق بالصور، وتُفصَّل أي خصومات من التأمين.`,
        },
      ]
    : [
        {
          title: "1. Equipment and rental period",
          body: `The lessor agrees to rent the equipment identified above to the lessee for the period stated. The rental period runs from delivery to site until collection from site — not from when use begins or stops.`,
        },
        {
          title: "2. Pricing and payment",
          body: `The prices itemised in the booking details are final and cover exactly the items listed. VAT is calculated at the rate applicable when the invoice is issued. Any extension of the period is priced and invoiced separately.`,
        },
        {
          title: "3. Security deposit",
          body: `The deposit is refundable, is held separately from the rental charge, and carries no VAT because it is not revenue. It covers damage beyond fair wear and tear, missing accessories and fuel shortfall. Any deduction is itemised after the return inspection.`,
        },
        {
          title: "4. Lessee responsibilities",
          body: `The lessee is responsible for site preparation, ground bearing assessment, the lift plan and method statement, and all necessary permits. The lessee must provide safe and adequate access for the equipment and its transport vehicles.`,
        },
        {
          title: "5. Safety",
          body: `Equipment suitability for any specific lift must be confirmed by a qualified lifting engineer. Load charts and specifications are provided for reference only and do not constitute an engineering determination of suitability. The equipment may be operated only by competent, licensed personnel.`,
        },
        {
          title: "6. Damage and loss",
          body: `The lessee is responsible for damage to or loss of the equipment during the rental period, excluding fair wear and tear and mechanical failure not caused by misuse.`,
        },
        {
          title: "7. Cancellation",
          body: `The tiered cancellation policy set out below applies, based on the notice given before the rental start date.`,
        },
        {
          title: "8. Return",
          body: `The equipment is returned in the condition in which it was received, with the same fuel level and all accessories. A return inspection is carried out and documented with photographs, and any deduction from the deposit is itemised.`,
        },
      ];

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-3xl px-6 py-10 print:px-0">
        <header className="border-b border-steel-300 pb-6">
          <h1 className="text-xl font-bold text-steel-950">
            {isArabic ? "عقد تأجير معدات" : "Equipment Rental Agreement"}
          </h1>
          <p className="mt-1 text-sm text-steel-600">
            {dict.booking.bookingReference}:{" "}
            <span className="font-medium text-steel-900 numeric-latin">{booking.reference}</span>
            {booking.termsVersion && (
              <>
                {" · "}
                {isArabic ? "إصدار الشروط" : "Terms version"}{" "}
                <span className="numeric-latin">{booking.termsVersion}</span>
              </>
            )}
          </p>
        </header>

        <section className="mt-6 grid gap-6 text-sm sm:grid-cols-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-steel-500">
              {isArabic ? "المؤجر" : "Lessor"}
            </h2>
            <p className="mt-1 font-medium text-steel-950">
              {isArabic ? business.companyNameAr : business.companyNameEn}
            </p>
            <p className="text-steel-700">{isArabic ? business.addressAr : business.addressEn}</p>
            <p className="text-steel-700">
              {dict.footer.crNumber}: <span className="numeric-latin">{business.crNumber}</span>
            </p>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-steel-500">
              {isArabic ? "المستأجر" : "Lessee"}
            </h2>
            <p className="mt-1 font-medium text-steel-950">{actor.fullName}</p>
            <p className="text-steel-700">{actor.email}</p>
          </div>
        </section>

        <section className="mt-6 rounded border border-steel-200 bg-steel-50 p-4 text-sm">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-steel-500">
                {dict.equipment.title}
              </dt>
              <dd className="font-medium text-steel-900">
                {booking.className}
                {booking.assetCode && (
                  <span className="text-steel-500 numeric-latin"> · {booking.assetCode}</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-steel-500">
                {dict.booking.duration}
              </dt>
              <dd className="font-medium text-steel-900">
                {formatDate(booking.startDate, locale)} — {formatDate(booking.endDate, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-steel-500">
                {dict.booking.siteDetails}
              </dt>
              <dd className="text-steel-900">
                {booking.siteAddressLine}
                {booking.siteCity ? `, ${booking.siteCity}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-steel-500">
                {dict.booking.chargedNow}
              </dt>
              <dd className="font-medium text-steel-900 numeric-latin">
                {money(booking.taxableSubtotalHalalas + booking.vatHalalas)}
                {booking.depositHalalas > 0n && (
                  <span className="block text-xs font-normal text-steel-500">
                    {dict.booking.depositLine}: {money(booking.depositHalalas)} —{" "}
                    {dict.booking.depositTiming}
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-8 space-y-5 text-sm leading-relaxed text-steel-800">
          {clauses.map((clause) => (
            <div key={clause.title}>
              <h2 className="font-semibold text-steel-950">{clause.title}</h2>
              <p className="mt-1">{clause.body}</p>
            </div>
          ))}
        </section>

        {/* Cancellation tiers come from settings, so the business can change
            them without a deploy — and the agreement always shows the tiers
            that were in force. */}
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-steel-950">
            {dict.footer.cancellation}
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-steel-300">
                <th scope="col" className="py-2 text-start font-semibold text-steel-700">
                  {isArabic ? "الإشعار المسبق" : "Notice given"}
                </th>
                <th scope="col" className="py-2 text-end font-semibold text-steel-700">
                  {isArabic ? "نسبة الاسترداد" : "Refund"}
                </th>
              </tr>
            </thead>
            <tbody>
              {[...business.cancellationTiers]
                .sort((a, b) => b.minHoursNotice - a.minHoursNotice)
                .map((tier) => (
                  <tr key={tier.minHoursNotice} className="border-b border-steel-200">
                    <td className="py-2 text-steel-800">
                      {tier.minHoursNotice === 0
                        ? isArabic
                          ? "أقل من 24 ساعة"
                          : "Less than 24 hours"
                        : isArabic
                          ? `${formatNumber(tier.minHoursNotice / 24, locale)} يوم أو أكثر`
                          : `${formatNumber(tier.minHoursNotice / 24, locale)} days or more`}
                    </td>
                    <td className="py-2 text-end font-medium text-steel-950 numeric-latin">
                      {formatNumber(tier.refundPercent, locale)}%
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-steel-500">
            {isArabic
              ? `بناءً على تاريخ البدء، الاسترداد الحالي إذا ألغيت الآن: ${formatNumber(
                  refundPercentForNotice(
                    business.cancellationTiers,
                    Math.max(0, (booking.startDate.getTime() - Date.now()) / 3_600_000),
                  ),
                  locale,
                )}%`
              : `Based on the start date, cancelling now would refund ${formatNumber(
                  refundPercentForNotice(
                    business.cancellationTiers,
                    Math.max(0, (booking.startDate.getTime() - Date.now()) / 3_600_000),
                  ),
                  locale,
                )}%.`}
          </p>
        </section>

        {/* Acceptance record — and an explicit statement of what it is not. */}
        <section className="mt-8 rounded border border-steel-300 p-4 text-sm">
          <h2 className="font-semibold text-steel-950">
            {isArabic ? "سجل القبول" : "Record of acceptance"}
          </h2>
          {booking.termsAcceptedAt ? (
            <p className="mt-1 text-steel-700">
              {isArabic ? "قُبلت هذه الشروط بواسطة" : "These terms were accepted by"}{" "}
              <strong>{actor.fullName}</strong>{" "}
              {isArabic ? "بتاريخ" : "on"}{" "}
              <span className="numeric-latin">
                {formatDate(booking.termsAcceptedAt, locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              .
            </p>
          ) : (
            <p className="mt-1 text-steel-700">
              {isArabic ? "لم تُقبل الشروط بعد." : "These terms have not yet been accepted."}
            </p>
          )}
          <p className="mt-2 text-xs text-steel-500">
            {isArabic
              ? "هذا سجل إلكتروني للقبول. لا يُقدَّم على أنه توقيع إلكتروني معتمد؛ يتطلب ذلك مزود توقيع إلكتروني متوافق."
              : "This is an electronic record of acceptance. It is not presented as a certified electronic signature, which requires a compliant e-signature provider."}
          </p>
        </section>

        <p className="mt-10 border-t border-steel-200 pt-4 text-center text-xs text-steel-500 print:hidden">
          {isArabic
            ? "استخدم طباعة المتصفح لحفظ العقد كملف PDF."
            : "Use your browser's print function to save this agreement as a PDF."}
        </p>
      </div>
    </div>
  );
}
