import { headers } from "next/headers";
import { z } from "zod";
import { getActor, requestContext, type AuthenticatedActor } from "@/lib/auth/session";
import { env } from "@/lib/env";
import {
  AuthenticationError,
  AuthorizationError,
  canAdmin,
  canInCompany,
  type Permission,
} from "@/lib/rbac";
import { writeAudit, type AuditActorType } from "./audit";
import { checkRateLimit, RateLimitError, type RateLimitName } from "./rate-limit";

/**
 * THE SERVER TRUST BOUNDARY.
 *
 * Every server entry point — Server Action or Route Handler — goes through
 * `guard`. It runs the same steps in the same order every time:
 *
 *   1. CSRF origin check   (state-changing requests only)
 *   2. Rate limit
 *   3. Authenticate
 *   4. Authorize           (RBAC + resource scope)
 *   5. Validate input      (Zod, strict — unknown keys rejected)
 *   6. Run the handler
 *   7. Audit the outcome
 *
 * Having one composable helper is the point: a route cannot silently skip a
 * step, because skipping a step means not using `guard` at all, which is
 * visible in review.
 */

export interface GuardOptions<TSchema extends z.ZodType> {
  /** Zod schema for the input. Use `.strict()` on objects to reject unknown keys. */
  schema?: TSchema;
  /** Require an authenticated actor. */
  requireAuth?: boolean;
  /** Require platform admin AND the named admin permission. */
  requireAdmin?: Permission;
  /** Require this permission within the company resolved by `companyId`. */
  requireCompanyPermission?: { permission: Permission; companyId: string };
  /** Require the session to have satisfied MFA (mandatory for admin actions). */
  requireMfa?: boolean;
  /**
   * Permit a BOOKING-SCOPED session (a guest who proved they hold a reference
   * and the email it was booked with).
   *
   * Off by default, and deliberately opt-IN: such a session must reach only
   * the handful of actions that operate on the one booking it names. The
   * default matters because guest checkout attaches a booking to whatever user
   * row owns that email — which can be a REAL account if someone books using
   * an address that already has one. A scoped session therefore carries a
   * `userId` that is not necessarily the visitor's, so letting it change a
   * password or a profile would be account takeover. It is refused everywhere
   * unless the action says otherwise.
   */
  allowScopedSession?: boolean;
  rateLimit?: { name: RateLimitName; identifier?: string };
  /** Skip the origin check. ONLY for provider webhooks, which authenticate by signature. */
  skipCsrf?: boolean;
  audit?: {
    action: string;
    resourceType?: string;
    resourceId?: string;
  };
}

export interface GuardContext<TInput> {
  input: TInput;
  actor: AuthenticatedActor | null;
  ip: string | undefined;
  userAgent: string | undefined;
}

export class ValidationError extends Error {
  readonly code = "validation_failed";
  constructor(readonly issues: { path: string; message: string }[]) {
    super("Please check the highlighted fields.");
    this.name = "ValidationError";
  }
}

/**
 * CSRF: verify the request's Origin matches our own.
 *
 * SameSite=Lax on the session cookie is the primary defence; this is the
 * second layer, because SameSite is a browser behaviour and not every client
 * or configuration honours it identically.
 */
async function assertSameOrigin(): Promise<void> {
  const h = await headers();
  const origin = h.get("origin");

  // Same-origin non-CORS requests may omit Origin entirely; Sec-Fetch-Site
  // then tells us what we need.
  if (!origin) {
    const fetchSite = h.get("sec-fetch-site");
    if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
      throw new AuthorizationError("Cross-origin request rejected.");
    }
    return;
  }

  const expected = new URL(env.APP_URL).origin;
  let actual: string;
  try {
    actual = new URL(origin).origin;
  } catch {
    throw new AuthorizationError("Invalid request origin.");
  }

  if (actual !== expected) {
    throw new AuthorizationError("Cross-origin request rejected.");
  }
}

export async function guard<TSchema extends z.ZodType, TResult>(
  rawInput: unknown,
  options: GuardOptions<TSchema>,
  handler: (ctx: GuardContext<z.infer<TSchema>>) => Promise<TResult>,
): Promise<TResult> {
  const { ip, userAgent } = await requestContext();

  let actor: AuthenticatedActor | null = null;
  let actorType: AuditActorType = "anonymous";

  try {
    // --- 1. CSRF -----------------------------------------------------------
    if (!options.skipCsrf) await assertSameOrigin();

    // --- 2. Rate limit -----------------------------------------------------
    // Applied BEFORE authentication so that unauthenticated flooding of the
    // login endpoint is cheap for us and expensive for the attacker.
    if (options.rateLimit) {
      const identifier = options.rateLimit.identifier ?? ip ?? "unknown";
      const result = await checkRateLimit(options.rateLimit.name, identifier);
      if (!result.allowed) throw new RateLimitError(result.retryAfterSeconds);
    }

    // --- 3. Authenticate ---------------------------------------------------
    const needsActor =
      options.requireAuth || options.requireAdmin || options.requireCompanyPermission;
    if (needsActor) {
      actor = await getActor();
      if (!actor) throw new AuthenticationError();
      actorType = actor.isPlatformAdmin ? "admin" : "customer";
    } else {
      actor = await getActor();
      if (actor) actorType = actor.isPlatformAdmin ? "admin" : "customer";
    }

    // --- 4. Authorize ------------------------------------------------------
    if (options.requireAdmin) {
      if (!canAdmin(actor, options.requireAdmin)) {
        throw new AuthorizationError();
      }
      // Admin actions always require a session that has satisfied MFA. An
      // admin session obtained without a second factor must not be able to
      // change rates or issue refunds.
      if (!actor?.mfaSatisfied && env.NODE_ENV === "production") {
        throw new AuthorizationError("Two-factor authentication is required for this action.");
      }
    }

    if (options.requireCompanyPermission && actor) {
      const { permission, companyId } = options.requireCompanyPermission;
      if (!canInCompany(actor, companyId, permission)) {
        throw new AuthorizationError();
      }
    }

    if (options.requireMfa && actor && !actor.mfaSatisfied) {
      throw new AuthorizationError("Two-factor authentication is required for this action.");
    }

    // A booking-scoped session may not act AS the user it names. Placed AFTER
    // the other authorization checks so it can only ever subtract from what
    // they allowed, never add to it.
    //
    // What it must not do is refuse work that needs no identity at all. A guest
    // who books a pump holds a scoped session for four hours; refusing every
    // guarded endpoint left them unable to price a second machine, let alone
    // book one — the checkout simply reported "please sign in" at someone who
    // has no account to sign in to.
    //
    // So the rule splits by whether the action needs an actor. If it does, the
    // scoped session is refused. If it does not, the caller is treated as
    // ANONYMOUS: the session is dropped rather than honoured, so it can never
    // leak an identity into an action that never asked for one, and a second
    // booking correctly goes down the guest path and mints its own session.
    if (actor?.scopedBookingId && !options.allowScopedSession) {
      if (needsActor) {
        throw new AuthorizationError(
          "Please sign in to do that. Looking up a booking gives access to that booking only.",
        );
      }
      actor = null;
      actorType = "anonymous";
    }

    // --- 5. Validate -------------------------------------------------------
    let input = rawInput as z.infer<TSchema>;
    if (options.schema) {
      const parsed = options.schema.safeParse(rawInput);
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        );
      }
      input = parsed.data;
    }

    // --- 6. Handle ---------------------------------------------------------
    const result = await handler({ input, actor, ip, userAgent });

    // --- 7. Audit ----------------------------------------------------------
    if (options.audit) {
      await writeAudit({
        action: options.audit.action,
        actorUserId: actor?.userId ?? null,
        actorType,
        actorIp: ip ?? null,
        actorUserAgent: userAgent ?? null,
        resourceType: options.audit.resourceType ?? null,
        resourceId: options.audit.resourceId ?? null,
        outcome: "success",
      });
    }

    return result;
  } catch (error) {
    // Every denial is audited. A single 403 is noise; a pattern of them is an
    // attacker probing, and that pattern only exists if we record the denials.
    if (error instanceof AuthorizationError || error instanceof AuthenticationError) {
      await writeAudit({
        action: options.audit?.action ?? "authorization.denied",
        actorUserId: actor?.userId ?? null,
        actorType,
        actorIp: ip ?? null,
        actorUserAgent: userAgent ?? null,
        resourceType: options.audit?.resourceType ?? null,
        resourceId: options.audit?.resourceId ?? null,
        outcome: "denied",
        metadata: { reason: error.code },
      });
    }
    throw error;
  }
}

/**
 * Convert an internal error into something safe to send to a client.
 *
 * Never leaks a stack trace, a SQL fragment, an internal id or an
 * infrastructure detail. The technical detail is logged server-side, keyed by
 * a reference the user can quote to support.
 */
export function toClientError(error: unknown): {
  code: string;
  message: string;
  issues?: { path: string; message: string }[];
  retryAfterSeconds?: number;
} {
  if (error instanceof ValidationError) {
    return { code: error.code, message: error.message, issues: error.issues };
  }
  if (error instanceof RateLimitError) {
    return { code: error.code, message: error.message, retryAfterSeconds: error.retryAfterSeconds };
  }
  if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
    return { code: error.code, message: error.message };
  }
  // Domain errors opt in to being shown by carrying a `code`.
  if (
    error instanceof Error &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return { code: (error as { code: string }).code, message: error.message };
  }

  const reference = crypto.randomUUID().slice(0, 8);
  console.error(`[error ${reference}]`, error);
  return {
    code: "internal_error",
    message: `Something went wrong. If this keeps happening, quote reference ${reference}.`,
  };
}

/** Assert an authenticated actor, for use inside a guarded handler. */
export function requireActor(actor: AuthenticatedActor | null): AuthenticatedActor {
  if (!actor) throw new AuthenticationError();
  return actor;
}
