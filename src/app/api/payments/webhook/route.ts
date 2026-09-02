import { NextResponse } from "next/server";
import { sha256 } from "@/lib/auth/crypto";
import { getPaymentProvider, WebhookVerificationError } from "@/lib/payments";
import { processWebhookEvent, recordUnverifiedWebhook } from "@/lib/payments/service";

/**
 * PAYMENT WEBHOOK — the only source of truth for payment status.
 *
 * A browser POSTing "I paid" changes nothing anywhere in this system. The
 * booking becomes `confirmed` only here, and only after:
 *
 *   1. the RAW body verifies against the provider's signature
 *      (verified BEFORE parsing, so the parser never runs on unauthenticated
 *      input, and compared in constant time)
 *   2. the provider event id passes the replay check (UNIQUE index)
 *   3. the amount and currency match the stored booking
 *
 * CSRF is skipped deliberately: a provider is not a browser and sends no
 * Origin. Authentication here is the signature, which is strictly stronger.
 */
export async function POST(request: Request) {
  const provider = getPaymentProvider();

  // The raw text, not request.json(). Re-serialising JSON changes bytes and
  // would break signature verification.
  const rawBody = await request.text();

  let event;
  try {
    event = provider.verifyWebhook(rawBody, request.headers);
  } catch (error) {
    // Recorded for forensics but acted on in no way. Silently dropping forged
    // webhooks would lose the signal that someone is attempting forgery — a
    // spike here is exactly what monitoring should alert on.
    await recordUnverifiedWebhook(
      provider.name,
      sha256(rawBody),
      error instanceof WebhookVerificationError ? error.message : "verification_error",
    );
    // 400, not 401: we are not inviting a retry with credentials.
    return NextResponse.json({ received: false }, { status: 400 });
  }

  try {
    const outcome = await processWebhookEvent(provider.name, event);
    // 200 even for "duplicate" or "unknown intent": the provider has delivered
    // successfully and must not be told to retry a message we will keep
    // rejecting.
    return NextResponse.json({ received: true, outcome }, { status: 200 });
  } catch (error) {
    console.error("[webhook] processing failed", error);
    // 500 tells the provider to retry — the event was valid and we failed.
    return NextResponse.json({ received: false }, { status: 500 });
  }
}

/** Providers often probe the endpoint with a GET during configuration. */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
