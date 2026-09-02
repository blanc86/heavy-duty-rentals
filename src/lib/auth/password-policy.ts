import { z } from "zod";

/**
 * Password policy.
 *
 * LENGTH is the requirement. Composition rules ("must contain an uppercase,
 * a digit and a symbol") are deliberately NOT enforced: they push users toward
 * predictable shapes like `Password1!`, which measurably lowers real entropy
 * while feeling stricter. NIST SP 800-63B reached the same conclusion.
 *
 * What we DO reject is passwords that are trivially guessable for this
 * specific application.
 */
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 256;

/**
 * Application-specific terms an attacker would try first against THIS site.
 * A generic breach-corpus check belongs behind `isBreachedPassword` below.
 */
const BLOCKED_SUBSTRINGS = [
  "password",
  "123456",
  "qwerty",
  "letmein",
  "admin",
  "welcome",
  "iloveyou",
  "heavyduty",
  "rentals",
  "equipment",
  "crane",
  "riyadh",
  "jeddah",
  "dammam",
  "saudi",
];

export interface PasswordCheck {
  ok: boolean;
  reason?: string;
}

export function checkPassword(password: string, context: { email?: string; name?: string } = {}): PasswordCheck {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, reason: `Password must be at most ${MAX_PASSWORD_LENGTH} characters.` };
  }

  const lower = password.toLowerCase();

  for (const blocked of BLOCKED_SUBSTRINGS) {
    if (lower.includes(blocked)) {
      return { ok: false, reason: "Password contains a term that is too easy to guess." };
    }
  }

  // A password derived from the user's own identifiers is guessable by anyone
  // who knows the account exists.
  const localPart = context.email?.split("@")[0]?.toLowerCase();
  if (localPart && localPart.length >= 4 && lower.includes(localPart)) {
    return { ok: false, reason: "Password must not contain your email address." };
  }
  if (context.name) {
    for (const part of context.name.toLowerCase().split(/\s+/)) {
      if (part.length >= 4 && lower.includes(part)) {
        return { ok: false, reason: "Password must not contain your name." };
      }
    }
  }

  // Long runs of one character, or a straight keyboard/alphabet sequence,
  // pass a length check while carrying almost no entropy.
  if (/(.)\1{4,}/.test(password)) {
    return { ok: false, reason: "Password contains too many repeated characters." };
  }
  if (hasLongSequence(lower)) {
    return { ok: false, reason: "Password contains a simple sequence." };
  }

  return { ok: true };
}

function hasLongSequence(value: string): boolean {
  let run = 1;
  for (let i = 1; i < value.length; i++) {
    const delta = value.charCodeAt(i) - value.charCodeAt(i - 1);
    if (delta === 1 || delta === -1) {
      run += 1;
      if (run >= 6) return true;
    } else {
      run = 1;
    }
  }
  return false;
}

/**
 * BOUNDARY — breached-password checking.
 *
 * Intentionally not implemented. Doing it properly means a k-anonymity range
 * query against a breach corpus (e.g. the HIBP range API), which is an outbound
 * network dependency the business must choose and accept. Wiring a placeholder
 * that always returns false would be worse than an honest gap, because it would
 * read as a control that exists.
 *
 * See docs/SECURITY.md §2 and docs/FINAL_REVIEW.md.
 */
export async function isBreachedPassword(_password: string): Promise<boolean> {
  return false;
}

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  .max(MAX_PASSWORD_LENGTH);
