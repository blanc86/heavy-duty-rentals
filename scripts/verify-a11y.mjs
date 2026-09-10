#!/usr/bin/env node
/**
 * Accessibility audit — WCAG 2.2 A and AA.
 *
 * Runs axe-core in a real browser against the pages a customer and an operator
 * actually pass through, in BOTH locales. Arabic is not a translation of the
 * English run: it is right-to-left, so it exercises different layout code and
 * has its own contrast and reading-order failure modes.
 *
 * Why this is worth a browser rather than a linter: the failures that matter
 * here — contrast, target size, focus order, whether a label is actually
 * associated — are properties of rendered layout and computed style. Nothing
 * that reads the source can see them.
 *
 * Signed-in pages are included by minting a session directly, the same way
 * verify-routes does. Half of this application is behind a login, and auditing
 * only the marketing pages would be auditing the easy half.
 *
 * Usage:  node scripts/verify-a11y.mjs
 */
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import postgres from "postgres";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.loadEnvFile(path.join(root, ".env"));
} catch {
  /* environment may be injected */
}

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const sql = postgres(process.env.DATABASE_URL, { max: 2, onnotice: () => {} });

/** WCAG 2.2 A + AA. AAA is deliberately out of scope — it is not the bar. */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

function uuidv7() {
  const bytes = randomBytes(16);
  const ms = BigInt(Date.now());
  for (let i = 0; i < 6; i += 1) bytes[i] = Number((ms >> BigInt(40 - i * 8)) & 0xffn);
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = bytes.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

async function sessionTokenFor(email) {
  const [user] = await sql`SELECT id FROM "user" WHERE lower(email) = lower(${email}) LIMIT 1`;
  if (!user) return null;
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await sql`
    INSERT INTO session (id, user_id, token_hash, expires_at, absolute_expires_at, mfa_satisfied_at)
    VALUES (${uuidv7()}, ${user.id}, ${tokenHash},
            now() + interval '1 day', now() + interval '1 day', now())
  `;
  return token;
}

async function main() {
  const axeSource = await readFile(path.join(root, "node_modules/axe-core/axe.min.js"), "utf8");

  const [cls] = await sql`SELECT slug FROM equipment_class ORDER BY created_at LIMIT 1`;
  const [branch] = await sql`SELECT slug FROM branch ORDER BY created_at LIMIT 1`;
  const [booking] = await sql`
    SELECT b.reference, u.email AS owner_email
    FROM booking b JOIN "user" u ON u.id = b.customer_user_id
    ORDER BY b.created_at DESC LIMIT 1
  `;

  const publicPages = [
    "",
    "/equipment",
    cls ? `/equipment/item/${cls.slug}` : null,
    "/locations",
    branch ? `/locations/${branch.slug}` : null,
    "/how-it-works",
    "/for-contractors",
    "/quote",
    "/login",
    // The booking lookup replaced customer registration; it is the page a
    // customer with a rental actually lands on, so it is the one audited.
    "/booking",
    "/contact",
    "/faq",
  ].filter(Boolean);

  const ownerPages = booking
    ? ["/account", "/account/security", `/booking/${booking.reference}`]
    : ["/account", "/account/security"];

  const adminPages = ["/admin", "/admin/bookings", "/admin/inventory", "/admin/quotes"];

  const browser = await chromium.launch();
  const findings = new Map();
  let audited = 0;
  let incomplete = 0;

  async function audit(context, pages, label) {
    const page = await context.newPage();
    for (const route of pages) {
      for (const locale of ["en", "ar"]) {
        const url = `${BASE}/${locale}${route}`;
        // NOT `networkidle`: the dev server holds an HMR websocket open, so the
        // network never goes idle and every navigation waits out its timeout.
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 }).catch(() => {});
        // Client islands hydrate after DOMContentLoaded, and a control that is
        // not in the DOM yet cannot be audited. 600ms was not enough: a CTA was
        // reported as a contrast failure while its styles were still settling,
        // and measured 9.19:1 when checked properly. A check that reports
        // timing artifacts as violations gets ignored, so this waits for the
        // network to go quiet (bounded, because the dev server's HMR socket
        // never closes) before measuring anything.
        await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});
        await page.waitForTimeout(400);
        // NOT `addScriptTag`: that injects an inline <script>, and this site's
        // CSP is `script-src 'self' 'nonce-…'` — an un-nonced inline script is
        // refused, which is the policy working correctly. Evaluating the source
        // goes through the debugging protocol instead, which CSP does not
        // govern, so the audit runs against the real policy rather than needing
        // it relaxed.
        await page.evaluate((src) => {
          (0, eval)(src);
        }, axeSource);
        const result = await page.evaluate(
          // Runs in the BROWSER, so `window` and `document` are the page's, not
          // this file's. eslint lints this as Node source and cannot know that.
          /* eslint-disable-next-line no-undef */
          async (tags) => await window.axe.run(document, { runOnly: { type: "tag", values: tags } }),
          TAGS,
        );
        audited += 1;

        // axe's `incomplete` bucket is "could not determine", not "failed" —
        // it is what a `lab()` or `oklch()` colour it cannot parse lands in.
        // Counted and surfaced, never mixed in with real violations.
        incomplete += result.incomplete.length;

        for (const violation of result.violations) {
          const key = `${violation.id}|${violation.impact}`;
          const entry = findings.get(key) ?? {
            id: violation.id,
            impact: violation.impact,
            help: violation.help,
            pages: new Set(),
            sample: violation.nodes[0]?.html?.slice(0, 160) ?? "",
            target: violation.nodes[0]?.target?.join(" ") ?? "",
          };
          entry.pages.add(`/${locale}${route} (${label})`);
          findings.set(key, entry);
        }
      }
    }
    await page.close();
  }

  await audit(await browser.newContext(), publicPages, "public");

  /**
   * The session cookie, matching whatever host is being audited.
   *
   * Both the name and the domain were pinned to local development, so pointing
   * this at a deployment silently audited every "signed in" page as an
   * anonymous visitor — passing, while checking a redirect instead of the page.
   * The application uses the `__Host-` prefix over https, which additionally
   * requires Secure and no Domain attribute, so the cookie is built with `url`
   * rather than a domain there.
   */
  const cookieFor = async (token) => {
    const url = new URL(BASE);
    const secure = url.protocol === "https:";
    // Playwright takes EITHER `url` (from which it derives domain and path) or
    // an explicit `domain` + `path` — never both. The `url` form is the right
    // one for a `__Host-` cookie anyway, since that prefix forbids a Domain
    // attribute and requires path=/, which `url.origin` gives exactly.
    return [
      secure
        ? { name: "__Host-hdr_session", value: token, url: url.origin }
        : { name: "hdr_session", value: token, domain: url.hostname, path: "/" },
    ];
  };

  const ownerToken = booking ? await sessionTokenFor(booking.owner_email) : null;
  if (ownerToken) {
    const ctx = await browser.newContext();
    await ctx.addCookies(await cookieFor(ownerToken));
    await audit(ctx, ownerPages, "customer");
  }

  const adminToken = await sessionTokenFor(process.env.SEED_ADMIN_EMAIL ?? "admin@example.com");
  if (adminToken) {
    const ctx = await browser.newContext();
    await ctx.addCookies(await cookieFor(adminToken));
    await audit(ctx, adminPages, "admin");
  }

  await browser.close();

  const ranked = [...findings.values()].sort((a, b) => {
    const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
    return (order[a.impact] ?? 9) - (order[b.impact] ?? 9);
  });

  console.log(`Audited ${audited} page renders (WCAG 2.2 A + AA, both locales).`);
  console.log(`${incomplete} check(s) inconclusive — axe could not determine, usually an unparsed colour space.`);
  console.log("");

  if (ranked.length === 0) {
    console.log("PASS  no WCAG A/AA violations detected.");
    return;
  }

  for (const f of ranked) {
    console.log(`${f.impact.toUpperCase()}  ${f.id} — ${f.help}`);
    console.log(`      on ${f.pages.size} page(s), e.g. ${[...f.pages][0]}`);
    if (f.target) console.log(`      first: ${f.target}`);
    if (f.sample) console.log(`      ${f.sample.replace(/\s+/g, " ")}`);
    console.log("");
  }

  const blocking = ranked.filter((f) => f.impact === "critical" || f.impact === "serious");
  console.log(
    `${ranked.length} distinct violation type(s); ${blocking.length} critical or serious.`,
  );
  process.exitCode = blocking.length > 0 ? 1 : 0;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
