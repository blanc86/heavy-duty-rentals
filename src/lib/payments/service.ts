import { and, eq } from "drizzle-orm";
import { db, isUniqueViolation } from "@/lib/db";
import { bookings } from "@/lib/db/schema/booking";
import { payments, paymentWebhookEvents, refunds } from "@/lib/db/schema/finance";
import { uuidv7 } from "@/lib/ids";
import type { Halalas } from "@/lib/money";
import { transitionBooking } from "@/lib/booking/service";
import { sendBookingConfirmation } from "@/lib/notifications/service";
import { writeAudit } from "@/lib/server/audit";
import { getPaymentProvider } from "./index";
import type { PaymentIntent, VerifiedWebhookEvent } from "./types";

/**
 * Start payment for a booking.
 *
 * Creates exactly ONE intent at checkout: `rental_charge`, for
 * `taxableSubtotal + VAT`. The refundable deposit is NOT charged here and NOT
 * added to this amount.
 *
 * Why the deposit is not taken at checkout
 * ----------------------------------------
 * A deposit must be an authorization (a hold that is voided on clean return),
 * never a charge — it is not revenue and is outside the VAT base, so merging
 * it into the rental charge is a tax error as well as a trust one.
 *
 * But a hosted-page PSP can only redirect the customer to ONE page per
 * checkout, and an authorization against the same card afterwards needs a
 * stored card token, which requires tokenization to be enabled on a PSP
 * contract the business has not signed yet (docs/research.md §5).
 *
 * So the deposit is authorized at HANDOVER instead, on the depot terminal,
 * using `provider.createIntent({ mode: "authorize" })` and released with
 * `provider.void()` after the return inspection. That path is deliberately not
 * wired up here: it needs a settled PSP contract and the depot flow. Until it
 * is, the deposit is presented to the customer as authorised at handover — it
 * is never described as due now, and never included in the charged figure.
 *
 * See docs/FINAL_REVIEW.md — deposit authorization.
 */
export async function startPayment(params: {
  bookingId: string;
  customer: { email: string; name: string; phone?: string | undefined };
  returnUrl: string;
  locale: "en" | "ar";
}): Promise<{ rental: PaymentIntent; paymentId: string }> {
  const provider = getPaymentProvider();

  if (!provider.isConfigured) {
    throw new Error(
      `Payment provider "${provider.name}" is not configured. Card payment is unavailable.`,
    );
  }

  const [booking] = await db
    .select({
      id: bookings.id,
      reference: bookings.reference,
      status: bookings.status,
      taxableSubtotalHalalas: bookings.taxableSubtotalHalalas,
      vatHalalas: bookings.vatHalalas,
      depositHalalas: bookings.depositHalalas,
      totalHalalas: bookings.totalHalalas,
      currency: bookings.currency,
    })
    .from(bookings)
    .where(eq(bookings.id, params.bookingId))
    .limit(1);

  if (!booking) throw new Error("Booking not found.");
  if (booking.status !== "pending_payment") {
    throw new Error(`Booking ${booking.reference} is not awaiting payment.`);
  }

  // The rental charge excludes the deposit; the deposit is authorized separately.
  const rentalAmount = booking.taxableSubtotalHalalas + booking.vatHalalas;
  const paymentId = uuidv7();
  const idempotencyKey = `pay_${booking.id}_rental`;

  await db
    .insert(payments)
    .values({
      id: paymentId,
      bookingId: booking.id,
      kind: "rental_charge",
      provider: provider.name,
      status: "created",
      amountHalalas: rentalAmount,
      currency: booking.currency,
      idempotencyKey,
    })
    .onConflictDoNothing({ target: payments.idempotencyKey });

  // A retried start must reuse the existing row rather than orphaning it.
  const [row] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(eq(payments.idempotencyKey, idempotencyKey))
    .limit(1);
  const effectivePaymentId = row?.id ?? paymentId;

  const intent = await provider.createIntent({
    paymentId: effectivePaymentId,
    bookingReference: booking.reference,
    amountHalalas: rentalAmount,
    currency: booking.currency,
    description: `Equipment rental ${booking.reference}`,
    mode: "charge",
    customer: params.customer,
    returnUrl: params.returnUrl,
    idempotencyKey,
    locale: params.locale,
  });

  await db
    .update(payments)
    .set({ providerIntentId: intent.providerIntentId, updatedAt: new Date() })
    .where(eq(payments.id, effectivePaymentId));

  return { rental: intent, paymentId: effectivePaymentId };
}

export type WebhookOutcome =
  | { handled: true; result: string }
  | { handled: false; reason: string };

/**
 * PROCESS A VERIFIED WEBHOOK.
 *
 * The ONLY way a booking becomes `confirmed`. Client-reported payment status is
 * discarded entirely — a browser POSTing "I paid" changes nothing, because the
 * confirmation path starts from a signature the browser cannot produce.
 *
 * Defences applied here, in order:
 *   1. Signature verified by the caller before this is reached (the
 *      `VerifiedWebhookEvent` type can only be produced by `verifyWebhook`)
 *   2. REPLAY — a UNIQUE index on (provider, providerEventId); a duplicate
 *      violates it and is discarded rather than crediting twice
 *   3. AMOUNT and CURRENCY compared against the stored booking, so a
 *      tampered-but-validly-signed event still cannot underpay a rental
 */
export async function processWebhookEvent(
  providerName: string,
  event: VerifiedWebhookEvent,
): Promise<WebhookOutcome> {
  // --- 2. Replay defence ---------------------------------------------------
  const eventRowId = uuidv7();
  try {
    await db.insert(paymentWebhookEvents).values({
      id: eventRowId,
      provider: providerName,
      providerEventId: event.providerEventId,
      eventType: event.type,
      signatureVerified: true,
      payloadHash: event.rawPayloadHash,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { handled: false, reason: "duplicate_event" };
    }
    throw error;
  }

  const [payment] = await db
    .select({
      id: payments.id,
      bookingId: payments.bookingId,
      kind: payments.kind,
      status: payments.status,
      amountHalalas: payments.amountHalalas,
      currency: payments.currency,
    })
    .from(payments)
    .where(eq(payments.providerIntentId, event.providerIntentId))
    .limit(1);

  if (!payment) {
    await markEventProcessed(eventRowId, "unknown_intent");
    return { handled: false, reason: "unknown_intent" };
  }

  // --- 3. Amount and currency must match -----------------------------------
  // A signed event whose amount does not match the booking is either a
  // provider-side inconsistency or a compromised signing key. Either way it is
  // not a basis for confirming a rental.
  if (event.amountHalalas !== payment.amountHalalas || event.currency !== payment.currency) {
    await markEventProcessed(eventRowId, "amount_mismatch");
    await writeAudit({
      action: "payment.amount_mismatch",
      actorType: "webhook",
      resourceType: "payment",
      resourceId: payment.id,
      outcome: "denied",
      metadata: {
        expectedHalalas: payment.amountHalalas.toString(),
        receivedHalalas: event.amountHalalas.toString(),
        expectedCurrency: payment.currency,
        receivedCurrency: event.currency,
      },
    });
    return { handled: false, reason: "amount_mismatch" };
  }

  const now = new Date();

  switch (event.status) {
    case "captured": {
      await db
        .update(payments)
        .set({
          status: "captured",
          capturedHalalas: event.amountHalalas,
          providerChargeId: event.providerChargeId ?? null,
          method: event.method ?? null,
          last4: event.last4 ?? null,
          cardBrandLabel: event.cardBrandLabel ?? null,
          capturedAt: now,
          updatedAt: now,
        })
        .where(eq(payments.id, payment.id));

      if (payment.kind === "rental_charge") {
        // Compare-and-set: an out-of-order or replayed event cannot resurrect
        // a cancelled booking.
        const moved = await transitionBooking({
          bookingId: payment.bookingId,
          toStatus: "confirmed",
          expectedFrom: ["pending_payment"],
          actorType: "webhook",
          type: "payment.captured",
          metadata: { paymentId: payment.id, providerEventId: event.providerEventId },
        });

        // Confirmation email, gated on the transition ACTUALLY happening.
        // Payment providers retry webhooks, and `moved` is false on a replay,
        // so a customer receives exactly one confirmation however many times
        // the event is delivered. It cannot throw — see notifications/service.
        if (moved) {
          await sendBookingConfirmation(payment.bookingId);
        }
      }

      await writeAudit({
        action: "payment.captured",
        actorType: "webhook",
        resourceType: "payment",
        resourceId: payment.id,
        outcome: "success",
        metadata: { bookingId: payment.bookingId, amountHalalas: event.amountHalalas.toString() },
      });

      await markEventProcessed(eventRowId, "captured");
      return { handled: true, result: "captured" };
    }

    case "authorized": {
      await db
        .update(payments)
        .set({
          status: "authorized",
          providerChargeId: event.providerChargeId ?? null,
          method: event.method ?? null,
          last4: event.last4 ?? null,
          authorizedAt: now,
          updatedAt: now,
        })
        .where(eq(payments.id, payment.id));
      await markEventProcessed(eventRowId, "authorized");
      return { handled: true, result: "authorized" };
    }

    case "failed": {
      await db
        .update(payments)
        .set({
          status: "failed",
          failureCode: event.failureCode ?? null,
          failureMessage: event.failureMessage?.slice(0, 400) ?? null,
          updatedAt: now,
        })
        .where(eq(payments.id, payment.id));

      await writeAudit({
        action: "payment.failed",
        actorType: "webhook",
        resourceType: "payment",
        resourceId: payment.id,
        outcome: "failure",
        metadata: { bookingId: payment.bookingId, failureCode: event.failureCode ?? null },
      });

      // The booking stays `pending_payment` so the customer can retry with a
      // different card. Its reservation hold still protects the machine.
      await markEventProcessed(eventRowId, "failed");
      return { handled: true, result: "failed" };
    }

    case "voided": {
      await db
        .update(payments)
        .set({ status: "voided", voidedAt: now, updatedAt: now })
        .where(eq(payments.id, payment.id));
      await markEventProcessed(eventRowId, "voided");
      return { handled: true, result: "voided" };
    }

    default: {
      await markEventProcessed(eventRowId, `ignored_${event.status}`);
      return { handled: false, reason: `unhandled_status_${event.status}` };
    }
  }
}

async function markEventProcessed(eventRowId: string, result: string): Promise<void> {
  await db
    .update(paymentWebhookEvents)
    .set({ processedAt: new Date(), processingResult: result })
    .where(eq(paymentWebhookEvents.id, eventRowId));
}

/**
 * Record an unverifiable webhook for forensics WITHOUT acting on it.
 *
 * Silently dropping forged webhooks loses the signal that someone is
 * attempting forgery — a spike here is exactly what monitoring should alert on.
 */
export async function recordUnverifiedWebhook(
  providerName: string,
  payloadHash: string,
  reason: string,
): Promise<void> {
  await db
    .insert(paymentWebhookEvents)
    .values({
      id: uuidv7(),
      provider: providerName,
      // Namespaced so a forged event id cannot collide with a real one and
      // thereby suppress a genuine webhook via the replay defence.
      providerEventId: `unverified_${payloadHash.slice(0, 32)}`,
      eventType: "unverified",
      signatureVerified: false,
      payloadHash,
      processedAt: new Date(),
      processingResult: reason,
    })
    .onConflictDoNothing();

  await writeAudit({
    action: "payment.webhook_verification_failed",
    actorType: "webhook",
    resourceType: "payment_webhook",
    resourceId: payloadHash.slice(0, 32),
    outcome: "denied",
    metadata: { provider: providerName, reason },
  });
}

/**
 * Refund a captured rental charge, in whole or in part.
 *
 * Called when a booking is cancelled. The AMOUNT is decided by the caller from
 * the published cancellation tiers — this function moves money and records it,
 * it does not decide policy.
 *
 * Ordering matters. The refund row is written FIRST, in `pending`, so a refund
 * that reaches the provider but whose response is lost still leaves a record to
 * reconcile against. Losing money silently is worse than an unreconciled row.
 *
 * Idempotency is the `idempotencyKey` unique index: a retried cancellation
 * finds the existing row and returns it rather than refunding twice.
 */
export async function refundRentalCharge(params: {
  bookingId: string;
  amountHalalas: Halalas;
  reason: string;
  requestedByUserId?: string | null;
}): Promise<{ refunded: Halalas; status: "succeeded" | "pending" | "failed" | "skipped" }> {
  if (params.amountHalalas <= 0n) return { refunded: 0n, status: "skipped" };

  const [payment] = await db
    .select({
      id: payments.id,
      providerChargeId: payments.providerChargeId,
      providerIntentId: payments.providerIntentId,
      capturedHalalas: payments.capturedHalalas,
      refundedHalalas: payments.refundedHalalas,
    })
    .from(payments)
    .where(and(eq(payments.bookingId, params.bookingId), eq(payments.kind, "rental_charge")))
    .limit(1);

  // Nothing was ever captured — a booking cancelled before payment. Not an
  // error, and not something to invent a refund for.
  if (!payment || payment.capturedHalalas <= 0n) return { refunded: 0n, status: "skipped" };

  // Never refund more than remains. Clamping here means a policy bug cannot
  // become a payout larger than the customer ever paid.
  const remaining = payment.capturedHalalas - payment.refundedHalalas;
  const amount = params.amountHalalas > remaining ? remaining : params.amountHalalas;
  if (amount <= 0n) return { refunded: 0n, status: "skipped" };

  const idempotencyKey = `refund_${payment.id}_cancel`;
  const refundId = uuidv7();

  await db
    .insert(refunds)
    .values({
      id: refundId,
      paymentId: payment.id,
      amountHalalas: amount,
      reason: params.reason,
      status: "pending",
      requestedByUserId: params.requestedByUserId ?? null,
      idempotencyKey,
    })
    .onConflictDoNothing({ target: refunds.idempotencyKey });

  const [row] = await db
    .select({ id: refunds.id, status: refunds.status, amountHalalas: refunds.amountHalalas })
    .from(refunds)
    .where(eq(refunds.idempotencyKey, idempotencyKey))
    .limit(1);

  // A refund already settled for this cancellation: report it, do not repeat it.
  if (row && row.id !== refundId && row.status === "succeeded") {
    return { refunded: row.amountHalalas, status: "succeeded" };
  }

  const effectiveId = row?.id ?? refundId;
  const chargeId = payment.providerChargeId ?? payment.providerIntentId;
  if (!chargeId) {
    return { refunded: 0n, status: "pending" };
  }

  try {
    const result = await getPaymentProvider().refund({
      providerChargeId: chargeId,
      amountHalalas: amount,
      reason: params.reason,
      idempotencyKey,
    });

    await db
      .update(refunds)
      .set({ status: result.status, providerRefundId: result.providerRefundId })
      .where(eq(refunds.id, effectiveId));

    if (result.status === "succeeded") {
      const refundedTotal = payment.refundedHalalas + amount;
      await db
        .update(payments)
        .set({
          refundedHalalas: refundedTotal,
          status: refundedTotal >= payment.capturedHalalas ? "refunded" : "partially_refunded",
          updatedAt: new Date(),
        })
        .where(eq(payments.id, payment.id));

      await db
        .update(bookings)
        .set({ refundHalalas: refundedTotal, updatedAt: new Date() })
        .where(eq(bookings.id, params.bookingId));
    }

    return { refunded: result.status === "succeeded" ? amount : 0n, status: result.status };
  } catch (error) {
    // The booking is already cancelled and the machine already released. A
    // failed payout must not undo that — it stays `pending` for an operator to
    // retry, and is audited so it cannot be lost.
    await db.update(refunds).set({ status: "failed" }).where(eq(refunds.id, effectiveId));
    await writeAudit({
      action: "payment.refund_failed",
      actorUserId: params.requestedByUserId ?? null,
      actorType: "system",
      resourceType: "booking",
      resourceId: params.bookingId,
      outcome: "failure",
      metadata: {
        amountHalalas: amount.toString(),
        error: error instanceof Error ? error.message : "unknown",
      },
    });
    return { refunded: 0n, status: "failed" };
  }
}
