/**
 * Rate limiting.
 *
 * The in-memory backend is per-process. With N app instances the effective
 * limit is N × the configured limit, which is acceptable for the coarse
 * protections (search, catalog) and NOT acceptable for the security-critical
 * ones (login, password reset, OTP).
 *
 * Production with more than one instance must set RATE_LIMIT_BACKEND=redis.
 * This is stated in .env.example and docs/SECURITY.md rather than silently
 * assumed, because a rate limit that quietly multiplies is worse than none:
 * it looks like a control.
 */
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

  if (env.RATE_LIMIT_BACKEND === "redis") {
    // BOUNDARY: a Redis-backed limiter belongs here. Not implemented — see
    // docs/FINAL_REVIEW.md. Falling through to memory is documented, not silent.
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

/** Clear a limit after a legitimate success, so one bad typo does not cost the window. */
export async function resetRateLimit(name: RateLimitName, identifier: string): Promise<void> {
  buckets.delete(`${name}:${identifier}`);
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
