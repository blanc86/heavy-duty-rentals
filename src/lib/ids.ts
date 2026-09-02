import { randomBytes } from "node:crypto";

/**
 * UUID v7 — time-ordered, so primary keys stay local in the B-tree instead of
 * scattering writes across the index the way v4 does. Still 122 bits of
 * entropy in the random portion, so ids remain unguessable in URLs.
 *
 * Layout (RFC 9562): 48-bit big-endian unix milliseconds | version 7 |
 * 12 random bits | variant | 62 random bits.
 */
export function uuidv7(): string {
  const bytes = randomBytes(16);
  const ms = BigInt(Date.now());

  bytes[0] = Number((ms >> 40n) & 0xffn);
  bytes[1] = Number((ms >> 32n) & 0xffn);
  bytes[2] = Number((ms >> 24n) & 0xffn);
  bytes[3] = Number((ms >> 16n) & 0xffn);
  bytes[4] = Number((ms >> 8n) & 0xffn);
  bytes[5] = Number(ms & 0xffn);

  bytes[6] = (bytes[6]! & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 4122 variant

  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Human-facing booking reference, e.g. RNT-7F3K9Q. Excludes I/O/0/1 to avoid transcription errors over the phone. */
const REFERENCE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateReference(prefix: string, length = 6): string {
  const buf = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += REFERENCE_ALPHABET[buf[i]! % REFERENCE_ALPHABET.length];
  }
  return `${prefix}-${out}`;
}
