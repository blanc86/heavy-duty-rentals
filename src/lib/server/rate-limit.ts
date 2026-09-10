/**
 * Rate limiting.
 *
 * Two backends, and the choice is a deployment fact rather than a preference:
 *
 * `memory` is per-process. With N long-lived instances the effective limit is
 * N × the configured limit — acceptable for the coarse protections (search,
 * catalog), not acceptable for the security-critical ones (login, the booking
 * lookup, OTP). On a SERVERLESS platform it is worse than that: every cold
 * start begins with an empty map and concurrent invocations each keep their
 * own, so the limit stops existing under exactly the load it defends against.
 *
 * `postgres` shares one counter across every instance, which is what makes the
 * control real. It costs one round trip on limited paths. Those paths are
 * login, checkout and the booking lookup — none of them hot, all of them
 * already talking to the database.
 *
 * The default stays `memory` so a development machine needs no table. Any
 * deployment with more than one instance must set `postgres`; see
 * docs/SECURITY.md §2.
 */
import { sql as raw } from "drizzle-orm";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export interface RateLimitRule {
  /** Requests permitted per window. */
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Named rules, so limits live in one auditable place rather than being
 * sprinkled as magic numbers across route handlers.
 */
export const RATE_LIMITS = {
  login: { limit: 5, windowSeconds: 900 },
  loginPerIp: { limit: 20, windowSeconds: 3600 },
  register: { limit: 3, windowSeconds: 3600 },
  passwordReset: { limit: 3, windowSeconds: 3600 },
  mfaVerify: { limit: 5, windowSeconds: 600 },
  couponValidate: { limit: 10, windowSeconds: 60 },
  bookingCreate: { limit: 10, windowSeconds: 3600 },
  checkoutHold: { limit: 20, windowSeconds: 3600 },
  quoteRequest: { limit: 5, windowSeconds: 3600 },
  contactForm: { limit: 3, windowSeconds: 3600 },
  search: { limit: 120, windowSeconds: 60 },
  priceQuote: { limit: 60, windowSeconds: 60 },
  api: { limit: 300, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Bound memory so a flood of distinct keys cannot exhaust the heap. */
const MAX_BUCKETS = 50_000;

function sweep(now: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Still oversized after sweeping expired entries: drop the oldest half
  // rather than grow without bound.
  if (buckets.size >= MAX_BUCKETS) {
    const keys = [...buckets.keys()].slice(0, Math.floor(MAX_BUCKETS / 2));
    for (const key of keys) buckets.delete(key);
  }
}

/**
 * Consume one unit against a named limit.
 *
 * `identifier` should be the narrowest meaningful subject: for login that is
 * (ip + email), not ip alone — otherwise one office NAT locks out a whole site,
 * and an attacker rotating IPs bypasses it entirely.
 */
export async function checkRateLimit(
  name: RateLimitName,
  identifier: string,
): Promise<RateLimitResult> {
  const rule = RATE_LIMITS[name];
  const key = `${name}:${identifier}`;
  const now = Date.now();

  if (env.RATE_LIMIT_BACKEND === "postgres") {
    return consumeInPostgres(key, rule);
  }

  if (env.RATE_LIMIT_BACKEND === "redis") {
    // BOUNDARY: a Redis-backed limiter belongs here. NOT IMPLEMENTED.
    //
    // Falling through to memory used to be the whole of it, and the fallback
    // was worse than it looked: `assertProductionReady` warns when the backend
    // is `memory`, so selecting `redis` removed the warning AND kept the
    // per-process limiter. Someone setting it to fix multi-instance rate
    // limiting got neither Redis nor the notice that they had not got Redis.
    //
    // Startup now refuses `redis` in production outright. This throw covers
    // every other environment, so the switch can never be quietly ignored.
    throw new Error(
      "RATE_LIMIT_BACKEND=redis is selected but the Redis limiter is not implemented. " +
        "Use `postgres` for a limit shared across instances, or `memory` and " +
        "accept a per-instance limit. See docs/FINAL_REVIEW.md.",
    );
  }

  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowSeconds * 1000 });
    return { allowed: true, remaining: rule.limit - 1, retryAfterSeconds: 0 };
  }

  if (bucket.count >= rule.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return { allowed: true, remaining: rule.limit - bucket.count, retryAfterSeconds: 0 };
}

/**
 * Consume one unit against a shared counter in Postgres.
 *
 * The whole operation is ONE statement. Read-then-write would let two
 * concurrent requests both read `count = limit - 1` and both be allowed —
 * precisely the race a limiter exists to survive, and under an attack there is
 * nothing but concurrent requests.
 *
 * The window is fixed, not sliding. `expires_at` moves only when the previous
 * window has already elapsed, so a caller who keeps hammering cannot push
 * their own reset further away, and an expired row is reused rather than
 * accumulating.
 *
 * Reuses the `rate_limit_bucket` table defined in the first migration, whose
 * `count` is a varchar. Hence the cast: the arithmetic still happens in
 * Postgres, inside the one atomic statement, which is the part that matters.
 */
async function consumeInPostgres(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const rows = await db.execute<{ count: number; retry_after: number }>(raw`
    INSERT INTO rate_limit_bucket ("key", "count", "window_started_at", "expires_at")
    VALUES (${key}, '1', now(), now() + make_interval(secs => ${rule.windowSeconds}))
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
          THEN now() + make_interval(secs => ${rule.windowSeconds})
        ELSE rate_limit_bucket."expires_at"
      END
    RETURNING "count"::int AS count,
              ceil(extract(epoch FROM ("expires_at" - now())))::int AS retry_after
  `);

  const row = rows[0];
  if (!row) {
    // Cannot happen — the statement always returns its row. Failing CLOSED,
    // because a limiter that answers "allowed" when it did not work is the
    // failure mode that actually costs something.
    return { allowed: false, remaining: 0, retryAfterSeconds: rule.windowSeconds };
  }

  const count = Number(row.count);
  await sweepPostgres();

  if (count > rule.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Number(row.retry_after)),
    };
  }
  return { allowed: true, remaining: rule.limit - count, retryAfterSeconds: 0 };
}

/**
 * Drop expired rows occasionally.
 *
 * Probabilistic rather than scheduled, so the limiter needs no cron and no
 * external dependency. At 1-in-500 the table stays small without putting a
 * DELETE on the hot path.
 */
async function sweepPostgres(): Promise<void> {
  if (Math.random() > 0.002) return;
  try {
    await db.execute(
      raw`DELETE FROM rate_limit_bucket WHERE "expires_at" <= now() - make_interval(hours => 1)`,
    );
  } catch {
    // Housekeeping. A failure here must never fail the request that triggered
    // it — the limit itself was already applied above.
  }
}

/** Clear a limit after a legitimate success, so one bad typo does not cost the window. */
export async function resetRateLimit(name: RateLimitName, identifier: string): Promise<void> {
  const key = `${name}:${identifier}`;
  if (env.RATE_LIMIT_BACKEND === "postgres") {
    await db.execute(raw`DELETE FROM rate_limit_bucket WHERE "key" = ${key}`);
    return;
  }
  buckets.delete(key);
}

export class RateLimitError extends Error {
  readonly code = "rate_limited";
  constructor(readonly retryAfterSeconds: number) {
    super("Too many requests. Please wait a moment and try again.");
    this.name = "RateLimitError";
  }
}

/** Test-only. */
export function __clearAllRateLimits(): void {
  buckets.clear();
}
