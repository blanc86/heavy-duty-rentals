import { describe, expect, it } from "vitest";
import * as OTPAuth from "otpauth";
import {
  accountLabelFor,
  createEnrolmentSecret,
  generateRecoveryCodes,
  normaliseRecoveryCode,
  verifyRecoveryCode,
  verifyTotp,
} from "@/lib/auth/mfa";
import { decryptSecret } from "@/lib/auth/crypto";

/**
 * MFA.
 *
 * Admin mutations are gated on a satisfied second factor in production, so
 * these assertions cover a correctness blocker as well as a security control.
 *
 * The three properties that matter: the secret is unreadable at rest, a code
 * cannot be replayed inside its own window, and recovery codes are single-use.
 */

const LABEL = accountLabelFor("admin@example.com");

/** Generate the code an authenticator app would show, for a given secret. */
function currentCode(secretBase32: string, offsetSteps = 0): string {
  const totp = new OTPAuth.TOTP({
    issuer: "Heavy Duty Rentals",
    label: LABEL,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
  return totp.generate({ timestamp: Date.now() + offsetSteps * 30_000 });
}

describe("TOTP enrolment", () => {
  it("produces a scannable otpauth URI and an SVG QR", async () => {
    const enrolment = await createEnrolmentSecret(LABEL);

    expect(enrolment.uri).toMatch(/^otpauth:\/\/totp\//);
    expect(enrolment.uri).toContain("secret=");
    expect(enrolment.uri).toContain("digits=6");
    expect(enrolment.uri).toContain("period=30");
    expect(enrolment.qrSvg.startsWith("<?xml") || enrolment.qrSvg.startsWith("<svg")).toBe(true);
  });

  it("encrypts the secret at rest, recoverably", async () => {
    const enrolment = await createEnrolmentSecret(LABEL);

    // The stored form must not contain the secret in the clear: a database
    // dump alone should not let anyone generate valid codes.
    expect(enrolment.secretEncrypted).not.toContain(enrolment.secretBase32);
    // ...but the server must still be able to read it back to verify codes.
    expect(decryptSecret(enrolment.secretEncrypted)).toBe(enrolment.secretBase32);
  });

  it("generates a 160-bit secret", async () => {
    const enrolment = await createEnrolmentSecret(LABEL);
    // Base32 of 20 bytes = 32 characters, the RFC 4226 recommended length.
    expect(enrolment.secretBase32).toHaveLength(32);
  });
});

describe("TOTP verification", () => {
  it("accepts a valid current code", async () => {
    const { secretBase32, secretEncrypted } = await createEnrolmentSecret(LABEL);
    const result = verifyTotp(secretEncrypted, currentCode(secretBase32), LABEL, null);
    expect(result.ok).toBe(true);
  });

  it("REJECTS a replay of the same code inside its own window", async () => {
    const { secretBase32, secretEncrypted } = await createEnrolmentSecret(LABEL);
    const code = currentCode(secretBase32);

    const first = verifyTotp(secretEncrypted, code, LABEL, null);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    // The code is still arithmetically valid — this is exactly the case a
    // naive implementation misses. A shoulder-surfed code must not be reusable.
    const replay = verifyTotp(secretEncrypted, code, LABEL, BigInt(first.counter));
    expect(replay.ok).toBe(false);
    if (!replay.ok) expect(replay.reason).toBe("replayed_code");
  });

  it("accepts the NEXT code after one has been consumed", async () => {
    const { secretBase32, secretEncrypted } = await createEnrolmentSecret(LABEL);

    const first = verifyTotp(secretEncrypted, currentCode(secretBase32), LABEL, null);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    // One step ahead: a legitimate next code must still work.
    const next = verifyTotp(
      secretEncrypted,
      currentCode(secretBase32, 1),
      LABEL,
      BigInt(first.counter),
    );
    expect(next.ok).toBe(true);
  });

  it("tolerates one step of clock drift either side", async () => {
    const { secretBase32, secretEncrypted } = await createEnrolmentSecret(LABEL);

    expect(verifyTotp(secretEncrypted, currentCode(secretBase32, -1), LABEL, null).ok).toBe(true);
    expect(verifyTotp(secretEncrypted, currentCode(secretBase32, 1), LABEL, null).ok).toBe(true);
  });

  it("rejects a code from far outside the drift window", async () => {
    const { secretBase32, secretEncrypted } = await createEnrolmentSecret(LABEL);
    // 10 steps = 5 minutes out.
    const result = verifyTotp(secretEncrypted, currentCode(secretBase32, 10), LABEL, null);
    expect(result.ok).toBe(false);
  });

  it("rejects a code generated from a DIFFERENT secret", async () => {
    const mine = await createEnrolmentSecret(LABEL);
    const theirs = await createEnrolmentSecret(LABEL);

    const result = verifyTotp(mine.secretEncrypted, currentCode(theirs.secretBase32), LABEL, null);
    expect(result.ok).toBe(false);
  });

  it("rejects malformed input without throwing", async () => {
    const { secretEncrypted } = await createEnrolmentSecret(LABEL);

    for (const bad of ["", "abc", "12345", "1234567", "<script>", "000000 "]) {
      const result = verifyTotp(secretEncrypted, bad, LABEL, null);
      expect(result.ok).toBe(false);
    }
  });

  it("treats an undecryptable secret as a FAILED verification, never a pass", () => {
    // Key rotation or tampering must read as failure. A thrown error that a
    // caller swallowed could otherwise become an accidental bypass.
    const result = verifyTotp("not-valid-ciphertext", "123456", LABEL, null);
    expect(result.ok).toBe(false);
  });

  it("ignores whitespace, as authenticator apps display codes grouped", async () => {
    const { secretBase32, secretEncrypted } = await createEnrolmentSecret(LABEL);
    const code = currentCode(secretBase32);
    const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;

    expect(verifyTotp(secretEncrypted, spaced, LABEL, null).ok).toBe(true);
  });
});

describe("recovery codes", () => {
  it("generates ten codes and stores only hashes", () => {
    const recovery = generateRecoveryCodes();

    expect(recovery.plaintext).toHaveLength(10);
    expect(recovery.hashes).toHaveLength(10);

    for (const code of recovery.plaintext) {
      expect(code).toMatch(/^[2-9A-HJ-NP-Z]{5}-[2-9A-HJ-NP-Z]{5}$/);
      // The plaintext must not be derivable from what we persist.
      expect(recovery.hashes).not.toContain(code);
    }
  });

  it("accepts a valid code and CONSUMES it", () => {
    const recovery = generateRecoveryCodes();
    const code = recovery.plaintext[0]!;

    const first = verifyRecoveryCode(code, recovery.hashes);
    expect(first.ok).toBe(true);
    expect(first.remainingHashes).toHaveLength(9);

    // Single-use: a recovery code that still worked afterwards would be a
    // standing bypass of the second factor.
    const reuse = verifyRecoveryCode(code, first.remainingHashes);
    expect(reuse.ok).toBe(false);
  });

  it("rejects an unknown code and consumes nothing", () => {
    const recovery = generateRecoveryCodes();
    const result = verifyRecoveryCode("AAAAA-AAAAA", recovery.hashes);

    expect(result.ok).toBe(false);
    expect(result.remainingHashes).toHaveLength(10);
  });

  it("accepts a code typed without the dash or in lower case", () => {
    const recovery = generateRecoveryCodes();
    const code = recovery.plaintext[0]!;

    expect(verifyRecoveryCode(code.replace("-", "").toLowerCase(), recovery.hashes).ok).toBe(true);
    expect(verifyRecoveryCode(` ${code} `, recovery.hashes).ok).toBe(true);
  });

  it("normalises consistently", () => {
    expect(normaliseRecoveryCode("ab3d5-6h8k9")).toBe("AB3D56H8K9");
    expect(normaliseRecoveryCode("AB3D5 6H8K9")).toBe("AB3D56H8K9");
  });

  it("generates distinct codes across sets", () => {
    const a = generateRecoveryCodes();
    const b = generateRecoveryCodes();
    const overlap = a.plaintext.filter((code) => b.plaintext.includes(code));
    expect(overlap).toEqual([]);
  });
});
