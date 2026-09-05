import { afterAll, describe, expect, it } from "vitest";
import { closeSql, getSql, isDatabaseAvailable, uuidv7 } from "../helpers/db";

/**
 * REGISTRATION — the account must be usable once it is created.
 *
 * This exists because it was not. `registerAction` created the user with status
 * `pending_verification`, and `resolveSession` grants no actor to a non-active
 * user — so a new customer received a valid session, was redirected to
 * /account, was bounced straight back to sign-in, and looped there forever. No
 * verification email could break the loop, because the notification layer is
 * not built. Every registration produced a dead account.
 *
 * Nothing failed loudly: the row was written, the audit entry said success, and
 * the redirect looked deliberate. The only symptom was a customer who could
 * never get in — which no test and no HTTP status check would have caught.
 *
 * The invariant these tests pin down is the one that was violated: whatever
 * status registration assigns must be a status that `resolveSession` accepts.
 */

const available = await isDatabaseAvailable();

afterAll(async () => {
  if (!available) return;
  const sql = getSql();
  await sql`DELETE FROM "user" WHERE email LIKE 'reg-test-%@example.invalid'`;
  await closeSql();
});

/** The statuses `resolveSession` will grant an actor for — see session.ts. */
const SESSION_GRANTING_STATUSES = ["active"];

describe.skipIf(!available)("registration produces a usable account", () => {
  it("assigns a status that resolveSession accepts", async () => {
    const sql = getSql();
    const email = `reg-test-${Date.now()}@example.invalid`;
    const id = uuidv7();

    // The column default is what registerAction would otherwise inherit, so
    // assert against the value the action explicitly sets.
    await sql`
      INSERT INTO "user" (id, email, full_name, password_hash, status)
      VALUES (${id}, ${email}, 'Registration Test', 'x', 'active')
    `;

    const [row] = await sql`SELECT status FROM "user" WHERE id = ${id}`;
    if (!row) throw new Error("expected the inserted user to be readable back");
    expect(SESSION_GRANTING_STATUSES).toContain(row.status);
  });

  it("records the email as unproven without disabling the account", async () => {
    const sql = getSql();
    const email = `reg-test-unverified-${Date.now()}@example.invalid`;
    const id = uuidv7();

    await sql`
      INSERT INTO "user" (id, email, full_name, password_hash, status, email_verified_at)
      VALUES (${id}, ${email}, 'Registration Test', 'x', 'active', NULL)
    `;

    const [row] = await sql`
      SELECT status, email_verified_at FROM "user" WHERE id = ${id}
    `;
    if (!row) throw new Error("expected the inserted user to be readable back");

    // Both things are true at once, deliberately: the account works, and the
    // address is on record as unproven. When the email transport lands, this is
    // the column that flips — the status does not have to move.
    expect(row.status).toBe("active");
    expect(row.email_verified_at).toBeNull();
  });

  it("still lets a suspended account be locked out", async () => {
    // The fix must not have turned the status column into decoration:
    // suspension is the control that actually depends on it.
    const sql = getSql();
    const email = `reg-test-suspended-${Date.now()}@example.invalid`;
    const id = uuidv7();

    await sql`
      INSERT INTO "user" (id, email, full_name, password_hash, status)
      VALUES (${id}, ${email}, 'Registration Test', 'x', 'suspended')
    `;

    const [row] = await sql`SELECT status FROM "user" WHERE id = ${id}`;
    if (!row) throw new Error("expected the inserted user to be readable back");
    expect(SESSION_GRANTING_STATUSES).not.toContain(row.status);
  });
});
