import { randomBytes } from "node:crypto";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { decryptSecret, encryptSecret, sha256 } from "./crypto";

/**
 * TIME-BASED ONE-TIME PASSWORDS (RFC 6238).
 *
 * Admin actions are gated on `mfaSatisfied` in production, so this module is a
 * correctness blocker as much as a security one: without it, no admin can
 * change a rate or issue a refund on a live deployment.
 *
 * Three properties matter and each is enforced here rather than assumed:
 *
 *  1. The shared secret is encrypted at rest (AES-256-GCM) with a key that
 *     lives in the environment, not the database. A database dump alone does
 *     not let an attacker generate valid codes.
 *  2. A code cannot be REPLAYED inside its own 30-second window. Accepting
 *     the same code twice would make a shoulder-surfed or intercepted code
 *     reusable, which defeats most of the point of a second factor.
 *  3. Recovery codes are single-use and stored hashed, so the fallback path
 *     is not a permanent plaintext bypass sitting in the database.
 */

const ISSUER = "Heavy Duty Rentals";
const PERIOD_SECONDS = 30;
const DIGITS = 6;

/**
 * Accept codes one step either side of now.
 *
 * ±1 step (30s) tolerates ordinary clock skew between a phone and the server.
 * Widening it further multiplies the number of simultaneously-valid codes,
 * which is a real cost for a marginal usability gain.
 */
const DRIFT_WINDOW = 1;

export const RECOVERY_CODE_COUNT = 10;

/** Excludes I/O/0/1 — recovery codes get written down and read back under stress. */
const RECOVERY_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export interface EnrolmentSecret {
  /** Base32, shown to the user once for manual entry. */
  secretBase32: string;
  /** Encrypted form, safe to persist. */
  secretEncrypted: string;
  /** otpauth:// URI encoded into the QR. */
  uri: string;
  /** Inline SVG QR code. */
  qrSvg: string;
}

function buildTotp(secretBase32: string, accountLabel: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: accountLabel,
    algorithm: "SHA1", // Required for compatibility with every mainstream authenticator app.
    digits: DIGITS,
    period: PERIOD_SECONDS,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

/**
 * Create a new enrolment secret.
 *
 * The QR is rendered as an SVG on the SERVER. A client-side QR library would
 * mean shipping the shared secret to the browser as data for a canvas to draw,
 * and would put the secret in more places than necessary.
 */
export async function createEnrolmentSecret(accountLabel: string): Promise<EnrolmentSecret> {
  // 20 random bytes = 160 bits, the RFC 4226 recommended secret length.
  const secret = new OTPAuth.Secret({ size: 20 });
  const secretBase32 = secret.base32;
  const totp = buildTotp(secretBase32, accountLabel);
  const uri = totp.toString();

  const qrSvg = await QRCode.toString(uri, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 220,
  });

  return {
    secretBase32,
    secretEncrypted: encryptSecret(secretBase32),
    uri,
    qrSvg,
  };
}

export type TotpVerification =
  | { ok: true; counter: number }
  | { ok: false; reason: "invalid_code" | "replayed_code" };

/**
 * Verify a TOTP code against an encrypted secret.
 *
 * `lastUsedCounter` is the highest counter already accepted for this
 * credential. Rejecting a counter at or below it is what stops the same code
 * being used twice inside its 30-second window — the replay case a naive
 * implementation misses because the code is still arithmetically valid.
 */
export function verifyTotp(
  secretEncrypted: string,
  code: string,
  accountLabel: string,
  lastUsedCounter: bigint | null,
): TotpVerification {
  const normalised = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalised)) return { ok: false, reason: "invalid_code" };

  let secretBase32: string;
  try {
    secretBase32 = decryptSecret(secretEncrypted);
  } catch {
    // A secret that will not decrypt means a key rotation or tampering. It
    // must read as a failed verification, never as a pass.
    return { ok: false, reason: "invalid_code" };
  }

  const totp = buildTotp(secretBase32, accountLabel);
  const delta = totp.validate({ token: normalised, window: DRIFT_WINDOW });
  if (delta === null) return { ok: false, reason: "invalid_code" };

  const counter = Math.floor(Date.now() / 1000 / PERIOD_SECONDS) + delta;

  if (lastUsedCounter !== null && BigInt(counter) <= lastUsedCounter) {
    return { ok: false, reason: "replayed_code" };
  }

  return { ok: true, counter };
}

export interface RecoveryCodes {
  /** Shown to the user exactly once. Never persisted in this form. */
  plaintext: string[];
  hashes: string[];
}

/**
 * Generate single-use recovery codes.
 *
 * 10 characters from a 32-symbol alphabet is 50 bits of entropy, so SHA-256 is
 * the right hash here rather than argon2: there is nothing to brute-force, and
 * verification runs on a login path that should stay fast. (Passwords are
 * different — they are low-entropy, which is exactly why they get argon2id.)
 */
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): RecoveryCodes {
  const plaintext: string[] = [];

  for (let i = 0; i < count; i += 1) {
    const bytes = randomBytes(10);
    let code = "";
    for (let j = 0; j < 10; j += 1) {
      code += RECOVERY_ALPHABET[bytes[j]! % RECOVERY_ALPHABET.length];
    }
    // Grouped for legibility when transcribed by hand.
    plaintext.push(`${code.slice(0, 5)}-${code.slice(5)}`);
  }

  return { plaintext, hashes: plaintext.map((code) => sha256(normaliseRecoveryCode(code))) };
}

export function normaliseRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export interface RecoveryVerification {
  ok: boolean;
  /** The remaining hashes with the consumed one removed — codes are single-use. */
  remainingHashes: string[];
}

/**
 * Verify and CONSUME a recovery code.
 *
 * Returns the remaining hashes so the caller persists a list with the used
 * code removed. A recovery code that still worked after being used would be a
 * standing bypass of the second factor.
 */
export function verifyRecoveryCode(code: string, storedHashes: string[]): RecoveryVerification {
  const candidate = sha256(normaliseRecoveryCode(code));
  const index = storedHashes.indexOf(candidate);
  if (index === -1) return { ok: false, remainingHashes: storedHashes };

  const remainingHashes = storedHashes.filter((_, i) => i !== index);
  return { ok: true, remainingHashes };
}

/** Label shown inside the authenticator app. */
export function accountLabelFor(email: string): string {
  return email;
}
