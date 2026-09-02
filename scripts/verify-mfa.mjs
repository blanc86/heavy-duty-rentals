#!/usr/bin/env node
/**
 * Live verification of the MFA gate.
 *
 * The property under test is the one that makes a second factor worth having:
 * a session created after a CORRECT PASSWORD but before the challenge is
 * answered must grant nothing. If it granted read access "just to browse",
 * a stolen password would still reach the account.
 *
 * Sessions are created directly in the database (that is what a correct
 * password produces) and then exercised over real HTTP.
 *
 * Usage:  node scripts/verify-mfa.mjs
 */
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import * as OTPAuth from "otpauth";

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

/** Create a session row exactly as a correct password would. */
async function createSession(userId, { mfaSatisfied }) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await sql`
    INSERT INTO session (id, user_id, token_hash, expires_at, absolute_expires_at, mfa_satisfied_at)
    VALUES (${uuidv7()}, ${userId}, ${tokenHash},
            now() + interval '30 days', now() + interval '90 days',
            ${mfaSatisfied ? sql`now()` : null})
  `;
  return token;
}

async function get(pathname, token) {
  return fetch(new URL(pathname, BASE), {
    redirect: "manual",
    headers: token ? { Cookie: `hdr_session=${token}` } : {},
  });
}

const isRedirect = (r) => r.status === 307 || r.status === 302 || r.status === 303;

async function main() {
  console.log(`Verifying the MFA gate against ${BASE}\n`);

  const [admin] = await sql`
    SELECT id, email FROM "user" WHERE is_platform_admin = TRUE ORDER BY created_at LIMIT 1
  `;
  if (!admin) {
    console.error("No admin user found. Run `npm run db:seed`.");
    return;
  }

  // Clean slate.
  await sql`DELETE FROM mfa_credential WHERE user_id = ${admin.id}`;
  await sql`DELETE FROM session WHERE user_id = ${admin.id}`;

  // --- Baseline: no MFA enrolled -----------------------------------------
  const plainToken = await createSession(admin.id, { mfaSatisfied: false });

  const adminNoMfa = await get("/en/admin", plainToken);
  check(
    "without MFA enrolled, an admin session reaches /admin",
    adminNoMfa.status === 200,
    `status ${adminNoMfa.status}`,
  );

  const accountNoMfa = await get("/en/account", plainToken);
  check(
    "without MFA enrolled, the account page loads",
    accountNoMfa.status === 200,
    `status ${accountNoMfa.status}`,
  );

  // --- Enrol MFA ----------------------------------------------------------
  // A confirmed credential; the secret's exact value does not matter here
  // because we are testing the GATE, not code verification (covered by
  // tests/integration/mfa.test.ts).
  const secret = new OTPAuth.Secret({ size: 20 }).base32;
  await sql`
    INSERT INTO mfa_credential
      (id, user_id, type, secret_encrypted, confirmed_at, recovery_code_hashes)
    VALUES (${uuidv7()}, ${admin.id}, 'totp', ${"placeholder-ciphertext"}, now(), ${sql.json([])})
  `;

  // --- THE CORE ASSERTION -------------------------------------------------
  // Same session token as before. Enrolment alone must revoke its power,
  // without needing the session to be recreated.
  const adminAfterEnrol = await get("/en/admin", plainToken);
  check(
    "once MFA is enrolled, an UNSATISFIED session is refused at /admin",
    isRedirect(adminAfterEnrol) || adminAfterEnrol.status === 404,
    `status ${adminAfterEnrol.status}`,
  );

  const accountAfterEnrol = await get("/en/account", plainToken);
  check(
    "once MFA is enrolled, an UNSATISFIED session is refused at /account",
    isRedirect(accountAfterEnrol),
    `status ${accountAfterEnrol.status} -> ${accountAfterEnrol.headers.get("location") ?? "-"}`,
  );

  const bookingAfterEnrol = await get("/en/booking/RNT-AAAAAA", plainToken);
  check(
    "an UNSATISFIED session cannot reach a booking page",
    isRedirect(bookingAfterEnrol) || bookingAfterEnrol.status === 404,
    `status ${bookingAfterEnrol.status}`,
  );

  // The challenge screen itself IS reachable — that is the one thing this
  // session may do.
  const challenge = await get("/en/login/mfa", plainToken);
  check(
    "the MFA challenge page IS reachable by the pending session",
    challenge.status === 200,
    `status ${challenge.status}`,
  );

  const challengeHtml = await challenge.text();
  check(
    "the challenge page names the account being signed into",
    challengeHtml.includes(admin.email),
  );
  check(
    "the challenge page does not leak the shared secret",
    !challengeHtml.includes("placeholder-ciphertext") && !challengeHtml.includes(secret),
  );

  // --- Satisfy the factor -------------------------------------------------
  const satisfiedToken = await createSession(admin.id, { mfaSatisfied: true });

  const adminSatisfied = await get("/en/admin", satisfiedToken);
  check(
    "a SATISFIED session reaches /admin again",
    adminSatisfied.status === 200,
    `status ${adminSatisfied.status}`,
  );

  const challengeWhenSatisfied = await get("/en/login/mfa", satisfiedToken);
  check(
    "a satisfied session is redirected away from the challenge",
    isRedirect(challengeWhenSatisfied),
    `status ${challengeWhenSatisfied.status}`,
  );

  // --- Anonymous ----------------------------------------------------------
  const anonSecurity = await get("/en/account/security", undefined);
  check(
    "the security page requires authentication",
    isRedirect(anonSecurity),
    `status ${anonSecurity.status}`,
  );

  // --- Tamper -------------------------------------------------------------
  const forged = await get("/en/admin", "not-a-real-session-token");
  check(
    "a forged session cookie grants nothing",
    isRedirect(forged) || forged.status === 404,
    `status ${forged.status}`,
  );

  // Cleanup so a re-run starts clean and the seeded admin still works.
  await sql`DELETE FROM mfa_credential WHERE user_id = ${admin.id}`;
  await sql`DELETE FROM session WHERE user_id = ${admin.id}`;

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
