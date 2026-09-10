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
    /**
     * Prepared statements, off behind a TRANSACTION-mode pooler.
     *
     * PgBouncer in transaction mode (which is what Neon's and Supabase's pooled
     * endpoints are) hands a different backend connection to each transaction.
     * A statement prepared on one is not there on the next, so postgres.js
     * raises `prepared statement "..." does not exist` — intermittently, under
     * concurrency, which is the worst way to find out.
     *
     * Off costs a little planning time per query. It is required for
     * correctness on a pooled endpoint and harmless on a direct one, but it is
     * still an explicit switch rather than a default: on a long-lived direct
     * connection the prepared path is genuinely faster and worth keeping.
     */
    prepare: !env.DATABASE_TRANSACTION_POOLER,
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

/**
 * Convert a timestamp coming out of a RAW `db.execute` query into a Date.
 *
 * Drizzle's postgres-js driver runs raw SQL through `client.unsafe(...)`, which
 * bypasses the type parsers the query builder relies on. A `timestamptz` column
 * therefore arrives as a STRING ("2026-09-08 00:00:00+00"), not a Date — even
 * though the same column read through `db.select()` is a Date.
 *
 * The generic on `db.execute<T>` is an unchecked assertion, so declaring
 * `start_date: Date` compiles happily and then explodes at runtime the first
 * time something does date arithmetic or hands it to `Intl.DateTimeFormat`
 * (which coerces a string to NaN and throws "Invalid time value").
 *
 * So: declare these columns as `string` in the row generic, and convert here at
 * the repository boundary. Passing a Date through is allowed because a query
 * built with `db.select()` genuinely does return one.
 */
export function parseTimestamp(value: string | Date): Date {
  if (value instanceof Date) return value;

  // Postgres renders timestamptz as "2026-09-08 00:00:00.123+00" — a space
  // instead of "T", and a two-digit offset. Neither is valid ISO 8601, so the
  // string is normalised rather than handed to Date's lenient non-standard
  // parser, whose behaviour is not guaranteed across engines.
  const iso = value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Not a valid timestamp from the driver: ${String(value)}`);
  }
  return date;
}

/** `parseTimestamp` for a nullable column. */
export function parseTimestampOrNull(value: string | Date | null): Date | null {
  return value === null || value === undefined ? null : parseTimestamp(value);
}
