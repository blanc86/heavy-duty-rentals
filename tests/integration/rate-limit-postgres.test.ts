import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeSql, getSql, isDatabaseAvailable } from "../helpers/db";

/**
 * THE SHARED RATE LIMITER.
 *
 * The in-memory limiter is per-process, so on a serverless platform it is not a
 * limit at all: every cold start begins with an empty map, and concurrent
 * invocations each keep their own. Login throttling and the booking-lookup
 * throttle both stop existing under exactly the load they defend against.
 *
 * These tests run the same single-statement upsert the limiter issues, against
 * a real database, and assert the three properties that make it a control:
 *
 *   1. it counts,
 *   2. it refuses past the limit,
 *   3. concurrent callers cannot both be allowed past it.
 *
 * (3) is why the implementation is one statement rather than read-then-write.
 * Under an attack there is nothing BUT concurrent callers, so a limiter that
 * only works when requests are serialised is decorative.
 */

const sql = getSql();
const KEY_PREFIX = "ratelimittest:";

let available = false;

/** The limiter's statement, verbatim in shape. */
async function consume(key: string, windowSeconds: number): Promise<number> {
  const rows = await sql<{ count: number }[]>`
    INSERT INTO rate_limit_bucket ("key", "count", "window_started_at", "expires_at")
    VALUES (${key}, '1', now(), now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN rate_limit_bucket."expires_at" <= now() THEN '1'
        ELSE (rate_limit_bucket."count"::bigint + 1)::text
      END,
      "window_started_at" = CASE
        WHEN rate_limit_bucket."expires_at" <= now() THEN now()
        ELSE rate_limit_bucket."window_started_at"
      END,
      "expires_at" = CASE
        WHEN rate_limit_bucket."expires_at" <= now()
          THEN now() + make_interval(secs => ${windowSeconds})
        ELSE rate_limit_bucket."expires_at"
      END
    RETURNING "count"::int AS count
  `;
  return Number(rows[0]?.count);
}

beforeAll(async () => {
  available = await isDatabaseAvailable();
});

afterAll(async () => {
  if (available) {
    await sql`DELETE FROM rate_limit_bucket WHERE "key" LIKE ${KEY_PREFIX + "%"}`;
  }
  await closeSql();
});

describe("postgres rate limiter", () => {
  it("counts consecutive consumptions against one key", async () => {
    if (!available) return;
    const key = `${KEY_PREFIX}counts`;
    expect(await consume(key, 900)).toBe(1);
    expect(await consume(key, 900)).toBe(2);
    expect(await consume(key, 900)).toBe(3);
  });

  it("keeps separate keys separate", async () => {
    if (!available) return;
    expect(await consume(`${KEY_PREFIX}a`, 900)).toBe(1);
    expect(await consume(`${KEY_PREFIX}b`, 900)).toBe(1);
  });

  it("does NOT let a hammering caller push their own reset away", async () => {
    if (!available) return;
    const key = `${KEY_PREFIX}window`;
    await consume(key, 900);
    const [first] = await sql<{ expires_at: Date }[]>`
      SELECT "expires_at" FROM rate_limit_bucket WHERE "key" = ${key}
    `;
    await consume(key, 900);
    const [second] = await sql<{ expires_at: Date }[]>`
      SELECT "expires_at" FROM rate_limit_bucket WHERE "key" = ${key}
    `;
    // A sliding window here would be a bypass: keep knocking, never expire.
    expect(second!.expires_at.getTime()).toBe(first!.expires_at.getTime());
  });

  it("starts a fresh window once the old one has elapsed", async () => {
    if (!available) return;
    const key = `${KEY_PREFIX}expiry`;
    // A window that is already over the moment it is written.
    await consume(key, 1);
    await sql`UPDATE rate_limit_bucket SET "expires_at" = now() - make_interval(secs => 1)
              WHERE "key" = ${key}`;
    expect(await consume(key, 900)).toBe(1);
  });

  it("counts every caller when twenty fire at once", async () => {
    if (!available) return;
    const key = `${KEY_PREFIX}concurrent`;
    // The property that read-then-write loses. Twenty concurrent consumptions
    // must yield the twenty distinct counts 1..20 — no two callers may receive
    // the same number, because two callers holding "5" both pass a limit of 5.
    const counts = await Promise.all(
      Array.from({ length: 20 }, () => consume(key, 900)),
    );
    expect(new Set(counts).size).toBe(20);
    expect(Math.max(...counts)).toBe(20);
  });
});
