"use server";

import { z } from "zod";
import { transitionBooking } from "@/lib/booking/service";
import { db } from "@/lib/db";
import { bookings } from "@/lib/db/schema/booking";
import { eq } from "drizzle-orm";
import { refundRentalCharge } from "@/lib/payments/service";
import { guard, requireActor, toClientError } from "@/lib/server/guard";

/**
 * Operational transitions — the half of the booking lifecycle that happens
 * off the website.
 *
 * `booking_status` has always had `active` and `completed`, and
 * `transitionBooking` has always been able to reach them. Nothing ever did:
 * the only transitions in the codebase were `confirmed` (from the payment
 * webhook) and `cancelled`. So every rental stayed `confirmed` for ever, no
 * machine was ever recorded as being out, and the dashboard's "Active rentals"
 * and "Returns due" tiles were structurally pinned at zero.
 *
 * These are the events a depot actually generates: the machine went out, the
 * machine came back, and sometimes the job is called off from our side.
 *
 * Every one re-checks authorization through `guard` rather than trusting the
 * admin layout. A layout protects rendering, not mutations, and a Server Action
 * is reachable without ever loading the page that renders its button.
 */

const referenceSchema = z.object({ reference: z.string().min(4).max(40) }).strict();

export type AdminBookingResult =
  | { ok: true; status: string }
  | { ok: false; error: { code: string; message: string } };

async function bookingIdFor(reference: string): Promise<string | null> {
  const [row] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.reference, reference))
    .limit(1);
  return row?.id ?? null;
}

/**
 * The machine has left the depot.
 *
 * Only from `confirmed`: a rental that has not been paid for is not a machine
 * anyone should be releasing, and the compare-and-set in `transitionBooking`
 * enforces that rather than trusting the caller to have checked.
 */
export async function markOnHireAction(input: unknown): Promise<AdminBookingResult> {
  return runTransition(input, {
    to: "active",
    from: ["confirmed"],
    type: "booking.on_hire",
    auditAction: "booking.mark_on_hire",
  });
}

/** The machine is back. Ends the hire; the deposit is released after inspection. */
export async function markReturnedAction(input: unknown): Promise<AdminBookingResult> {
  return runTransition(input, {
    to: "completed",
    from: ["active"],
    type: "booking.returned",
    auditAction: "booking.mark_returned",
  });
}

/**
 * Cancel from our side — a breakdown, a failed inspection, a site we cannot
 * reach.
 *
 * Refunds in FULL regardless of notice. The cancellation tiers price the
 * customer's change of mind; when the supplier cancels, charging a penalty for
 * our own failure would be indefensible.
 */
export async function adminCancelBookingAction(input: unknown): Promise<AdminBookingResult> {
  try {
    return await guard(
      input,
      {
        schema: referenceSchema,
        // `admin:refund` rather than `admin:booking`: this cancels AND moves
        // money back to the customer, and the money is the sharper privilege.
        requireAdmin: "admin:refund",
        requireMfa: true,
        rateLimit: { name: "api" },
        audit: { action: "booking.admin_cancel", resourceType: "booking" },
      },
      async ({ input: data, actor: maybeActor }) => {
        const actor = requireActor(maybeActor);
        const bookingId = await bookingIdFor(data.reference);
        if (!bookingId) {
          return {
            ok: false as const,
            error: { code: "not_found", message: "That booking was not found." },
          };
        }

        const moved = await transitionBooking({
          bookingId,
          toStatus: "cancelled",
          expectedFrom: ["pending_payment", "confirmed", "active"],
          actorUserId: actor.userId,
          actorType: "admin",
          type: "booking.cancelled_by_operator",
          metadata: { refundPercent: 100, reason: "operator_cancelled" },
        });

        if (!moved) {
          return {
            ok: false as const,
            error: { code: "invalid_state", message: "This booking cannot be cancelled." },
          };
        }

        const [booking] = await db
          .select({
            taxableSubtotalHalalas: bookings.taxableSubtotalHalalas,
            vatHalalas: bookings.vatHalalas,
          })
          .from(bookings)
          .where(eq(bookings.id, bookingId))
          .limit(1);

        if (booking) {
          await refundRentalCharge({
            bookingId,
            amountHalalas: booking.taxableSubtotalHalalas + booking.vatHalalas,
            reason: "Cancelled by operator — full refund",
            requestedByUserId: actor.userId,
          });
        }

        return { ok: true as const, status: "cancelled" };
      },
    );
  } catch (error) {
    return { ok: false, error: toClientError(error) };
  }
}

async function runTransition(
  input: unknown,
  spec: {
    to: "active" | "completed";
    from: readonly string[];
    type: string;
    auditAction: string;
  },
): Promise<AdminBookingResult> {
  try {
    return await guard(
      input,
      {
        schema: referenceSchema,
        // `admin:booking`, not `booking:approve`. The `booking:*` permissions
        // are COMPANY permissions — what a customer's own procurement manager
        // holds over their own bookings. A platform admin holds the `admin:*`
        // set, and `canAdmin` checks membership of exactly that set, so asking
        // for a company permission here refuses every real operator.
        requireAdmin: "admin:booking",
        requireMfa: true,
        rateLimit: { name: "api" },
        audit: { action: spec.auditAction, resourceType: "booking" },
      },
      async ({ input: data, actor: maybeActor }) => {
        const actor = requireActor(maybeActor);
        const bookingId = await bookingIdFor(data.reference);
        if (!bookingId) {
          return {
            ok: false as const,
            error: { code: "not_found", message: "That booking was not found." },
          };
        }

        const moved = await transitionBooking({
          bookingId,
          toStatus: spec.to,
          expectedFrom: spec.from,
          actorUserId: actor.userId,
          actorType: "admin",
          type: spec.type,
        });

        if (!moved) {
          return {
            ok: false as const,
            error: {
              code: "invalid_state",
              message: `This booking cannot move to ${spec.to} from its current status.`,
            },
          };
        }

        return { ok: true as const, status: spec.to };
      },
    );
  } catch (error) {
    return { ok: false, error: toClientError(error) };
  }
}
