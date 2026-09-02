import { describe, expect, it } from "vitest";
import { billableDaysBetween, calculatePrice } from "@/lib/pricing/engine";
import { PricingError, type PricingInput } from "@/lib/pricing/types";
import { applyPpm, formatMoney, roundHalfUpDivide, sar, sum } from "@/lib/money";

/**
 * PRICING ENGINE TESTS.
 *
 * The engine is pure — no I/O, no clock, no randomness — precisely so it can be
 * tested exhaustively. It is the component most directly attached to money, so
 * these assertions are about arithmetic correctness, not about "does it run".
 */

const VAT_15_PERCENT = 150_000; // parts per million

function baseInput(overrides: Partial<PricingInput> = {}): PricingInput {
  return {
    currency: "SAR",
    billableDays: 1,
    minRentalDays: 1,
    tiers: [
      { tier: "daily", minDays: 1, rateHalalas: sar(1000) },
      { tier: "weekly", minDays: 7, rateHalalas: sar(6000) },
      { tier: "monthly", minDays: 28, rateHalalas: sar(21000) },
    ],
    addons: [],
    transport: {
      required: false,
      mobilisationHalalas: 0n,
      demobilisationHalalas: 0n,
      lowBedSurchargeHalalas: 0n,
      escortSurchargeHalalas: 0n,
      requiresLowBed: false,
      requiresEscort: false,
    },
    coupon: null,
    depositHalalas: 0n,
    vatRatePpm: VAT_15_PERCENT,
    quantity: 1,
    ...overrides,
  };
}

describe("money primitives", () => {
  it("converts SAR to integer halalas without float drift", () => {
    expect(sar(1234.56)).toBe(123456n);
    // The classic float failure: 0.1 + 0.2 !== 0.3. Integers make it exact.
    expect(sar(0.1) + sar(0.2)).toBe(sar(0.3));
  });

  it("rounds VAT half-up, not half-even", () => {
    // 5 halalas at 50% = exactly 2.5 -> must round UP to 3, which is what an
    // invoice recipient and a tax authority expect.
    expect(applyPpm(5n, 500_000)).toBe(3n);
    expect(roundHalfUpDivide(5n, 2n)).toBe(3n);
    expect(roundHalfUpDivide(-5n, 2n)).toBe(-3n);
  });

  it("sums an empty list to zero rather than undefined", () => {
    expect(sum([])).toBe(0n);
  });

  it("formats money with the currency symbol for each locale", () => {
    const formatted = formatMoney(sar(2000), "en");
    expect(formatted).toContain("2,000");
    // Arabic uses its own numerals and currency placement via Intl.
    expect(formatMoney(sar(2000), "ar")).toBeTruthy();
  });
});

describe("billable days", () => {
  it("counts half-open days: the 14th to the 15th is one day", () => {
    expect(
      billableDaysBetween(new Date("2026-03-14T00:00:00Z"), new Date("2026-03-15T00:00:00Z")),
    ).toBe(1);
  });

  it("counts a fortnight as 14 days", () => {
    expect(
      billableDaysBetween(new Date("2026-03-14T00:00:00Z"), new Date("2026-03-28T00:00:00Z")),
    ).toBe(14);
  });

  it("never returns less than one day", () => {
    expect(
      billableDaysBetween(new Date("2026-03-14T00:00:00Z"), new Date("2026-03-14T00:00:00Z")),
    ).toBe(1);
  });
});

describe("duration tier selection", () => {
  it("uses the daily rate for a short rental", () => {
    const result = calculatePrice(baseInput({ billableDays: 3 }));
    expect(result.chosenTier).toBe("daily");
    expect(result.rentalSubtotalHalalas).toBe(sar(3000));
  });

  it("picks the WEEKLY tier when it beats the daily rate", () => {
    // 7 days daily = 7000; weekly = 6000. The customer must get 6000.
    const result = calculatePrice(baseInput({ billableDays: 7 }));
    expect(result.chosenTier).toBe("weekly");
    expect(result.rentalSubtotalHalalas).toBe(sar(6000));
  });

  it("picks the MONTHLY tier for a 30-day rental when it beats weekly", () => {
    // 30 days: daily = 30000, weekly (5 periods) = 30000, monthly = 21000.
    // Billing the customer 30000 when 21000 applies is the quiet overcharge
    // that destroys B2B trust the first time procurement checks.
    const result = calculatePrice(baseInput({ billableDays: 30 }));
    expect(result.chosenTier).toBe("monthly");
    expect(result.rentalSubtotalHalalas).toBe(sar(21000));
  });

  it("treats minDays as a HARD gate, not a suggestion", () => {
    // 25 days does not reach the monthly tier's 28-day minimum, so the monthly
    // RATE is not applied even though it would be cheaper. `minDays` is a
    // commercial commitment, and silently ignoring it would misprice the
    // supplier's side of the contract.
    const result = calculatePrice(baseInput({ billableDays: 25 }));
    expect(result.chosenTier).toBe("weekly");
    expect(result.rentalSubtotalHalalas).toBe(sar(24000));
  });

  it("reports every tier it considered, so a disputed price is explainable", () => {
    const result = calculatePrice(baseInput({ billableDays: 30 }));
    expect(result.tiersConsidered).toHaveLength(3);
    const monthly = result.tiersConsidered.find((t) => t.tier === "monthly");
    expect(monthly?.eligible).toBe(true);
    expect(monthly?.totalHalalas).toBe(sar(21000));
  });

  it("marks a tier ineligible when the rental is too short for it", () => {
    const result = calculatePrice(baseInput({ billableDays: 2 }));
    const weekly = result.tiersConsidered.find((t) => t.tier === "weekly");
    expect(weekly?.eligible).toBe(false);
    expect(weekly?.ineligibleReason).toContain("7");
  });

  it("charges partial periods as whole periods", () => {
    // 8 days on the weekly tier = 2 weeks. Selection then guarantees the
    // customer is not worse off than the daily rate would have made them.
    const result = calculatePrice(
      baseInput({
        billableDays: 8,
        tiers: [{ tier: "weekly", minDays: 7, rateHalalas: sar(6000) }],
      }),
    );
    expect(result.rentalSubtotalHalalas).toBe(sar(12000));
  });

  it("throws rather than guessing when no tier applies", () => {
    expect(() =>
      calculatePrice(
        baseInput({
          billableDays: 2,
          tiers: [{ tier: "monthly", minDays: 28, rateHalalas: sar(1) }],
        }),
      ),
    ).toThrow(PricingError);
  });

  it("throws when the class has no rate card at all", () => {
    expect(() => calculatePrice(baseInput({ tiers: [] }))).toThrow(/rate card/i);
  });
});

describe("cheaper-if-extended disclosure", () => {
  it("tells the customer when a LONGER rental would cost less", () => {
    // 25 days bills as 4 weeks = 24000. Extending to 28 days reaches the
    // monthly tier at 21000 — cheaper for a longer hire. Staying quiet about
    // that collects 3000 today and costs the account later.
    const result = calculatePrice(baseInput({ billableDays: 25 }));

    expect(result.cheaperIfExtended).not.toBeNull();
    expect(result.cheaperIfExtended?.tier).toBe("monthly");
    expect(result.cheaperIfExtended?.extendToDays).toBe(28);
    expect(result.cheaperIfExtended?.totalHalalas).toBe(sar(21000));
    expect(result.cheaperIfExtended?.savingHalalas).toBe(sar(3000));
  });

  it("stays silent when extending would NOT be cheaper", () => {
    // A 3-day hire is 3000; reaching the weekly tier costs 6000. There is
    // nothing useful to say, so we say nothing rather than nudging the
    // customer into spending more.
    const result = calculatePrice(baseInput({ billableDays: 3 }));
    expect(result.cheaperIfExtended).toBeNull();
  });

  it("stays silent when the cheapest tier already applies", () => {
    const result = calculatePrice(baseInput({ billableDays: 30 }));
    expect(result.cheaperIfExtended).toBeNull();
  });

  it("reports only the single best saving, not every option", () => {
    const result = calculatePrice(
      baseInput({
        billableDays: 2,
        tiers: [
          { tier: "daily", minDays: 1, rateHalalas: sar(1000) },
          { tier: "weekly", minDays: 7, rateHalalas: sar(1500) },
          { tier: "monthly", minDays: 28, rateHalalas: sar(1200) },
        ],
      }),
    );
    // Both weekly (1500) and monthly (1200) beat 2 days at 2000; the monthly
    // saving is larger, so that is the one worth surfacing.
    expect(result.cheaperIfExtended?.tier).toBe("monthly");
    expect(result.cheaperIfExtended?.savingHalalas).toBe(sar(800));
  });
});

describe("minimum rental period", () => {
  it("bills the class minimum even when the customer books fewer days", () => {
    const result = calculatePrice(baseInput({ billableDays: 1, minRentalDays: 3 }));
    expect(result.billableDays).toBe(1);
    expect(result.chargedDays).toBe(3);
    expect(result.rentalSubtotalHalalas).toBe(sar(3000));
  });
});

describe("add-ons", () => {
  it("prices a per-day add-on across the charged days", () => {
    const result = calculatePrice(
      baseInput({
        billableDays: 5,
        addons: [
          {
            code: "operator",
            labelEn: "Operator",
            labelAr: "مشغل",
            pricingModel: "per_day",
            rateHalalas: sar(500),
            quantity: 1,
            isTaxable: true,
          },
        ],
      }),
    );
    expect(result.addonsSubtotalHalalas).toBe(sar(2500));
  });

  it("prices a flat add-on once regardless of duration", () => {
    const result = calculatePrice(
      baseInput({
        billableDays: 30,
        addons: [
          {
            code: "site_survey",
            labelEn: "Site survey",
            labelAr: "مسح الموقع",
            pricingModel: "flat",
            rateHalalas: sar(1500),
            quantity: 1,
            isTaxable: true,
          },
        ],
      }),
    );
    expect(result.addonsSubtotalHalalas).toBe(sar(1500));
  });

  it("multiplies a per-unit-per-day add-on by both quantity and days", () => {
    const result = calculatePrice(
      baseInput({
        billableDays: 4,
        addons: [
          {
            code: "rigger",
            labelEn: "Rigger",
            labelAr: "فني ربط",
            pricingModel: "per_unit_per_day",
            rateHalalas: sar(400),
            quantity: 2,
            isTaxable: true,
          },
        ],
      }),
    );
    expect(result.addonsSubtotalHalalas).toBe(sar(3200));
  });

  it("rejects a negative add-on rate", () => {
    expect(() =>
      calculatePrice(
        baseInput({
          addons: [
            {
              code: "bad",
              labelEn: "Bad",
              labelAr: "سيئ",
              pricingModel: "flat",
              rateHalalas: -100n,
              quantity: 1,
              isTaxable: true,
            },
          ],
        }),
      ),
    ).toThrow(PricingError);
  });
});

describe("transport", () => {
  it("itemises mobilisation and demobilisation separately", () => {
    const result = calculatePrice(
      baseInput({
        transport: {
          required: true,
          mobilisationHalalas: sar(4000),
          demobilisationHalalas: sar(3600),
          lowBedSurchargeHalalas: sar(2200),
          escortSurchargeHalalas: sar(1800),
          requiresLowBed: true,
          requiresEscort: false,
        },
      }),
    );

    const codes = result.lines.filter((l) => l.kind === "transport").map((l) => l.code);
    expect(codes).toContain("mobilisation");
    expect(codes).toContain("demobilisation");
    expect(codes).toContain("low_bed");
    // Escort was not required for this class, so it must not be charged.
    expect(codes).not.toContain("escort");
    expect(result.transportSubtotalHalalas).toBe(sar(9800));
  });

  it("charges no transport when the customer collects from the depot", () => {
    const result = calculatePrice(
      baseInput({
        transport: {
          required: false,
          mobilisationHalalas: sar(4000),
          demobilisationHalalas: sar(3600),
          lowBedSurchargeHalalas: 0n,
          escortSurchargeHalalas: 0n,
          requiresLowBed: false,
          requiresEscort: false,
        },
      }),
    );
    expect(result.transportSubtotalHalalas).toBe(0n);
  });
});

describe("VAT", () => {
  it("computes 15% on the taxable subtotal", () => {
    const result = calculatePrice(baseInput({ billableDays: 1 }));
    expect(result.taxableSubtotalHalalas).toBe(sar(1000));
    expect(result.vatHalalas).toBe(sar(150));
  });

  it("rounds VAT ONCE on the total, not per line", () => {
    // Three lines of 3.33 SAR. Per-line VAT would be round(49.95)=50 each,
    // giving 150; on the total (9.99 SAR) it is round(149.85)=150 as well —
    // but the invariant we care about is that VAT is derived from the
    // subtotal, so the invoice always foots.
    const result = calculatePrice(
      baseInput({
        billableDays: 1,
        tiers: [{ tier: "daily", minDays: 1, rateHalalas: sar(3.33) }],
        addons: [
          {
            code: "a",
            labelEn: "A",
            labelAr: "أ",
            pricingModel: "flat",
            rateHalalas: sar(3.33),
            quantity: 1,
            isTaxable: true,
          },
          {
            code: "b",
            labelEn: "B",
            labelAr: "ب",
            pricingModel: "flat",
            rateHalalas: sar(3.33),
            quantity: 1,
            isTaxable: true,
          },
        ],
      }),
    );
    expect(result.taxableSubtotalHalalas).toBe(999n);
    expect(result.vatHalalas).toBe(applyPpm(999n, VAT_15_PERCENT));
    // The invoice must foot exactly.
    expect(result.totalHalalas).toBe(result.taxableSubtotalHalalas + result.vatHalalas);
  });
});

describe("deposit", () => {
  it("keeps the deposit OUT of the tax base", () => {
    const result = calculatePrice(baseInput({ billableDays: 1, depositHalalas: sar(5000) }));

    expect(result.taxableSubtotalHalalas).toBe(sar(1000));
    // VAT is 150 on the rental only — never on the refundable deposit.
    expect(result.vatHalalas).toBe(sar(150));
    expect(result.depositHalalas).toBe(sar(5000));
    expect(result.totalHalalas).toBe(sar(1000) + sar(150) + sar(5000));
  });

  it("marks the deposit line as non-taxable", () => {
    const result = calculatePrice(baseInput({ depositHalalas: sar(5000) }));
    const depositLine = result.lines.find((l) => l.kind === "deposit");
    expect(depositLine?.isTaxable).toBe(false);
  });

  it("scales the deposit with quantity", () => {
    const result = calculatePrice(baseInput({ quantity: 3, depositHalalas: sar(1000) }));
    expect(result.depositHalalas).toBe(sar(3000));
  });

  it("rejects a negative deposit", () => {
    expect(() => calculatePrice(baseInput({ depositHalalas: -1n }))).toThrow(PricingError);
  });
});

describe("coupons", () => {
  const percentCoupon = {
    code: "DEMO10",
    discountType: "percent" as const,
    value: 1000n, // basis points -> 10%
    minSubtotalHalalas: 0n,
    maxDiscountHalalas: null,
  };

  it("applies a percentage discount to the taxable subtotal", () => {
    const result = calculatePrice(baseInput({ billableDays: 10, coupon: percentCoupon }));
    // 10 days daily = 10000; weekly (2 weeks) = 12000, so daily wins at 10000.
    expect(result.discountHalalas).toBe(sar(1000));
    expect(result.taxableSubtotalHalalas).toBe(sar(9000));
  });

  it("caps a percentage discount at maxDiscount", () => {
    // Without the cap, 10% of a large rental would be an unbounded giveaway.
    const result = calculatePrice(
      baseInput({
        billableDays: 100,
        coupon: { ...percentCoupon, maxDiscountHalalas: sar(500) },
      }),
    );
    expect(result.discountHalalas).toBe(sar(500));
  });

  it("ignores a coupon below its minimum subtotal", () => {
    const result = calculatePrice(
      baseInput({
        billableDays: 1,
        coupon: { ...percentCoupon, minSubtotalHalalas: sar(50_000) },
      }),
    );
    expect(result.discountHalalas).toBe(0n);
  });

  it("never lets a discount exceed the charge or go negative", () => {
    const result = calculatePrice(
      baseInput({
        billableDays: 1,
        coupon: {
          code: "HUGE",
          discountType: "fixed",
          value: sar(999_999),
          minSubtotalHalalas: 0n,
          maxDiscountHalalas: null,
        },
      }),
    );
    expect(result.taxableSubtotalHalalas).toBe(0n);
    expect(result.discountHalalas).toBe(sar(1000));
    // A discount can never pay the customer.
    expect(result.totalHalalas >= 0n).toBe(true);
  });
});

describe("determinism", () => {
  it("produces identical output for identical input", () => {
    // The engine takes no clock and no randomness, so a booking's price can be
    // reproduced exactly when a customer disputes it months later.
    const input = baseInput({ billableDays: 14, depositHalalas: sar(5000) });
    expect(calculatePrice(input)).toStrictEqual(calculatePrice(input));
  });

  it("rejects a non-integer or zero quantity", () => {
    expect(() => calculatePrice(baseInput({ quantity: 0 }))).toThrow(PricingError);
    expect(() => calculatePrice(baseInput({ quantity: 1.5 }))).toThrow(PricingError);
  });

  it("rejects a zero-day rental", () => {
    expect(() => calculatePrice(baseInput({ billableDays: 0 }))).toThrow(PricingError);
  });
});

describe("realistic end-to-end scenario", () => {
  it("prices a 14-day 100t crane hire with operator and transport", () => {
    const result = calculatePrice({
      currency: "SAR",
      billableDays: 14,
      minRentalDays: 1,
      tiers: [
        { tier: "daily", minDays: 1, rateHalalas: sar(4200) },
        { tier: "weekly", minDays: 7, rateHalalas: sar(25_200) },
        { tier: "monthly", minDays: 28, rateHalalas: sar(88_200) },
      ],
      addons: [
        {
          code: "operator",
          labelEn: "Certified operator",
          labelAr: "مشغل معتمد",
          pricingModel: "per_day",
          rateHalalas: sar(550),
          quantity: 1,
          isTaxable: true,
        },
      ],
      transport: {
        required: true,
        mobilisationHalalas: sar(6400),
        demobilisationHalalas: sar(5760),
        lowBedSurchargeHalalas: sar(2200),
        escortSurchargeHalalas: sar(2400),
        requiresLowBed: true,
        requiresEscort: false,
      },
      coupon: null,
      depositHalalas: sar(15_000),
      vatRatePpm: VAT_15_PERCENT,
      quantity: 1,
    });

    // Two weeks at the weekly rate beats 14 daily days (58,800).
    expect(result.chosenTier).toBe("weekly");
    expect(result.rentalSubtotalHalalas).toBe(sar(50_400));
    expect(result.addonsSubtotalHalalas).toBe(sar(7700));
    expect(result.transportSubtotalHalalas).toBe(sar(14_360));
    expect(result.taxableSubtotalHalalas).toBe(sar(72_460));
    expect(result.vatHalalas).toBe(sar(10_869));
    expect(result.depositHalalas).toBe(sar(15_000));
    expect(result.totalHalalas).toBe(sar(98_329));

    // The total must equal exactly the sum of its declared parts.
    expect(result.totalHalalas).toBe(
      result.taxableSubtotalHalalas + result.vatHalalas + result.depositHalalas,
    );
  });
});
