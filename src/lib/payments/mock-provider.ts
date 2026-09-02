import { createHmac } from "node:crypto";
import { safeEqual, sha256 } from "@/lib/auth/crypto";
import { env } from "@/lib/env";
import type { Halalas } from "@/lib/money";
import {
  PaymentProviderError,
  WebhookVerificationError,
  type CreateIntentInput,
  type PaymentIntent,
  type PaymentProvider,
  type PaymentResult,
  type RefundInput,
  type RefundResult,
  type VerifiedWebhookEvent,
} from "./types";

/**
 * MOCK PAYMENT PROVIDER — development and tests only.
 *
 * IT MOVES NO MONEY. `src/lib/env.ts` refuses to boot in production with
 * PAYMENT_PROVIDER=mock, so this cannot be deployed by accident.
 *
 * It exists so the full booking → payment → webhook → confirmation path can be
 * exercised end to end without a merchant account. Crucially, it implements the
 * SAME contract as the real adapter, including HMAC webhook signing — so the
 * webhook verification logic under test is the logic that will run in
 * production, not a bypass.
 *
 * Deterministic behaviour by amount, so tests can drive failure paths:
 *   - amount ending in 01 halalas  -> declined
 *   - amount ending in 02 halalas  -> requires_action (3-D Secure)
 *   - anything else                -> succeeds
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";
  readonly isConfigured = true;
  readonly supportedMethods = ["mada", "visa", "mastercard", "apple_pay"] as const;

  private readonly intents = new Map<
    string,
    { input: CreateIntentInput; status: PaymentResult["status"]; captured: Halalas }
  >();

  private webhookSecret(): string {
    return env.APP_SECRET ?? "mock-webhook-secret-development-only";
  }

  async createIntent(input: CreateIntentInput): Promise<PaymentIntent> {
    const providerIntentId = `mock_int_${sha256(input.idempotencyKey).slice(0, 24)}`;

    // Idempotency: the same key must return the same intent, never a new one.
    const existing = this.intents.get(providerIntentId);
    if (existing) {
      return {
        providerIntentId,
        status: existing.status === "captured" ? "captured" : "created",
        redirectUrl: this.redirectUrl(providerIntentId, input),
      };
    }

    const tail = Number(input.amountHalalas % 100n);
    const status = tail === 1 ? "failed" : tail === 2 ? "requires_action" : "created";

    this.intents.set(providerIntentId, { input, status, captured: 0n });

    if (status === "failed") {
      throw new PaymentProviderError("The card was declined.", "card_declined");
    }

    return {
      providerIntentId,
      status,
      redirectUrl: this.redirectUrl(providerIntentId, input),
    };
  }

  private redirectUrl(providerIntentId: string, input: CreateIntentInput): string {
    const url = new URL("/api/payments/mock/checkout", env.APP_URL);
    url.searchParams.set("intent", providerIntentId);
    url.searchParams.set("return", input.returnUrl);
    return url.toString();
  }

  async capture(providerIntentId: string, amountHalalas: Halalas): Promise<PaymentResult> {
    const intent = this.intents.get(providerIntentId);
    if (!intent) throw new PaymentProviderError("Unknown intent.", "intent_not_found");
    if (amountHalalas > intent.input.amountHalalas) {
      throw new PaymentProviderError("Capture exceeds authorized amount.", "capture_too_large");
    }
    intent.status = "captured";
    intent.captured = amountHalalas;
    return {
      providerIntentId,
      providerChargeId: `mock_chg_${providerIntentId.slice(-12)}`,
      status: "captured",
      amountHalalas: intent.input.amountHalalas,
      capturedHalalas: amountHalalas,
      method: "mada",
      last4: "4321",
      cardBrandLabel: "mada",
    };
  }

  async void(providerIntentId: string): Promise<PaymentResult> {
    const intent = this.intents.get(providerIntentId);
    if (!intent) throw new PaymentProviderError("Unknown intent.", "intent_not_found");
    intent.status = "voided";
    return {
      providerIntentId,
      status: "voided",
      amountHalalas: intent.input.amountHalalas,
      capturedHalalas: 0n,
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    return {
      providerRefundId: `mock_ref_${sha256(input.idempotencyKey).slice(0, 20)}`,
      status: "succeeded",
      amountHalalas: input.amountHalalas,
    };
  }

  async fetchIntent(providerIntentId: string): Promise<PaymentResult> {
    const intent = this.intents.get(providerIntentId);
    if (!intent) throw new PaymentProviderError("Unknown intent.", "intent_not_found");
    return {
      providerIntentId,
      status: intent.status,
      amountHalalas: intent.input.amountHalalas,
      capturedHalalas: intent.captured,
      method: "mada",
      last4: "4321",
    };
  }

  /**
   * Signature verification, implemented for real even in the mock.
   *
   * The point is that tests exercise the same rejection path production uses:
   * an unsigned or wrongly-signed webhook throws here, so a test proving
   * "forged webhooks change nothing" is proving something true about the
   * production design rather than about a stub.
   */
  verifyWebhook(rawBody: string, headers: Headers): VerifiedWebhookEvent {
    const signature = headers.get("x-mock-signature");
    if (!signature) throw new WebhookVerificationError("Missing signature header.");

    const expected = createHmac("sha256", this.webhookSecret()).update(rawBody).digest("hex");
    if (!safeEqual(signature, expected)) {
      throw new WebhookVerificationError();
    }

    let payload: {
      id?: string;
      type?: string;
      intent_id?: string;
      charge_id?: string;
      status?: string;
      amount?: string | number;
      currency?: string;
      method?: string;
      last4?: string;
    };
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new WebhookVerificationError("Malformed webhook body.");
    }

    if (!payload.id || !payload.intent_id || !payload.status) {
      throw new WebhookVerificationError("Webhook payload is missing required fields.");
    }

    return {
      providerEventId: payload.id,
      type: payload.type ?? "payment.updated",
      providerIntentId: payload.intent_id,
      providerChargeId: payload.charge_id,
      status: payload.status as VerifiedWebhookEvent["status"],
      amountHalalas: BigInt(payload.amount ?? 0),
      currency: payload.currency ?? "SAR",
      method: payload.method as VerifiedWebhookEvent["method"],
      last4: payload.last4,
      rawPayloadHash: sha256(rawBody),
    };
  }

  /** Test helper: produce a correctly signed webhook body. */
  signWebhook(payload: Record<string, unknown>): { body: string; signature: string } {
    const body = JSON.stringify(payload);
    return {
      body,
      signature: createHmac("sha256", this.webhookSecret()).update(body).digest("hex"),
    };
  }
}
