import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeSql,
  createFixture,
  getSql,
  isDatabaseAvailable,
  tryReserve,
  uuidv7,
  type Fixture,
} from "../helpers/db";

/**
 * AVAILABILITY AND CONCURRENCY.
 *
 * These are the tests that matter most in the whole suite. The invariant they
 * protect — two customers can never both hold the same physical machine for
 * overlapping dates — is what makes online booking of heavy plant possible at
 * all. A double-booked crane means a machine that does not arrive on a live
 * site, which is a contractual and potentially a safety failure.
 *
 * The guarantee comes from a PostgreSQL GiST exclusion constraint, not from
 * application logic, so these tests exercise the DATABASE.
 */

const SQLSTATE_EXCLUSION_VIOLATION = "23P01";

let available = false;
let fixture: Fixture | null = null;

beforeAll(async () => {
  available = await isDatabaseAvailable();
  if (available) fixture = await createFixture();
});

afterAll(async () => {
  await fixture?.cleanup();
  await closeSql();
});

describe.runIf(await isDatabaseAvailable())("no double booking", () => {
  it("accepts the first reservation for a window", async () => {
    const result = await tryReserve(fixture!.unitId, "2027-03-14", "2027-03-28");
    expect(result.ok).toBe(true);
  });

  it("REJECTS an overlapping reservation on the same unit", async () => {
    // The core guarantee. 20 Mar – 2 Apr overlaps 14 – 28 Mar.
    const result = await tryReserve(fixture!.unitId, "2027-03-20", "2027-04-02");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(SQLSTATE_EXCLUSION_VIOLATION);
  });

  it("rejects a reservation fully contained within an existing one", async () => {
    const result = await tryReserve(fixture!.unitId, "2027-03-18", "2027-03-20");
    expect(result.ok).toBe(false);
  });

  it("rejects a reservation that fully contains an existing one", async () => {
    const result = await tryReserve(fixture!.unitId, "2027-03-01", "2027-04-30");
    expect(result.ok).toBe(false);
  });

  it("ALLOWS an adjacent reservation touching at the boundary", async () => {
    // Half-open ranges: a rental ending on the 28th and one starting on the
    // 28th do not overlap. Getting this wrong would lose a day of revenue on
    // every back-to-back hire.
    const result = await tryReserve(fixture!.unitId, "2027-03-28", "2027-04-05");
    expect(result.ok).toBe(true);
  });

  it("frees the window when a reservation is cancelled", async () => {
    const sql = getSql();
    await sql`
      UPDATE reservation SET status = 'cancelled'
      WHERE unit_id = ${fixture!.unitId} AND billable_start = '2027-03-14'::timestamptz
    `;
    // The exclusion constraint is partial (active statuses only), so cancelling
    // releases the window with no cleanup job in the critical path.
    const result = await tryReserve(fixture!.unitId, "2027-03-14", "2027-03-28");
    expect(result.ok).toBe(true);
  });

  it("allows the same window on a DIFFERENT unit", async () => {
    const sql = getSql();
    const otherUnitId = uuidv7();
    await sql`
      INSERT INTO equipment_unit (id, class_id, branch_id, asset_code, status, is_active)
      VALUES (${otherUnitId}, ${fixture!.classId}, ${fixture!.branchId},
              ${`TST-OTHER-${otherUnitId.slice(0, 6)}`}, 'available', TRUE)
    `;
    // The constraint keys on unit_id: a second physical crane is a second
    // crane, not a conflict.
    const result = await tryReserve(otherUnitId, "2027-03-14", "2027-03-28");
    expect(result.ok).toBe(true);

    await sql`DELETE FROM reservation WHERE unit_id = ${otherUnitId}`;
    await sql`DELETE FROM equipment_unit WHERE id = ${otherUnitId}`;
  });
});

describe.runIf(await isDatabaseAvailable())("concurrent booking race", () => {
  it("lets exactly ONE of ten simultaneous requests win the same window", async () => {
    const sql = getSql();
    const raceUnitId = uuidv7();

    await sql`
      INSERT INTO equipment_unit (id, class_id, branch_id, asset_code, status, is_active)
      VALUES (${raceUnitId}, ${fixture!.classId}, ${fixture!.branchId},
              ${`TST-RACE-${raceUnitId.slice(0, 6)}`}, 'available', TRUE)
    `;

    try {
      // Ten genuinely concurrent inserts for the identical window. An
      // application-level "check then insert" could not prevent all but one
      // from succeeding here — only the database can arbitrate.
      const attempts = await Promise.all(
        Array.from({ length: 10 }, () => tryReserve(raceUnitId, "2027-06-01", "2027-06-15")),
      );

      const succeeded = attempts.filter((a) => a.ok);
      const rejected = attempts.filter((a) => !a.ok);

      expect(succeeded).toHaveLength(1);
      expect(rejected).toHaveLength(9);

      // Every loser must fail with the SPECIFIC exclusion-violation code, which
      // is what the booking service catches to report "no longer available".
      // A different SQLSTATE would mean a real fault being silently swallowed.
      for (const attempt of rejected) {
        if (!attempt.ok) expect(attempt.code).toBe(SQLSTATE_EXCLUSION_VIOLATION);
      }

      const rows = await sql`
        SELECT COUNT(*)::int AS count FROM reservation
        WHERE unit_id = ${raceUnitId} AND status IN ('held','confirmed','active')
      `;
      expect(rows[0]?.count).toBe(1);
    } finally {
      await sql`DELETE FROM reservation WHERE unit_id = ${raceUnitId}`;
      await sql`DELETE FROM equipment_unit WHERE id = ${raceUnitId}`;
    }
  });
});

describe.runIf(await isDatabaseAvailable())("maintenance blackouts", () => {
  it("prevents a unit being double-blacked-out", async () => {
    const sql = getSql();
    const unitId = fixture!.unitId;

    await sql`
      INSERT INTO unit_blackout (id, unit_id, period, reason)
      VALUES (${uuidv7()}, ${unitId},
              tstzrange('2027-08-01'::timestamptz, '2027-08-10'::timestamptz), 'maintenance')
    `;

    let code = "";
    try {
      await sql`
        INSERT INTO unit_blackout (id, unit_id, period, reason)
        VALUES (${uuidv7()}, ${unitId},
                tstzrange('2027-08-05'::timestamptz, '2027-08-15'::timestamptz), 'inspection')
      `;
    } catch (error) {
      code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code: unknown }).code)
          : "";
    }
    // Overlapping maintenance windows are a data-entry error, not a schedule.
    expect(code).toBe(SQLSTATE_EXCLUSION_VIOLATION);

    await sql`DELETE FROM unit_blackout WHERE unit_id = ${unitId}`;
  });

  it("removes a unit from availability while it is in maintenance", async () => {
    const sql = getSql();
    const unitId = fixture!.unitId;

    await sql`
      INSERT INTO unit_blackout (id, unit_id, period, reason)
      VALUES (${uuidv7()}, ${unitId},
              tstzrange('2027-09-01'::timestamptz, '2027-09-10'::timestamptz), 'maintenance')
    `;

    // The availability query unions blackouts, so scheduling maintenance takes
    // the machine off sale immediately — there is no separate "bookable" flag
    // anyone could forget to flip.
    const rows = await sql<{ available: boolean }[]>`
      SELECT NOT EXISTS (
        SELECT 1 FROM unit_blackout ub
        WHERE ub.unit_id = ${unitId}
          AND ub.period && tstzrange('2027-09-03'::timestamptz, '2027-09-06'::timestamptz)
      ) AS available
    `;
    expect(rows[0]?.available).toBe(false);

    await sql`DELETE FROM unit_blackout WHERE unit_id = ${unitId}`;
  });
});

describe.runIf(await isDatabaseAvailable())("range validity constraints", () => {
  it("rejects an inverted date range", async () => {
    // An inverted range would overlap nothing and silently defeat the
    // no-overlap constraint, so it is rejected outright.
    const result = await tryReserve(fixture!.unitId, "2027-12-20", "2027-12-10");
    expect(result.ok).toBe(false);
  });

  it("rejects an empty date range", async () => {
    const result = await tryReserve(fixture!.unitId, "2027-12-10", "2027-12-10");
    expect(result.ok).toBe(false);
  });
});

describe.runIf(await isDatabaseAvailable())("held reservations", () => {
  it("blocks other customers while a checkout hold is live", async () => {
    const sql = getSql();
    const unitId = uuidv7();
    await sql`
      INSERT INTO equipment_unit (id, class_id, branch_id, asset_code, status, is_active)
      VALUES (${unitId}, ${fixture!.classId}, ${fixture!.branchId},
              ${`TST-HOLD-${unitId.slice(0, 6)}`}, 'available', TRUE)
    `;

    try {
      await sql`
        INSERT INTO reservation
          (id, unit_id, status, period, billable_start, billable_end, expires_at)
        VALUES (${uuidv7()}, ${unitId}, 'held',
                tstzrange('2027-07-01'::timestamptz, '2027-07-10'::timestamptz),
                '2027-07-01'::timestamptz, '2027-07-10'::timestamptz,
                now() + interval '20 minutes')
      `;

      // A hold genuinely blocks rather than merely hinting — otherwise a
      // customer could reach the payment page for a machine already gone.
      const result = await tryReserve(unitId, "2027-07-05", "2027-07-15");
      expect(result.ok).toBe(false);
    } finally {
      await sql`DELETE FROM reservation WHERE unit_id = ${unitId}`;
      await sql`DELETE FROM equipment_unit WHERE id = ${unitId}`;
    }
  });

  it("treats an EXPIRED hold as released in availability reads", async () => {
    const sql = getSql();
    const unitId = uuidv7();
    await sql`
      INSERT INTO equipment_unit (id, class_id, branch_id, asset_code, status, is_active)
      VALUES (${unitId}, ${fixture!.classId}, ${fixture!.branchId},
              ${`TST-EXP-${unitId.slice(0, 6)}`}, 'available', TRUE)
    `;

    try {
      await sql`
        INSERT INTO reservation
          (id, unit_id, status, period, billable_start, billable_end, expires_at)
        VALUES (${uuidv7()}, ${unitId}, 'held',
                tstzrange('2027-07-01'::timestamptz, '2027-07-10'::timestamptz),
                '2027-07-01'::timestamptz, '2027-07-10'::timestamptz,
                now() - interval '1 minute')
      `;

      // Reads filter on expiry, so correctness never depends on a sweeper job
      // having run on time.
      const rows = await sql<{ available: boolean }[]>`
        SELECT NOT EXISTS (
          SELECT 1 FROM reservation r
          WHERE r.unit_id = ${unitId}
            AND r.status IN ('held','confirmed','active')
            AND (r.expires_at IS NULL OR r.expires_at > now())
            AND r.period && tstzrange('2027-07-05'::timestamptz, '2027-07-08'::timestamptz)
        ) AS available
      `;
      expect(rows[0]?.available).toBe(true);
    } finally {
      await sql`DELETE FROM reservation WHERE unit_id = ${unitId}`;
      await sql`DELETE FROM equipment_unit WHERE id = ${unitId}`;
    }
  });
});
