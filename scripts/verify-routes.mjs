#!/usr/bin/env node
/**
 * Route sweep.
 *
 * Requests every page route in both locales — anonymously, as the seeded admin,
 * and as the customer who owns a booking — and reports anything unexpected.
 *
 * A 500 here means a page throws with the data currently in the database, which
 * is the class of bug that stays invisible while tables are empty and appears
 * the moment real rows exist. The admin dashboard crashed exactly that way as
 * soon as the first booking existed.
 *
 * Complements verify-flow.mjs, which asserts behaviour. This asserts only that
 * every page resolves, which is cheap and covers routes no test drives.
 *
 * Usage:  node scripts/verify-routes.mjs
 */
import { createHash, randomBytes } from "node:crypto";
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

let cookies = "";

async function req(pathname) {
  return fetch(new URL(pathname, BASE), {
    redirect: "manual",
    headers: { Origin: BASE, ...(cookies ? { Cookie: cookies } : {}) },
  });
}

function uuidv7() {
  const bytes = randomBytes(16);
  const ms = BigInt(Date.now());
  for (let i = 0; i < 6; i += 1) bytes[i] = Number((ms >> BigInt(40 - i * 8)) & 0xffn);
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = bytes.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Create a session row exactly as a correct password would, and set the cookie.
 *
 * Driving the login Server Action over HTTP would mean reproducing its wire
 * format. The session row is what the pages actually read, so this reaches the
 * same state through the same door the application uses.
 */
async function signInAs(email) {
  const [user] = await sql`SELECT id FROM "user" WHERE lower(email) = lower(${email}) LIMIT 1`;
  if (!user) throw new Error(`no such user: ${email} — run npm run db:seed`);

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await sql`
    INSERT INTO session (id, user_id, token_hash, expires_at, absolute_expires_at, mfa_satisfied_at)
    VALUES (${uuidv7()}, ${user.id}, ${tokenHash},
            now() + interval '1 day', now() + interval '1 day', now())
  `;
  cookies = `hdr_session=${token}`;
}

const failures = [];

async function sweep(routes, label) {
  console.log(`--- ${label} ---`);
  for (const route of routes) {
    for (const locale of ["en", "ar"]) {
      // A route is a string, or a function of the locale for the cases where
      // the two locales genuinely have different URLs.
      const resolved = typeof route === "function" ? route(locale) : route;
      if (resolved === null || resolved === undefined) continue;

      const url = `/${locale}${resolved}`;
      const response = await req(url);
      const ok = response.status === 200;
      if (!ok) failures.push(`${url} -> ${response.status}`);
      console.log(`${ok ? "PASS" : "FAIL"}  ${url} — ${response.status}`);
    }
  }
  console.log("");
}

async function main() {
  console.log(`Sweeping routes on ${BASE}`);
  console.log("");

  // Real ids and slugs, so dynamic segments are exercised against real rows.
  const [cls] = await sql`SELECT slug FROM equipment_class ORDER BY created_at LIMIT 1`;
  const [cat] = await sql`SELECT slug FROM equipment_category ORDER BY created_at LIMIT 1`;
  const [branch] = await sql`SELECT slug FROM branch ORDER BY created_at LIMIT 1`;
  const [booking] = await sql`
    SELECT b.reference, u.email AS owner_email
    FROM booking b JOIN "user" u ON u.id = b.customer_user_id
    ORDER BY b.created_at DESC LIMIT 1
  `;

  // Article slugs are TRANSLATED, not transliterated, so each locale has its
  // own. Sweeping the English slug under /ar would assert the wrong thing —
  // and the Arabic slugs are the ones that exposed the percent-encoding bug.
  const guideRows = await sql`
    SELECT DISTINCT ON (locale) locale, slug
    FROM article WHERE status = 'published' ORDER BY locale, created_at
  `;
  const guides = Object.fromEntries(guideRows.map((r) => [r.locale, r.slug]));

  const publicRoutes = [
    "",
    "/about",
    "/contact",
    "/equipment",
    cat ? `/equipment/${cat.slug}` : null,
    cls ? `/equipment/item/${cls.slug}` : null,
    "/faq",
    "/for-contractors",
    "/guides",
    (locale) => (guides[locale] ? `/guides/${encodeURIComponent(guides[locale])}` : null),
    "/how-it-works",
    "/locations",
    branch ? `/locations/${branch.slug}` : null,
    "/legal/terms",
    "/legal/privacy",
    "/login",
    "/quote",
    "/register",
    "/safety",
  ];

  const adminRoutes = [
    "/account",
    "/account/security",
    "/admin",
    "/admin/audit",
    "/admin/bookings",
    "/admin/quotes",
    "/admin/inventory",
    "/admin/utilization",
  ];

  // Booking reads are scoped to the actor and return 404 (not 403) for anyone
  // else, so these are swept as the customer who OWNS the booking. Sweeping
  // them as the admin would assert the wrong thing: a 200 there is the bug.
  const ownerRoutes = booking
    ? [
        `/booking/${booking.reference}`,
        `/booking/${booking.reference}/agreement`,
        `/booking/${booking.reference}/invoice`,
      ]
    : [];

  await sweep(publicRoutes, "public (anonymous)");

  await signInAs(process.env.SEED_ADMIN_EMAIL ?? "admin@example.com");
  await sweep(adminRoutes, "authenticated (admin)");

  if (ownerRoutes.length > 0) {
    await signInAs(booking.owner_email);
    await sweep(ownerRoutes, `booking owner (${booking.owner_email})`);
  } else {
    console.log("--- no bookings in the database; booking routes not swept ---");
    console.log("");
  }

  if (failures.length === 0) {
    console.log("All routes returned 200.");
  } else {
    console.log(`${failures.length} route(s) did not return 200:`);
    for (const f of failures) console.log(`  ${f}`);
  }
  process.exitCode = failures.length === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
