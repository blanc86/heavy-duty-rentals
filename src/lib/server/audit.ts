import { sql as raw } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema/platform";
import { sha256 } from "@/lib/auth/crypto";
import { uuidv7 } from "@/lib/ids";

export type AuditOutcome = "success" | "failure" | "denied";
export type AuditActorType = "customer" | "admin" | "system" | "webhook" | "anonymous";

export interface AuditEntry {
  action: string;
  actorUserId?: string | null;
  actorType: AuditActorType;
  actorIp?: string | null;
  actorUserAgent?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  companyId?: string | null;
  outcome: AuditOutcome;
  metadata?: Record<string, unknown>;
}

/**
 * Keys whose VALUES must never reach the audit log, at any nesting depth.
 *
 * A redaction allowlist enforced in one place beats relying on every call site
 * to remember. Call sites are where this kind of leak actually happens.
 */
const REDACTED_KEYS = new Set([
  "password", "passwordhash", "password_hash", "newpassword", "currentpassword",
  "token", "tokenhash", "token_hash", "accesstoken", "refreshtoken", "sessiontoken",
  "secret", "secretencrypted", "apikey", "api_key", "privatekey",
  "cvv", "cvc", "cardnumber", "card_number", "pan", "expiry",
  "authorization", "cookie", "setcookie",
  "totp", "otp", "mfacode", "recoverycode",
  "nationalid", "iqama", "passport",
]);

const MAX_STRING_LENGTH = 500;
const MAX_DEPTH = 4;

function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[truncated]";
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => redact(v, depth + 1));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = REDACTED_KEYS.has(key.toLowerCase().replace(/[^a-z]/g, ""))
        ? "[redacted]"
        : redact(val, depth + 1);
    }
    return out;
  }

  return String(value);
}

/**
 * Deterministic serialisation for hashing: key order must not depend on
 * insertion order, or the chain would not be reproducible on verification.
 */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

/**
 * Append one hash-chained audit entry.
 *
 * `entryHash = SHA256(previousHash || canonical(entry))`. Altering or deleting
 * a historical row breaks every subsequent hash, so tampering is detectable
 * even if someone gains write access. The application role additionally holds
 * no UPDATE/DELETE on this table (see migration 0001 §9): detection and
 * prevention, because either alone is weaker.
 *
 * Never throws into the caller. An audit failure must not roll back a customer's
 * booking — but it must be shouted about in the server log.
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    const occurredAt = new Date();
    const metadata = redact(entry.metadata ?? {}) as Record<string, unknown>;

    // The immediately-preceding entry anchors this one to the chain.
    const [previous] = await db.execute<{ entry_hash: string }>(raw`
      SELECT entry_hash FROM audit_log ORDER BY occurred_at DESC, id DESC LIMIT 1
    `);
    const previousHash = previous?.entry_hash ?? null;

    const payload = canonicalJson({
      occurredAt: occurredAt.toISOString(),
      actorUserId: entry.actorUserId ?? null,
      actorType: entry.actorType,
      action: entry.action,
      resourceType: entry.resourceType ?? null,
      resourceId: entry.resourceId ?? null,
      companyId: entry.companyId ?? null,
      outcome: entry.outcome,
      metadata,
    });

    await db.insert(auditLogs).values({
      id: uuidv7(),
      occurredAt,
      actorUserId: entry.actorUserId ?? null,
      actorType: entry.actorType,
      actorIp: entry.actorIp ?? null,
      actorUserAgent: entry.actorUserAgent?.slice(0, 512) ?? null,
      action: entry.action,
      resourceType: entry.resourceType ?? null,
      resourceId: entry.resourceId ?? null,
      companyId: entry.companyId ?? null,
      outcome: entry.outcome,
      metadata,
      previousHash,
      entryHash: sha256(`${previousHash ?? ""}${payload}`),
    });
  } catch (error) {
    console.error("[audit] failed to write audit entry", {
      action: entry.action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Verify the chain. Run as a scheduled integrity job, and after any suspected
 * incident. Returns the first row where the chain breaks.
 */
export async function verifyAuditChain(limit = 10_000): Promise<{
  ok: boolean;
  checked: number;
  brokenAtId?: string;
}> {
  const rows = await db.execute<{
    id: string;
    // A string, not a Date: raw `db.execute` bypasses the driver's type
    // parsers. `new Date(...)` below normalises it, and the millisecond
    // truncation is deliberate — the hash was computed from a JS Date at write
    // time, so verification must reproduce exactly that precision.
    occurred_at: string;
    actor_user_id: string | null;
    actor_type: string;
    action: string;
    resource_type: string | null;
    resource_id: string | null;
    company_id: string | null;
    outcome: string;
    metadata: Record<string, unknown>;
    previous_hash: string | null;
    entry_hash: string;
  }>(raw`
    SELECT id, occurred_at, actor_user_id, actor_type, action, resource_type,
           resource_id, company_id, outcome, metadata, previous_hash, entry_hash
    FROM audit_log ORDER BY occurred_at ASC, id ASC LIMIT ${limit}
  `);

  let expectedPrevious: string | null = null;
  let checked = 0;

  for (const row of rows) {
    if (row.previous_hash !== expectedPrevious) {
      return { ok: false, checked, brokenAtId: row.id };
    }
    const payload = canonicalJson({
      occurredAt: new Date(row.occurred_at).toISOString(),
      actorUserId: row.actor_user_id,
      actorType: row.actor_type,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      companyId: row.company_id,
      outcome: row.outcome,
      metadata: row.metadata,
    });
    if (sha256(`${row.previous_hash ?? ""}${payload}`) !== row.entry_hash) {
      return { ok: false, checked, brokenAtId: row.id };
    }
    expectedPrevious = row.entry_hash;
    checked += 1;
  }

  return { ok: true, checked };
}
