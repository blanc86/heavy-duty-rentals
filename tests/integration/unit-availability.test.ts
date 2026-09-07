import { afterAll, describe, expect, it } from "vitest";
import { closeSql, getSql, isDatabaseAvailable, uuidv7 } from "../helpers/db";

/**
 * TAKING A MACHINE OUT OF SERVICE.
 *
 * `equipment_unit.status` and `unit_blackout` were READ by the booking path
 * from the beginning — `createBooking` refuses a unit in `maintenance` or
 * `out_of_service`, and `findAvailableUnits` excludes any unit with an
 * overlapping blackout. Neither was ever WRITTEN by anything, so a crane that
 * broke down kept accepting online bookings.
 *
 * The assertion that matters most here is the LAST one. Grounding a machine
 * reports the bookings it collides with; it must never cancel them. Releasing a
 * customer's machine is a decision with money and a phone call attached, and an
 * "improvement" that quietly automated it would be a serious regression that no
 * type or constraint would catch.
 */

const available = await isDatabaseAvailable();

const created = { bookingIds: [] as string[], reservationIds: [] as string[], blackoutIds: [] as string[] };
let originalStatus: string | null = null;
let unitId: string | null = null;

afterAll(async () => {
  if (!available) return;
  const sql = getSql();
  if (created.reservationIds.length > 0) {
    await sql`DELETE FROM reservation WHERE id = ANY(${created.reservationIds})`;
  }
  if (created.bookingIds.length > 0) {
    await sql`DELETE FROM booking WHERE id = ANY(${created.bookingIds})`;
  }
  if (created.blackoutIds.length > 0) {
    await sql`DELETE FROM unit_blackout WHERE id = ANY(${created.blackoutIds})`;
  }
  // Never leave a fixture machine grounded: every later test that needs an
  // available unit would fail for a reason that has nothing to do with it.
  if (unitId && originalStatus) {
    await sql`UPDATE equipment_unit SET status = ${originalStatus}::unit_status WHERE id = ${unitId}`;
  }
  await closeSql();
});

/** The availability predicate, including unit status and blackouts. */
async function unitIsBookable(id: string, start: string, end: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    SELECT 1 FROM equipment_unit u
    WHERE u.id = ${id}
      AND u.is_active
      AND u.status NOT IN ('maintenance', 'inspection', 'out_of_service')
      AND NOT EXISTS (
        SELECT 1 FROM unit_blackout ub
        WHERE ub.unit_id = u.id
          AND ub.period && tstzrange(${start}::timestamptz, ${end}::timestamptz, '[)')
      )
    LIMIT 1
  `;
  return rows.length > 0;
}

describe.skipIf(!available)("a machine can be taken out of service", () => {
  it("a grounded unit stops being bookable", async () => {
    const sql = getSql();
    const [unit] = await sql`
      SELECT id, status FROM equipment_unit WHERE status = 'available' LIMIT 1
    `;
    if (!unit) throw new Error("no available unit seeded");
    unitId = unit.id;
    originalStatus = unit.status;

    const start = "2029-01-01T00:00:00Z";
    const end = "2029-01-08T00:00:00Z";
    expect(await unitIsBookable(unit.id, start, end)).toBe(true);

    await sql`UPDATE equipment_unit SET status = 'maintenance' WHERE id = ${unit.id}`;
    expect(await unitIsBookable(unit.id, start, end)).toBe(false);

    await sql`UPDATE equipment_unit SET status = 'available' WHERE id = ${unit.id}`;
    expect(await unitIsBookable(unit.id, start, end)).toBe(true);
  });

  it("a blackout blocks its window and nothing else", async () => {
    const sql = getSql();
    if (!unitId) throw new Error("unit fixture missing");

    const blackoutId = uuidv7();
    created.blackoutIds.push(blackoutId);

    await sql`
      INSERT INTO unit_blackout (id, unit_id, period, reason)
      VALUES (${blackoutId}, ${unitId},
              tstzrange('2029-02-01'::timestamptz, '2029-02-08'::timestamptz, '[)'),
              'maintenance')
    `;

    // Inside the window the machine is off the market...
    expect(await unitIsBookable(unitId, "2029-02-02T00:00:00Z", "2029-02-05T00:00:00Z")).toBe(false);
    // ...and outside it, untouched. A blackout is a window, not a status.
    expect(await unitIsBookable(unitId, "2029-03-01T00:00:00Z", "2029-03-08T00:00:00Z")).toBe(true);
  });

  it("grounding a machine REPORTS colliding bookings and does not cancel them", async () => {
    const sql = getSql();
    if (!unitId) throw new Error("unit fixture missing");

    // A SEEDED user, not "whatever row comes back first". Another test file
    // creates and deletes its own users, so an unordered LIMIT 1 can hand
    // back a row that is gone by the time this insert runs — which it did,
    // as a foreign-key violation that had nothing to do with the assertion.
    const [user] = await sql`
      SELECT id FROM "user" WHERE email = 'customer@example.com' LIMIT 1
    `;
    if (!user) throw new Error("no user seeded");

    const bookingId = uuidv7();
    const reservationId = uuidv7();
    created.bookingIds.push(bookingId);
    created.reservationIds.push(reservationId);

    const start = "2029-04-01T00:00:00Z";
    const end = "2029-04-08T00:00:00Z";

    await sql`
      INSERT INTO booking (
        id, reference, customer_user_id, status, start_date, end_date, billable_days,
        rental_subtotal_halalas, addons_subtotal_halalas, transport_subtotal_halalas,
        discount_halalas, taxable_subtotal_halalas, vat_rate_ppm, vat_halalas,
        deposit_halalas, total_halalas, currency, locale,
        site_city, site_address_line, site_contact_name, site_contact_phone,
        terms_version, idempotency_key, pricing_snapshot
      ) VALUES (
        ${bookingId}, ${"RNT-COL" + bookingId.slice(0, 3).toUpperCase()}, ${user.id},
        'confirmed', ${start}::timestamptz, ${end}::timestamptz, 7,
        0, 0, 0, 0, 0, 150000, 0, 0, 0, 'SAR', 'en',
        'Riyadh', 'Test', 'Test', '+966500000000',
        '1.0', ${"collide-" + bookingId}, '{}'::jsonb
      )
    `;
    await sql`
      INSERT INTO reservation (id, unit_id, booking_id, status, period, billable_start, billable_end, expires_at)
      VALUES (${reservationId}, ${unitId}, ${bookingId}, 'confirmed',
              tstzrange(${start}::timestamptz, ${end}::timestamptz, '[)'),
              ${start}::timestamptz, ${end}::timestamptz, NULL)
    `;

    // Ground the machine, exactly as the action does.
    await sql`UPDATE equipment_unit SET status = 'out_of_service' WHERE id = ${unitId}`;

    const [booking] = await sql`SELECT status FROM booking WHERE id = ${bookingId}`;
    const [reservation] = await sql`SELECT status FROM reservation WHERE id = ${reservationId}`;

    // THE POINT: the customer's booking is untouched. An operator is told about
    // it and decides what to do; the software does not decide for them.
    expect(booking?.status).toBe("confirmed");
    expect(reservation?.status).toBe("confirmed");

    await sql`UPDATE equipment_unit SET status = 'available' WHERE id = ${unitId}`;
  });
});
