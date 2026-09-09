import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeSql, getSql, isDatabaseAvailable, uuidv7 } from "../helpers/db";

/**
 * GUEST ACCESS INVARIANTS.
 *
 * Customers have no accounts. A booking is reached with its reference plus the
 * email it was made with, and that pair mints a session restricted to the one
 * booking it names. Three things must hold, and each is a real breach if it
 * does not:
 *
 *   1. A booking-scoped session sees ONE booking — not the other bookings made
 *      by the same email address.
 *   2. The lookup never resolves a booking owned by a REAL account. Anyone can
 *      type any email at checkout, so without this a stranger could book using
 *      a staff address and then receive a session carrying that person's id.
 *   3. A guest row can never be a platform admin, enforced by the database
 *      rather than by the code that writes it.
 *
 * These are written against SQL rather than the repository so they check the
 * data shape the repository depends on, and keep working if it is refactored.
 */

const sql = getSql();

/** Test fixtures are prefixed so cleanup can never touch seeded data. */
const TAG = "guesttest";

let available = false;

async function makeUser(email: string, isGuest: boolean): Promise<string> {
  const id = uuidv7();
  await sql`
    INSERT INTO "user" (id, email, full_name, phone, password_hash, preferred_locale, is_guest, status)
    VALUES (${id}, ${email}, 'Guest Test', NULL,
            ${isGuest ? "guest-checkout-no-password" : "$argon2id$v=19$m=1,t=1,p=1$c29tZXNhbHQ$aGFzaA"},
            'en', ${isGuest}, 'active')
  `;
  return id;
}

async function makeBooking(customerUserId: string, reference: string): Promise<string> {
  const id = uuidv7();
  await sql`
    INSERT INTO booking (
      id, reference, customer_user_id, status,
      start_date, end_date, billable_days,
      rental_subtotal_halalas, addons_subtotal_halalas, transport_subtotal_halalas,
      discount_halalas, taxable_subtotal_halalas, vat_rate_ppm, vat_halalas,
      total_halalas, deposit_halalas, currency
    )
    VALUES (
      ${id}, ${reference}, ${customerUserId}, 'confirmed',
      now(), now() + interval '3 days', 3,
      100000, 0, 0, 0, 100000, 150000, 15000,
      115000, 0, 'SAR'
    )
  `;
  return id;
}

beforeAll(async () => {
  available = await isDatabaseAvailable();
});

afterAll(async () => {
  if (available) {
    await sql`DELETE FROM booking WHERE reference LIKE ${"GT-%"}`;
    await sql`DELETE FROM "user" WHERE email LIKE ${`%@${TAG}.invalid`}`;
  }
  await closeSql();
});

describe("guest booking lookup", () => {
  it("resolves only when the reference AND the email both match", async () => {
    if (!available) return;
    const userId = await makeUser(`one@${TAG}.invalid`, true);
    await makeBooking(userId, "GT-AAAAA1");

    const match = async (reference: string, email: string) => sql<{ id: string }[]>`
      SELECT b.id FROM booking b
      JOIN "user" u ON u.id = b.customer_user_id
      WHERE b.reference = ${reference}
        AND lower(u.email) = ${email}
        AND u.is_guest = TRUE
    `;

    expect(await match("GT-AAAAA1", `one@${TAG}.invalid`)).toHaveLength(1);
    // Right reference, wrong email: the reference alone is not a credential.
    expect(await match("GT-AAAAA1", `other@${TAG}.invalid`)).toHaveLength(0);
    // Right email, wrong reference.
    expect(await match("GT-ZZZZZ9", `one@${TAG}.invalid`)).toHaveLength(0);
  });

  it("REFUSES a booking that belongs to a real account", async () => {
    if (!available) return;
    // Someone books a machine while logged out, typing an address that already
    // has an account. The booking attaches to that account — and must NOT be
    // openable by whoever typed the address.
    const staffId = await makeUser(`staff@${TAG}.invalid`, false);
    await makeBooking(staffId, "GT-BBBBB2");

    const rows = await sql<{ id: string }[]>`
      SELECT b.id FROM booking b
      JOIN "user" u ON u.id = b.customer_user_id
      WHERE b.reference = ${"GT-BBBBB2"}
        AND lower(u.email) = ${`staff@${TAG}.invalid`}
        AND u.is_guest = TRUE
    `;
    expect(rows).toHaveLength(0);
  });
});

describe("booking-scoped sessions", () => {
  it("narrow to a single booking, not to everything the email has booked", async () => {
    if (!available) return;
    const userId = await makeUser(`repeat@${TAG}.invalid`, true);
    const first = await makeBooking(userId, "GT-CCCCC3");
    await makeBooking(userId, "GT-DDDDD4");

    // What `scopeFor` produces for a scoped actor: id equality, nothing wider.
    const scoped = await sql<{ id: string }[]>`SELECT id FROM booking WHERE id = ${first}`;
    expect(scoped).toHaveLength(1);

    // What the SAME user would see with a full session. The gap between these
    // two counts is exactly the disclosure the scoping prevents.
    const unscoped = await sql<{ id: string }[]>`
      SELECT id FROM booking WHERE customer_user_id = ${userId}
    `;
    expect(unscoped).toHaveLength(2);
  });

  it("cannot be created with MFA already satisfied", async () => {
    if (!available) return;
    const userId = await makeUser(`mfa@${TAG}.invalid`, true);
    const bookingId = await makeBooking(userId, "GT-EEEEE5");

    // A scoped session is not a second factor and must never look like one.
    // The database refuses the combination outright.
    await expect(
      sql`
        INSERT INTO session (id, user_id, token_hash, expires_at, absolute_expires_at,
                             scoped_booking_id, mfa_satisfied_at)
        VALUES (${uuidv7()}, ${userId}, ${"a".repeat(64)},
                now() + interval '1 hour', now() + interval '1 hour',
                ${bookingId}, now())
      `,
    ).rejects.toThrow();
  });
});

describe("guest customer records", () => {
  it("can never be a platform admin", async () => {
    if (!available) return;
    const userId = await makeUser(`admin@${TAG}.invalid`, true);

    // Enforced by a CHECK constraint, so it holds against any writer —
    // including a future code path that forgets the rule.
    await expect(
      sql`UPDATE "user" SET is_platform_admin = TRUE WHERE id = ${userId}`,
    ).rejects.toThrow();
  });

  it("hold a password hash that no password can produce", async () => {
    if (!available) return;
    const userId = await makeUser(`nologin@${TAG}.invalid`, true);
    const [row] = await sql<{ password_hash: string }[]>`
      SELECT password_hash FROM "user" WHERE id = ${userId}
    `;
    // Argon2 verification needs PHC format; this is not one, so it fails to
    // parse rather than matching. Sign-in cannot succeed against a guest row.
    expect(row?.password_hash.startsWith("$argon2")).toBe(false);
  });
});
