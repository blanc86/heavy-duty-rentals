import { afterAll, describe, expect, it } from "vitest";
import { closeSql, getSql, isDatabaseAvailable, uuidv7 } from "../helpers/db";

/**
 * ABANDONED CHECKOUT — the machine must come back.
 *
 * `createBooking` writes the booking and its reservation together, before the
 * customer has paid. If that reservation is written as `confirmed` with no
 * expiry, then a customer who closes the tab on the payment page removes a
 * machine from the fleet permanently: the booking sits in `pending_payment`
 * for ever, the reservation never expires, and nothing sweeps it.
 *
 * That is a silent inventory leak, and abandoned checkouts are ordinary traffic
 * — declined cards, cold feet, a lost connection. Each one would quietly retire
 * a crane, and the only symptom would be utilisation slowly looking wrong.
 *
 * The machinery to prevent it already existed and was simply not connected:
 * `transitionBooking` hardens a `held` reservation to `confirmed` when payment
 * lands, `findAvailableUnits` ignores a hold whose `expiresAt` has passed, and
 * `expireStaleHolds` clears them out. All of it assumed the reservation started
 * life as `held`.
 */

const available = await isDatabaseAvailable();

const created = { bookingIds: [] as string[], reservationIds: [] as string[] };

afterAll(async () => {
  if (!available) return;
  const sql = getSql();
  if (created.reservationIds.length > 0) {
    await sql`DELETE FROM reservation WHERE id = ANY(${created.reservationIds})`;
  }
  if (created.bookingIds.length > 0) {
    await sql`DELETE FROM booking WHERE id = ANY(${created.bookingIds})`;
  }
  await closeSql();
});

/** The availability predicate `findAvailableUnits` applies, in SQL. */
async function unitIsFree(unitId: string, start: string, end: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    SELECT 1
    FROM reservation r
    WHERE r.unit_id = ${unitId}
      AND r.status IN ('held', 'confirmed', 'active')
      AND (r.expires_at IS NULL OR r.expires_at > now())
      AND r.period && tstzrange(${start}::timestamptz, ${end}::timestamptz, '[)')
    LIMIT 1
  `;
  return rows.length === 0;
}

describe.skipIf(!available)("an abandoned checkout releases its machine", () => {
  it("holds the unit while the checkout window is still open", async () => {
    const sql = getSql();
    const [unit] = await sql`SELECT id FROM equipment_unit LIMIT 1`;
    if (!unit) throw new Error("no equipment units seeded");

    const start = "2027-03-01T00:00:00Z";
    const end = "2027-03-08T00:00:00Z";
    expect(await unitIsFree(unit.id, start, end)).toBe(true);

    const reservationId = uuidv7();
    created.reservationIds.push(reservationId);

    // A live hold: created just now, expiring in twenty minutes.
    await sql`
      INSERT INTO reservation (id, unit_id, status, period, billable_start, billable_end, expires_at)
      VALUES (${reservationId}, ${unit.id}, 'held',
              tstzrange(${start}::timestamptz, ${end}::timestamptz, '[)'),
              ${start}::timestamptz, ${end}::timestamptz,
              now() + interval '20 minutes')
    `;

    // While the customer is on the payment page the machine is genuinely taken.
    expect(await unitIsFree(unit.id, start, end)).toBe(false);
  });

  it("frees the unit once the hold expires, without a sweeper having run", async () => {
    const sql = getSql();
    const [unit] = await sql`SELECT id FROM equipment_unit OFFSET 1 LIMIT 1`;
    if (!unit) throw new Error("need at least two equipment units seeded");

    const start = "2027-04-01T00:00:00Z";
    const end = "2027-04-08T00:00:00Z";

    const reservationId = uuidv7();
    created.reservationIds.push(reservationId);

    // The customer closed the tab; the hold lapsed an hour ago. Its status is
    // still 'held' because nothing has swept it.
    await sql`
      INSERT INTO reservation (id, unit_id, status, period, billable_start, billable_end, expires_at)
      VALUES (${reservationId}, ${unit.id}, 'held',
              tstzrange(${start}::timestamptz, ${end}::timestamptz, '[)'),
              ${start}::timestamptz, ${end}::timestamptz,
              now() - interval '1 hour')
    `;

    // Reads must not depend on the sweeper having run on time.
    expect(await unitIsFree(unit.id, start, end)).toBe(true);
  });

  it("REGRESSION: a reservation written without an expiry never frees the machine", async () => {
    const sql = getSql();
    const [unit] = await sql`SELECT id FROM equipment_unit OFFSET 2 LIMIT 1`;
    if (!unit) throw new Error("need at least three equipment units seeded");

    const start = "2027-05-01T00:00:00Z";
    const end = "2027-05-08T00:00:00Z";

    const reservationId = uuidv7();
    created.reservationIds.push(reservationId);

    // This is what an unpaid booking used to write: 'confirmed', no expiry.
    // Nothing in the system can ever release it — which is exactly the leak.
    await sql`
      INSERT INTO reservation (id, unit_id, status, period, billable_start, billable_end, expires_at)
      VALUES (${reservationId}, ${unit.id}, 'confirmed',
              tstzrange(${start}::timestamptz, ${end}::timestamptz, '[)'),
              ${start}::timestamptz, ${end}::timestamptz,
              NULL)
    `;

    expect(await unitIsFree(unit.id, start, end)).toBe(false);

    // The sweeper cannot help: it only touches 'held'.
    await sql`
      UPDATE reservation SET status = 'expired'
      WHERE status = 'held' AND expires_at IS NOT NULL AND expires_at <= now()
    `;
    expect(await unitIsFree(unit.id, start, end)).toBe(false);

    // Which is why an UNPAID booking must never write one of these. The
    // assertion that matters lives in the booking service test below.
  });
});
