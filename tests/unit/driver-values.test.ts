import { describe, expect, it } from "vitest";
import { parseTimestamp, parseTimestampOrNull } from "@/lib/db";

/**
 * Drizzle's postgres-js driver runs raw `db.execute` SQL through
 * `client.unsafe(...)`, which bypasses the type parsers the query builder uses.
 * A `timestamptz` column therefore comes back as a STRING, in Postgres's own
 * rendering — a space instead of "T", and a two-digit UTC offset — neither of
 * which is valid ISO 8601.
 *
 * The generic on `db.execute<T>` is an unchecked assertion, so declaring such a
 * column as `Date` compiles and then throws at runtime the moment anything
 * formats it. That is not hypothetical: it took down the admin dashboard as
 * soon as the first booking existed.
 */
describe("parseTimestamp", () => {
  it("parses Postgres timestamptz output", () => {
    expect(parseTimestamp("2026-09-08 00:00:00+00").toISOString()).toBe(
      "2026-09-08T00:00:00.000Z",
    );
  });

  it("truncates microseconds to milliseconds without failing", () => {
    // Postgres keeps microseconds; a JS Date holds milliseconds. The audit hash
    // chain depends on this truncating rather than throwing, because the hash
    // was computed from a millisecond-precision Date at write time.
    expect(parseTimestamp("2026-09-05 11:15:52.574273+00").toISOString()).toBe(
      "2026-09-05T11:15:52.574Z",
    );
  });

  it("honours a non-UTC offset rather than assuming UTC", () => {
    // Riyadh is +03. Reading this as UTC would shift every timestamp by three
    // hours — silently, and in the direction that makes a rental look earlier.
    expect(parseTimestamp("2026-09-08 03:00:00+03").toISOString()).toBe(
      "2026-09-08T00:00:00.000Z",
    );
  });

  it("accepts a Date unchanged, so query-builder rows pass through", () => {
    const date = new Date("2026-09-08T00:00:00.000Z");
    expect(parseTimestamp(date)).toBe(date);
  });

  it("throws rather than yielding an Invalid Date", () => {
    // Failing loudly at the repository boundary beats an Invalid Date
    // propagating into a page render, which is how this surfaced originally.
    expect(() => parseTimestamp("not a timestamp")).toThrow(RangeError);
  });

  it("passes null through", () => {
    expect(parseTimestampOrNull(null)).toBeNull();
    expect(parseTimestampOrNull("2026-09-08 00:00:00+00")).toBeInstanceOf(Date);
  });
});
