import { createHmac } from "node:crypto";
import { safeEqual, sha256 } from "@/lib/auth/crypto";
import { env } from "@/lib/env";
import type { Halalas } from "@/lib/money";
import {
  PaymentProviderError,
  WebhookVerificationError,
  type CreateIntentInput,
  type PaymentIntent,
  type PaymentIntentStatus,
  type PaymentMethodCode,
  type PaymentProvider,
  type PaymentResult,
  type RefundInput,
  type RefundResult,
  type VerifiedWebhookEvent,
} from "./types";

/**
 * MOYASAR — reference real payment adapter.
 *
 * Chosen as the default real provider for a Saudi-only V1: SAMA-licensed and
 * Saudi-built, first-class mada support (mada is the national debit scheme and
 * the default card in most Saudi wallets — a checkout without it bleeds
 * conversion), Apple Pay and STC Pay, fast T+1 mada settlement, and the lowest
 * onboarding cost of the credible options. See docs/research.md §5.
 *
 * THIS CODE IS REAL AND UNTESTED AGAINST THE LIVE API.
 *
 * No credentials ship with this repository, and none can: a merchant account
 * requires a Saudi CR and a signed PSP contract the business must obtain. The
 * adapter refuses to initialise without them rather than pretending to work.
 *
 * Before going live:
 *   1. Verify the request/response shapes against current Moyasar API docs —
 *      they may have changed since this was written (2026-09).
 *   2. Confirm with Moyasar whether mada supports authorization HOLDS, and for
 *      how long. Our deposit model assumes auth-then-capture; if mada cannot
 *      hold, the deposit must become charge-then-refund, which changes the
 *      customer's cash position and must be disclosed at checkout.
 *   3. Test the full webhook path in their sandbox, including replay.
 *   4. Confirm the webhook signature scheme below matches what they send.
 */

const API_BASE = "https://api.moyasar.com/v1";

/** Moyasar amounts are in the currency's minor unit — halalas for SAR. */
function toMinorUnit(halalas: Halalas): number {
  const asNumber = Number(halalas);
  if (!Number.isSafeInteger(asNumber)) {
    throw new PaymentProviderError("Amount exceeds safe integer range.", "amount_too_large");
  }
  return asNumber;
}

interface MoyasarPayment {
  id: string;
  status: string;
  amount: number;
  currency: string;
  source?: { type?: string; company?: string; number?: string; transaction_url?: string };
  metadata?: Record<string, string>;
}

function mapStatus(status: string): PaymentIntentStatus {
  switch (status) {
    case "initiated":
      return "created";
    case "paid":
      return "captured";
    case "authorized":
      return "authorized";
    case "failed":
      return "failed";
    case "voided":
      return "voided";
    case "refunded":
      return "captured";
    default:
      return "requires_action";
  }
}

function mapMethod(source: MoyasarPayment["source"]): PaymentMethodCode | undefined {
  const company = source?.company?.toLowerCase();
  if (company === "mada") return "mada";
  if (company === "visa") return "visa";
  if (company === "master" || company === "mastercard") return "mastercard";
  if (source?.type === "applepay") return "apple_pay";
  if (source?.type === "stcpay") return "stc_pay";
  return undefined;
}

export class MoyasarProvider implements PaymentProvider {
  readonly name = "moyasar";
  readonly supportedMethods = ["mada", "visa", "mastercard", "apple_pay", "stc_pay"] as const;

  get isConfigured(): boolean {
    return Boolean(env.MOYASAR_SECRET_KEY && env.MOYASAR_WEBHOOK_SECRET);
  }

  private secretKey(): string {
    const key = env.MOYASAR_SECRET_KEY;
    if (!key) {
      throw new PaymentProviderError(
        "MOYASAR_SECRET_KEY is not configured. Card payment is unavailable.",
        "provider_not_configured",
      );
    }
    return key;
  }

  private async request<T>(
    path: string,
    init: { method: string; body?: Record<string, unknown>; idempotencyKey?: string },
  ): Promise<T> {
    const auth = Buffer.from(`${this.secretKey()}:`).toString("base64");

    const headers: Record<string, string> = {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    // Retries and double-submits must never create a second charge.
    if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;

    let response: Response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        method: init.method,
        headers,
        body: init.body ? JSON.stringify(init.body) : undefined,
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      // A network failure is retryable; a decline is not. The distinction
      // decides whether the caller may safely try again.
      throw new PaymentProviderError(
        `Could not reach the payment provider: ${error instanceof Error ? error.message : "unknown"}`,
        "provider_unreachable",
        true,
      );
    }

    const text = await response.text();

    if (!response.ok) {
      let message = "Payment failed.";
      let code = `provider_http_${response.status}`;
      try {
        const parsed = JSON.parse(text) as { message?: string; type?: string };
        if (parsed.message) message = parsed.message;
        if (parsed.type) code = parsed.type;
      } catch {
        // Body was not JSON. Keep the generic message — never surface raw
        // provider output to a customer.
      }
      throw new PaymentProviderError(message, code, response.status >= 500);
    }

    return JSON.parse(text) as T;
  }

  async createIntent(input: CreateIntentInput): Promise<PaymentIntent> {
    const payment = await this.request<MoyasarPayment>("/payments", {
      method: "POST",
      idempotencyKey: input.idempotencyKey,
      body: {
        amount: toMinorUnit(input.amountHalalas),
        currency: input.currency,
        description: input.description,
        callback_url: input.returnUrl,
        // Correlates the provider's webhook back to our payment row without
        // trusting anything the browser sends.
        metadata: {
          payment_id: input.paymentId,
          booking_reference: input.bookingReference,
          mode: input.mode,
        },
      },
    });

    return {
      providerIntentId: payment.id,
      status: mapStatus(payment.status),
      redirectUrl: payment.source?.transaction_url,
    };
  }

  async capture(providerIntentId: string, amountHalalas: Halalas): Promise<PaymentResult> {
    const payment = await this.request<MoyasarPayment>(`/payments/${providerIntentId}/capture`, {
      method: "POST",
      body: { amount: toMinorUnit(amountHalalas) },
    });
    return this.toResult(payment, amountHalalas);
  }

  async void(providerIntentId: string): Promise<PaymentResult> {
    const payment = await this.request<MoyasarPayment>(`/payments/${providerIntentId}/void`, {
      method: "POST",
    });
    return this.toResult(payment, 0n);
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const payment = await this.request<MoyasarPayment>(
      `/payments/${input.providerChargeId}/refund`,
      {
        method: "POST",
        idempotencyKey: input.idempotencyKey,
        body: { amount: toMinorUnit(input.amountHalalas) },
      },
    );
    return {
      providerRefundId: payment.id,
      status: payment.status === "refunded" ? "succeeded" : "pending",
      amountHalalas: input.amountHalalas,
    };
  }

  async fetchIntent(providerIntentId: string): Promise<PaymentResult> {
    const payment = await this.request<MoyasarPayment>(`/payments/${providerIntentId}`, {
      method: "GET",
    });
    return this.toResult(payment, BigInt(payment.amount));
  }

  private toResult(payment: MoyasarPayment, captured: Halalas): PaymentResult {
    return {
      providerIntentId: payment.id,
      providerChargeId: payment.id,
      status: mapStatus(payment.status),
      amountHalalas: BigInt(payment.amount),
      capturedHalalas: captured,
      method: mapMethod(payment.source),
      // Only the last four digits, and only because the customer needs to know
      // which card was used. Nothing else about the card is ever stored.
      last4: payment.source?.number?.slice(-4),
      cardBrandLabel: payment.source?.company,
    };
  }

  /**
   * Verify the webhook signature over the RAW body, before parsing.
   *
   * Order matters: parsing first and verifying second would mean the parser
   * runs on attacker-controlled input that has not been authenticated. The
   * comparison is constant-time so the signature cannot be recovered byte by
   * byte from response timing.
   */
  verifyWebhook(rawBody: string, headers: Headers): VerifiedWebhookEvent {
    const secret = env.MOYASAR_WEBHOOK_SECRET;
    if (!secret) {
      throw new WebhookVerificationError("MOYASAR_WEBHOOK_SECRET is not configured.");
    }

    const signature = headers.get("x-moyasar-signature") ?? headers.get("x-signature");
    if (!signature) throw new WebhookVerificationError("Missing signature header.");

    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    if (!safeEqual(signature, expected)) throw new WebhookVerificationError();

    let payload: {
      id?: string;
      type?: string;
      data?: MoyasarPayment;
    };
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new WebhookVerificationError("Malformed webhook body.");
    }

    const data = payload.data;
    if (!payload.id || !data?.id || !data.status) {
      throw new WebhookVerificationError("Webhook payload is missing required fields.");
    }

    return {
      providerEventId: payload.id,
      type: payload.type ?? "payment.updated",
      providerIntentId: data.id,
      providerChargeId: data.id,
      status: mapStatus(data.status),
      amountHalalas: BigInt(data.amount ?? 0),
      currency: data.currency ?? "SAR",
      method: mapMethod(data.source),
      last4: data.source?.number?.slice(-4),
      cardBrandLabel: data.source?.company,
      rawPayloadHash: sha256(rawBody),
    };
  }
}
