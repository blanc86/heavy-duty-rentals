import { beforeEach, describe, expect, it } from "vitest";
import { __clearAllRateLimits, checkRateLimit, resetRateLimit } from "@/lib/server/rate-limit";

/**
 * RATE LIMITING.
 *
 * A security control with no tests is a claim, not a control. This one guards
 * the login endpoint, so "it looks right" is not good enough.
 *
 * The last test is the one that matters most. A bucket is keyed on
 * `name:identifier`, so every distinct identifier gets its own budget — which
 * is correct, and is exactly why login cannot be limited on the email alone.
 * An attacker spraying one likely password across a thousand accounts gets a
 * fresh allowance for each, and never trips a per-account limit. Closing that
 * needs a SECOND limit keyed on the IP, which is what `loginPerIp` is for.
 */

beforeEach(() => {
  __clearAllRateLimits();
});

describe("checkRateLimit", () => {
  it("allows up to the limit and refuses after it", async () => {
    // `login` is 5 per 15 minutes.
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const result = await checkRateLimit("login", "someone@example.invalid");
      expect(result.allowed).toBe(true);
    }

    const sixth = await checkRateLimit("login", "someone@example.invalid");
    expect(sixth.allowed).toBe(false);
    expect(sixth.remaining).toBe(0);
    // A caller needs to be able to tell the user WHEN to come back.
    expect(sixth.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts down the remaining allowance", async () => {
    const first = await checkRateLimit("login", "counter@example.invalid");
    const second = await checkRateLimit("login", "counter@example.invalid");
    expect(first.remaining).toBe(4);
    expect(second.remaining).toBe(3);
  });

  it("keeps separate budgets per limit name", async () => {
    // Exhausting login must not lock someone out of searching.
    for (let i = 0; i < 6; i += 1) await checkRateLimit("login", "shared@example.invalid");
    const search = await checkRateLimit("search", "shared@example.invalid");
    expect(search.allowed).toBe(true);
  });

  it("clears the window after a legitimate success", async () => {
    // One mistyped password must not cost the whole window once the real one
    // works — otherwise the control punishes the honest user hardest.
    for (let i = 0; i < 5; i += 1) await checkRateLimit("login", "typo@example.invalid");
    expect((await checkRateLimit("login", "typo@example.invalid")).allowed).toBe(false);

    await resetRateLimit("login", "typo@example.invalid");
    expect((await checkRateLimit("login", "typo@example.invalid")).allowed).toBe(true);
  });

  it("gives every identifier its own budget — which is why an IP limit is also needed", async () => {
    // Exhaust one account completely.
    for (let i = 0; i < 6; i += 1) await checkRateLimit("login", "victim@example.invalid");
    expect((await checkRateLimit("login", "victim@example.invalid")).allowed).toBe(false);

    // A different account is untouched. Correct for a per-account limit, and
    // useless against spraying: 100 accounts is 500 free password guesses.
    for (let n = 0; n < 100; n += 1) {
      const result = await checkRateLimit("login", `sprayed-${n}@example.invalid`);
      expect(result.allowed).toBe(true);
    }

    // `loginPerIp` is the bucket that closes it, and it is keyed on the caller
    // rather than the target. Twenty attempts from one address, whoever they
    // are aimed at.
    let allowed = 0;
    for (let n = 0; n < 25; n += 1) {
      if ((await checkRateLimit("loginPerIp", "203.0.113.7")).allowed) allowed += 1;
    }
    expect(allowed).toBe(20);
  });
});
