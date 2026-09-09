"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { UnitNoLongerAvailableError, findAvailableUnits, occupiedPeriod } from "@/lib/availability";
import { db } from "@/lib/db";
import { projectSites } from "@/lib/db/schema/identity";
import { parseHalalas } from "@/lib/money";
import { refundRentalCharge, startPayment } from "@/lib/payments/service";
import { quote } from "@/lib/pricing/repository";
import { getBookingForActor } from "@/lib/booking/repository";
import { findOrCreateGuestCustomer, resolveGuestBooking } from "@/lib/booking/guest";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import {
  createBooking,
  expireAbandonedCheckouts,
  transitionBooking,
} from "@/lib/booking/service";
import { canInCompany } from "@/lib/rbac";
import { guard, requireActor, toClientError } from "@/lib/server/guard";
import { getBusinessSettings, refundPercentForNotice } from "@/lib/settings";
import { env } from "@/lib/env";

/**
 * Statuses a CUSTOMER may cancel from.
 *
 * `active` is deliberately absent: once the machine is on site, ending the hire
 * is an off-hire with a collection to arrange, not a cancellation.
 */
const CANCELLABLE_STATUSES = ["pending_payment", "confirmed"] as const;

export type BookingActionResult =
  | { ok: true; reference: string; bookingId: string; redirectUrl: string }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        issues?: { path: string; message: string }[];
      };
    };

const createBookingSchema = z
  .object({
    classId: z.uuid(),
    branchId: z.uuid().optional(),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    quantity: z.number().int().min(1).max(5).default(1),

    addons: z
      .array(z.object({ code: z.string().max(40), quantity: z.number().int().min(1).max(10) }))
      .max(10)
      .default([]),

    deliveryRequired: z.boolean(),
    deliveryDistanceKm: z.number().int().min(0).max(3000).optional(),
    couponCode: z.string().max(40).optional(),

    // WHO IS BOOKING. Previously taken from the signed-in account; customers
    // no longer have one, so the checkout collects it. These are the details
    // the depot will actually call, and the email the customer will use to
    // find this booking again.
    customerName: z.string().min(2).max(200).trim(),
    customerEmail: z.email().max(320),
    customerPhone: z.string().min(6).max(32).trim().optional(),

    siteCity: z.string().min(2).max(80).trim(),
    siteAddressLine: z.string().min(5).max(500).trim(),
    siteContactName: z.string().min(2).max(160).trim(),
    siteContactPhone: z.string().min(6).max(32).trim(),
    siteAccessNotes: z.string().max(2000).trim().optional(),

    companyId: z.uuid().optional(),
    projectSiteId: z.uuid().optional(),
    poNumber: z.string().max(80).trim().optional(),
    costCentre: z.string().max(80).trim().optional(),
    projectCode: z.string().max(80).trim().optional(),

    /**
     * The total the browser BELIEVES it is committing to.
     *
     * Never written to the booking. It exists only so the server can detect a
     * disagreement between what the customer was shown and what the rates
     * actually produce — see `createBooking`, which recomputes and compares.
     */
    clientTotalHalalas: z.string().regex(/^\d+$/),

    acceptedTerms: z.literal(true),
    locale: z.enum(["en", "ar"]).default("en"),

    /** Retry-safe: the same key returns the original booking. */
    idempotencyKey: z.string().min(8).max(80),
  })
  .strict();

export async function createBookingAction(input: unknown): Promise<BookingActionResult> {
  try {
    return await guard(
      input,
      {
        schema: createBookingSchema,
        // NO ACCOUNT REQUIRED. Making a contractor register before they can
        // hire a machine costs bookings, and the account was never doing work
        // the business needed — identity is checked at handover and the money
        // is checked by the card. A `user` row is still created behind the
        // scenes, keyed on email, so ownership scoping and repeat-customer
        // grouping work exactly as before.
        rateLimit: { name: "bookingCreate" },
        audit: { action: "booking.create_attempt", resourceType: "booking" },
      },
      async ({ input: data, actor: maybeActor, ip }) => {
        const startDate = new Date(`${data.startDate}T00:00:00.000Z`);
        const endDate = new Date(`${data.endDate}T00:00:00.000Z`);
        if (endDate <= startDate) {
          return {
            ok: false as const,
            error: { code: "invalid_dates", message: "The end date must be after the start date." },
          };
        }

        // --- Tenant authorization -----------------------------------------
        // A company id from the request means nothing on its own. Membership
        // is resolved from the SESSION actor, so a customer cannot book on
        // another company's account by editing a hidden field.
        //
        // A GUEST has no session and therefore no memberships, so supplying
        // either of these is refused outright rather than ignored. Ignoring a
        // field an attacker set is how it ends up honoured by a later refactor.
        if ((data.companyId || data.projectSiteId) && !maybeActor) {
          return {
            ok: false as const,
            error: {
              code: "forbidden",
              message: "Sign in to book on a company account.",
            },
          };
        }
        const actor = maybeActor;

        if (data.companyId && (!actor || !canInCompany(actor, data.companyId, "booking:create"))) {
          return {
            ok: false as const,
            error: {
              code: "forbidden",
              message: "You do not have permission to book for that company.",
            },
          };
        }

        // A project site must belong to the actor's own company (or to the
        // actor personally) — otherwise it is another tenant's data.
        if (data.projectSiteId) {
          const [site] = await db
            .select({ companyId: projectSites.companyId, ownerUserId: projectSites.ownerUserId })
            .from(projectSites)
            .where(eq(projectSites.id, data.projectSiteId))
            .limit(1);

          const permitted =
            site &&
            actor &&
            (site.ownerUserId === actor.userId ||
              (site.companyId !== null && canInCompany(actor, site.companyId, "site:read")));

          if (!permitted) {
            // 404-shaped rather than 403: a site the actor cannot see should
            // not be confirmed to exist.
            return {
              ok: false as const,
              error: { code: "not_found", message: "That project site was not found." },
            };
          }
        }

        // --- Resolve a specific physical unit ------------------------------
        const { classInfo } = await quote({
          classId: data.classId,
          branchId: data.branchId,
          startDate,
          endDate,
          quantity: data.quantity,
          addons: data.addons,
          deliveryRequired: data.deliveryRequired,
          deliveryDistanceKm: data.deliveryDistanceKm,
          couponCode: data.couponCode,
        });

        const period = occupiedPeriod(
          startDate,
          endDate,
          classInfo.mobilisationBufferDays,
          classInfo.demobilisationBufferDays,
        );

        // Clear lapsed holds before looking for a machine.
        //
        // Reads already ignore an expired hold, but the exclusion constraint
        // does not: its predicate is `status IN ('held','confirmed','active')`
        // with no expiry term, so a lapsed row still rejects the insert. Without
        // this, availability would say "1 free" and the booking would fail with
        // "no longer available" for a machine that genuinely is. Done here, on
        // the write path, rather than on every read — and it is idempotent, so
        // a scheduled sweeper remains a fine addition, not a prerequisite.
        await expireAbandonedCheckouts();

        const candidates = await findAvailableUnits({
          classId: data.classId,
          period,
          branchId: data.branchId,
          limit: 5,
        });

        if (candidates.length === 0) {
          return {
            ok: false as const,
            error: {
              code: "unit_no_longer_available",
              message: "That machine is no longer available for these dates.",
            },
          };
        }

        const business = await getBusinessSettings();

        // The customer record. A signed-in actor books as themselves; a guest
        // is found or created by email, which is what keeps
        // `booking.customer_user_id` NOT NULL and every scoped read unchanged.
        const customer = actor
          ? { userId: actor.userId, isGuest: false }
          : await findOrCreateGuestCustomer({
              email: data.customerEmail,
              fullName: data.customerName,
              phone: data.customerPhone,
              locale: data.locale,
            });
        const customerUserId = customer.userId;

        // --- Commit --------------------------------------------------------
        // Try each candidate in turn: losing the exclusion-constraint race to
        // another customer is ordinary traffic under contention, not an error.
        let created: Awaited<ReturnType<typeof createBooking>> | null = null;
        let lastError: unknown = null;

        for (const candidate of candidates) {
          try {
            created = await createBooking({
              classId: data.classId,
              branchId: data.branchId,
              startDate,
              endDate,
              quantity: data.quantity,
              addons: data.addons,
              deliveryRequired: data.deliveryRequired,
              deliveryDistanceKm: data.deliveryDistanceKm,
              couponCode: data.couponCode,

              unitId: candidate.unitId,
              customerUserId,
              companyId: data.companyId ?? null,
              projectSiteId: data.projectSiteId ?? null,
              locale: data.locale,

              siteCity: data.siteCity,
              siteAddressLine: data.siteAddressLine,
              siteContactName: data.siteContactName,
              siteContactPhone: data.siteContactPhone,
              siteAccessNotes: data.siteAccessNotes,

              poNumber: data.poNumber,
              costCentre: data.costCentre,
              projectCode: data.projectCode,

              clientTotalHalalas: parseHalalas(data.clientTotalHalalas),
              termsVersion: business.termsVersion,
              termsAcceptedIp: ip ?? null,
              idempotencyKey: data.idempotencyKey,
            });
            break;
          } catch (error) {
            if (error instanceof UnitNoLongerAvailableError) {
              lastError = error;
              continue;
            }
            throw error;
          }
        }

        if (!created) {
          throw lastError ?? new UnitNoLongerAvailableError();
        }

        // --- Guest access ----------------------------------------------------
        // A guest gets a session scoped to the booking they just made, so the
        // payment return lands on their rental instead of a lookup form asking
        // for a reference they were shown ten seconds ago.
        //
        // It grants nothing beyond this one booking (see `scopeFor`) and lasts
        // hours, not weeks. Skipped for a signed-in actor, who already has a
        // full session that this would replace with a narrower one.
        // `customer.isGuest` and not merely `!actor`: the email typed at
        // checkout may belong to an account that already exists, and a session
        // carrying THAT person's user id must never be handed to whoever typed
        // their address. Those bookings are reached by signing in.
        if (customer.isGuest) {
          const session = await createSession({
            userId: customerUserId,
            ipAddress: ip,
            scopedBookingId: created.bookingId,
          });
          await setSessionCookie(session.token, session.expiresAt);
        }

        // --- Payment -------------------------------------------------------
        // Started AFTER the booking transaction has committed. Holding a
        // database transaction open across a call to a payment provider is how
        // systems deadlock under load.
        const returnUrl = new URL(
          `/${data.locale}/booking/${created.reference}`,
          env.APP_URL,
        ).toString();

        try {
          const payment = await startPayment({
            bookingId: created.bookingId,
            // The details the PROVIDER gets are the ones given at checkout,
            // which for a guest is the only identity there is.
            customer: {
              email: actor?.email ?? data.customerEmail,
              name: actor?.fullName ?? data.customerName,
            },
            returnUrl,
            locale: data.locale,
          });

          return {
            ok: true as const,
            reference: created.reference,
            bookingId: created.bookingId,
            redirectUrl: payment.rental.redirectUrl ?? returnUrl,
          };
        } catch {
          // The booking exists and holds the machine; only the payment
          // handoff failed. Sending the customer to the booking page lets them
          // retry payment rather than losing the reservation.
          return {
            ok: true as const,
            reference: created.reference,
            bookingId: created.bookingId,
            redirectUrl: returnUrl,
          };
        }
      },
    );
  } catch (error) {
    return { ok: false, error: toClientError(error) };
  }
}

const cancelBookingSchema = z
  .object({
    reference: z.string().min(4).max(40),
    locale: z.enum(["en", "ar"]).default("en"),
  })
  .strict();

export type CancelResult =
  | { ok: true; refundedHalalas: string; refundPercent: number; refundPending: boolean }
  | { ok: false; error: { code: string; message: string } };

/**
 * Cancel a booking the actor owns.
 *
 * A platform whose premise is "book online without phoning anyone" has to let
 * people UN-book the same way. Until this existed, `transitionBooking` could
 * cancel, the cancellation policy was published, the rental agreement quoted
 * the customer their refund entitlement — and there was no way to act on any
 * of it. A machine held by a booking nobody could cancel also stayed out of
 * inventory, so this is a fleet-utilisation problem as much as a UX one.
 *
 * The refund percentage comes from the SAME settings the published policy page
 * and the rental agreement render from, so the customer cannot be quoted one
 * schedule and charged against another.
 *
 * Order is deliberate: release the machine first, refund second. A refund that
 * fails must not leave a cancelled customer holding a crane, and the refund row
 * survives as `pending` for an operator to retry.
 */
export async function cancelBookingAction(input: unknown): Promise<CancelResult> {
  try {
    return await guard(
      input,
      {
        schema: cancelBookingSchema,
        requireAuth: true,
        // A guest who looked up their booking may cancel it. The scoped read
        // below still narrows to the one booking their session names, so this
        // widens nothing beyond the rental they already proved they hold.
        allowScopedSession: true,
        rateLimit: { name: "bookingCreate" },
        audit: { action: "booking.cancel", resourceType: "booking" },
      },
      async ({ input: data, actor: maybeActor }) => {
        const actor = requireActor(maybeActor);

        // Scoped read: a booking the actor cannot see does not exist to them.
        const booking = await getBookingForActor(actor, data.reference, data.locale);
        if (!booking) {
          return {
            ok: false as const,
            error: { code: "not_found", message: "That booking was not found." },
          };
        }

        if (!(CANCELLABLE_STATUSES as readonly string[]).includes(booking.status)) {
          return {
            ok: false as const,
            error: {
              code: "not_cancellable",
              message: "This booking can no longer be cancelled online. Please contact us.",
            },
          };
        }

        const business = await getBusinessSettings();
        const hoursNotice = Math.max(
          0,
          (booking.startDate.getTime() - Date.now()) / (1000 * 60 * 60),
        );
        const refundPercent = refundPercentForNotice(business.cancellationTiers, hoursNotice);

        // Release the machine. A compare-and-set, so a double submit or a race
        // with an admin cancelling the same booking resolves to one transition.
        const moved = await transitionBooking({
          bookingId: booking.id,
          toStatus: "cancelled",
          expectedFrom: CANCELLABLE_STATUSES,
          actorUserId: actor.userId,
          actorType: "customer",
          type: "booking.cancelled_by_customer",
          metadata: {
            hoursNotice: Math.round(hoursNotice),
            refundPercent,
            termsVersion: business.termsVersion,
          },
        });

        if (!moved) {
          return {
            ok: false as const,
            error: {
              code: "not_cancellable",
              message: "This booking can no longer be cancelled online. Please contact us.",
            },
          };
        }

        // Percentage of what was actually CHARGED, not of the total — the total
        // includes a deposit that was never collected online.
        const charged = booking.taxableSubtotalHalalas + booking.vatHalalas;
        const refundAmount = (charged * BigInt(refundPercent)) / 100n;

        const refund = await refundRentalCharge({
          bookingId: booking.id,
          amountHalalas: refundAmount,
          reason: `Cancelled by customer with ${Math.round(hoursNotice)}h notice (${refundPercent}%)`,
          requestedByUserId: actor.userId,
        });

        return {
          ok: true as const,
          refundedHalalas: refund.refunded.toString(),
          refundPercent,
          // Told, not hidden: the booking is cancelled either way, but the
          // customer must know whether the money has actually moved.
          refundPending: refund.status === "pending" || refund.status === "failed",
        };
      },
    );
  } catch (error) {
    return { ok: false, error: toClientError(error) };
  }
}

const lookupSchema = z
  .object({
    reference: z.string().min(4).max(40).trim(),
    email: z.email().max(320),
    locale: z.enum(["en", "ar"]).default("en"),
  })
  .strict();

export type LookupResult =
  | { ok: true; redirectTo: string }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        /** Per-field validation problems. Never says which half was wrong. */
        issues?: { path: string; message: string }[];
        retryAfterSeconds?: number;
      };
    };

/**
 * Find my booking — the guest replacement for signing in.
 *
 * Customers have no accounts, so this is how someone returns to their own
 * rental to see the invoice, download the agreement, or cancel.
 *
 * Both the reference and the email are required. The reference alone is about
 * a billion combinations, which is guessable given time, and a correct guess
 * would expose a name, a phone number and a site address. Requiring the email
 * makes a guessed reference worthless on its own.
 *
 * The failure message is IDENTICAL for "no such reference" and "wrong email".
 * Distinguishing them would turn this form into an oracle for which references
 * exist — the same disclosure the booking pages avoid by answering 404 rather
 * than 403.
 */
export async function lookupBookingAction(input: unknown): Promise<LookupResult> {
  try {
    return await guard(
      input,
      {
        schema: lookupSchema,
        // Rate limited because this is a guessing surface by construction.
        rateLimit: { name: "login" },
        audit: { action: "booking.guest_lookup", resourceType: "booking" },
      },
      async ({ input: data, ip }) => {
        const match = await resolveGuestBooking(data.reference, data.email);

        if (!match) {
          return {
            ok: false as const,
            error: {
              code: "not_found",
              // ONE message for every failure: no such reference, wrong email,
              // and "that address has a real account, so this booking is
              // reached by signing in" are indistinguishable here on purpose.
              // The sign-in sentence is shown in all three cases, so it guides
              // the account holder out of a dead end without telling anyone
              // else which case they hit.
              message:
                "We could not find a booking with that reference and email address. " +
                "Check the reference on your confirmation. If you have an account with us, sign in instead.",
            },
          };
        }

        // A session that can see this booking and nothing else, for four hours.
        const session = await createSession({
          userId: match.customerUserId,
          ipAddress: ip,
          scopedBookingId: match.bookingId,
        });
        await setSessionCookie(session.token, session.expiresAt);

        return {
          ok: true as const,
          redirectTo: `/${data.locale}/booking/${data.reference.trim().toUpperCase()}`,
        };
      },
    );
  } catch (error) {
    return { ok: false, error: toClientError(error) };
  }
}
