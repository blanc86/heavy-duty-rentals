import { describe, expect, it } from "vitest";
import { DEFAULT_BUSINESS_SETTINGS, refundPercentForNotice } from "@/lib/settings";

/**
 * CANCELLATION REFUND TIERS.
 *
 * This decides how much money goes back to a customer, so the boundaries matter
 * more than the middles: a cancellation at exactly 168 hours must land in the
 * 100% tier, not the 75% one, because the published policy page and the signed
 * rental agreement both render "7 days or more — 100%" from this same table.
 *
 * The tiers are business-authored rather than statutory. Saudi consumer return
 * rules cover GOODS and do not map cleanly onto rental SERVICES, so inventing a
 * legal window here would be worse than deferring to the business
 * (docs/research.md §7).
 */

const TIERS = DEFAULT_BUSINESS_SETTINGS.cancellationTiers;

describe("refundPercentForNotice", () => {
  it("gives a full refund at and above the top tier", () => {
    expect(refundPercentForNotice(TIERS, 168)).toBe(100);
    expect(refundPercentForNotice(TIERS, 169)).toBe(100);
    expect(refundPercentForNotice(TIERS, 10_000)).toBe(100);
  });

  it("drops to the next tier one hour below a boundary", () => {
    // The boundary is the whole point: 167 hours is not "about a week".
    expect(refundPercentForNotice(TIERS, 167)).toBe(75);
    expect(refundPercentForNotice(TIERS, 71)).toBe(50);
    expect(refundPercentForNotice(TIERS, 23)).toBe(0);
  });

  it("is inclusive at every boundary", () => {
    expect(refundPercentForNotice(TIERS, 72)).toBe(75);
    expect(refundPercentForNotice(TIERS, 24)).toBe(50);
    expect(refundPercentForNotice(TIERS, 0)).toBe(0);
  });

  it("never returns a refund for negative notice", () => {
    // A booking whose start date has passed. Clamping in the caller means this
    // should not arrive, but a negative must not fall through to a full refund.
    expect(refundPercentForNotice(TIERS, -1)).toBe(0);
    expect(refundPercentForNotice(TIERS, -500)).toBe(0);
  });

  it("does not depend on the tiers being given in order", () => {
    // Settings are business-editable, and nothing forces a sort order on them.
    const shuffled = [
      { minHoursNotice: 24, refundPercent: 50 },
      { minHoursNotice: 168, refundPercent: 100 },
      { minHoursNotice: 0, refundPercent: 0 },
      { minHoursNotice: 72, refundPercent: 75 },
    ];
    expect(refundPercentForNotice(shuffled, 200)).toBe(100);
    expect(refundPercentForNotice(shuffled, 100)).toBe(75);
    expect(refundPercentForNotice(shuffled, 30)).toBe(50);
    expect(refundPercentForNotice(shuffled, 1)).toBe(0);
  });
});

describe("refund amount", () => {
  /** Mirrors the arithmetic in `cancelBookingAction`. */
  const refundFor = (chargedHalalas: bigint, percent: number) =>
    (chargedHalalas * BigInt(percent)) / 100n;

  it("is a percentage of what was CHARGED, not of the total", () => {
    // The booking total includes a deposit that is never collected online.
    // Refunding a percentage of the total would pay out money never taken.
    const charged = 2_297_700n; // subtotal + VAT
    const deposit = 800_000n;
    const total = charged + deposit;

    expect(refundFor(charged, 100)).toBe(2_297_700n);
    expect(refundFor(charged, 100)).toBeLessThan(total);
  });

  it("rounds down, so a rounding error can never overpay", () => {
    // 75% of 1001 is 750.75 halalas. Integer division floors it to 750.
    expect(refundFor(1001n, 75)).toBe(750n);
  });

  it("refunds nothing at the zero tier", () => {
    expect(refundFor(2_297_700n, 0)).toBe(0n);
  });
});
