import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Alert, Badge, Card, CardBody, Container, ScrollX } from "@/components/ui";
import { CancelBooking } from "@/components/booking/cancel-booking";
import { getActor } from "@/lib/auth/session";
import { getEmailProvider } from "@/lib/notifications";
import { getBookingForActor } from "@/lib/booking/repository";
import { getDictionary } from "@/lib/i18n";
import { formatDate, formatNumber, isLocale, localePath, type Locale } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";
import { getBusinessSettings, refundPercentForNotice } from "@/lib/settings";

/**
 * Mirrors `CANCELLABLE_STATUSES` in the cancel action. The server decides; this
 * only controls whether the control is offered, so a stale copy here can hide
 * the button but can never authorise a cancellation the action would refuse.
 */
const CANCELLABLE: readonly string[] = ["pending_payment", "confirmed"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: getDictionary(locale).account.rentalDetails,
    // A booking page contains customer PII and must never be indexed.
    robots: { index: false, follow: false },
  };
}

const STATUS_TONE: Record<string, "neutral" | "available" | "warning" | "danger" | "info"> = {
  draft: "neutral",
  pending_payment: "warning",
  confirmed: "available",
  active: "info",
  completed: "neutral",
  cancelled: "danger",
  expired: "danger",
};

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ locale: string; reference: string }>;
}) {
  const { locale: rawLocale, reference } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDictionary(locale);

  const emailDelivers = getEmailProvider().delivers;

  const actor = await getActor();
  if (!actor) {
  // No customer accounts: an unidentified visitor proves ownership with the
  // reference and the email it was booked with. The reference is prefilled
  // because they already have it; the email is what actually gates access.
    redirect(localePath(locale, `/booking?ref=${encodeURIComponent(reference)}`));
  }

  /**
   * Scoped fetch: reference AND ownership resolve in the same query.
   *
   * A booking belonging to someone else returns null, and we render a 404
   * rather than a 403 — so guessing an `RNT-XXXXXX` reference cannot even
   * confirm that a booking exists.
   */
  const booking = await getBookingForActor(actor, reference, locale);
  if (!booking) notFound();

  const money = (value: bigint) => formatMoney(value, locale, booking.currency);

  // Cancellation entitlement, computed from the SAME settings the published
  // policy page and the rental agreement render from — a customer must never be
  // quoted one schedule and charged against another.
  const business = await getBusinessSettings();
  const hoursNotice = Math.max(0, (booking.startDate.getTime() - Date.now()) / (1000 * 60 * 60));
  const refundPercent = refundPercentForNotice(business.cancellationTiers, hoursNotice);
  const isConfirmed = booking.status === "confirmed" || booking.status === "active";
  const awaitingPayment = booking.status === "pending_payment";

  return (
    <Container className="py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        {isConfirmed && (
          <div className="mb-6 rounded-[--radius-card] border border-[--color-available]/25 bg-[--color-available-bg] p-5 text-center">
            <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-[--color-available] text-white">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M4 12.5l5 5L20 6.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-steel-950">{dict.booking.confirmTitle}</h1>
            <p className="mt-1 text-sm text-steel-700">{dict.booking.confirmSubtitle}</p>
            {/* Only claimed when the configured provider actually delivers.
                Telling a customer their confirmation has been emailed when it
                went to a server log is how someone waits for a message that is
                never coming, and stops watching for the reference on screen. */}
            {emailDelivers && (
              <p className="mt-1 text-sm text-steel-600">{dict.booking.confirmEmailed}</p>
            )}
          </div>
        )}

        {awaitingPayment && (
          <Alert tone="warning" className="mb-6" title={dict.account.paymentStatus}>
            {locale === "ar"
              ? "لم يكتمل الدفع بعد. المعدة محجوزة لك مؤقتاً — أكمل الدفع لتأكيد الحجز."
              : "Payment is not complete. The machine is held for you — complete payment to confirm."}
          </Alert>
        )}

        <Card>
          <CardBody>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-steel-500">
                  {dict.booking.bookingReference}
                </p>
                <p className="text-2xl font-bold tracking-tight text-steel-950 numeric-latin">
                  {booking.reference}
                </p>
              </div>
              <Badge tone={STATUS_TONE[booking.status] ?? "neutral"}>
                {booking.status.replace(/_/g, " ")}
              </Badge>
            </div>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-steel-500">
                  {dict.equipment.title}
                </dt>
                <dd className="mt-0.5 font-medium text-steel-900">
                  {booking.classSlug ? (
                    <Link
                      href={localePath(locale, `/equipment/item/${booking.classSlug}`)}
                      className="underline underline-offset-2"
                    >
                      {booking.className}
                    </Link>
                  ) : (
                    booking.className
                  )}
                </dd>
                {booking.assetCode && (
                  <dd className="text-sm text-steel-500 numeric-latin">{booking.assetCode}</dd>
                )}
              </div>

              <div>
                <dt className="text-xs uppercase tracking-wide text-steel-500">
                  {dict.booking.duration}
                </dt>
                <dd className="mt-0.5 font-medium text-steel-900">
                  {formatDate(booking.startDate, locale)} — {formatDate(booking.endDate, locale)}
                </dd>
                <dd className="text-sm text-steel-500 numeric-latin">
                  {formatNumber(booking.billableDays, locale)} {dict.common.days}
                </dd>
              </div>

              <div>
                <dt className="text-xs uppercase tracking-wide text-steel-500">
                  {dict.booking.siteDetails}
                </dt>
                <dd className="mt-0.5 text-sm text-steel-900">
                  {booking.siteAddressLine}
                  {booking.siteCity ? `, ${booking.siteCity}` : ""}
                </dd>
                {booking.siteContactName && (
                  <dd className="text-sm text-steel-500">
                    {booking.siteContactName}
                    {booking.siteContactPhone ? (
                      <span className="numeric-latin"> · {booking.siteContactPhone}</span>
                    ) : null}
                  </dd>
                )}
              </div>

              <div>
                <dt className="text-xs uppercase tracking-wide text-steel-500">
                  {dict.account.paymentStatus}
                </dt>
                <dd className="mt-0.5 font-medium text-steel-900">
                  {booking.paymentStatus ?? "—"}
                  {booking.paymentLast4 && (
                    <span className="text-steel-500 numeric-latin">
                      {" "}
                      · {booking.paymentMethod} ····{booking.paymentLast4}
                    </span>
                  )}
                </dd>
              </div>

              {(booking.poNumber || booking.costCentre || booking.projectCode) && (
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-steel-500">
                    {dict.booking.poNumber}
                  </dt>
                  <dd className="mt-0.5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-steel-900">
                    {booking.poNumber && (
                      <span>
                        PO: <span className="numeric-latin">{booking.poNumber}</span>
                      </span>
                    )}
                    {booking.costCentre && (
                      <span>
                        {dict.booking.costCentre}:{" "}
                        <span className="numeric-latin">{booking.costCentre}</span>
                      </span>
                    )}
                    {booking.projectCode && (
                      <span>
                        {dict.booking.projectCode}:{" "}
                        <span className="numeric-latin">{booking.projectCode}</span>
                      </span>
                    )}
                  </dd>
                </div>
              )}
            </dl>

            {booking.siteAccessNotes && (
              <div className="mt-4 rounded-[--radius-control] border border-steel-200 bg-steel-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-steel-500">
                  {dict.booking.siteAccessNotes}
                </p>
                <p className="mt-1 text-sm text-steel-700">{booking.siteAccessNotes}</p>
              </div>
            )}
          </CardBody>
        </Card>

        {/* --- Price breakdown, frozen at booking time -------------------- */}
        <Card className="mt-5">
          <CardBody>
            <h2 className="mb-4 text-base font-bold text-steel-950">{dict.booking.priceBreakdown}</h2>

            <ScrollX>
              <table className="w-full min-w-[20rem] text-sm">
                <tbody>
                  <tr className="border-b border-steel-200">
                    <th scope="row" className="py-2 text-start font-normal text-steel-600">
                      {dict.booking.equipmentRental}
                    </th>
                    <td className="py-2 text-end font-medium text-steel-900 numeric-latin">
                      {money(booking.rentalSubtotalHalalas)}
                    </td>
                  </tr>

                  {booking.addons.map((addon) => (
                    <tr key={addon.code} className="border-b border-steel-200">
                      <th scope="row" className="py-2 text-start font-normal text-steel-600">
                        {addon.label}
                      </th>
                      <td className="py-2 text-end font-medium text-steel-900 numeric-latin">
                        {money(addon.totalHalalas)}
                      </td>
                    </tr>
                  ))}

                  {booking.transportSubtotalHalalas > 0n && (
                    <tr className="border-b border-steel-200">
                      <th scope="row" className="py-2 text-start font-normal text-steel-600">
                        {dict.booking.delivery}
                      </th>
                      <td className="py-2 text-end font-medium text-steel-900 numeric-latin">
                        {money(booking.transportSubtotalHalalas)}
                      </td>
                    </tr>
                  )}

                  {booking.discountHalalas > 0n && (
                    <tr className="border-b border-steel-200">
                      <th scope="row" className="py-2 text-start font-normal text-steel-600">
                        {locale === "ar" ? "خصم" : "Discount"}
                      </th>
                      <td className="py-2 text-end font-medium text-[--color-available] numeric-latin">
                        −{money(booking.discountHalalas)}
                      </td>
                    </tr>
                  )}

                  <tr className="border-b border-steel-200">
                    <th scope="row" className="py-2 text-start font-medium text-steel-800">
                      {dict.booking.subtotal}
                    </th>
                    <td className="py-2 text-end font-semibold text-steel-950 numeric-latin">
                      {money(booking.taxableSubtotalHalalas)}
                    </td>
                  </tr>

                  <tr className="border-b border-steel-200">
                    <th scope="row" className="py-2 text-start font-normal text-steel-600">
                      {dict.booking.vat.replace(
                        "{rate}",
                        formatNumber(booking.vatRatePpm / 10000, locale),
                      )}
                    </th>
                    <td className="py-2 text-end font-medium text-steel-900 numeric-latin">
                      {money(booking.vatHalalas)}
                    </td>
                  </tr>

                  {/* Charged amount first and alone; the deposit is not part
                      of it. This figure must equal the tax invoice total. */}
                  <tr>
                    <th scope="row" className="pt-3 text-start text-base font-bold text-steel-950">
                      {dict.booking.chargedNow}
                    </th>
                    <td className="pt-3 text-end text-lg font-bold text-steel-950 numeric-latin">
                      {money(booking.taxableSubtotalHalalas + booking.vatHalalas)}
                    </td>
                  </tr>

                  {booking.depositHalalas > 0n && (
                    <>
                      <tr className="border-t border-dashed border-steel-300">
                        <th scope="row" className="py-2 text-start font-normal text-steel-600">
                          {dict.booking.depositLine}
                          <span className="block text-xs text-steel-500">
                            {dict.booking.depositTiming}
                          </span>
                        </th>
                        <td className="py-2 text-end font-medium text-steel-900 numeric-latin">
                          {money(booking.depositHalalas)}
                        </td>
                      </tr>
                      <tr>
                        <th scope="row" className="py-1 text-start font-normal text-steel-600">
                          {dict.booking.totalCommitment}
                        </th>
                        <td className="py-1 text-end font-medium text-steel-900 numeric-latin">
                          {money(booking.totalHalalas)}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </ScrollX>
          </CardBody>
        </Card>

        {/* --- Documents --- */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link
            href={localePath(locale, `/booking/${booking.reference}/agreement`)}
            className="flex min-h-[3rem] items-center justify-center rounded-[--radius-control] border border-steel-300 bg-white px-4 text-sm font-semibold text-steel-800 hover:bg-steel-100"
          >
            {dict.booking.downloadAgreement}
          </Link>
          <Link
            href={localePath(locale, `/booking/${booking.reference}/invoice`)}
            className="flex min-h-[3rem] items-center justify-center rounded-[--radius-control] border border-steel-300 bg-white px-4 text-sm font-semibold text-steel-800 hover:bg-steel-100"
          >
            {dict.booking.downloadInvoice}
          </Link>
        </div>

        {/* Cancellation. Shown only while it is actually possible, so the page
            never offers an action that will be refused. The refund figure is
            computed here from the same tiers the policy page renders, and shown
            BEFORE the customer commits. */}
        {CANCELLABLE.includes(booking.status) && (
          <div className="mt-6">
            <CancelBooking
              reference={booking.reference}
              locale={locale}
              dict={dict}
              hoursNotice={hoursNotice}
              refundPercent={refundPercent}
              refundDueHalalas={(
                ((booking.taxableSubtotalHalalas + booking.vatHalalas) * BigInt(refundPercent)) /
                100n
              ).toString()}
              currency={booking.currency}
            />
          </div>
        )}

        {booking.termsAcceptedAt && (
          <p className="mt-4 text-center text-xs text-steel-500">
            {locale === "ar" ? "تم قبول الشروط في" : "Terms accepted"}{" "}
            {formatDate(booking.termsAcceptedAt, locale, {
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            (v<span className="numeric-latin">{booking.termsVersion}</span>)
          </p>
        )}

        {/* A guest has no account to return to — their session covers this one
            booking. Linking "My rentals" at them would land back on this page. */}
        {!actor.scopedBookingId && (
          <p className="mt-6 text-center text-sm">
            <Link href={localePath(locale, "/account")} className="text-steel-700 underline">
              {dict.account.title}
            </Link>
          </p>
        )}
      </div>
    </Container>
  );
}
