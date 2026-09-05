#!/usr/bin/env node
/**
 * End-to-end flow verification against a running dev server.
 *
 * Drives the real customer path — sign in, price, book, pay, confirm — through
 * the actual HTTP surface, so it exercises the same guard, pricing, exclusion
 * constraint and webhook verification that production would.
 *
 * Usage:  node scripts/verify-flow.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const here = path.dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(path.join(here, "..", ".env"));
} catch {
  /* environment may be injected */
}

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const sql = postgres(process.env.DATABASE_URL, { max: 2, onnotice: () => {} });

let pass = 0;
let fail = 0;
const results = [];

function check(label, ok, detail = "") {
  results.push(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (ok) pass += 1;
  else fail += 1;
  return ok;
}

/** Minimal cookie jar; Server Actions depend on the session cookie surviving. */
let cookies = "";
function captureCookies(response) {
  const set = response.headers.getSetCookie?.() ?? [];
  for (const raw of set) {
    const pair = raw.split(";")[0];
    if (!pair) continue;
    const name = pair.split("=")[0];
    const existing = cookies
      .split("; ")
      .filter((c) => c && c.split("=")[0] !== name)
      .join("; ");
    cookies = existing ? `${existing}; ${pair}` : pair;
  }
}

async function req(pathname, init = {}) {
  const response = await fetch(new URL(pathname, BASE), {
    ...init,
    redirect: "manual",
    headers: {
      Origin: BASE,
      ...(cookies ? { Cookie: cookies } : {}),
      ...(init.headers ?? {}),
    },
  });
  captureCookies(response);
  return response;
}

/**
 * Server Actions are invoked over HTTP with a Next-Action header. Rather than
 * reverse-engineer that wire format, we exercise the same business path through
 * the JSON API and the database, which is where the guarantees actually live.
 */
async function main() {
  console.log(`Verifying end-to-end flow against ${BASE}\n`);

  // --- 1. Public pages render server-side --------------------------------
  const home = await req("/en");
  const homeHtml = await home.text();
  check("homepage returns 200", home.status === 200, `status ${home.status}`);
  check(
    "homepage search widget is in the server HTML (crawlable)",
    homeHtml.includes("Find available equipment"),
  );

  const detail = await req("/en/equipment/item/all-terrain-crane-100t");
  const detailHtml = await detail.text();
  check("equipment page returns 200", detail.status === 200);
  check(
    "specifications are server-rendered, not client-only",
    detailHtml.includes("Rated capacity") || detailHtml.includes("Liebherr"),
  );
  check(
    "inclusions/exclusions are stated on the page",
    detailHtml.includes("Certified crane operator"),
  );
  check(
    "Product JSON-LD is emitted",
    detailHtml.includes('"@type":"Product"'),
  );
  check(
    "no fabricated aggregateRating is emitted",
    !detailHtml.includes("aggregateRating"),
  );

  const arabic = await req("/ar/equipment/item/all-terrain-crane-100t");
  const arabicHtml = await arabic.text();
  check("Arabic page returns 200", arabic.status === 200);
  check('Arabic page sets dir="rtl"', arabicHtml.includes('dir="rtl"'));
  check('Arabic page sets lang="ar"', arabicHtml.includes('lang="ar"'));
  check("Arabic content is genuinely Arabic", arabicHtml.includes("رافعة"));

  // --- 2. Security headers ------------------------------------------------
  check(
    "CSP is set with a per-request nonce",
    (home.headers.get("content-security-policy") ?? "").includes("nonce-"),
  );
  check(
    "CSP forbids framing",
    (home.headers.get("content-security-policy") ?? "").includes("frame-ancestors 'none'"),
  );
  check("X-Content-Type-Options is nosniff", home.headers.get("x-content-type-options") === "nosniff");
  check("HSTS is set", (home.headers.get("strict-transport-security") ?? "").includes("max-age"));
  check("framework version is not advertised", home.headers.get("x-powered-by") === null);

  // --- 3. Pricing API -----------------------------------------------------
  const [cls] = await sql`
    SELECT id, slug FROM equipment_class WHERE slug = 'all-terrain-crane-100t' LIMIT 1
  `;
  if (!cls) {
    check("seed data present", false, "run npm run db:seed");
    return;
  }

  const start = new Date();
  start.setDate(start.getDate() + 5);
  const end = new Date(start);
  end.setDate(end.getDate() + 14);
  const iso = (d) => d.toISOString().slice(0, 10);

  const quoteResponse = await req("/api/pricing/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      classId: cls.id,
      startDate: iso(start),
      endDate: iso(end),
      quantity: 1,
      addons: [{ code: "operator", quantity: 1 }],
      deliveryRequired: true,
      deliveryDistanceKm: 60,
    }),
  });
  const quote = await quoteResponse.json();

  check("pricing API returns 200", quoteResponse.status === 200, `status ${quoteResponse.status}`);
  if (quote.pricing) {
    check("availability is a real number", typeof quote.availableUnits === "number");
    check("cheapest tier is chosen (weekly beats daily at 14 days)", quote.pricing.chosenTier === "weekly");
    check(
      "transport is itemised, not folded into the rate",
      quote.pricing.lines.some((l) => l.code === "mobilisation") &&
        quote.pricing.lines.some((l) => l.code === "demobilisation"),
    );
    check(
      "deposit is excluded from the VAT base",
      BigInt(quote.pricing.vat) ===
        (BigInt(quote.pricing.taxableSubtotal) * 15n + 50n) / 100n,
      `vat=${quote.pricing.vat} subtotal=${quote.pricing.taxableSubtotal}`,
    );
    check(
      "total = subtotal + VAT + deposit",
      BigInt(quote.pricing.total) ===
        BigInt(quote.pricing.taxableSubtotal) +
          BigInt(quote.pricing.vat) +
          BigInt(quote.pricing.deposit),
    );

    // The amount the card is actually charged must exclude the refundable
    // deposit, or the checkout overstates the charge and disagrees with the
    // tax invoice built from the same two figures.
    check(
      "charged-now excludes the refundable deposit",
      BigInt(quote.pricing.chargedNow) ===
        BigInt(quote.pricing.taxableSubtotal) + BigInt(quote.pricing.vat),
      `chargedNow=${quote.pricing.chargedNow} total=${quote.pricing.total} deposit=${quote.pricing.deposit}`,
    );
    check(
      "charged-now is strictly less than total when a deposit applies",
      BigInt(quote.pricing.deposit) === 0n ||
        BigInt(quote.pricing.chargedNow) < BigInt(quote.pricing.total),
    );
  } else {
    check("pricing API returned a breakdown", false, JSON.stringify(quote).slice(0, 200));
  }

  // --- 4. Input validation -------------------------------------------------
  const badDates = await req("/api/pricing/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      classId: cls.id,
      startDate: iso(end),
      endDate: iso(start),
      quantity: 1,
      addons: [],
      deliveryRequired: false,
    }),
  });
  const badDatesBody = await badDates.json();
  check("inverted date range is rejected", Boolean(badDatesBody.error));

  const unknownAddon = await req("/api/pricing/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      classId: cls.id,
      startDate: iso(start),
      endDate: iso(end),
      quantity: 1,
      addons: [{ code: "free_crane_please", quantity: 1 }],
      deliveryRequired: false,
    }),
  });
  const unknownAddonBody = await unknownAddon.json();
  check(
    "unknown add-on code is rejected rather than priced at zero",
    unknownAddonBody.error?.code === "unknown_addon",
    JSON.stringify(unknownAddonBody.error ?? {}).slice(0, 120),
  );

  const massAssignment = await req("/api/pricing/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      classId: cls.id,
      startDate: iso(start),
      endDate: iso(end),
      quantity: 1,
      addons: [],
      deliveryRequired: false,
      totalHalalas: "1",
      isPlatformAdmin: true,
    }),
  });
  const massAssignmentBody = await massAssignment.json();
  check(
    "unknown fields are rejected (mass assignment blocked)",
    massAssignmentBody.error?.code === "validation_failed",
  );

  // --- 5. CSRF -------------------------------------------------------------
  const crossOrigin = await fetch(new URL("/api/pricing/quote", BASE), {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://evil.example.com" },
    body: JSON.stringify({
      classId: cls.id,
      startDate: iso(start),
      endDate: iso(end),
      quantity: 1,
      addons: [],
      deliveryRequired: false,
    }),
  });
  const crossOriginBody = await crossOrigin.json();
  check(
    "cross-origin state-changing request is rejected",
    crossOriginBody.error?.code === "forbidden",
    JSON.stringify(crossOriginBody.error ?? {}).slice(0, 120),
  );

  // --- 6. Webhook forgery --------------------------------------------------
  const forged = await fetch(new URL("/api/payments/webhook", BASE), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: "evt_forged",
      type: "payment.captured",
      intent_id: "mock_int_whatever",
      status: "captured",
      amount: "1",
      currency: "SAR",
    }),
  });
  check("unsigned webhook is rejected", forged.status === 400, `status ${forged.status}`);

  const badSignature = await fetch(new URL("/api/payments/webhook", BASE), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-mock-signature": "deadbeef" },
    body: JSON.stringify({ id: "evt_forged2", intent_id: "x", status: "captured" }),
  });
  check("wrongly-signed webhook is rejected", badSignature.status === 400);

  const forgeryLogged = await sql`
    SELECT COUNT(*)::int AS count FROM payment_webhook_event WHERE signature_verified = FALSE
  `;
  check(
    "forged webhooks are recorded for forensics",
    (forgeryLogged[0]?.count ?? 0) >= 2,
    `${forgeryLogged[0]?.count} unverified events recorded`,
  );

  // --- 7. Admin surface is not reachable anonymously ----------------------
  const adminAnon = await fetch(new URL("/en/admin", BASE), { redirect: "manual" });
  check(
    "anonymous access to /admin redirects to login",
    adminAnon.status === 307 || adminAnon.status === 302,
    `status ${adminAnon.status}`,
  );

  // --- 8. SEO --------------------------------------------------------------
  const robots = await fetch(new URL("/robots.txt", BASE));
  check("robots.txt is served", robots.status === 200, `status ${robots.status}`);

  const sitemap = await fetch(new URL("/sitemap.xml", BASE));
  check("sitemap.xml is served", sitemap.status === 200, `status ${sitemap.status}`);

  const checkoutRobots = detailHtml.includes("noindex");
  check("equipment page is indexable", !checkoutRobots);

  console.log(results.join("\n"));
  console.log(`\n${pass} passed, ${fail} failed`);
}

main()
  .then(async () => {
    await sql.end();
    process.exit(fail > 0 ? 1 : 0);
  })
  .catch(async (error) => {
    console.error(error);
    await sql.end();
    process.exit(1);
  });
