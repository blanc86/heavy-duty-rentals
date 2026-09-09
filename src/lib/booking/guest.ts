import { and, eq, sql as raw } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings } from "@/lib/db/schema/booking";
import { users } from "@/lib/db/schema/identity";
import { uuidv7 } from "@/lib/ids";
import type { Locale } from "@/lib/i18n/config";

/**
 * Guest customers.
 *
 * Nobody creates an account to hire a machine. Requiring a signup before a
 * contractor can book costs bookings, and the account was never doing work the
 * business needed: identity is checked at handover, and the money is checked by
 * the card.
 *
 * A guest checkout still writes a `user` row, found or created by email. That
 * is deliberate and is what keeps this change small:
 *
 *   - `booking.customer_user_id` stays NOT NULL
 *   - every scoped read in the codebase keeps working unchanged
 *   - repeat customers group under one identity, so "this contractor has hired
 *     from us four times" stays answerable in the operations console
 *
 * The row simply cannot authenticate. There is no password that produces the
 * sentinel below, so the login path can never match it.
 */

/**
 * A `password_hash` value no password can ever produce.
 *
 * Argon2 verification of a string that is not a PHC-format hash fails rather
 * than matching, so this is unusable as a credential by construction. It is
 * also obviously not a hash to anyone reading the table, which matters more
 * than cleverness would.
 */
const NO_LOGIN_SENTINEL = "guest-checkout-no-password";

export interface GuestContact {
  email: string;
  fullName: string;
  phone?: string | undefined;
  locale: Locale;
}

/**
 * Find or create the customer record behind a guest checkout.
 *
 * Matching is on lowercased email, the same key the unique index uses, so two
 * bookings from one address land on one customer rather than two.
 *
 * An existing REAL account (staff, or a customer from before guest checkout)
 * is reused as-is and never downgraded to a guest: someone who can sign in
 * keeps that ability, and booking as a guest with a staff email must not strip
 * anyone's password.
 *
 * `isGuest` is returned because the caller must NOT hand out a booking-scoped
 * session for a real account. Anyone can type any email at checkout, so minting
 * a session against an address that already has an account would let a stranger
 * hold a session carrying that account holder's user id — narrow in what it can
 * read, but wrong in whose name it acts, which also corrupts the audit trail.
 */
export async function findOrCreateGuestCustomer(
  contact: GuestContact,
): Promise<{ userId: string; isGuest: boolean }> {
  const email = contact.email.trim().toLowerCase();

  const [existing] = await db
    .select({ id: users.id, isGuest: users.isGuest })
    .from(users)
    .where(raw`lower(${users.email}) = ${email}`)
    .limit(1);

  if (existing) return { userId: existing.id, isGuest: existing.isGuest };

  const id = uuidv7();
  try {
    await db.insert(users).values({
      id,
      email,
      fullName: contact.fullName,
      phone: contact.phone ?? null,
      passwordHash: NO_LOGIN_SENTINEL,
      preferredLocale: contact.locale,
      isGuest: true,
      // Active, because the booking is real and must work. The email is
      // unproven, which `emailVerifiedAt` being null records honestly.
      status: "active",
    });
    return { userId: id, isGuest: true };
  } catch {
    // Two concurrent checkouts from the same new address race on the unique
    // email index. The loser re-reads rather than failing the booking.
    const [raced] = await db
      .select({ id: users.id, isGuest: users.isGuest })
      .from(users)
      .where(raw`lower(${users.email}) = ${email}`)
      .limit(1);
    if (raced) return { userId: raced.id, isGuest: raced.isGuest };
    throw new Error("Could not resolve a customer record for this booking.");
  }
}

/**
 * Resolve a booking from a reference AND the email it was made with.
 *
 * Both are required. The reference alone is roughly a billion combinations,
 * which is guessable given time — and a correct guess would expose a name, a
 * phone number and a site address. Pairing it with the email means a guessed
 * reference is worth nothing without also knowing who made it.
 *
 * Returns the booking id, or null. The caller must not distinguish "no such
 * reference" from "wrong email" in anything it shows the user, or the lookup
 * becomes an oracle for which references exist.
 *
 * ONLY guest-owned bookings resolve here, and that restriction is load-bearing
 * rather than tidiness. Guest checkout attaches a booking to whichever user row
 * holds that email, so booking with an address that already has a REAL account
 * attaches it to that account. Without the `is_guest` test, anyone could book a
 * machine using a staff member's address and then "look up" their own reference
 * to receive a session carrying that staff member's user id. The account holder
 * has a password and signs in normally; nobody else gets in this way.
 */
export async function resolveGuestBooking(
  reference: string,
  email: string,
): Promise<{ bookingId: string; customerUserId: string } | null> {
  const [row] = await db
    .select({ bookingId: bookings.id, customerUserId: bookings.customerUserId })
    .from(bookings)
    .innerJoin(users, eq(users.id, bookings.customerUserId))
    .where(
      and(
        eq(bookings.reference, reference.trim().toUpperCase()),
        raw`lower(${users.email}) = ${email.trim().toLowerCase()}`,
        eq(users.isGuest, true),
      ),
    )
    .limit(1);

  return row ?? null;
}
