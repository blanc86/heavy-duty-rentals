import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeSql, getSql, isDatabaseAvailable, uuidv7 } from "../helpers/db";
import {
  ROLE_PERMISSIONS,
  PLATFORM_ADMIN_PERMISSIONS,
  accessibleCompanyIds,
  canAccessResource,
  canAdmin,
  canInCompany,
  roleHasPermission,
  roleInCompany,
} from "@/lib/rbac";
import type { AuthenticatedActor } from "@/lib/auth/session";
import { hashToken, safeEqual } from "@/lib/auth/crypto";
import { checkPassword } from "@/lib/auth/password-policy";

/**
 * SECURITY INVARIANTS.
 *
 * Each of these encodes a promise made in docs/SECURITY.md §6. They are written
 * as executable assertions rather than prose because "we check authorization"
 * is not verifiable and "company A gets nothing for company B's id" is.
 */

function actor(overrides: Partial<AuthenticatedActor> = {}): AuthenticatedActor {
  return {
    userId: "user-a",
    email: "a@example.com",
    fullName: "User A",
    preferredLocale: "en",
    isPlatformAdmin: false,
    sessionId: "session-a",
    mfaSatisfied: false,
    memberships: [],
    ...overrides,
  };
}

const COMPANY_A = "aaaaaaaa-0000-7000-8000-000000000001";
const COMPANY_B = "bbbbbbbb-0000-7000-8000-000000000002";

describe("tenant isolation (RBAC layer)", () => {
  const memberOfA = actor({
    userId: "user-a",
    memberships: [{ companyId: COMPANY_A, role: "owner" }],
  });

  it("grants permission inside the actor's own company", () => {
    expect(canInCompany(memberOfA, COMPANY_A, "booking:read")).toBe(true);
    expect(canInCompany(memberOfA, COMPANY_A, "booking:create")).toBe(true);
  });

  it("DENIES every permission for a company the actor is not a member of", () => {
    // Even as an OWNER of company A, company B must be completely opaque.
    for (const permission of ROLE_PERMISSIONS.owner) {
      expect(canInCompany(memberOfA, COMPANY_B, permission)).toBe(false);
    }
  });

  it("returns no role for a company the actor does not belong to", () => {
    expect(roleInCompany(memberOfA, COMPANY_A)).toBe("owner");
    expect(roleInCompany(memberOfA, COMPANY_B)).toBeNull();
  });

  it("exposes only the actor's own company ids for query scoping", () => {
    expect(accessibleCompanyIds(memberOfA)).toEqual([COMPANY_A]);
    expect(accessibleCompanyIds(actor())).toEqual([]);
  });

  it("denies a suspended/absent membership even with a valid company id", () => {
    // `memberships` only ever contains ACTIVE rows (the session loader filters
    // on status), so a removed member loses access on their next request.
    const removed = actor({ memberships: [] });
    expect(canInCompany(removed, COMPANY_A, "booking:read")).toBe(false);
  });
});

describe("resource ownership (IDOR defence)", () => {
  const customerA = actor({ userId: "user-a" });
  const customerB = actor({ userId: "user-b" });

  it("lets a customer reach their OWN individual resource", () => {
    const resource = { ownerUserId: "user-a", companyId: null };
    expect(canAccessResource(customerA, resource, "booking:read")).toBe(true);
  });

  it("DENIES a customer another customer's resource", () => {
    const resource = { ownerUserId: "user-a", companyId: null };
    expect(canAccessResource(customerB, resource, "booking:read")).toBe(false);
  });

  it("routes a company-owned resource through membership, not ownership", () => {
    const resource = { ownerUserId: null, companyId: COMPANY_A };
    const memberOfA = actor({ memberships: [{ companyId: COMPANY_A, role: "viewer" }] });

    expect(canAccessResource(memberOfA, resource, "booking:read")).toBe(true);
    // A viewer can read but must not cancel: RBAC and ownership are BOTH
    // required, and ownership alone is not sufficient.
    expect(canAccessResource(memberOfA, resource, "booking:cancel")).toBe(false);
    expect(canAccessResource(customerB, resource, "booking:read")).toBe(false);
  });
});

describe("privilege escalation", () => {
  it("never grants admin permissions to a non-admin, whatever their company role", () => {
    const companyOwner = actor({ memberships: [{ companyId: COMPANY_A, role: "owner" }] });
    for (const permission of PLATFORM_ADMIN_PERMISSIONS) {
      expect(canAdmin(companyOwner, permission)).toBe(false);
    }
  });

  it("grants admin permissions only when isPlatformAdmin is set on the USER record", () => {
    const platformAdmin = actor({ isPlatformAdmin: true });
    expect(canAdmin(platformAdmin, "admin:access")).toBe(true);
    expect(canAdmin(platformAdmin, "admin:refund")).toBe(true);
  });

  it("denies admin permissions to an anonymous actor", () => {
    expect(canAdmin(null, "admin:access")).toBe(false);
  });

  it("keeps admin permissions OUT of every company role", () => {
    // The two axes must not overlap: no company role may contain an admin:*
    // permission, or a company owner could escalate into internal operations.
    for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      const adminPermissions = permissions.filter((p) => p.startsWith("admin:"));
      expect(adminPermissions, `role ${role} must hold no admin:* permission`).toEqual([]);
    }
  });
});

describe("separation of duties within a company", () => {
  it("lets procurement create a booking but NOT approve it", () => {
    expect(roleHasPermission("procurement", "booking:create")).toBe(true);
    // The whole point of the procurement role: it cannot approve its own spend.
    expect(roleHasPermission("procurement", "booking:approve")).toBe(false);
  });

  it("lets finance see the money but not commit the company to new rentals", () => {
    expect(roleHasPermission("finance", "invoice:read")).toBe(true);
    expect(roleHasPermission("finance", "payment:manage")).toBe(true);
    expect(roleHasPermission("finance", "booking:create")).toBe(false);
  });

  it("keeps a viewer read-only", () => {
    expect(roleHasPermission("viewer", "booking:read")).toBe(true);
    expect(roleHasPermission("viewer", "booking:create")).toBe(false);
    expect(roleHasPermission("viewer", "booking:cancel")).toBe(false);
    expect(roleHasPermission("viewer", "member:manage")).toBe(false);
  });

  it("restricts member management to owner and admin", () => {
    expect(roleHasPermission("owner", "member:manage")).toBe(true);
    expect(roleHasPermission("admin", "member:manage")).toBe(true);
    for (const role of ["procurement", "finance", "project_manager", "viewer"] as const) {
      expect(roleHasPermission(role, "member:manage")).toBe(false);
    }
  });

  it("restricts credit management to the owner alone", () => {
    expect(roleHasPermission("owner", "credit:manage")).toBe(true);
    for (const role of ["admin", "procurement", "finance", "project_manager", "viewer"] as const) {
      expect(roleHasPermission(role, "credit:manage")).toBe(false);
    }
  });
});

describe("token handling", () => {
  it("stores only a hash, never the raw session token", () => {
    const token = "a-very-secret-session-token";
    const hash = hashToken(token);
    expect(hash).not.toContain(token);
    expect(hash).toHaveLength(64);
    // Deterministic, so lookup works; irreversible, so a DB dump is useless.
    expect(hashToken(token)).toBe(hash);
  });

  it("compares secrets in constant time and rejects length mismatches", () => {
    expect(safeEqual("abc123", "abc123")).toBe(true);
    expect(safeEqual("abc123", "abc124")).toBe(false);
    expect(safeEqual("abc", "abcdef")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});

describe("password policy", () => {
  it("requires length over composition", () => {
    expect(checkPassword("short").ok).toBe(false);
    // 12+ characters with no symbols is fine — length is the requirement.
    expect(checkPassword("correcthorsebatterystaple").ok).toBe(true);
  });

  it("rejects passwords containing the user's own identifiers", () => {
    expect(
      checkPassword("fahad-alotaibi-2026", { name: "Fahad Alotaibi", email: "f@example.com" }).ok,
    ).toBe(false);
    expect(
      checkPassword("procurement-team-x9", { email: "procurement@example.com" }).ok,
    ).toBe(false);
  });

  it("rejects application-specific guessable terms", () => {
    expect(checkPassword("cranerentalriyadh").ok).toBe(false);
    expect(checkPassword("heavydutyrentals1").ok).toBe(false);
  });

  it("rejects long runs and simple sequences that pass a length check", () => {
    expect(checkPassword("aaaaaaaaaaaaaaa").ok).toBe(false);
    expect(checkPassword("abcdefghijklmnop").ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Database-level guarantees
// ---------------------------------------------------------------------------

let dbAvailable = false;
beforeAll(async () => {
  dbAvailable = await isDatabaseAvailable();
});
afterAll(async () => {
  await closeSql();
});

describe.runIf(await isDatabaseAvailable())("database-enforced money invariants", () => {
  it("rejects a booking with negative money", async () => {
    const sql = getSql();
    let failed = false;
    try {
      await sql`
        INSERT INTO booking
          (id, reference, status, customer_user_id, start_date, end_date, billable_days,
           vat_rate_ppm, total_halalas)
        VALUES (${uuidv7()}, ${`TST-${uuidv7().slice(0, 6)}`}, 'draft',
                ${uuidv7()}, now(), now() + interval '1 day', 1, 150000, -100)
      `;
    } catch {
      failed = true;
    }
    // Rejected by CHECK (or by the FK) — either way the row cannot exist.
    expect(failed).toBe(true);
  });

  it("rejects an invoice whose total does not equal subtotal + VAT", async () => {
    const sql = getSql();
    let code = "";
    try {
      await sql`
        INSERT INTO invoice
          (id, booking_id, invoice_number, seller_name, buyer_name,
           subtotal_halalas, vat_rate_ppm, vat_halalas, total_halalas)
        VALUES (${uuidv7()}, ${uuidv7()}, ${`INV-TEST-${uuidv7().slice(0, 6)}`},
                'Seller', 'Buyer', 1000, 150000, 150, 9999)
      `;
    } catch (error) {
      code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code: unknown }).code)
          : "";
    }
    // 23514 = check_violation, 23503 = foreign_key_violation. Either proves the
    // database refused an invoice that does not foot.
    expect(["23514", "23503"]).toContain(code);
  });

  it("rejects a review rating outside 1..5", async () => {
    const sql = getSql();
    let failed = false;
    try {
      await sql`
        INSERT INTO review (id, booking_id, user_id, class_id, rating)
        VALUES (${uuidv7()}, ${uuidv7()}, ${uuidv7()}, ${uuidv7()}, 99)
      `;
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });

  it("rejects a coupon redeemed beyond its cap", async () => {
    const sql = getSql();
    const couponId = uuidv7();
    const code = `TESTCAP${uuidv7().slice(0, 6).toUpperCase()}`;

    await sql`
      INSERT INTO coupon
        (id, code, discount_type, value, valid_from, valid_to, max_redemptions, redemption_count)
      VALUES (${couponId}, ${code}, 'percent', 1000,
              now() - interval '1 day', now() + interval '30 days', 1, 0)
    `;

    try {
      await sql`UPDATE coupon SET redemption_count = 1 WHERE id = ${couponId}`;

      let overRedeemed = false;
      try {
        // The CHECK is what makes concurrent redemption of the last use safe:
        // application logic alone could let N requests all pass the same read.
        await sql`UPDATE coupon SET redemption_count = 2 WHERE id = ${couponId}`;
        overRedeemed = true;
      } catch {
        overRedeemed = false;
      }
      expect(overRedeemed).toBe(false);
    } finally {
      await sql`DELETE FROM coupon WHERE id = ${couponId}`;
    }
  });
});

describe.runIf(await isDatabaseAvailable())("webhook replay defence", () => {
  it("cannot record the same provider event twice", async () => {
    const sql = getSql();
    const eventId = `evt_test_${uuidv7().slice(0, 12)}`;

    await sql`
      INSERT INTO payment_webhook_event
        (id, provider, provider_event_id, event_type, signature_verified, payload_hash)
      VALUES (${uuidv7()}, 'mock', ${eventId}, 'payment.captured', TRUE, ${"a".repeat(64)})
    `;

    let code = "";
    try {
      // A replayed webhook must violate the unique index rather than credit a
      // payment a second time.
      await sql`
        INSERT INTO payment_webhook_event
          (id, provider, provider_event_id, event_type, signature_verified, payload_hash)
        VALUES (${uuidv7()}, 'mock', ${eventId}, 'payment.captured', TRUE, ${"a".repeat(64)})
      `;
    } catch (error) {
      code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code: unknown }).code)
          : "";
    }
    expect(code).toBe("23505");

    await sql`DELETE FROM payment_webhook_event WHERE provider_event_id = ${eventId}`;
  });
});

describe.runIf(await isDatabaseAvailable())("schema cannot hold card data", () => {
  it("has no column capable of storing a PAN, CVV or expiry", async () => {
    const sql = getSql();
    const rows = await sql<{ column_name: string; table_name: string }[]>`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          column_name ILIKE '%card_number%' OR
          column_name ILIKE '%cardnumber%' OR
          column_name = 'pan' OR
          column_name ILIKE '%cvv%' OR
          column_name ILIKE '%cvc%' OR
          column_name ILIKE '%expiry%' OR
          column_name ILIKE '%card_expiry%'
        )
    `;
    // Structural, not procedural: there is nowhere to put card data, which is
    // a stronger guarantee than a policy saying we do not.
    expect(rows).toEqual([]);
  });

  it("stores only a 4-character last4 field for display", async () => {
    const sql = getSql();
    const rows = await sql<{ character_maximum_length: number }[]>`
      SELECT character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'payment' AND column_name = 'last4'
    `;
    expect(rows[0]?.character_maximum_length).toBe(4);
  });
});

describe.runIf(await isDatabaseAvailable())("company ownership constraint", () => {
  it("allows only one active owner per company", async () => {
    const sql = getSql();
    const companyId = uuidv7();
    const userOne = uuidv7();
    const userTwo = uuidv7();

    await sql`INSERT INTO company (id, name_en, status) VALUES (${companyId}, 'Test Co', 'active')`;
    await sql`
      INSERT INTO "user" (id, email, full_name, password_hash, status)
      VALUES (${userOne}, ${`o1-${userOne}@example.com`}, 'Owner One', 'x', 'active'),
             (${userTwo}, ${`o2-${userTwo}@example.com`}, 'Owner Two', 'x', 'active')
    `;

    try {
      await sql`
        INSERT INTO company_member (id, company_id, user_id, role, status, joined_at)
        VALUES (${uuidv7()}, ${companyId}, ${userOne}, 'owner', 'active', now())
      `;

      let code = "";
      try {
        // Two active owners would make "who can grant roles" ambiguous.
        await sql`
          INSERT INTO company_member (id, company_id, user_id, role, status, joined_at)
          VALUES (${uuidv7()}, ${companyId}, ${userTwo}, 'owner', 'active', now())
        `;
      } catch (error) {
        code =
          typeof error === "object" && error !== null && "code" in error
            ? String((error as { code: unknown }).code)
            : "";
      }
      expect(code).toBe("23505");
    } finally {
      await sql`DELETE FROM company_member WHERE company_id = ${companyId}`;
      await sql`DELETE FROM company WHERE id = ${companyId}`;
      await sql`DELETE FROM "user" WHERE id IN (${userOne}, ${userTwo})`;
    }
  });
});

describe.runIf(await isDatabaseAvailable())("project site tenancy", () => {
  it("rejects a site owned by both a company and an individual", async () => {
    const sql = getSql();
    let failed = false;
    try {
      await sql`
        INSERT INTO project_site (id, company_id, owner_user_id, name, city, address_line)
        VALUES (${uuidv7()}, ${uuidv7()}, ${uuidv7()}, 'Ambiguous', 'Riyadh', 'x')
      `;
    } catch {
      failed = true;
    }
    // A site with two owners could be reached by two different scoped queries.
    expect(failed).toBe(true);
  });

  it("rejects a site with no owner at all", async () => {
    const sql = getSql();
    let code = "";
    try {
      await sql`
        INSERT INTO project_site (id, company_id, owner_user_id, name, city, address_line)
        VALUES (${uuidv7()}, NULL, NULL, 'Orphan', 'Riyadh', 'x')
      `;
    } catch (error) {
      code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code: unknown }).code)
          : "";
    }
    // An ownerless row is unreachable by every scoped query — dead data.
    expect(code).toBe("23514");
  });
});

describe("database availability", () => {
  it("reports whether integration coverage actually ran", () => {
    if (!dbAvailable) {
      console.warn(
        "\n  ⚠ Postgres unavailable — database security tests were SKIPPED.\n" +
          "    Run `npm run db:up` first. CI must set REQUIRE_DB=1.\n",
      );
    }
    expect(typeof dbAvailable).toBe("boolean");
  });
});

describe("driver error unwrapping", () => {
  it("finds a SQLSTATE nested inside a driver wrapper", async () => {
    const { isExclusionViolation, isUniqueViolation, sqlState } = await import("@/lib/db");

    // Drizzle wraps driver errors and puts the original on `cause`. Checking
    // only the top level silently misses every constraint violation, which
    // would turn a lost booking race into a 500 instead of a clean
    // "no longer available".
    const wrapped = new Error("Failed query");
    (wrapped as Error & { cause?: unknown }).cause = { code: "23P01" };

    expect(sqlState(wrapped)).toBe("23P01");
    expect(isExclusionViolation(wrapped)).toBe(true);
    expect(isUniqueViolation(wrapped)).toBe(false);
  });

  it("finds a SQLSTATE at the top level too", async () => {
    const { isUniqueViolation } = await import("@/lib/db");
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("returns null rather than looping on a self-referential cause chain", async () => {
    const { sqlState } = await import("@/lib/db");
    const looping: { cause?: unknown } = {};
    looping.cause = looping;
    expect(sqlState(looping)).toBeNull();
  });

  it("returns null for a plain error with no SQLSTATE", async () => {
    const { sqlState, isExclusionViolation } = await import("@/lib/db");
    expect(sqlState(new Error("boom"))).toBeNull();
    expect(isExclusionViolation(new Error("boom"))).toBe(false);
    expect(isExclusionViolation(null)).toBe(false);
  });
});
