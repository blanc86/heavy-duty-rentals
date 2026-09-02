import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge, ButtonLink, Card, CardBody, Container, EmptyState, ScrollX } from "@/components/ui";
import { getActor } from "@/lib/auth/session";
import { bookingCountsForActor, listBookingsForActor } from "@/lib/booking/repository";
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
  return { title: getDictionary(locale).account.title, robots: { index: false, follow: false } };
}

const STATUS_TONE: Record<string, "neutral" | "available" | "warning" | "danger" | "info"> = {
  pending_payment: "warning",
  confirmed: "available",
  active: "info",
  completed: "neutral",
  cancelled: "danger",
  expired: "danger",
  draft: "neutral",
};

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDictionary(locale);

  const actor = await getActor();
  if (!actor) redirect(localePath(locale, `/login?next=${encodeURIComponent(`/${locale}/account`)}`));

  // Both reads are scoped to the actor inside the repository — there is no
  // unscoped variant to call by mistake.
  const [bookings, counts] = await Promise.all([
    listBookingsForActor(actor, locale),
    bookingCountsForActor(actor),
  ]);

  const now = Date.now();
  const current = bookings.filter(
    (b) =>
      (b.status === "confirmed" || b.status === "active") &&
      b.startDate.getTime() <= now &&
      b.endDate.getTime() >= now,
  );
  const upcoming = bookings.filter(
    (b) => (b.status === "confirmed" || b.status === "pending_payment") && b.startDate.getTime() > now,
  );
  const past = bookings.filter(
    (b) => b.status === "completed" || b.status === "cancelled" || b.status === "expired",
  );

  const stats = [
    { label: dict.account.currentRentals, value: current.length },
    { label: dict.account.upcomingRentals, value: upcoming.length },
    { label: dict.admin.pendingPayments, value: counts.pending_payment ?? 0 },
    { label: dict.account.pastRentals, value: past.length },
  ];

  return (
    <Container className="py-8 sm:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-steel-950 sm:text-3xl">
            {dict.account.title}
          </h1>
          <p className="mt-1 text-sm text-steel-600">{actor.fullName}</p>
        </div>
        <ButtonLink href={localePath(locale, "/equipment")} size="md">
          {dict.account.browseEquipment}
        </ButtonLink>
      </div>

      <ul className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <li key={stat.label}>
            <Card>
              <CardBody className="py-4">
                <p className="text-2xl font-bold text-steel-950 numeric-latin">
                  {formatNumber(stat.value, locale)}
                </p>
                <p className="mt-0.5 text-xs text-steel-600">{stat.label}</p>
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>

      {bookings.length === 0 ? (
        <EmptyState
          title={dict.account.noRentals}
          description={
            locale === "ar"
              ? "ابحث عن المعدة المناسبة وتحقق من التوفر واحجز عبر الإنترنت."
              : "Find the right machine, check availability and book online."
          }
          action={
            <ButtonLink href={localePath(locale, "/equipment")}>
              {dict.account.browseEquipment}
            </ButtonLink>
          }
        />
      ) : (
        <section>
          <h2 className="mb-3 text-lg font-bold text-steel-950">{dict.account.rentals}</h2>
          <Card>
            <ScrollX>
              <table className="w-full min-w-[44rem] text-sm">
                <thead>
                  <tr className="border-b border-steel-200 bg-steel-50 text-start">
                    <th scope="col" className="px-4 py-3 text-start font-semibold text-steel-700">
                      {dict.booking.bookingReference}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start font-semibold text-steel-700">
                      {dict.equipment.title}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start font-semibold text-steel-700">
                      {dict.booking.duration}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start font-semibold text-steel-700">
                      {dict.common.status}
                    </th>
                    <th scope="col" className="px-4 py-3 text-end font-semibold text-steel-700">
                      {dict.common.total}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="border-b border-steel-100 last:border-0">
                      <td className="px-4 py-3">
                        <Link
                          href={localePath(locale, `/booking/${booking.reference}`)}
                          className="font-medium text-steel-900 underline underline-offset-2 numeric-latin"
                        >
                          {booking.reference}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-steel-700">
                        {booking.className}
                        {booking.assetCode && (
                          <span className="block text-xs text-steel-500 numeric-latin">
                            {booking.assetCode}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-steel-700">
                        <span className="whitespace-nowrap">
                          {formatDate(booking.startDate, locale)}
                        </span>
                        <span className="block text-xs text-steel-500 numeric-latin">
                          {formatNumber(booking.billableDays, locale)} {dict.common.days}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS_TONE[booking.status] ?? "neutral"}>
                          {booking.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-end font-medium text-steel-950 numeric-latin">
                        {formatMoney(booking.totalHalalas, locale, booking.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollX>
          </Card>
        </section>
      )}
    </Container>
  );
}
