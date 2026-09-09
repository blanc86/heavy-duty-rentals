"use server";

import { and, eq, isNotNull, sql as raw } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { companyMembers, companies, mfaCredentials, users } from "@/lib/db/schema/identity";
import { uuidv7 } from "@/lib/ids";
import { getDummyHash, hashPassword, verifyPassword } from "./crypto";
import { checkPassword, passwordSchema } from "./password-policy";
import { safeLoginRedirect } from "./safe-redirect";
import {
  clearSessionCookie,
  createSession,
  getActor,
  revokeAllSessionsForUser,
  revokeSession,
  setSessionCookie,
} from "./session";
import { writeAudit } from "@/lib/server/audit";
import { guard, toClientError } from "@/lib/server/guard";
import { RateLimitError, checkRateLimit, resetRateLimit } from "@/lib/server/rate-limit";
import type { Locale } from "@/lib/i18n/config";

export type ActionResult =
  | { ok: true; redirectTo?: string }
  | {
      ok: false;
      error: { code: string; message: string; issues?: { path: string; message: string }[] };
    };

const emailSchema = z
  .email()
  .max(320)
  .transform((v) => v.trim().toLowerCase());

const registerSchema = z
  .object({
    fullName: z.string().min(2).max(200).trim(),
    email: emailSchema,
    phone: z.string().max(32).trim().optional(),
    password: passwordSchema,
    locale: z.enum(["en", "ar"]).default("en"),
    // PDPL: separate, unbundled, never pre-ticked. Accepting terms is a
    // different act from consenting to marketing, and conflating them is one
    // of the violations SDAIA actively penalises.
    marketingConsent: z.boolean().default(false),
    companyName: z.string().max(240).trim().optional(),
  })
  .strict();

export async function registerAction(input: unknown): Promise<ActionResult> {
  try {
    return await guard(
      input,
      { schema: registerSchema, rateLimit: { name: "register" } },
      async ({ input: data, ip }) => {
        const policy = checkPassword(data.password, { email: data.email, name: data.fullName });
        if (!policy.ok) {
          return {
            ok: false as const,
            error: { code: "weak_password", message: policy.reason ?? "Password is too weak." },
          };
        }

        const passwordHash = await hashPassword(data.password);
        const userId = uuidv7();

        try {
          await db.transaction(async (tx) => {
            await tx.insert(users).values({
              id: userId,
              email: data.email,
              fullName: data.fullName,
              phone: data.phone ?? null,
              passwordHash,
              preferredLocale: data.locale,

              // ACTIVE on registration, with `emailVerifiedAt` left null.
              //
              // The account is usable; the email address is recorded as
              // unproven, which is the truth. Registering as
              // `pending_verification` instead would be a dead end today:
              // `resolveSession` grants no actor to a non-active user, so a new
              // customer would receive a valid session, be redirected to
              // /account, be bounced straight back to sign-in, and loop there
              // — with no verification email to escape it, because the
              // notification layer is not built (docs/FINAL_REVIEW.md §3).
              //
              // What actually guards identity here is downstream and stronger
              // than an email click: a booking requires a successful card
              // payment, and the machine is not released without an ID check at
              // handover (docs/SECURITY.md §8). When the email transport lands,
              // `emailVerifiedAt` is the column that flips, and gating whatever
              // then needs a proven address is a smaller change than this
              // comment.
              status: "active",
              marketingConsentAt: data.marketingConsent ? new Date() : null,
              marketingConsentSource: data.marketingConsent ? "registration" : null,
              marketingConsentIp: data.marketingConsent ? (ip ?? null) : null,
            });

            if (data.companyName) {
              const companyId = uuidv7();
              await tx.insert(companies).values({
                id: companyId,
                nameEn: data.companyName,
                status: "pending_review",
                contactEmail: data.email,
              });
              await tx.insert(companyMembers).values({
                id: uuidv7(),
                companyId,
                userId,
                role: "owner",
                status: "active",
                joinedAt: new Date(),
              });
            }
          });
        } catch (error) {
          // A duplicate email must not disclose that the account exists. We
          // return the same shape as success — the legitimate owner gets
          // nothing new, and an enumerator learns nothing.
          if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "23505"
          ) {
            await writeAudit({
              action: "auth.register_duplicate_email",
              actorType: "anonymous",
              actorIp: ip ?? null,
              outcome: "failure",
            });
            return { ok: true as const, redirectTo: `/${data.locale}/login?registered=1` };
          }
          throw error;
        }

        const session = await createSession({ userId, ipAddress: ip });
        await setSessionCookie(session.token, session.expiresAt);

        await writeAudit({
          action: "auth.registered",
          actorUserId: userId,
          actorType: "customer",
          actorIp: ip ?? null,
          resourceType: "user",
          resourceId: userId,
          outcome: "success",
          metadata: { marketingConsent: data.marketingConsent },
        });

        return { ok: true as const, redirectTo: `/${data.locale}/account` };
      },
    );
  } catch (error) {
    return { ok: false, error: toClientError(error) };
  }
}

const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(256),
    locale: z.enum(["en", "ar"]).default("en"),
    redirectTo: z.string().max(500).optional(),
  })
  .strict();

export async function loginAction(input: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  const emailForLimit = parsed.success ? parsed.data.email : "unknown";

  try {
    return await guard(
      input,
      {
        schema: loginSchema,
        // Limited per EMAIL here, and additionally per IP inside the handler.
        // Two separate buckets, deliberately: this one stops someone hammering
        // a single account, and the IP one stops spraying across many. This
        // comment used to claim the identifier was "email + IP" while passing
        // the email alone, which is how the spraying gap survived so long.
        rateLimit: { name: "login", identifier: emailForLimit },
      },
      async ({ input: data, ip, userAgent }) => {
        // A SECOND limit, keyed on the caller rather than the target.
        //
        // `guard` above limits by email, which stops someone hammering one
        // account. It does nothing against spraying: a bucket is keyed on
        // `name:identifier`, so a thousand accounts is a thousand fresh
        // allowances, and one likely password tried against all of them never
        // trips a per-account limit. `loginPerIp` was defined for exactly this
        // and was never wired to anything.
        //
        // Both are needed, and neither substitutes for the other: IP alone
        // locks out a whole site behind one office NAT, email alone lets an
        // attacker walk the user list.
        const perIp = await checkRateLimit("loginPerIp", ip ?? "unknown");
        if (!perIp.allowed) {
          await writeAudit({
            action: "auth.login_rate_limited",
            actorType: "anonymous",
            actorIp: ip ?? null,
            actorUserAgent: userAgent ?? null,
            outcome: "denied",
            metadata: { scope: "ip" },
          });
          throw new RateLimitError(perIp.retryAfterSeconds);
        }

        const [user] = await db
          .select({
            id: users.id,
            passwordHash: users.passwordHash,
            status: users.status,
            lockedUntil: users.lockedUntil,
            failedLoginCount: users.failedLoginCount,
            isPlatformAdmin: users.isPlatformAdmin,
          })
          .from(users)
          .where(raw`lower(${users.email}) = ${data.email}`)
          .limit(1);

        // Verifying against a dummy hash when the account does not exist costs
        // the same as a real verify, so response timing is not an
        // account-enumeration oracle.
        const hashToCheck = user?.passwordHash ?? (await getDummyHash());
        const passwordOk = await verifyPassword(hashToCheck, data.password);

        const genericFailure = {
          ok: false as const,
          error: { code: "invalid_credentials", message: "Email or password is incorrect." },
        };

        if (!user || !passwordOk) {
          if (user) {
            await db
              .update(users)
              .set({
                failedLoginCount: user.failedLoginCount + 1,
                lockedUntil:
                  user.failedLoginCount + 1 >= 10
                    ? new Date(Date.now() + 15 * 60_000)
                    : user.lockedUntil,
              })
              .where(eq(users.id, user.id));
          }
          await writeAudit({
            action: "auth.login_failed",
            actorUserId: user?.id ?? null,
            actorType: "anonymous",
            actorIp: ip ?? null,
            actorUserAgent: userAgent ?? null,
            outcome: "failure",
          });
          return genericFailure;
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await writeAudit({
            action: "auth.login_locked",
            actorUserId: user.id,
            actorType: "customer",
            actorIp: ip ?? null,
            outcome: "denied",
          });
          return {
            ok: false as const,
            error: {
              code: "account_locked",
              message: "Too many attempts. Please try again later.",
            },
          };
        }

        // A suspended account gets the SAME message as a wrong password, so
        // suspension status is not disclosed to an attacker.
        if (user.status === "suspended") return genericFailure;

        await db
          .update(users)
          .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() })
          .where(eq(users.id, user.id));

        await resetRateLimit("login", data.email);
        // The IP budget is cleared on success too, so a busy office behind one
        // NAT is not throttled by its own staff signing in normally. What the
        // IP limit is there to stop is a run of FAILURES from one address, and
        // clearing on success leaves that intact: an attacker without working
        // credentials never reaches this line.
        await resetRateLimit("loginPerIp", ip ?? "unknown");

        // Does this account carry a confirmed second factor?
        const [mfa] = await db
          .select({ id: mfaCredentials.id })
          .from(mfaCredentials)
          .where(and(eq(mfaCredentials.userId, user.id), isNotNull(mfaCredentials.confirmedAt)))
          .limit(1);
        const requiresMfa = mfa !== undefined;

        // A fresh session id on every successful login: session-fixation
        // defence, since a token planted before login does not survive it.
        //
        // When MFA is enrolled the session is created UNSATISFIED. `getActor`
        // returns null for that state, so the cookie grants nothing anywhere
        // until the challenge is answered — the password alone never gets past
        // the second factor.
        const session = await createSession({
          userId: user.id,
          ipAddress: ip,
          userAgent,
          mfaSatisfied: false,
        });
        await setSessionCookie(session.token, session.expiresAt);

        await writeAudit({
          action: requiresMfa ? "auth.login_password_stage" : "auth.login",
          actorUserId: user.id,
          actorType: user.isPlatformAdmin ? "admin" : "customer",
          actorIp: ip ?? null,
          actorUserAgent: userAgent ?? null,
          outcome: "success",
        });

        // Only same-origin relative paths are accepted, so `redirectTo` cannot
        // be turned into an open redirect to an attacker's site. The rule lives
        // in its own module with its own tests — inline, it was the one thing
        // standing between a real login and a phishing hand-off, and nothing
        // could assert on it.
        const safeRedirect = safeLoginRedirect(data.redirectTo, data.locale);

        if (requiresMfa) {
          // Carry the intended destination through the challenge so the user
          // still lands where they were going.
          const next = encodeURIComponent(safeRedirect);
          return { ok: true as const, redirectTo: `/${data.locale}/login/mfa?next=${next}` };
        }

        return { ok: true as const, redirectTo: safeRedirect };
      },
    );
  } catch (error) {
    return { ok: false, error: toClientError(error) };
  }
}

export async function logoutAction(locale: Locale): Promise<void> {
  const actor = await getActor();
  if (actor) {
    // Server-side revocation. Clearing the cookie alone would leave a valid
    // session token in circulation.
    await revokeSession(actor.sessionId);
    await writeAudit({
      action: "auth.logout",
      actorUserId: actor.userId,
      actorType: actor.isPlatformAdmin ? "admin" : "customer",
      outcome: "success",
    });
  }
  await clearSessionCookie();
  redirect(`/${locale}`);
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(256),
    newPassword: passwordSchema,
  })
  .strict();

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  try {
    return await guard(
      input,
      { schema: changePasswordSchema, requireAuth: true, rateLimit: { name: "passwordReset" } },
      async ({ input: data, actor, ip }) => {
        if (!actor) {
          return { ok: false as const, error: { code: "unauthorized", message: "Please sign in." } };
        }

        const [user] = await db
          .select({ passwordHash: users.passwordHash, email: users.email, fullName: users.fullName })
          .from(users)
          .where(eq(users.id, actor.userId))
          .limit(1);
        if (!user) {
          return { ok: false as const, error: { code: "unauthorized", message: "Please sign in." } };
        }

        if (!(await verifyPassword(user.passwordHash, data.currentPassword))) {
          await writeAudit({
            action: "auth.password_change_failed",
            actorUserId: actor.userId,
            actorType: "customer",
            actorIp: ip ?? null,
            outcome: "failure",
          });
          return {
            ok: false as const,
            error: { code: "invalid_credentials", message: "Your current password is incorrect." },
          };
        }

        const policy = checkPassword(data.newPassword, { email: user.email, name: user.fullName });
        if (!policy.ok) {
          return {
            ok: false as const,
            error: { code: "weak_password", message: policy.reason ?? "Password is too weak." },
          };
        }

        await db
          .update(users)
          .set({ passwordHash: await hashPassword(data.newPassword), updatedAt: new Date() })
          .where(eq(users.id, actor.userId));

        // Every OTHER session is revoked: a password change is how a user
        // evicts an attacker, and that only works if it kills their session.
        await revokeAllSessionsForUser(actor.userId, actor.sessionId);

        await writeAudit({
          action: "auth.password_changed",
          actorUserId: actor.userId,
          actorType: "customer",
          actorIp: ip ?? null,
          outcome: "success",
        });

        return { ok: true as const };
      },
    );
  } catch (error) {
    return { ok: false, error: toClientError(error) };
  }
}
