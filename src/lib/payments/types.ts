import type { Halalas } from "@/lib/money";

export type PaymentMethodCode =
  | "mada"
  | "visa"
  | "mastercard"
  | "apple_pay"
  | "stc_pay"
  | "credit_terms"
  | "bank_transfer";

export type PaymentIntentStatus =
  | "created"
  | "requires_action"
  | "authorized"
  | "captured"
  | "failed"
  | "voided";

export interface CreateIntentInput {
  /** Our payment row id. Sent to the provider so webhooks can be correlated. */
  paymentId: string;
  bookingReference: string;
  amountHalalas: Halalas;
  currency: string;
  description: string;
  /** "authorize" for deposits (a hold), "charge" for the rental itself. */
  mode: "authorize" | "charge";
  customer: { email: string; name: string; phone?: string | undefined };
  returnUrl: string;
  /** Retrying with the same key must never create a second charge. */
  idempotencyKey: string;
  locale: "en" | "ar";
}

export interface PaymentIntent {
  providerIntentId: string;
  status: PaymentIntentStatus;
  /** Where to send the customer to complete payment (hosted page / 3-D Secure). */
  redirectUrl?: string;
  /** For an embedded form, if the provider supports one. */
  clientSecret?: string;
}

export interface PaymentResult {
  providerIntentId: string;
  providerChargeId?: string;
  status: PaymentIntentStatus;
  amountHalalas: Halalas;
  capturedHalalas: Halalas;
  method?: PaymentMethodCode;
  last4?: string;
  cardBrandLabel?: string;
  failureCode?: string;
  failureMessage?: string;
}

export interface RefundInput {
  providerChargeId: string;
  amountHalalas: Halalas;
  reason: string;
  idempotencyKey: string;
}

export interface RefundResult {
  providerRefundId: string;
  status: "pending" | "succeeded" | "failed";
  amountHalalas: Halalas;
}

/**
 * A webhook event that has ALREADY had its signature verified.
 *
 * The type exists to make the ordering un-skippable: `verifyWebhook` is the
 * only way to obtain one, so no code path can act on an unverified payload.
 */
export interface VerifiedWebhookEvent {
  providerEventId: string;
  type: string;
  providerIntentId: string;
  providerChargeId?: string;
  status: PaymentIntentStatus;
  /** Compared against the booking before anything is credited. */
  amountHalalas: Halalas;
  currency: string;
  method?: PaymentMethodCode;
  last4?: string;
  cardBrandLabel?: string;
  failureCode?: string;
  failureMessage?: string;
  rawPayloadHash: string;
}

export class PaymentProviderError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "PaymentProviderError";
  }
}

export class WebhookVerificationError extends Error {
  readonly code = "webhook_verification_failed";
  constructor(message = "Webhook signature verification failed.") {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

/**
 * Every payment provider implements exactly this.
 *
 * Swapping Moyasar for HyperPay or Tap is a new adapter, not a rewrite of the
 * booking flow — which matters because the PSP choice depends on a commercial
 * contract the business has not signed yet (docs/research.md §5).
 */
export interface PaymentProvider {
  readonly name: string;
  /** False when credentials are absent; the UI must not offer card payment. */
  readonly isConfigured: boolean;
  /** Methods this provider can actually accept, for rendering the checkout. */
  readonly supportedMethods: readonly PaymentMethodCode[];

  createIntent(input: CreateIntentInput): Promise<PaymentIntent>;
  /** Capture an authorization — the deposit path, or a delayed rental charge. */
  capture(providerIntentId: string, amountHalalas: Halalas): Promise<PaymentResult>;
  /** Release an authorization without taking money — deposit returned. */
  void(providerIntentId: string): Promise<PaymentResult>;
  refund(input: RefundInput): Promise<RefundResult>;
  /** Verify signature over the RAW body. MUST throw if verification fails. */
  verifyWebhook(rawBody: string, headers: Headers): VerifiedWebhookEvent;
  /** Read-through for reconciliation, and for recovering from a missed webhook. */
  fetchIntent(providerIntentId: string): Promise<PaymentResult>;
}
