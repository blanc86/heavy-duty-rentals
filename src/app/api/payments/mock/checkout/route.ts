import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema/finance";
import { env } from "@/lib/env";
import { eq } from "drizzle-orm";

/**
 * MOCK PAYMENT PAGE — development only.
 *
 * Stands in for the PSP's hosted checkout so the whole funnel (book → pay →
 * webhook → confirmed) can be exercised without a merchant account.
 *
 * It moves no money. Crucially, "paying" here does NOT mark the booking paid
 * directly: it emits a properly HMAC-SIGNED webhook to our own webhook
 * endpoint, so the code path under test is the production one, including
 * signature verification and replay defence. A mock that shortcut straight to
 * "confirmed" would be testing nothing.
 */
function assertMockProvider(): void {
  if (env.PAYMENT_PROVIDER !== "mock" || env.NODE_ENV === "production") {
    throw new Error("The mock checkout is not available.");
  }
}

export async function GET(request: Request) {
  try {
    assertMockProvider();
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const intent = url.searchParams.get("intent");
  const returnUrl = url.searchParams.get("return") ?? "/";

  if (!intent) return new NextResponse("Missing intent", { status: 400 });

  // Same-origin only, so this cannot be turned into an open redirect.
  const safeReturn = returnUrl.startsWith(env.APP_URL) ? returnUrl : env.APP_URL;

  const [payment] = await db
    .select({ amountHalalas: payments.amountHalalas, currency: payments.currency })
    .from(payments)
    .where(eq(payments.providerIntentId, intent))
    .limit(1);

  const amount = payment ? (Number(payment.amountHalalas) / 100).toFixed(2) : "0.00";

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mock payment — development only</title>
<style>
  body{font-family:system-ui,sans-serif;background:#f6f7f9;margin:0;display:grid;place-items:center;min-height:100dvh;padding:1.5rem}
  .card{background:#fff;border:1px solid #dfe3e8;border-radius:.75rem;max-width:26rem;width:100%;padding:1.5rem;box-shadow:0 4px 12px rgba(0,0,0,.06)}
  h1{font-size:1.125rem;margin:0 0 .25rem}
  .warn{background:#fff8e6;border:1px solid #f0d48a;color:#7a5b00;border-radius:.5rem;padding:.75rem;font-size:.8125rem;margin:1rem 0}
  .amt{font-size:1.75rem;font-weight:700;margin:.5rem 0 0}
  button{width:100%;min-height:3rem;border:0;border-radius:.5rem;font-size:1rem;font-weight:600;cursor:pointer;margin-top:.5rem}
  .pay{background:#f4a71d;color:#1a1d23}
  .fail{background:#fff;border:1px solid #dfe3e8;color:#444}
  .muted{color:#6b7280;font-size:.8125rem;margin:.75rem 0 0;text-align:center}
</style></head>
<body><div class="card">
  <h1>Mock payment gateway</h1>
  <p class="muted" style="text-align:left;margin:0">Simulates a SAMA-licensed PSP hosted page.</p>
  <p class="amt">${amount} ${payment?.currency ?? "SAR"}</p>
  <div class="warn"><strong>Development only.</strong> No real payment is processed and no money moves.
  Pressing pay emits a signed webhook to this application, exercising the same
  verification path production uses.</div>
  <form method="POST">
    <input type="hidden" name="intent" value="${escapeHtml(intent)}">
    <input type="hidden" name="return" value="${escapeHtml(safeReturn)}">
    <button class="pay" name="outcome" value="paid" type="submit">Simulate successful payment</button>
    <button class="fail" name="outcome" value="failed" type="submit">Simulate declined card</button>
  </form>
  <p class="muted">mada · Visa · Mastercard · Apple Pay (simulated)</p>
</div></body></html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  try {
    assertMockProvider();
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const returnUrl = String(form.get("return") ?? env.APP_URL);
  const outcome = String(form.get("outcome") ?? "paid");

  const [payment] = await db
    .select({ amountHalalas: payments.amountHalalas, currency: payments.currency })
    .from(payments)
    .where(eq(payments.providerIntentId, intent))
    .limit(1);

  if (!payment) return new NextResponse("Unknown intent", { status: 404 });

  const payload = {
    id: `mock_evt_${crypto.randomUUID()}`,
    type: outcome === "paid" ? "payment.captured" : "payment.failed",
    intent_id: intent,
    charge_id: `mock_chg_${intent.slice(-12)}`,
    status: outcome === "paid" ? "captured" : "failed",
    // The real amount from the database, so an amount-mismatch test can be
    // written by deliberately changing it.
    amount: payment.amountHalalas.toString(),
    currency: payment.currency,
    method: "mada",
    last4: "4321",
  };

  const body = JSON.stringify(payload);
  const secret = env.APP_SECRET ?? "mock-webhook-secret-development-only";
  const signature = createHmac("sha256", secret).update(body).digest("hex");

  // Delivered over HTTP to our own webhook endpoint — the same route a real
  // PSP calls, with the same verification.
  await fetch(new URL("/api/payments/webhook", env.APP_URL), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-mock-signature": signature },
    body,
  }).catch((error) => {
    console.error("[mock-checkout] webhook delivery failed", error);
  });

  const safeReturn = returnUrl.startsWith(env.APP_URL) ? returnUrl : env.APP_URL;
  return NextResponse.redirect(safeReturn, 303);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) =>
    char === "&" ? "&amp;"
    : char === "<" ? "&lt;"
    : char === ">" ? "&gt;"
    : char === '"' ? "&quot;"
    : "&#39;",
  );
}
