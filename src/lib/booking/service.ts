import { and, eq, sql as raw } from "drizzle-orm";
import { db, isExclusionViolation, isUniqueViolation } from "@/lib/db";
import { bookingAddons, bookingEvents, bookingItems, bookings } from "@/lib/db/schema/booking";
import { coupons } from "@/lib/db/schema/pricing";
import type { TstzRange } from "@/lib/db/schema/types";
import { env } from "@/lib/env";
import { generateReference, uuidv7 } from "@/lib/ids";
import type { Halalas } from "@/lib/money";
import { expireStaleHolds, occupiedPeriod, UnitNoLongerAvailableError } from "@/lib/availability";
import { quote, toPricingSnapshot, type QuoteRequest } from "@/lib/pricing/repository";
import { writeAudit } from "@/lib/server/audit";

export class PriceMismatchError extends Error {
  readonly code = "price_mismatch";
  constructor(
    readonly expected: Halalas,
    readonly received: Halalas,
  ) {
    super("The price changed while you were booking. Please review the updated total.");
    this.name = "PriceMismatchError";
  }
}

export class BookingNotAllowedError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "BookingNotAllowedError";
  }
}

export interface CreateBookingInput extends QuoteRequest {
  unitId: string;
  customerUserId: string;
  companyId: string | null;
  projectSiteId: string | null;
  locale: "en" | "ar";

  siteCity: string;
  siteAddressLine: string;
  siteContactName: string;
  siteContactPhone: string;
  siteAccessNotes?: string | undefined;
  deliveryWindowStart?: Date | undefined;
  deliveryWindowEnd?: Date | undefined;

  poNumber?: string | undefined;
  costCentre?: string | undefined;
  projectCode?: string | undefined;

  /**
   * What the browser BELIEVES the total is. Used only for comparison — never
   * written to the booking. See the price-recomputation step below.
   */
  clientTotalHalalas: Halalas;

  termsVersion: string;
  termsAcceptedIp: string | null;

  /** Retrying with the same key returns the original booking. */
  idempotencyKey: string;

  /** The checkout hold to promote, if one exists. */
  reservationId?: string | undefined;
}

export interface CreatedBooking {
  bookingId: string;
  reference: string;
  totalHalalas: Halalas;
  depositHalalas: Halalas;
  /** True when an existing booking was returned instead of a new one. */
  wasIdempotentReplay: boolean;
}

/**
 * CREATE A BOOKING.
 *
 * The whole thing is one database transaction, and the ordering is deliberate:
 *
 *   1. Idempotency check     — a retry must not book a second crane
 *   2. Lock the unit         — SELECT ... FOR UPDATE
 *   3. RECOMPUTE the price   — from database rates, ignoring the client
 *   4. Compare to the client's claimed total; abort on mismatch
 *   5. Insert the reservation — the exclusion constraint arbitrates the race
 *   6. Insert booking, items, add-ons, event
 *
 * Payment is deliberately NOT in this transaction. The booking is created
 * `pending_payment` and only becomes `confirmed` when a verified provider
 * webhook arrives. Holding a database transaction open across a network call
 * to a payment provider is how systems deadlock under load.
 */
export async function createBooking(input: CreateBookingInput): Promise<CreatedBooking> {
  // --- 1. Idempotency ------------------------------------------------------
  // Checked before the transaction so a double-clicked submit returns fast.
  // The UNIQUE index is the real guarantee; this is the fast path.
  const [existing] = await db
    .select({
      id: bookings.id,
      reference: bookings.reference,
      totalHalalas: bookings.totalHalalas,
      depositHalalas: bookings.depositHalalas,
    })
    .from(bookings)
    .where(eq(bookings.idempotencyKey, input.idempotencyKey))
    .limit(1);

  if (existing) {
    return {
      bookingId: existing.id,
      reference: existing.reference,
      totalHalalas: existing.totalHalalas,
      depositHalalas: existing.depositHalalas,
      wasIdempotentReplay: true,
    };
  }

  // --- 3. Recompute the price (server-side, from the database) -------------
  // Runs BEFORE the transaction: it only reads rate configuration, and keeping
  // it out of the transaction shortens the window the unit row is locked for.
  const { result, classInfo } = await quote(input);

  if (!classInfo.instantBookable) {
    throw new BookingNotAllowedError(
      "This equipment requires a quote before it can be booked.",
      "quote_required",
    );
  }

  // --- 4. Compare, do not adopt -------------------------------------------
  // The client's total is evidence of what the customer was SHOWN. If it
  // disagrees with the server's figure, either the rates changed mid-checkout
  // (legitimate — the customer must re-confirm) or someone edited the payload
  // (an attack). Both are handled by refusing, and both are audited so a
  // systematic attempt is visible rather than merely blocked.
  if (result.totalHalalas !== input.clientTotalHalalas) {
    await writeAudit({
      action: "booking.price_mismatch",
      actorUserId: input.customerUserId,
      actorType: "customer",
      actorIp: input.termsAcceptedIp,
      resourceType: "equipment_class",
      resourceId: input.classId,
      outcome: "denied",
      metadata: {
        expectedHalalas: result.totalHalalas.toString(),
        receivedHalalas: input.clientTotalHalalas.toString(),
        differenceHalalas: (result.totalHalalas - input.clientTotalHalalas).toString(),
      },
    });
    throw new PriceMismatchError(result.totalHalalas, input.clientTotalHalalas);
  }

  const period = occupiedPeriod(
    input.startDate,
    input.endDate,
    classInfo.mobilisationBufferDays,
    classInfo.demobilisationBufferDays,
  );

  const bookingId = uuidv7();
  const reference = generateReference("RNT");

  try {
    await db.transaction(async (tx) => {
      // --- 2. Lock the unit ------------------------------------------------
      // FOR UPDATE serialises concurrent attempts on the SAME unit, so the
      // status and blackout checks below cannot be invalidated between reading
      // and writing.
      const unitRows = await tx.execute<{ id: string; status: string; is_active: boolean }>(raw`
        SELECT id, status, is_active FROM equipment_unit WHERE id = ${input.unitId} FOR UPDATE
      `);
      const unit = unitRows[0];

      if (!unit || !unit.is_active) {
        throw new BookingNotAllowedError("That machine is not available.", "unit_not_found");
      }
      if (unit.status === "maintenance" || unit.status === "out_of_service") {
        throw new UnitNoLongerAvailableError();
      }

      // A blackout can be created between the availability check and here.
      const blackoutRows = await tx.execute<{ exists: boolean }>(raw`
        SELECT EXISTS (
          SELECT 1 FROM unit_blackout
          WHERE unit_id = ${input.unitId}
            AND period && ${`[${period.start.toISOString()},${period.end.toISOString()})`}::tstzrange
        ) AS exists
      `);
      if (blackoutRows[0]?.exists) throw new UnitNoLongerAvailableError();

      // --- 5. The booking row FIRST -----------------------------------------
      // `reservation.booking_id` is a foreign key to `booking.id`, so the
      // booking must exist before the reservation can reference it. Both are
      // in the same transaction, so if the exclusion constraint rejects the
      // reservation below, this insert rolls back with it and no orphan
      // booking survives.
      await tx.insert(bookings).values({
        id: bookingId,
        reference,
        status: "pending_payment",
        customerUserId: input.customerUserId,
        companyId: input.companyId,
        projectSiteId: input.projectSiteId,
        locale: input.locale,
        startDate: input.startDate,
        endDate: input.endDate,
        billableDays: result.billableDays,
        deliveryRequired: input.deliveryRequired,
        deliveryDistanceKm: input.deliveryDistanceKm ?? null,
        deliveryWindowStart: input.deliveryWindowStart ?? null,
        deliveryWindowEnd: input.deliveryWindowEnd ?? null,
        siteContactName: input.siteContactName,
        siteContactPhone: input.siteContactPhone,
        siteAddressLine: input.siteAddressLine,
        siteCity: input.siteCity,
        siteAccessNotes: input.siteAccessNotes ?? null,
        poNumber: input.poNumber ?? null,
        costCentre: input.costCentre ?? null,
        projectCode: input.projectCode ?? null,

        rentalSubtotalHalalas: result.rentalSubtotalHalalas,
        addonsSubtotalHalalas: result.addonsSubtotalHalalas,
        transportSubtotalHalalas: result.transportSubtotalHalalas,
        discountHalalas: result.discountHalalas,
        taxableSubtotalHalalas: result.taxableSubtotalHalalas,
        vatRatePpm: result.vatRatePpm,
        vatHalalas: result.vatHalalas,
        depositHalalas: result.depositHalalas,
        totalHalalas: result.totalHalalas,
        currency: result.currency,
        // The frozen breakdown: rates change, but a booking's price must not
        // drift after the customer agreed to it, and a dispute months later
        // has to be answerable from the record.
        pricingSnapshot: toPricingSnapshot(result),

        termsVersion: input.termsVersion,
        termsAcceptedAt: new Date(),
        termsAcceptedIp: input.termsAcceptedIp,
        idempotencyKey: input.idempotencyKey,
      });

      // --- 6. Reservation: the exclusion constraint arbitrates the race -----
      // If a checkout hold exists we PROMOTE it, which keeps the window
      // continuously occupied — releasing then re-inserting would open a gap
      // another customer could win.
      if (input.reservationId) {
        const promoted = await tx.execute<{ id: string }>(raw`
          UPDATE reservation
          SET status = 'confirmed', booking_id = ${bookingId}, expires_at = NULL
          WHERE id = ${input.reservationId}
            AND unit_id = ${input.unitId}
            AND status = 'held'
            AND (expires_at IS NULL OR expires_at > now())
          RETURNING id
        `);
        if (promoted.length === 0) {
          // The hold expired or was taken. Fall through to a fresh insert,
          // which the constraint will reject if someone else now owns it.
          await insertReservation(tx, bookingId, input, period);
        }
      } else {
        await insertReservation(tx, bookingId, input, period);
      }

      // --- 7. Line items ----------------------------------------------------
      const rentalLine = result.lines.find((l) => l.kind === "rental");
      await tx.insert(bookingItems).values({
        id: uuidv7(),
        bookingId,
        classId: input.classId,
        unitId: input.unitId,
        quantity: input.quantity,
        tier: result.chosenTier,
        unitRateHalalas: result.chosenTierRateHalalas,
        lineTotalHalalas: rentalLine?.totalHalalas ?? result.rentalSubtotalHalalas,
      });

      const addonLines = result.lines.filter((l) => l.kind === "addon");
      if (addonLines.length > 0) {
        await tx.insert(bookingAddons).values(
          addonLines.map((line) => ({
            id: uuidv7(),
            bookingId,
            addonOptionId: null,
            code: line.code,
            labelEn: line.labelEn,
            labelAr: line.labelAr,
            quantity: line.quantity,
            pricingModel: "flat" as const,
            unitRateHalalas: line.unitRateHalalas,
            lineTotalHalalas: line.totalHalalas,
            isTaxable: line.isTaxable,
          })),
        );
      }

      // Increment redemption inside the transaction. The database CHECK
      // (redemption_count <= max_redemptions) rejects the write if concurrent
      // redemptions have already exhausted the coupon.
      if (input.couponCode) {
        await tx
          .update(coupons)
          .set({ redemptionCount: raw`${coupons.redemptionCount} + 1` })
          .where(
            and(eq(coupons.code, input.couponCode.trim().toUpperCase()), eq(coupons.isActive, true)),
          );
      }

      await tx.insert(bookingEvents).values({
        id: uuidv7(),
        bookingId,
        type: "booking.created",
        fromStatus: null,
        toStatus: "pending_payment",
        actorUserId: input.customerUserId,
        actorType: "customer",
        metadata: {
          unitId: input.unitId,
          classId: input.classId,
          billableDays: result.billableDays,
          tier: result.chosenTier,
        },
      });
    });
  } catch (error) {
    // Another customer won the race for this exact unit and window. This is
    // ordinary traffic under contention, not a fault — the caller offers
    // alternatives rather than showing an error page.
    if (isExclusionViolation(error)) throw new UnitNoLongerAvailableError();

    // Two identical submissions landed concurrently; the loser reads the
    // winner's booking rather than creating a duplicate.
    if (isUniqueViolation(error)) {
      const [raced] = await db
        .select({
          id: bookings.id,
          reference: bookings.reference,
          totalHalalas: bookings.totalHalalas,
          depositHalalas: bookings.depositHalalas,
        })
        .from(bookings)
        .where(eq(bookings.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (raced) {
        return {
          bookingId: raced.id,
          reference: raced.reference,
          totalHalalas: raced.totalHalalas,
          depositHalalas: raced.depositHalalas,
          wasIdempotentReplay: true,
        };
      }
    }
    throw error;
  }

  await writeAudit({
    action: "booking.created",
    actorUserId: input.customerUserId,
    actorType: "customer",
    actorIp: input.termsAcceptedIp,
    resourceType: "booking",
    resourceId: bookingId,
    companyId: input.companyId,
    outcome: "success",
    metadata: {
      reference,
      totalHalalas: result.totalHalalas.toString(),
      unitId: input.unitId,
    },
  });

  return {
    bookingId,
    reference,
    totalHalalas: result.totalHalalas,
    depositHalalas: result.depositHalalas,
    wasIdempotentReplay: false,
  };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function insertReservation(
  tx: Tx,
  bookingId: string,
  input: CreateBookingInput,
  period: TstzRange,
): Promise<void> {
  // HELD, with an expiry — not `confirmed`.
  //
  // This row is written before the customer has paid. Written as `confirmed`
  // with no expiry, a customer who closes the tab on the payment page would
  // remove the machine from the fleet PERMANENTLY: the booking sits in
  // `pending_payment` for ever, nothing expires the reservation, and the
  // exclusion constraint keeps honouring it. Abandoned checkouts are ordinary
  // traffic — declined cards, cold feet, a dropped connection — so each one
  // would quietly retire a machine, with slowly-wrong utilisation as the only
  // symptom.
  //
  // The rest of the machinery already assumed a hold and was simply never fed
  // one: `transitionBooking` hardens a held reservation to `confirmed` with a
  // null expiry the moment payment lands, `findAvailableUnits` ignores a hold
  // whose expiry has passed, and `expireStaleHolds` clears the rows out.
  const expiresAt = new Date(Date.now() + CHECKOUT_HOLD_MINUTES * 60_000);

  await tx.execute(raw`
    INSERT INTO reservation
      (id, unit_id, booking_id, status, period, billable_start, billable_end, expires_at)
    VALUES
      (${uuidv7()}, ${input.unitId}, ${bookingId}, 'held',
       ${`[${period.start.toISOString()},${period.end.toISOString()})`}::tstzrange,
       ${input.startDate.toISOString()}::timestamptz,
       ${input.endDate.toISOString()}::timestamptz,
       ${expiresAt.toISOString()}::timestamptz)
  `);
}

/**
 * Transition a booking's status, appending to the immutable event log.
 *
 * `expectedFrom` makes the transition a compare-and-set: a webhook arriving
 * twice, or out of order, cannot move a cancelled booking back to confirmed.
 */
export async function transitionBooking(params: {
  bookingId: string;
  toStatus: "confirmed" | "active" | "completed" | "cancelled" | "expired";
  expectedFrom?: readonly string[];
  actorUserId?: string | null;
  actorType: "customer" | "admin" | "system" | "webhook";
  type: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx.execute<{ status: string }>(raw`
      SELECT status FROM booking WHERE id = ${params.bookingId} FOR UPDATE
    `);
    const current = rows[0]?.status;
    if (!current) return false;

    if (params.expectedFrom && !params.expectedFrom.includes(current)) return false;
    if (current === params.toStatus) return false;

    await tx.execute(raw`
      UPDATE booking SET status = ${params.toStatus}::booking_status, updated_at = now()
      WHERE id = ${params.bookingId}
    `);

    // Confirming a booking hardens its reservation: `confirmed` reservations
    // have no expiry, so the window can never be freed by a sweeper.
    if (params.toStatus === "confirmed") {
      await tx.execute(raw`
        UPDATE reservation SET status = 'confirmed', expires_at = NULL
        WHERE booking_id = ${params.bookingId} AND status IN ('held', 'confirmed')
      `);
    }

    if (params.toStatus === "cancelled" || params.toStatus === "expired") {
      // Releasing the reservation frees the machine immediately, because the
      // exclusion constraint only considers active statuses.
      await tx.execute(raw`
        UPDATE reservation SET status = 'released'
        WHERE booking_id = ${params.bookingId} AND status IN ('held', 'confirmed', 'active')
      `);
    }

    await tx.insert(bookingEvents).values({
      id: uuidv7(),
      bookingId: params.bookingId,
      type: params.type,
      fromStatus: current,
      toStatus: params.toStatus,
      actorUserId: params.actorUserId ?? null,
      actorType: params.actorType,
      metadata: params.metadata ?? {},
    });

    return true;
  });
}

/** Checkout hold lifetime, in minutes. Configurable per deployment. */
export const CHECKOUT_HOLD_MINUTES = env.CHECKOUT_HOLD_MINUTES;

/**
 * Expire abandoned checkouts: release the machine AND close the booking.
 *
 * `expireStaleHolds` frees the machine, which is the part that matters for
 * inventory. It leaves the booking itself in `pending_payment` for ever, so
 * abandoned checkouts pile up in the operations dashboard's "Awaiting payment"
 * tile with money attached to them — a number that only ever grows and that
 * nobody can act on.
 *
 * `expired` has been in `booking_status` from the start and nothing ever
 * reached it. This is what it was for.
 *
 * Deliberately NOT one transaction with the hold release: freeing the machine
 * is urgent and must not be held up or rolled back by bookkeeping on the
 * booking row. Each transition is a compare-and-set, so a booking that was
 * paid in the meantime is left alone.
 */
export async function expireAbandonedCheckouts(): Promise<{
  holdsReleased: number;
  bookingsExpired: number;
}> {
  const holdsReleased = await expireStaleHolds();

  // Only bookings whose hold has actually lapsed and which nobody has paid.
  // A `confirmed` reservation has a null expiry and cannot appear here.
  const stale = await db.execute<{ booking_id: string }>(raw`
    SELECT DISTINCT r.booking_id
    FROM reservation r
    JOIN booking b ON b.id = r.booking_id
    WHERE r.status = 'expired'
      AND b.status = 'pending_payment'
      AND r.booking_id IS NOT NULL
  `);

  let bookingsExpired = 0;
  for (const row of stale) {
    const moved = await transitionBooking({
      bookingId: row.booking_id,
      toStatus: "expired",
      expectedFrom: ["pending_payment"],
      actorType: "system",
      type: "booking.checkout_expired",
      metadata: { reason: "hold_lapsed_without_payment" },
    });
    if (moved) bookingsExpired += 1;
  }

  return { holdsReleased, bookingsExpired };
}
