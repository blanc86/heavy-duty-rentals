"use server";

import { and, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { mfaCredentials } from "@/lib/db/schema/identity";
import { users } from "@/lib/db/schema/identity";
import { uuidv7 } from "@/lib/ids";
import { writeAudit } from "@/lib/server/audit";
import { guard, requireActor, toClientError } from "@/lib/server/guard";
import { resetRateLimit } from "@/lib/server/rate-limit";
import { verifyPassword } from "./crypto";
import {
  accountLabelFor,
  createEnrolmentSecret,
  generateRecoveryCodes,
  verifyRecoveryCode,
  verifyTotp,
} from "./mfa";
import {
  getPendingMfaSession,
  // Enrolment keeps its session: the user is ALREADY fully authenticated there,
  // and is adding a factor rather than elevating a half-authenticated token.
  markSessionMfaSatisfied,
  revokeAllSessionsForUser,
  rotateSession,
  setSessionCookie,
} from "./session";

export type MfaResult<T = unknown> =
  | ({ ok: true } & (T extends object ? T : Record<never, never>))
  | { ok: false; error: { code: string; message: string } };

/**
 * Begin TOTP enrolment.
 *
 * Creates an UNCONFIRMED credential. Enrolment only takes effect once the user
 * proves they can generate a code — otherwise a mis-scanned QR would lock the
 * account out of its own second factor, which for an admin means locking them
 * out of every admin action.
 */
export async function beginMfaEnrolment(): Promise<
  MfaResult<{ secretBase32: string; qrSvg: string; uri: string }>
> {
  try {
    return await guard(
      {},
      { requireAuth: true, audit: { action: "mfa.enrolment_started", resourceType: "user" } },
      async ({ actor: maybeActor }) => {
        const actor = requireActor(maybeActor);

        const [existing] = await db
          .select({ id: mfaCredentials.id })
          .from(mfaCredentials)
          .where(
            and(eq(mfaCredentials.userId, actor.userId), isNotNull(mfaCredentials.confirmedAt)),
          )
          .limit(1);

        if (existing) {
          return {
            ok: false as const,
            error: {
              code: "already_enrolled",
              message: "Two-factor authentication is already enabled. Disable it first to re-enrol.",
            },
          };
        }

        const enrolment = await createEnrolmentSecret(accountLabelFor(actor.email));

        // Replace any abandoned unconfirmed attempt so a stale secret cannot
        // later be confirmed by someone who captured that earlier QR.
        await db
          .delete(mfaCredentials)
          .where(eq(mfaCredentials.userId, actor.userId));

        await db.insert(mfaCredentials).values({
          id: uuidv7(),
          userId: actor.userId,
          type: "totp",
          secretEncrypted: enrolment.secretEncrypted,
          confirmedAt: null,
          lastUsedCounter: null,
          recoveryCodeHashes: [],
        });

        return {
          ok: true as const,
          secretBase32: enrolment.secretBase32,
          qrSvg: enrolment.qrSvg,
          uri: enrolment.uri,
        };
      },
    );
  } catch (error) {
    return { ok: false, error: toClientError(error) };
  }
}

const codeSchema = z.object({ code: z.string().min(6).max(20).trim() }).strict();

/**
 * Confirm enrolment by verifying a code, then issue recovery codes.
 *
 * The recovery codes are returned exactly once. They are stored hashed, so
 * neither we nor a database thief can recover them afterwards.
 */
export async function confirmMfaEnrolment(
  input: unknown,
): Promise<MfaResult<{ recoveryCodes: string[] }>> {
  try {
    return await guard(
      input,
      {
        schema: codeSchema,
        requireAuth: true,
        rateLimit: { name: "mfaVerify" },
        audit: { action: "mfa.enrolment_confirmed", resourceType: "user" },
      },
      async ({ input: data, actor: maybeActor, ip }) => {
        const actor = requireActor(maybeActor);

        const [credential] = await db
          .select()
          .from(mfaCredentials)
          .where(eq(mfaCredentials.userId, actor.userId))
          .limit(1);

        if (!credential) {
          return {
            ok: false as const,
            error: { code: "not_started", message: "Start enrolment again." },
          };
        }
        if (credential.confirmedAt) {
          return {
            ok: false as const,
            error: { code: "already_enrolled", message: "Two-factor authentication is already enabled." },
          };
        }

        const verification = verifyTotp(
          credential.secretEncrypted,
          data.code,
          accountLabelFor(actor.email),
          credential.lastUsedCounter,
        );

        if (!verification.ok) {
          await writeAudit({
            action: "mfa.enrolment_code_rejected",
            actorUserId: actor.userId,
            actorType: "customer",
            actorIp: ip ?? null,
            outcome: "failure",
            metadata: { reason: verification.reason },
          });
          return {
            ok: false as const,
            error: { code: verification.reason, message: "That code is not valid. Try the next one." },
          };
        }

        const recovery = generateRecoveryCodes();

        await db
          .update(mfaCredentials)
          .set({
            confirmedAt: new Date(),
            lastUsedCounter: BigInt(verification.counter),
            recoveryCodeHashes: recovery.hashes,
          })
          .where(eq(mfaCredentials.id, credential.id));

        // This session has just proved the second factor, so mark it satisfied
        // rather than immediately challenging the user who set it up.
        await markSessionMfaSatisfied(actor.sessionId);

        // Enabling MFA is a privilege change: every OTHER session predates the
        // second factor and must be re-authenticated.
        await revokeAllSessionsForUser(actor.userId, actor.sessionId);

        await writeAudit({
          action: "mfa.enabled",
          actorUserId: actor.userId,
          actorType: actor.isPlatformAdmin ? "admin" : "customer",
          actorIp: ip ?? null,
          resourceType: "user",
          resourceId: actor.userId,
          outcome: "success",
        });

        return { ok: true as const, recoveryCodes: recovery.plaintext };
      },
    );
  } catch (error) {
    return { ok: false, error: toClientError(error) };
  }
}

/**
 * Answer the MFA challenge at login.
 *
 * Runs against a session that exists but grants nothing (`getActor` returns
 * null for it). Accepts either a TOTP code or a recovery code; a recovery code
 * is consumed on use.
 */
export async function verifyMfaChallenge(input: unknown): Promise<MfaResult<{ redirectTo: string }>> {
  const pending = await getPendingMfaSession();

  try {
    return await guard(
      input,
      {
        schema: codeSchema.extend({ locale: z.enum(["en", "ar"]).default("en") }).strict(),
        // No `requireAuth`: by design there is no actor yet. The pending
        // session below IS the authentication context.
        rateLimit: { name: "mfaVerify", identifier: pending?.userId ?? "anonymous" },
      },
      async ({ input: data, ip, userAgent }) => {
        if (!pending) {
          return {
            ok: false as const,
            error: { code: "no_challenge", message: "Please sign in again." },
          };
        }

        const [credential] = await db
          .select()
          .from(mfaCredentials)
          .where(
            and(eq(mfaCredentials.userId, pending.userId), isNotNull(mfaCredentials.confirmedAt)),
          )
          .limit(1);

        if (!credential) {
          return {
            ok: false as const,
            error: { code: "no_challenge", message: "Please sign in again." },
          };
        }

        const totp = verifyTotp(
          credential.secretEncrypted,
          data.code,
          accountLabelFor(pending.email),
          credential.lastUsedCounter,
        );

        if (totp.ok) {
          await db
            .update(mfaCredentials)
            .set({ lastUsedCounter: BigInt(totp.counter) })
            .where(eq(mfaCredentials.id, credential.id));
        } else {
          // Fall back to a recovery code. Consumed on use, so it cannot become
          // a standing bypass.
          const recovery = verifyRecoveryCode(data.code, credential.recoveryCodeHashes);
          if (!recovery.ok) {
            await writeAudit({
              action: "mfa.challenge_failed",
              actorUserId: pending.userId,
              actorType: "customer",
              actorIp: ip ?? null,
              actorUserAgent: userAgent ?? null,
              outcome: "failure",
              metadata: { reason: totp.reason },
            });
            return {
              ok: false as const,
              error: { code: "invalid_code", message: "That code is not valid." },
            };
          }

          await db
            .update(mfaCredentials)
            .set({ recoveryCodeHashes: recovery.remainingHashes })
            .where(eq(mfaCredentials.id, credential.id));

          await writeAudit({
            action: "mfa.recovery_code_used",
            actorUserId: pending.userId,
            actorType: "customer",
            actorIp: ip ?? null,
            outcome: "success",
            metadata: { remaining: recovery.remainingHashes.length },
          });
        }

        // ROTATE rather than mark the existing session satisfied.
        //
        // Passing the second factor is a privilege elevation, and the token
        // that was in the browser during the challenge was only ever a
        // half-authenticated one. Anyone who obtained a copy of it — a shared
        // depot machine, a leaked log line — would otherwise find their copy
        // silently upgraded to a fully privileged session the moment the real
        // user completed the challenge. Issuing a new token leaves the stolen
        // one revoked and useless.
        const rotated = await rotateSession(pending.sessionId, pending.userId, {
          mfaSatisfied: true,
        });
        await setSessionCookie(rotated.token, rotated.expiresAt);

        await resetRateLimit("mfaVerify", pending.userId);

        await writeAudit({
          action: "mfa.challenge_passed",
          actorUserId: pending.userId,
          actorType: "customer",
          actorIp: ip ?? null,
          actorUserAgent: userAgent ?? null,
          outcome: "success",
        });

        return { ok: true as const, redirectTo: `/${data.locale}/account` };
      },
    );
  } catch (error) {
    return { ok: false, error: toClientError(error) };
  }
}

const disableSchema = z.object({ password: z.string().min(1).max(256) }).strict();

/**
 * Disable MFA.
 *
 * Requires the account password. Removing a second factor is a privilege
 * REDUCTION, and an attacker sitting on a hijacked session must not be able to
 * strip it without knowing the password.
 */
export async function disableMfa(input: unknown): Promise<MfaResult> {
  try {
    return await guard(
      input,
      {
        schema: disableSchema,
        requireAuth: true,
        // The session must itself have cleared MFA before it can remove it.
        requireMfa: true,
        rateLimit: { name: "mfaVerify" },
        audit: { action: "mfa.disable_attempt", resourceType: "user" },
      },
      async ({ input: data, actor: maybeActor, ip }) => {
        const actor = requireActor(maybeActor);

        const [user] = await db
          .select({ passwordHash: users.passwordHash })
          .from(users)
          .where(eq(users.id, actor.userId))
          .limit(1);

        if (!user || !(await verifyPassword(user.passwordHash, data.password))) {
          await writeAudit({
            action: "mfa.disable_rejected",
            actorUserId: actor.userId,
            actorType: "customer",
            actorIp: ip ?? null,
            outcome: "denied",
          });
          return {
            ok: false as const,
            error: { code: "invalid_credentials", message: "Your password is incorrect." },
          };
        }

        await db.delete(mfaCredentials).where(eq(mfaCredentials.userId, actor.userId));

        await writeAudit({
          action: "mfa.disabled",
          actorUserId: actor.userId,
          actorType: actor.isPlatformAdmin ? "admin" : "customer",
          actorIp: ip ?? null,
          resourceType: "user",
          resourceId: actor.userId,
          outcome: "success",
        });

        return { ok: true as const };
      },
    );
  } catch (error) {
    return { ok: false, error: toClientError(error) };
  }
}

/** Regenerate recovery codes, invalidating the previous set. */
export async function regenerateRecoveryCodes(): Promise<MfaResult<{ recoveryCodes: string[] }>> {
  try {
    return await guard(
      {},
      {
        requireAuth: true,
        requireMfa: true,
        rateLimit: { name: "mfaVerify" },
        audit: { action: "mfa.recovery_codes_regenerated", resourceType: "user" },
      },
      async ({ actor: maybeActor }) => {
        const actor = requireActor(maybeActor);

        const [credential] = await db
          .select({ id: mfaCredentials.id })
          .from(mfaCredentials)
          .where(
            and(eq(mfaCredentials.userId, actor.userId), isNotNull(mfaCredentials.confirmedAt)),
          )
          .limit(1);

        if (!credential) {
          return {
            ok: false as const,
            error: { code: "not_enrolled", message: "Two-factor authentication is not enabled." },
          };
        }

        const recovery = generateRecoveryCodes();
        await db
          .update(mfaCredentials)
          .set({ recoveryCodeHashes: recovery.hashes })
          .where(eq(mfaCredentials.id, credential.id));

        return { ok: true as const, recoveryCodes: recovery.plaintext };
      },
    );
  } catch (error) {
    return { ok: false, error: toClientError(error) };
  }
}

/** MFA status for the security page. */
export async function getMfaStatus(): Promise<{
  enrolled: boolean;
  confirmedAt: Date | null;
  recoveryCodesRemaining: number;
}> {
  const { getActor } = await import("./session");
  const actor = await getActor();
  if (!actor) return { enrolled: false, confirmedAt: null, recoveryCodesRemaining: 0 };

  const [credential] = await db
    .select({
      confirmedAt: mfaCredentials.confirmedAt,
      recoveryCodeHashes: mfaCredentials.recoveryCodeHashes,
    })
    .from(mfaCredentials)
    .where(and(eq(mfaCredentials.userId, actor.userId), isNotNull(mfaCredentials.confirmedAt)))
    .limit(1);

  return {
    enrolled: credential !== undefined,
    confirmedAt: credential?.confirmedAt ?? null,
    recoveryCodesRemaining: credential?.recoveryCodeHashes.length ?? 0,
  };
}
