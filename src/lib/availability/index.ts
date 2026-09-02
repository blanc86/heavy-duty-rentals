import { and, eq, sql as raw } from "drizzle-orm";
import { db, isExclusionViolation } from "@/lib/db";
import { equipmentClasses } from "@/lib/db/schema/catalog";
import { reservations } from "@/lib/db/schema/booking";
import type { TstzRange } from "@/lib/db/schema/types";
import { uuidv7 } from "@/lib/ids";

/**
 * AVAILABILITY.
 *
 * The invariant: two customers must never both hold the same physical machine
 * for overlapping dates.
 *
 * That invariant is NOT enforced here. It is enforced by a PostgreSQL GiST
 * exclusion constraint on `reservation` (see db/migrations). This module's job
 * is to (a) ask good questions of the database and (b) lose the race
 * gracefully when another transaction wins it.
 *
 * The distinction matters: an application-level "check then insert" cannot be
 * made safe under concurrency, because another transaction can commit between
 * the check and the insert. Only the database can arbitrate.
 */

export class UnitNoLongerAvailableError extends Error {
  readonly code = "unit_no_longer_available";
  constructor(message = "That machine was just taken for these dates.") {
    super(message);
    this.name = "UnitNoLongerAvailableError";
  }
}

/** Statuses that occupy a machine. Anything else releases the window. */
const ACTIVE_RESERVATION_STATUSES = ["held", "confirmed", "active"] as const;

/**
 * Widen the customer's billed window into the physically OCCUPIED window.
 *
 * A crane coming off a job at 18:00 on the 28th is not available at 08:00 on
 * the 29th: it has to be de-rigged, loaded, transported and inspected. Booking
 * against the billed window alone hands operations a schedule that cannot
 * physically happen — which is how a machine fails to arrive on a live site.
 */
export function occupiedPeriod(
  startDate: Date,
  endDate: Date,
  mobilisationBufferDays: number,
  demobilisationBufferDays: number,
): TstzRange {
  const start = new Date(startDate);
  start.setUTCDate(start.getUTCDate() - mobilisationBufferDays);
  const end = new Date(endDate);
  end.setUTCDate(end.getUTCDate() + demobilisationBufferDays);
  return { start, end };
}

function rangeLiteral(period: TstzRange): string {
  return `[${period.start.toISOString()},${period.end.toISOString()})`;
}

export interface AvailableUnit {
  unitId: string;
  assetCode: string;
  branchId: string;
  branchCity: string;
  yearOfManufacture: number | null;
  engineHours: number;
}

/**
 * Which physical units of a class are free for a period?
 *
 * A unit is free when ALL of the following hold:
 *   1. it is active and in a bookable status;
 *   2. it has no overlapping reservation in an active status that has not expired;
 *   3. it has no overlapping blackout (maintenance, inspection, transport).
 *
 * Note (2)'s expiry filter. A held reservation whose `expiresAt` has passed is
 * treated as released *by the read*, so correctness never depends on a sweeper
 * job having run on time. The constraint still blocks a genuinely live hold.
 */
export async function findAvailableUnits(params: {
  classId: string;
  period: TstzRange;
  branchId?: string | undefined;
  limit?: number;
}): Promise<AvailableUnit[]> {
  const { classId, period, branchId, limit = 50 } = params;
  const range = rangeLiteral(period);

  const rows = await db.execute<{
    unit_id: string;
    asset_code: string;
    branch_id: string;
    city: string;
    year_of_manufacture: number | null;
    engine_hours: number;
  }>(raw`
    SELECT u.id            AS unit_id,
           u.asset_code    AS asset_code,
           u.branch_id     AS branch_id,
           b.city          AS city,
           u.year_of_manufacture,
           u.engine_hours
    FROM equipment_unit u
    JOIN branch b ON b.id = u.branch_id
    WHERE u.class_id = ${classId}
      AND u.is_active = TRUE
      AND b.is_active = TRUE
      AND u.status IN ('available', 'reserved', 'rented', 'in_transit')
      ${branchId ? raw`AND u.branch_id = ${branchId}` : raw``}
      AND NOT EXISTS (
        SELECT 1 FROM reservation r
        WHERE r.unit_id = u.id
          AND r.status IN ('held', 'confirmed', 'active')
          AND (r.expires_at IS NULL OR r.expires_at > now())
          AND r.period && ${range}::tstzrange
      )
      AND NOT EXISTS (
        SELECT 1 FROM unit_blackout ub
        WHERE ub.unit_id = u.id
          AND ub.period && ${range}::tstzrange
      )
    ORDER BY u.engine_hours ASC, u.asset_code ASC
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    unitId: r.unit_id,
    assetCode: r.asset_code,
    branchId: r.branch_id,
    branchCity: r.city,
    yearOfManufacture: r.year_of_manufacture,
    engineHours: r.engine_hours,
  }));
}

/** How many units of a class are free for a period? Used on listing cards. */
export async function countAvailableUnits(params: {
  classId: string;
  period: TstzRange;
  branchId?: string | undefined;
}): Promise<number> {
  const units = await findAvailableUnits({ ...params, limit: 1000 });
  return units.length;
}

export interface DayAvailability {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  availableUnits: number;
  totalUnits: number;
}

/**
 * Per-day availability for a calendar view.
 *
 * Computed in one query rather than N day-queries: `generate_series` produces
 * the days, and each is tested against the reservation and blackout ranges.
 */
export async function getAvailabilityCalendar(params: {
  classId: string;
  from: Date;
  to: Date;
  branchId?: string | undefined;
}): Promise<DayAvailability[]> {
  const { classId, from, to, branchId } = params;

  const rows = await db.execute<{ day: string; available_units: number; total_units: number }>(raw`
    WITH days AS (
      SELECT generate_series(
        date_trunc('day', ${from.toISOString()}::timestamptz),
        date_trunc('day', ${to.toISOString()}::timestamptz),
        '1 day'::interval
      ) AS day
    ),
    units AS (
      SELECT u.id
      FROM equipment_unit u
      JOIN branch b ON b.id = u.branch_id
      WHERE u.class_id = ${classId}
        AND u.is_active = TRUE
        AND b.is_active = TRUE
        AND u.status IN ('available', 'reserved', 'rented', 'in_transit')
        ${branchId ? raw`AND u.branch_id = ${branchId}` : raw``}
    )
    SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
           COUNT(*) FILTER (
             WHERE NOT EXISTS (
               SELECT 1 FROM reservation r
               WHERE r.unit_id = un.id
                 AND r.status IN ('held', 'confirmed', 'active')
                 AND (r.expires_at IS NULL OR r.expires_at > now())
                 AND r.period && tstzrange(d.day, d.day + interval '1 day')
             )
             AND NOT EXISTS (
               SELECT 1 FROM unit_blackout ub
               WHERE ub.unit_id = un.id
                 AND ub.period && tstzrange(d.day, d.day + interval '1 day')
             )
           )::int AS available_units,
           COUNT(*)::int AS total_units
    FROM days d
    CROSS JOIN units un
    GROUP BY d.day
    ORDER BY d.day
  `);

  return rows.map((r) => ({
    date: r.day,
    availableUnits: Number(r.available_units),
    totalUnits: Number(r.total_units),
  }));
}

export interface HoldResult {
  reservationId: string;
  unitId: string;
  expiresAt: Date;
}

/**
 * Place a time-boxed hold on a specific unit while the customer checks out.
 *
 * The hold participates in the exclusion constraint, so it genuinely blocks
 * other customers rather than merely hinting. If another transaction wins the
 * race, Postgres raises SQLSTATE 23P01 and we surface a clean
 * "no longer available" instead of trying to prevent the race ourselves.
 */
export async function holdUnit(params: {
  unitId: string;
  period: TstzRange;
  billableStart: Date;
  billableEnd: Date;
  holdMinutes: number;
  heldByToken: string;
}): Promise<HoldResult> {
  const expiresAt = new Date(Date.now() + params.holdMinutes * 60_000);
  const id = uuidv7();

  try {
    await db.execute(raw`
      INSERT INTO reservation
        (id, unit_id, booking_id, status, period, billable_start, billable_end, expires_at, held_by_token)
      VALUES
        (${id}, ${params.unitId}, NULL, 'held', ${rangeLiteral(params.period)}::tstzrange,
         ${params.billableStart.toISOString()}::timestamptz,
         ${params.billableEnd.toISOString()}::timestamptz,
         ${expiresAt.toISOString()}::timestamptz,
         ${params.heldByToken})
    `);
  } catch (error) {
    if (isExclusionViolation(error)) throw new UnitNoLongerAvailableError();
    throw error;
  }

  return { reservationId: id, unitId: params.unitId, expiresAt };
}

/**
 * Find any free unit of a class and hold it, trying candidates in turn.
 *
 * Under contention the first candidate can lose the race to another customer
 * between the read and the insert. Rather than failing, we move to the next
 * candidate — the exclusion violation is expected traffic here, not an error.
 */
export async function holdAnyAvailableUnit(params: {
  classId: string;
  period: TstzRange;
  billableStart: Date;
  billableEnd: Date;
  holdMinutes: number;
  heldByToken: string;
  branchId?: string | undefined;
}): Promise<HoldResult> {
  const candidates = await findAvailableUnits({
    classId: params.classId,
    period: params.period,
    branchId: params.branchId,
    limit: 10,
  });

  if (candidates.length === 0) throw new UnitNoLongerAvailableError();

  for (const candidate of candidates) {
    try {
      return await holdUnit({ ...params, unitId: candidate.unitId });
    } catch (error) {
      if (error instanceof UnitNoLongerAvailableError) continue;
      throw error;
    }
  }

  throw new UnitNoLongerAvailableError();
}

/** Release a hold — the customer abandoned checkout or changed their selection. */
export async function releaseHold(reservationId: string, heldByToken: string): Promise<void> {
  await db
    .update(reservations)
    .set({ status: "released" })
    .where(
      and(
        eq(reservations.id, reservationId),
        eq(reservations.heldByToken, heldByToken),
        eq(reservations.status, "held"),
      ),
    );
}

/**
 * Expire stale holds.
 *
 * Housekeeping only. Reads already treat an expired hold as released, so a late
 * or failed run of this job cannot cause a unit to be wrongly unavailable.
 */
export async function expireStaleHolds(): Promise<number> {
  const result = await db.execute<{ id: string }>(raw`
    UPDATE reservation
    SET status = 'expired'
    WHERE status = 'held'
      AND expires_at IS NOT NULL
      AND expires_at <= now()
    RETURNING id
  `);
  return result.length;
}

/** Fetch the buffer configuration a class needs to compute its occupied window. */
export async function getClassSchedulingConfig(classId: string): Promise<{
  mobilisationBufferDays: number;
  demobilisationBufferDays: number;
  minRentalDays: number;
} | null> {
  const [row] = await db
    .select({
      mobilisationBufferDays: equipmentClasses.mobilisationBufferDays,
      demobilisationBufferDays: equipmentClasses.demobilisationBufferDays,
      minRentalDays: equipmentClasses.minRentalDays,
    })
    .from(equipmentClasses)
    .where(eq(equipmentClasses.id, classId))
    .limit(1);
  return row ?? null;
}

/** Is this specific unit free for this period? Used when re-validating at commit. */
export async function isUnitAvailable(unitId: string, period: TstzRange): Promise<boolean> {
  const rows = await db.execute<{ ok: boolean }>(raw`
    SELECT NOT EXISTS (
      SELECT 1 FROM reservation r
      WHERE r.unit_id = ${unitId}
        AND r.status IN ('held', 'confirmed', 'active')
        AND (r.expires_at IS NULL OR r.expires_at > now())
        AND r.period && ${rangeLiteral(period)}::tstzrange
    ) AND NOT EXISTS (
      SELECT 1 FROM unit_blackout ub
      WHERE ub.unit_id = ${unitId}
        AND ub.period && ${rangeLiteral(period)}::tstzrange
    ) AND EXISTS (
      SELECT 1 FROM equipment_unit u
      WHERE u.id = ${unitId} AND u.is_active = TRUE
        AND u.status IN ('available', 'reserved', 'rented', 'in_transit')
    ) AS ok
  `);
  return rows[0]?.ok === true;
}

export { ACTIVE_RESERVATION_STATUSES };
