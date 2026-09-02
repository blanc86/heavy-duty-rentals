import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { env } from "@/lib/env";

/**
 * argon2id parameters — the OWASP baseline (m=19 MiB, t=2, p=1).
 *
 * Memory-hard by design: GPU and ASIC attackers gain far less against argon2id
 * than against bcrypt or PBKDF2 at comparable CPU cost.
 */
const ARGON_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return argonHash(password, ARGON_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argonVerify(hash, password, ARGON_OPTIONS);
  } catch {
    // A malformed stored hash must read as "wrong password", never as a crash
    // that behaves differently from a genuine mismatch.
    return false;
  }
}

/**
 * A hash of a value that is never a real password.
 *
 * Verified against when an account does not exist, so a login attempt for an
 * unknown email costs the same time as one for a known email. Without this,
 * response timing is a free account-enumeration oracle.
 */
let dummyHashPromise: Promise<string> | null = null;
export function getDummyHash(): Promise<string> {
  dummyHashPromise ??= argonHash(randomBytes(32).toString("hex"), ARGON_OPTIONS);
  return dummyHashPromise;
}

/** 256 bits of entropy. Used for session tokens, reset tokens, hold tokens. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Tokens are stored hashed, never in plaintext, so a database read yields
 * nothing usable. SHA-256 (not argon2) is correct here: the input is already
 * 256 bits of random, so there is nothing to brute-force and the lookup must
 * be fast enough to run on every request.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time comparison for secrets (webhook signatures, tokens). */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Compare against itself so the timing profile does not leak length.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function encryptionKey(): Buffer {
  if (!env.ENCRYPTION_KEY) {
    throw new Error(
      "ENCRYPTION_KEY is not configured. MFA secrets cannot be stored without it. See .env.example.",
    );
  }
  return Buffer.from(env.ENCRYPTION_KEY, "base64");
}

/**
 * AES-256-GCM for data that must be readable again (currently only TOTP
 * secrets). GCM is authenticated, so tampering with a stored ciphertext is
 * detected on decrypt rather than producing a silently wrong secret.
 *
 * Format: base64(iv | authTag | ciphertext)
 */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
