"use server";

import { eq, sql as raw } from "drizzle-orm";
import { z } from "zod";
import { db, parseTimestamp } from "@/lib/db";
import { equipmentUnits, unitBlackouts } from "@/lib/db/schema/inventory";
import { uuidv7 } from "@/lib/ids";
import { guard, requireActor, toClientError } from "@/lib/server/guard";

/**
 * Taking a machine out of service.
 *
 * `equipment_unit.status` and `unit_blackout` were both READ by the booking
 * path from the beginning — `createBooking` refuses a unit in `maintenance` or
 * `out_of_service`, and `findAvailableUnits` excludes any unit with an
 * overlapping blackout. Neither was ever WRITTEN by anything. So a crane that
 * threw a hydraulic line kept accepting online bookings, and the depot had to
 * phone customers to cancel them — which is the exact failure the platform
 * exists to remove.
 *
 * Both actions report what they COLLIDE with rather than silently creating a
 * conflict. An operator taking a machine off the road needs to know it has
 * three bookings stacked behind it; discovering that later, one angry phone
 * call at a time, is how a fleet loses customers.
 */

export type InventoryResult =
  | { ok: true; affectedBookings: { reference: string; startDate: string; status: string }[] }
  | { ok: false; error: { code: string; message: string } };

/**
 * Bookings this change would collide with.
 *
 * Reported, never auto-cancelled: releasing a customer's machine is a decision
 * with money and a phone call attached, and it belongs to a person.
 */
async function collidingBookings(unitId: string, from?: Date, to?: Date) {
  const rows = await db.execute<{ reference: string; start_date: string; status: string }>(raw`
    SELECT b.reference, b.start_date, b.status
    FROM reservation r
    JOIN booking b ON b.id = r.booking_id
    WHERE r.unit_id = ${unitId}
      AND r.status IN ('held', 'confirmed', 'active')
      AND (r.expires_at IS NULL OR r.expires_at > now())
      AND b.status IN ('pending_payment', 'confirmed', 'active')
      ${
        from && to
          ? raw`AND r.period && ${`[${from.toISOString()},${to.toISOString()})`}::tstzrange`
          : raw``
      }
    ORDER BY b.start_date
    LIMIT 20
  `);

  return rows.map((r) => ({
    reference: r.reference,
    // `parseTimestamp`, not hand-rolled parsing: raw `db.execute` returns a
    // timestamptz as a string in Postgres's own rendering, which is not valid
    // ISO 8601. Re-deriving that here is how the two drift apart.
    startDate: parseTimestamp(r.start_date).toISOString().slice(0, 10),
    status: r.status,
  }));
}

const setStatusSchema = z
  .object({
    unitId: z.uuid(),
    status: z.enum(["available", "maintenance", "inspection", "out_of_service"]),
  })
  .strict();

/**
 * Change a unit's operational status.
 *
 * Only the statuses an operator sets by hand are accepted. `reserved`,
 * `rented` and `in_transit` describe where the machine is in a rental and are
 * derived from bookings — letting someone type those in by hand would put the
 * fleet's state and its bookings out of step with no way to tell which is true.
 */
export async function setUnitStatusAction(input: unknown): Promise<InventoryResult> {
  try {
    return await guard(
      input,
      {
        schema: setStatusSchema,
        requireAdmin: "admin:inventory",
        requireMfa: true,
        rateLimit: { name: "api" },
        audit: { action: "unit.set_status", resourceType: "equipment_unit" },
      },
      async ({ input: data }) => {
        const [unit] = await db
          .select({ id: equipmentUnits.id })
          .from(equipmentUnits)
          .where(eq(equipmentUnits.id, data.unitId))
          .limit(1);

        if (!unit) {
          return {
            ok: false as const,
            error: { code: "not_found", message: "That machine was not found." },
          };
        }

        await db
          .update(equipmentUnits)
          .set({ status: data.status, updatedAt: new Date() })
          .where(eq(equipmentUnits.id, data.unitId));

        // Only meaningful when the machine is going OUT; coming back into
        // service collides with nothing.
        const affectedBookings =
          data.status === "available" ? [] : await collidingBookings(data.unitId);

        return { ok: true as const, affectedBookings };
      },
    );
  } catch (error) {
    return { ok: false, error: toClientError(error) };
  }
}

const blackoutSchema = z
  .object({
    unitId: z.uuid(),
    reason: z.enum(["maintenance", "inspection", "transport", "out_of_service", "other"]),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    notes: z.string().max(500).trim().optional(),
  })
  .strict();

/**
 * Block a date range on one machine.
 *
 * A blackout is how a scheduled service or a statutory inspection keeps the
 * machine off the market for a window without taking it out of service
 * entirely. `findAvailableUnits` already excludes any unit with an overlapping
 * blackout, so this takes effect on the next search with no other wiring.
 */
export async function addUnitBlackoutAction(input: unknown): Promise<InventoryResult> {
  try {
    return await guard(
      input,
      {
        schema: blackoutSchema,
        requireAdmin: "admin:inventory",
        requireMfa: true,
        rateLimit: { name: "api" },
        audit: { action: "unit.blackout_created", resourceType: "equipment_unit" },
      },
      async ({ input: data, actor: maybeActor }) => {
        const actor = requireActor(maybeActor);

        const start = new Date(`${data.startDate}T00:00:00.000Z`);
        const end = new Date(`${data.endDate}T00:00:00.000Z`);
        if (end <= start) {
          return {
            ok: false as const,
            error: { code: "invalid_dates", message: "The end date must be after the start date." },
          };
        }

        const [unit] = await db
          .select({ id: equipmentUnits.id })
          .from(equipmentUnits)
          .where(eq(equipmentUnits.id, data.unitId))
          .limit(1);

        if (!unit) {
          return {
            ok: false as const,
            error: { code: "not_found", message: "That machine was not found." },
          };
        }

        // Collisions are read BEFORE the blackout is written, so the operator is
        // told about bookings that already existed rather than about the state
        // they have just created.
        const affectedBookings = await collidingBookings(data.unitId, start, end);

        await db.insert(unitBlackouts).values({
          id: uuidv7(),
          unitId: data.unitId,
          period: { start, end },
          reason: data.reason,
          notes: data.notes ?? null,
          createdByUserId: actor.userId,
        });

        return { ok: true as const, affectedBookings };
      },
    );
  } catch (error) {
    return { ok: false, error: toClientError(error) };
  }
}
