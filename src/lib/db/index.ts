import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "@/lib/env";

/**
 * A single pooled connection per process.
 *
 * Next.js hot-reloads modules in development, which would otherwise open a new
 * pool on every edit until Postgres refuses connections. Stashing the client on
 * globalThis keeps exactly one.
 */
const globalForDb = globalThis as unknown as { __hdrSql?: ReturnType<typeof postgres> };

function createClient() {
  return postgres(env.DATABASE_URL, {
    max: env.DATABASE_POOL_MAX,
    // Fail fast rather than queueing requests behind an unreachable database.
    connect_timeout: 10,
    idle_timeout: 30,
    // Never log query parameters: they contain PII and, on the auth path,
    // token hashes. See docs/SECURITY.md §9.
    onnotice: () => {},
    transform: { undefined: null },
  });
}

export const sql = globalForDb.__hdrSql ?? createClient();
if (env.NODE_ENV !== "production") globalForDb.__hdrSql = sql;

export const db = drizzle(sql, { schema, logger: false });

export type Database = typeof db;
export { schema };

/**
 * Extract a Postgres SQLSTATE from an error, unwrapping driver wrappers.
 *
 * Drizzle wraps driver errors in its own Error and puts the original on
 * `cause`, so checking `error.code` at the top level silently misses every
 * constraint violation. That mattered here: an unrecognised exclusion
 * violation would surface to a customer as a 500 instead of the graceful
 * "no longer available" — precisely under the contention where it matters
 * most. We walk the cause chain rather than assuming a depth.
 */
function sqlState(error: unknown): string | null {
  let current: unknown = error;
  // Bounded so a self-referential cause chain cannot loop forever.
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (typeof current === "object" && current !== null) {
      const code = (current as { code?: unknown }).code;
      if (typeof code === "string") return code;
      current = (current as { cause?: unknown }).cause;
    } else {
      break;
    }
  }
  return null;
}

/**
 * Postgres SQLSTATE 23P01 — exclusion_violation.
 *
 * Raised when the reservation no-overlap constraint rejects an insert, i.e.
 * another customer won the race for this unit. The booking path catches
 * exactly this and reports "no longer available"; anything else is a real
 * error and must propagate.
 */
export function isExclusionViolation(error: unknown): boolean {
  return sqlState(error) === "23P01";
}

/** SQLSTATE 23505 — unique_violation. Used to detect idempotency-key replays. */
export function isUniqueViolation(error: unknown): boolean {
  return sqlState(error) === "23505";
}

/** Exposed for tests that assert the unwrapping behaviour directly. */
export { sqlState };
