import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeSql, getSql, isDatabaseAvailable, uuidv7 } from "../helpers/db";

/**
 * BOOKING SERVICE — the money path.
 *
 * Exercises `createBooking` against a real database: the price is recomputed
 * server-side, a tampered total is rejected and audited, a retry is idempotent,
 * and a lost race surfaces as "no longer available" rather than a second
 * reservation on the same crane.
 *
 * These are the assertions that make online booking of heavy plant defensible.
 */

const available = await isDatabaseAvailable();

let ctx: {
  categoryId: string;
  classId: string;
  branchId: string;
  unitId: string;
  userId: string;
  rateCardId: string;
} | null = null;

beforeAll(async () => {
  if (!available) return;
  const sql = getSql();
  const suffix = uuidv7().slice(0, 8);

  const categoryId = uuidv7();
  const classId = uuidv7();
  const branchId = uuidv7();
  const unitId = uuidv7();
  const userId = uuidv7();
  const rateCardId = uuidv7();

  await sql`
    INSERT INTO equipment_category (id, slug, name_en, name_ar)
    VALUES (${categoryId}, ${`bk-cat-${suffix}`}, 'Booking Test', 'اختبار الحجز')
  `;
  await sql`
    INSERT INTO equipment_class
      (id, category_id, slug, name_en, name_ar, manufacturer, model, capacity_kg,
       min_rental_days, mobilisation_buffer_days, demobilisation_buffer_days,
       deposit_halalas, transport_class, instant_bookable, is_active)
    VALUES
      (${classId}, ${categoryId}, ${`bk-class-${suffix}`}, 'Test Crane', 'رافعة اختبار',
       'TestCo', 'TC-50', 50000, 1, 1, 1, 100000, 'light_plant', TRUE, TRUE)
  `;
  await sql`
    INSERT INTO branch
      (id, slug, name_en, name_ar, city, city_ar, region, region_ar, address_en, address_ar)
    VALUES (${branchId}, ${`bk-branch-${suffix}`}, 'Test Depot', 'مستودع',
            'Riyadh', 'الرياض', 'Riyadh', 'الرياض', 'x', 'x')
  `;
  await sql`
    INSERT INTO equipment_unit (id, class_id, branch_id, asset_code, status, is_active)
    VALUES (${unitId}, ${classId}, ${branchId}, ${`BK-${suffix}`}, 'available', TRUE)
  `;
  // 1,000 SAR/day flat: no weekly or monthly tier, so the arithmetic in these
  // assertions stays obvious.
  await sql`
    INSERT INTO rate_card (id, class_id, branch_id, currency, valid_from, is_active)
    VALUES (${rateCardId}, ${classId}, NULL, 'SAR', now() - interval '1 day', TRUE)
  `;
  await sql`
    INSERT INTO rate_tier (id, rate_card_id, tier, min_days, rate_halalas)
    VALUES (${uuidv7()}, ${rateCardId}, 'daily', 1, 100000)
  `;
  await sql`
    INSERT INTO "user" (id, email, full_name, password_hash, status)
    VALUES (${userId}, ${`bk-${suffix}@example.com`}, 'Booking Tester', 'x', 'active')
  `;

  ctx = { categoryId, classId, branchId, unitId, userId, rateCardId };
});

afterAll(async () => {
  if (available && ctx) {
    const sql = getSql();
    await sql`DELETE FROM booking_event WHERE booking_id IN (SELECT id FROM booking WHERE customer_user_id = ${ctx.userId})`;
    await sql`DELETE FROM booking_addon WHERE booking_id IN (SELECT id FROM booking WHERE customer_user_id = ${ctx.userId})`;
    await sql`DELETE FROM booking_item WHERE booking_id IN (SELECT id FROM booking WHERE customer_user_id = ${ctx.userId})`;
    await sql`DELETE FROM reservation WHERE unit_id = ${ctx.unitId}`;
    await sql`DELETE FROM audit_log WHERE actor_user_id = ${ctx.userId}`;
    await sql`DELETE FROM booking WHERE customer_user_id = ${ctx.userId}`;
    await sql`DELETE FROM equipment_unit WHERE id = ${ctx.unitId}`;
    await sql`DELETE FROM rate_tier WHERE rate_card_id = ${ctx.rateCardId}`;
    await sql`DELETE FROM rate_card WHERE id = ${ctx.rateCardId}`;
    await sql`DELETE FROM equipment_class WHERE id = ${ctx.classId}`;
    await sql`DELETE FROM branch WHERE id = ${ctx.branchId}`;
    await sql`DELETE FROM equipment_category WHERE id = ${ctx.categoryId}`;
    await sql`DELETE FROM "user" WHERE id = ${ctx.userId}`;
  }
  await closeSql();
});

/** Dates far enough out that seeded data cannot collide with them. */
function dates(offsetDays: number, lengthDays: number) {
  const start = new Date(Date.UTC(2028, 0, 1));
  start.setUTCDate(start.getUTCDate() + offsetDays);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + lengthDays);
  return { start, end };
}

async function baseInput(overrides: Record<string, unknown> = {}) {
  const { start, end } = dates(0, 5);
  return {
    classId: ctx!.classId,
    branchId: ctx!.branchId,
    startDate: start,
    endDate: end,
    quantity: 1,
    addons: [],
    deliveryRequired: false,
    unitId: ctx!.unitId,
    customerUserId: ctx!.userId,
    companyId: null,
    projectSiteId: null,
    locale: "en" as const,
    siteCity: "Riyadh",
    siteAddressLine: "Test site",
    siteContactName: "Tester",
    siteContactPhone: "+966500000000",
    termsVersion: "1.0",
    termsAcceptedIp: "127.0.0.1",
    idempotencyKey: uuidv7(),
    ...overrides,
  };
}

describe.runIf(available)("createBooking", () => {
  it("creates a booking with a server-computed price", async () => {
    const { createBooking } = await import("@/lib/booking/service");
    const { quote } = await import("@/lib/pricing/repository");

    const input = await baseInput();
    // Ask the server what it costs, then commit at exactly that figure — which
    // is what an honest client does.
    const { result } = await quote({
      classId: input.classId,
      branchId: input.branchId,
      startDate: input.startDate,
      endDate: input.endDate,
      quantity: 1,
      addons: [],
      deliveryRequired: false,
    });

    const booking = await createBooking({ ...input, clientTotalHalalas: result.totalHalalas });

    expect(booking.reference).toMatch(/^RNT-[A-Z2-9]{6}$/);
    expect(booking.wasIdempotentReplay).toBe(false);
    // 5 days at 1,000 SAR + 15% VAT + 1,000 SAR deposit.
    expect(booking.totalHalalas).toBe(500000n + 75000n + 100000n);
    expect(booking.depositHalalas).toBe(100000n);

    const sql = getSql();
    const rows = await sql<{ status: string }[]>`
      SELECT status FROM booking WHERE id = ${booking.bookingId}
    `;
    // Never `confirmed` on creation: only a verified webhook may do that.
    expect(rows[0]?.status).toBe("pending_payment");
  });

  it("REJECTS a tampered total and writes an audit event", async () => {
    const { createBooking, PriceMismatchError } = await import("@/lib/booking/service");
    const input = await baseInput({ ...dates(30, 3) });
    const { start, end } = dates(30, 3);

    let threw = false;
    try {
      // The classic attack: edit the total in the request to 1 halala.
      await createBooking({
        ...input,
        startDate: start,
        endDate: end,
        clientTotalHalalas: 1n,
      });
    } catch (error) {
      threw = true;
      expect(error).toBeInstanceOf(PriceMismatchError);
    }
    expect(threw).toBe(true);

    const sql = getSql();
    const audits = await sql<{ action: string; outcome: string }[]>`
      SELECT action, outcome FROM audit_log
      WHERE actor_user_id = ${ctx!.userId} AND action = 'booking.price_mismatch'
    `;
    // Rejecting alone would be safe; auditing is what makes a systematic
    // attempt visible rather than merely blocked.
    expect(audits.length).toBeGreaterThan(0);
    expect(audits[0]?.outcome).toBe("denied");

    const bookings = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM booking WHERE idempotency_key = ${input.idempotencyKey}
    `;
    expect(bookings[0]?.count).toBe(0);
  });

  it("is idempotent: the same key returns the original booking", async () => {
    const { createBooking } = await import("@/lib/booking/service");
    const { quote } = await import("@/lib/pricing/repository");

    const { start, end } = dates(60, 4);
    const idempotencyKey = uuidv7();
    const input = await baseInput({ startDate: start, endDate: end, idempotencyKey });

    const { result } = await quote({
      classId: input.classId,
      branchId: input.branchId,
      startDate: start,
      endDate: end,
      quantity: 1,
      addons: [],
      deliveryRequired: false,
    });

    const first = await createBooking({ ...input, clientTotalHalalas: result.totalHalalas });
    // A double-clicked submit must not reserve a second crane.
    const second = await createBooking({ ...input, clientTotalHalalas: result.totalHalalas });

    expect(second.bookingId).toBe(first.bookingId);
    expect(second.reference).toBe(first.reference);
    expect(second.wasIdempotentReplay).toBe(true);

    const sql = getSql();
    const reservations = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM reservation WHERE booking_id = ${first.bookingId}
    `;
    expect(reservations[0]?.count).toBe(1);
  });

  it("rejects a second booking overlapping the first on the same unit", async () => {
    const { createBooking } = await import("@/lib/booking/service");
    const { quote } = await import("@/lib/pricing/repository");
    const { UnitNoLongerAvailableError } = await import("@/lib/availability");

    const { start, end } = dates(120, 10);
    const input = await baseInput({ startDate: start, endDate: end });
    const { result } = await quote({
      classId: input.classId,
      branchId: input.branchId,
      startDate: start,
      endDate: end,
      quantity: 1,
      addons: [],
      deliveryRequired: false,
    });
    await createBooking({ ...input, clientTotalHalalas: result.totalHalalas });

    // Overlaps the window just booked.
    const overlapStart = new Date(start);
    overlapStart.setUTCDate(overlapStart.getUTCDate() + 3);
    const overlapEnd = new Date(overlapStart);
    overlapEnd.setUTCDate(overlapEnd.getUTCDate() + 5);

    const clash = await baseInput({
      startDate: overlapStart,
      endDate: overlapEnd,
      idempotencyKey: uuidv7(),
    });
    const clashQuote = await quote({
      classId: clash.classId,
      branchId: clash.branchId,
      startDate: overlapStart,
      endDate: overlapEnd,
      quantity: 1,
      addons: [],
      deliveryRequired: false,
    });

    let threw = false;
    try {
      await createBooking({ ...clash, clientTotalHalalas: clashQuote.result.totalHalalas });
    } catch (error) {
      threw = true;
      expect(error).toBeInstanceOf(UnitNoLongerAvailableError);
    }
    expect(threw).toBe(true);
  });

  it("stores the full pricing snapshot so a price can be explained later", async () => {
    const { createBooking } = await import("@/lib/booking/service");
    const { quote } = await import("@/lib/pricing/repository");

    const { start, end } = dates(200, 6);
    const input = await baseInput({ startDate: start, endDate: end, idempotencyKey: uuidv7() });
    const { result } = await quote({
      classId: input.classId,
      branchId: input.branchId,
      startDate: start,
      endDate: end,
      quantity: 1,
      addons: [],
      deliveryRequired: false,
    });

    const booking = await createBooking({ ...input, clientTotalHalalas: result.totalHalalas });

    const sql = getSql();
    const rows = await sql<{ pricing_snapshot: unknown }[]>`
      SELECT pricing_snapshot FROM booking WHERE id = ${booking.bookingId}
    `;
    const snapshot =
      typeof rows[0]?.pricing_snapshot === "string"
        ? JSON.parse(rows[0].pricing_snapshot as string)
        : (rows[0]?.pricing_snapshot as Record<string, unknown>);

    // Rates change; a booking's price must not drift after the customer agreed
    // to it, and a dispute months later must be answerable from the record.
    expect(snapshot.engineVersion).toBeTruthy();
    expect(snapshot.chosenTier).toBe("daily");
    expect(Array.isArray(snapshot.tiersConsidered)).toBe(true);
    expect(Array.isArray(snapshot.lines)).toBe(true);
    expect(snapshot.totalHalalas).toBe(result.totalHalalas.toString());
  });

  it("widens the occupied window beyond the billed window using class buffers", async () => {
    const { createBooking } = await import("@/lib/booking/service");
    const { quote } = await import("@/lib/pricing/repository");

    const { start, end } = dates(300, 3);
    const input = await baseInput({ startDate: start, endDate: end, idempotencyKey: uuidv7() });
    const { result } = await quote({
      classId: input.classId,
      branchId: input.branchId,
      startDate: start,
      endDate: end,
      quantity: 1,
      addons: [],
      deliveryRequired: false,
    });
    const booking = await createBooking({ ...input, clientTotalHalalas: result.totalHalalas });

    const sql = getSql();
    const rows = await sql<{ occupied_start: Date; occupied_end: Date; billable_start: Date }[]>`
      SELECT lower(period) AS occupied_start, upper(period) AS occupied_end, billable_start
      FROM reservation WHERE booking_id = ${booking.bookingId}
    `;
    const row = rows[0]!;

    // The class has 1-day mobilisation and demobilisation buffers, so the
    // machine is occupied for longer than the customer is billed — otherwise
    // operations gets handed a physically impossible schedule.
    expect(new Date(row.occupied_start).getTime()).toBeLessThan(
      new Date(row.billable_start).getTime(),
    );
    expect(new Date(row.occupied_end).getTime()).toBeGreaterThan(end.getTime());
  });
});
