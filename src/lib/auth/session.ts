import { and, eq, gt, isNotNull, isNull, sql as raw } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { companyMembers, mfaCredentials, sessions, users } from "@/lib/db/schema/identity";
import { env, isProduction } from "@/lib/env";
import { uuidv7 } from "@/lib/ids";
import { generateToken, hashToken } from "./crypto";

/**
 * The `__Host-` prefix is enforced by the browser: the cookie must be Secure,
 * have Path=/, and carry no Domain attribute. That makes it impossible for a
 * subdomain (or an attacker who controls one) to set or overwrite it.
 * Dev runs over http, where `__Host-` cookies are rejected, so the name differs.
 */
export const SESSION_COOKIE = isProduction ? "__Host-hdr_session" : "hdr_session";

export interface AuthenticatedActor {
  userId: string;
  email: string;
  fullName: string;
  preferredLocale: "en" | "ar";
  isPlatformAdmin: boolean;
  sessionId: string;
  mfaSatisfied: boolean;
  /** True when a confirmed TOTP credential exists for this user. */
  mfaEnrolled: boolean;
  /** Active company memberships. THE tenancy fact; never taken from a request. */
  memberships: { companyId: string; role: CompanyRole }[];
  /**
   * Set when this session exists only to view ONE booking — a guest who proved
   * ownership with a reference and the email it was made with.
   *
   * Every booking read narrows to this id when it is present. Without that,
   * one reference plus one email would open every booking that address ever
   * made; the reference is the secret, and it should unlock exactly what it
   * names.
   */
  scopedBookingId: string | null;
}

export type CompanyRole =
  | "owner"
  | "admin"
  | "procurement"
  | "finance"
  | "project_manager"
  | "viewer";

/**
 * Create a session and return the RAW token exactly once.
 *
 * Only the SHA-256 hash is persisted, so a database dump yields no usable
 * sessions. Callers must set the cookie immediately; the raw value is never
 * recoverable afterwards.
 */
export async function createSession(params: {
  userId: string;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  mfaSatisfied?: boolean;
  /**
   * Restrict this session to a single booking — a guest who proved they hold a
   * reference and the email it was made with. Such a session lives for HOURS,
   * not the usual thirty days: it exists to look at one rental, often on a
   * shared site-office machine, and a month-long token for that is a liability
   * with no upside.
   */
  scopedBookingId?: string | undefined;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const now = Date.now();
  const guestTtlMs = 4 * 60 * 60 * 1000;
  const expiresAt = params.scopedBookingId
    ? new Date(now + guestTtlMs)
    : new Date(now + env.SESSION_TTL_SECONDS * 1000);
  const absoluteExpiresAt = params.scopedBookingId
    ? new Date(now + guestTtlMs)
    : new Date(now + env.SESSION_ABSOLUTE_TTL_SECONDS * 1000);

  await db.insert(sessions).values({
    id: uuidv7(),
    userId: params.userId,
    tokenHash: hashToken(token),
    expiresAt,
    absoluteExpiresAt,
    scopedBookingId: params.scopedBookingId ?? null,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent?.slice(0, 512) ?? null,
    mfaSatisfiedAt: params.mfaSatisfied ? new Date() : null,
  });

  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

interface ResolvedSession {
  row: {
    sessionId: string;
    mfaSatisfiedAt: Date | null;
    scopedBookingId: string | null;
    expiresAt: Date;
    userId: string;
    email: string;
    fullName: string;
    preferredLocale: "en" | "ar";
    isPlatformAdmin: boolean;
  };
  mfaEnrolled: boolean;
}

/**
 * Load and validate the session behind the cookie.
 *
 * Shared by `getActor` and `getPendingMfaSession` so both agree on exactly what
 * a valid session is. Duplicating this check is how the two views drift apart
 * and one of them ends up accepting a revoked or expired session.
 */
async function resolveSession(): Promise<ResolvedSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const now = new Date();

  const [row] = await db
    .select({
      sessionId: sessions.id,
      mfaSatisfiedAt: sessions.mfaSatisfiedAt,
      scopedBookingId: sessions.scopedBookingId,
      expiresAt: sessions.expiresAt,
      userId: users.id,
      email: users.email,
      fullName: users.fullName,
      preferredLocale: users.preferredLocale,
      isPlatformAdmin: users.isPlatformAdmin,
      status: users.status,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
        // The absolute ceiling is checked too: a session that has been slid
        // forward for 90 days is finished regardless of recent activity.
        gt(sessions.absoluteExpiresAt, now),
      ),
    )
    .limit(1);

  if (!row) return null;
  // A suspended user's existing sessions must stop working immediately —
  // checked on every request rather than at sign-in, so suspending an account
  // takes effect now instead of whenever its session happens to expire.
  if (row.status !== "active") return null;

  // Enrolment is read fresh on every request rather than baked into the
  // session, so enabling MFA takes effect immediately on existing sessions.
  const [credential] = await db
    .select({ id: mfaCredentials.id })
    .from(mfaCredentials)
    .where(and(eq(mfaCredentials.userId, row.userId), isNotNull(mfaCredentials.confirmedAt)))
    .limit(1);

  return { row, mfaEnrolled: credential !== undefined };
}

/**
 * Resolve the current actor from the session cookie.
 *
 * Everything about the actor — identity, admin flag, company memberships — is
 * read from the database on each request. Nothing is trusted from the cookie
 * beyond the opaque token itself, so a forged or edited cookie yields no
 * privileges.
 *
 * IMPORTANT: a session belonging to a user who HAS enrolled MFA but has not
 * satisfied it returns null. The cookie exists, but it grants nothing anywhere
 * in the application until the challenge is passed — a half-authenticated
 * session that could still browse would defeat the second factor.
 *
 * Returns null rather than throwing: many pages are legitimately anonymous.
 */
export async function getActor(): Promise<AuthenticatedActor | null> {
  const resolved = await resolveSession();
  if (!resolved) return null;

  const { row, mfaEnrolled } = resolved;

  // Enrolled but unsatisfied: not an actor yet.
  if (mfaEnrolled && row.mfaSatisfiedAt === null) return null;

  const memberships = await db
    .select({ companyId: companyMembers.companyId, role: companyMembers.role })
    .from(companyMembers)
    .where(and(eq(companyMembers.userId, row.userId), eq(companyMembers.status, "active")));

  // Slide the expiry, but only when it is meaningfully stale, so an active
  // session does not write to the database on every single request.
  const now = new Date();
  const halfLife = env.SESSION_TTL_SECONDS * 500;
  if (row.expiresAt.getTime() - now.getTime() < halfLife) {
    await db
      .update(sessions)
      .set({ expiresAt: new Date(now.getTime() + env.SESSION_TTL_SECONDS * 1000) })
      .where(eq(sessions.id, row.sessionId));
  }

  return {
    userId: row.userId,
    email: row.email,
    fullName: row.fullName,
    preferredLocale: row.preferredLocale,
    isPlatformAdmin: row.isPlatformAdmin,
    sessionId: row.sessionId,
    mfaSatisfied: row.mfaSatisfiedAt !== null,
    scopedBookingId: row.scopedBookingId,
    mfaEnrolled,
    memberships,
  };
}

/**
 * The actor, but only if this is a FULL session.
 *
 * A booking-scoped guest session is not one: it exists to view a single rental
 * and must not reach account settings, the admin console, or anything else that
 * acts on behalf of the user id it carries. Server Actions get this rule from
 * `guard`; pages have no guard, so they call this instead of `getActor`.
 *
 * The pairing is deliberate — a page that wants "someone is signed in" almost
 * always means "signed in properly", and this makes that the shorter thing to
 * write.
 */
export async function getFullActor(): Promise<AuthenticatedActor | null> {
  const actor = await getActor();
  if (!actor || actor.scopedBookingId) return null;
  return actor;
}

/**
 * A session that exists but has NOT yet cleared the second factor.
 *
 * Returned only to the MFA challenge screen. `getActor` deliberately reports
 * null for this state, so the cookie grants nothing anywhere else in the
 * application until the challenge is passed.
 */
export interface PendingMfaSession {
  sessionId: string;
  userId: string;
  email: string;
  fullName: string;
  preferredLocale: "en" | "ar";
}

export async function getPendingMfaSession(): Promise<PendingMfaSession | null> {
  const resolved = await resolveSession();
  if (!resolved) return null;
  // Already satisfied, or MFA is not enrolled: there is no challenge to answer.
  if (!resolved.mfaEnrolled || resolved.row.mfaSatisfiedAt !== null) return null;

  return {
    sessionId: resolved.row.sessionId,
    userId: resolved.row.userId,
    email: resolved.row.email,
    fullName: resolved.row.fullName,
    preferredLocale: resolved.row.preferredLocale,
  };
}

/** Mark this session as having cleared the second factor. */
export async function markSessionMfaSatisfied(sessionId: string): Promise<void> {
  await db.update(sessions).set({ mfaSatisfiedAt: new Date() }).where(eq(sessions.id, sessionId));
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId));
}

/** "Sign out everywhere" — also used after a password change. */
export async function revokeAllSessionsForUser(userId: string, exceptSessionId?: string): Promise<void> {
  await db.execute(raw`
    UPDATE session SET revoked_at = now()
    WHERE user_id = ${userId}
      AND revoked_at IS NULL
      ${exceptSessionId ? raw`AND id <> ${exceptSessionId}` : raw``}
  `);
}

/**
 * Rotate the session id on privilege change (login, MFA completion, password
 * change). Defends against session fixation: a token an attacker planted
 * before the privilege change stops being the one that carries it.
 */
export async function rotateSession(
  oldSessionId: string,
  userId: string,
  opts: { mfaSatisfied?: boolean } = {},
): Promise<{ token: string; expiresAt: Date }> {
  await revokeSession(oldSessionId);
  const requestHeaders = await headers();
  return createSession({
    userId,
    ipAddress: clientIpFrom(requestHeaders),
    userAgent: requestHeaders.get("user-agent") ?? undefined,
    mfaSatisfied: opts.mfaSatisfied ?? false,
  });
}

/**
 * Best-effort client IP.
 *
 * Only meaningful when the app sits behind a proxy that OVERWRITES
 * X-Forwarded-For. If any client can set the header, this value is
 * attacker-controlled and must be treated as a hint for audit context, never
 * as a security decision on its own.
 */
export function clientIpFrom(h: Headers): string | undefined {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim();
  return h.get("x-real-ip") ?? undefined;
}

export async function requestContext(): Promise<{ ip?: string; userAgent?: string }> {
  const h = await headers();
  return {
    ip: clientIpFrom(h),
    userAgent: h.get("user-agent") ?? undefined,
  };
}
