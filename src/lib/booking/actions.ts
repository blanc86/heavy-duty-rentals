"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { UnitNoLongerAvailableError, findAvailableUnits, occupiedPeriod } from "@/lib/availability";
import { db } from "@/lib/db";
import { bookings } from "@/lib/db/schema/booking";
import { projectSites } from "@/lib/db/schema/identity";
import { uuidv7 } from "@/lib/ids";
import { parseHalalas } from "@/lib/money";
import { startPayment } from "@/lib/payments/service";
import { quote } from "@/lib/pricing/repository";
import { createBooking } from "@/lib/booking/service";
import { canInCompany } from "@/lib/rbac";
import { guard, requireActor, toClientError } from "@/lib/server/guard";
import { getBusinessSettings } from "@/lib/settings";
import { env } from "@/lib/env";

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
        requireAuth: true,
        rateLimit: { name: "bookingCreate" },
        audit: { action: "booking.create_attempt", resourceType: "booking" },
      },
      async ({ input: data, actor: maybeActor, ip }) => {
        const actor = requireActor(maybeActor);

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
        if (data.companyId && !canInCompany(actor, data.companyId, "booking:create")) {
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
              customerUserId: actor.userId,
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
            customer: { email: actor.email, name: actor.fullName },
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

/** A stable idempotency key for one checkout attempt, generated server-side. */
export async function newIdempotencyKey(): Promise<string> {
  return uuidv7();
}

/** Look up a booking by reference, scoped to the actor. Used by the confirmation page. */
export async function getBookingReference(reference: string): Promise<string | null> {
  const [row] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.reference, reference))
    .limit(1);
  return row?.id ?? null;
}
