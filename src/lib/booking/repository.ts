import { and, desc, eq, inArray, or, sql as raw } from "drizzle-orm";
import type { AuthenticatedActor } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { bookingAddons, bookingItems, bookings } from "@/lib/db/schema/booking";
import { equipmentClasses } from "@/lib/db/schema/catalog";
import { payments } from "@/lib/db/schema/finance";
import { equipmentUnits } from "@/lib/db/schema/inventory";
import type { Locale } from "@/lib/i18n/config";
import type { Halalas } from "@/lib/money";
import { accessibleCompanyIds } from "@/lib/rbac";

/**
 * Booking reads, SCOPED.
 *
 * Every function here takes the authenticated actor and applies ownership as a
 * mandatory predicate in the same query that fetches the row. There is no
 * exported "fetch by id" that skips scoping, so a caller cannot forget — the
 * unsafe call does not exist to be written.
 *
 * A booking the actor cannot see returns null, and callers render a 404 rather
 * than a 403, so existence is not disclosed.
 */

export interface BookingSummary {
  id: string;
  reference: string;
  status: string;
  startDate: Date;
  endDate: Date;
  billableDays: number;
  totalHalalas: Halalas;
  depositHalalas: Halalas;
  currency: string;
  className: string;
  classSlug: string;
  assetCode: string | null;
  siteCity: string | null;
  createdAt: Date;
  companyId: string | null;
}

/**
 * The scoping predicate: the actor's own bookings, plus any belonging to a
 * company they are an active member of. Built from the SESSION actor, never
 * from a request parameter.
 */
function scopeFor(actor: AuthenticatedActor) {
  // A booking-scoped session sees ONE booking and nothing else — not even the
  // other bookings made by the same email address. A guest proved they hold a
  // specific reference; that is what it unlocks.
  //
  // Checked FIRST and returned immediately, so no later branch can widen it.
  if (actor.scopedBookingId) return eq(bookings.id, actor.scopedBookingId);

  const companyIds = accessibleCompanyIds(actor);
  return companyIds.length > 0
    ? or(eq(bookings.customerUserId, actor.userId), inArray(bookings.companyId, companyIds))
    : eq(bookings.customerUserId, actor.userId);
}

export async function listBookingsForActor(
  actor: AuthenticatedActor,
  locale: Locale,
  filter?: { statuses?: string[] },
): Promise<BookingSummary[]> {
  const rows = await db
    .select({
      id: bookings.id,
      reference: bookings.reference,
      status: bookings.status,
      startDate: bookings.startDate,
      endDate: bookings.endDate,
      billableDays: bookings.billableDays,
      totalHalalas: bookings.totalHalalas,
      depositHalalas: bookings.depositHalalas,
      currency: bookings.currency,
      className: locale === "ar" ? equipmentClasses.nameAr : equipmentClasses.nameEn,
      classSlug: equipmentClasses.slug,
      assetCode: equipmentUnits.assetCode,
      siteCity: bookings.siteCity,
      createdAt: bookings.createdAt,
      companyId: bookings.companyId,
    })
    .from(bookings)
    .leftJoin(bookingItems, eq(bookingItems.bookingId, bookings.id))
    .leftJoin(equipmentClasses, eq(equipmentClasses.id, bookingItems.classId))
    .leftJoin(equipmentUnits, eq(equipmentUnits.id, bookingItems.unitId))
    .where(
      filter?.statuses?.length
        ? and(scopeFor(actor), inArray(bookings.status, filter.statuses as never[]))
        : scopeFor(actor),
    )
    .orderBy(desc(bookings.createdAt))
    .limit(100);

  return rows.map((r) => ({
    ...r,
    className: r.className ?? "—",
    classSlug: r.classSlug ?? "",
  }));
}

export interface BookingDetail extends BookingSummary {
  rentalSubtotalHalalas: Halalas;
  addonsSubtotalHalalas: Halalas;
  transportSubtotalHalalas: Halalas;
  discountHalalas: Halalas;
  taxableSubtotalHalalas: Halalas;
  vatRatePpm: number;
  vatHalalas: Halalas;
  siteAddressLine: string | null;
  siteContactName: string | null;
  siteContactPhone: string | null;
  siteAccessNotes: string | null;
  deliveryRequired: boolean;
  poNumber: string | null;
  costCentre: string | null;
  projectCode: string | null;
  termsVersion: string | null;
  termsAcceptedAt: Date | null;
  addons: { code: string; label: string; totalHalalas: Halalas }[];
  paymentStatus: string | null;
  paymentMethod: string | null;
  paymentLast4: string | null;
}

/**
 * Fetch one booking BY REFERENCE, scoped to the actor.
 *
 * The reference is a customer-facing code, so scoping matters here more than
 * anywhere: without it, guessing `RNT-XXXXXX` would be an IDOR.
 */
export async function getBookingForActor(
  actor: AuthenticatedActor,
  reference: string,
  locale: Locale,
): Promise<BookingDetail | null> {
  const [row] = await db
    .select({
      id: bookings.id,
      reference: bookings.reference,
      status: bookings.status,
      startDate: bookings.startDate,
      endDate: bookings.endDate,
      billableDays: bookings.billableDays,
      totalHalalas: bookings.totalHalalas,
      depositHalalas: bookings.depositHalalas,
      currency: bookings.currency,
      rentalSubtotalHalalas: bookings.rentalSubtotalHalalas,
      addonsSubtotalHalalas: bookings.addonsSubtotalHalalas,
      transportSubtotalHalalas: bookings.transportSubtotalHalalas,
      discountHalalas: bookings.discountHalalas,
      taxableSubtotalHalalas: bookings.taxableSubtotalHalalas,
      vatRatePpm: bookings.vatRatePpm,
      vatHalalas: bookings.vatHalalas,
      siteCity: bookings.siteCity,
      siteAddressLine: bookings.siteAddressLine,
      siteContactName: bookings.siteContactName,
      siteContactPhone: bookings.siteContactPhone,
      siteAccessNotes: bookings.siteAccessNotes,
      deliveryRequired: bookings.deliveryRequired,
      poNumber: bookings.poNumber,
      costCentre: bookings.costCentre,
      projectCode: bookings.projectCode,
      termsVersion: bookings.termsVersion,
      termsAcceptedAt: bookings.termsAcceptedAt,
      createdAt: bookings.createdAt,
      companyId: bookings.companyId,
      className: locale === "ar" ? equipmentClasses.nameAr : equipmentClasses.nameEn,
      classSlug: equipmentClasses.slug,
      assetCode: equipmentUnits.assetCode,
    })
    .from(bookings)
    .leftJoin(bookingItems, eq(bookingItems.bookingId, bookings.id))
    .leftJoin(equipmentClasses, eq(equipmentClasses.id, bookingItems.classId))
    .leftJoin(equipmentUnits, eq(equipmentUnits.id, bookingItems.unitId))
    // Reference AND scope in the same predicate. Not fetch-then-check.
    .where(and(eq(bookings.reference, reference), scopeFor(actor)))
    .limit(1);

  if (!row) return null;

  const [addons, paymentRows] = await Promise.all([
    db
      .select({
        code: bookingAddons.code,
        labelEn: bookingAddons.labelEn,
        labelAr: bookingAddons.labelAr,
        totalHalalas: bookingAddons.lineTotalHalalas,
      })
      .from(bookingAddons)
      .where(eq(bookingAddons.bookingId, row.id)),
    db
      .select({
        status: payments.status,
        method: payments.method,
        last4: payments.last4,
        kind: payments.kind,
      })
      .from(payments)
      .where(and(eq(payments.bookingId, row.id), eq(payments.kind, "rental_charge")))
      .orderBy(desc(payments.createdAt))
      .limit(1),
  ]);

  const payment = paymentRows[0];

  return {
    ...row,
    className: row.className ?? "—",
    classSlug: row.classSlug ?? "",
    addons: addons.map((a) => ({
      code: a.code,
      label: locale === "ar" ? a.labelAr : a.labelEn,
      totalHalalas: a.totalHalalas,
    })),
    paymentStatus: payment?.status ?? null,
    paymentMethod: payment?.method ?? null,
    paymentLast4: payment?.last4 ?? null,
  };
}

/** Counts for the customer dashboard. */
export async function bookingCountsForActor(actor: AuthenticatedActor) {
  // Uses the same `scopeFor` predicate as every other read in this file.
  // A hand-written `= ANY(${array}::uuid[])` does NOT work here: drizzle
  // expands an interpolated JS array into one bind parameter per element, so
  // Postgres receives a bare uuid where it expects an array literal and fails
  // with 22P02. `inArray` builds the correct form.
  const rows = await db
    .select({ status: bookings.status, count: raw<number>`count(*)::int` })
    .from(bookings)
    .where(scopeFor(actor))
    .groupBy(bookings.status);

  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.status] = Number(row.count);
  return counts;
}
