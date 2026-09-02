import { applyPpm, clampToZero, min, sum, ZERO, type Halalas } from "@/lib/money";
import {
  PricingError,
  type PricingInput,
  type PricingLine,
  type PricingResult,
  type RateTierInput,
  type CheaperExtension,
  type RateTierName,
  type TierEvaluation,
} from "./types";

/**
 * Bumped whenever the calculation changes. Stored on every booking's
 * pricingSnapshot so a historical price can be explained against the engine
 * that produced it.
 */
export const PRICING_ENGINE_VERSION = "1.0.0";

const DAYS_PER_TIER: Record<RateTierName, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
};

/**
 * THE PRICING ENGINE.
 *
 * Pure: no I/O, no clock, no randomness. The caller loads rates and rules from
 * the database and passes them in. That is what makes this exhaustively
 * unit-testable, which matters because it is the component most directly
 * attached to money.
 *
 * It is also the reason a price can never originate in the browser: the server
 * calls this with database-sourced inputs, and any client-supplied total is
 * only ever compared against the result.
 */
export function calculatePrice(input: PricingInput): PricingResult {
  validate(input);

  const chargedDays = Math.max(input.billableDays, input.minRentalDays);
  const quantity = input.quantity;

  const tiersConsidered = evaluateTiers(input.tiers, chargedDays, quantity);
  const chosen = chooseBestTier(tiersConsidered);
  const cheaperIfExtended = findCheaperExtension(input.tiers, chargedDays, quantity, chosen);

  const lines: PricingLine[] = [];

  // --- 1. Rental ---------------------------------------------------------
  const rentalSubtotal = chosen.totalHalalas;
  lines.push({
    kind: "rental",
    code: `rental_${chosen.tier}`,
    labelEn: rentalLabelEn(chosen.tier, chargedDays, quantity),
    labelAr: rentalLabelAr(chosen.tier, chargedDays, quantity),
    quantity: chargedDays * quantity,
    unitRateHalalas: chosen.rateHalalas,
    totalHalalas: rentalSubtotal,
    isTaxable: true,
  });

  // --- 2. Add-ons (operator, fuel, crew, accessories) --------------------
  // Deliberately generic: the industry charges separately for riggers,
  // banksmen and slings, all of which are "an add-on" exactly as an operator is.
  const addonLines: PricingLine[] = input.addons.map((addon) => {
    const total = addonTotal(addon.pricingModel, addon.rateHalalas, addon.quantity, chargedDays);
    return {
      kind: "addon",
      code: addon.code,
      labelEn: addon.labelEn,
      labelAr: addon.labelAr,
      quantity: addon.quantity,
      unitRateHalalas: addon.rateHalalas,
      totalHalalas: total,
      isTaxable: addon.isTaxable,
    };
  });
  lines.push(...addonLines);
  const addonsSubtotal = sum(addonLines.map((l) => l.totalHalalas));

  // --- 3. Transport ------------------------------------------------------
  // Mobilisation/demobilisation is a first-class cost, not "shipping". For the
  // largest classes it can be 20-40% of the job, so it is itemised rather than
  // buried in a flat delivery fee (docs/research.md §4).
  const transportLines: PricingLine[] = [];
  if (input.transport.required) {
    const t = input.transport;
    if (t.mobilisationHalalas > ZERO) {
      transportLines.push({
        kind: "transport",
        code: "mobilisation",
        labelEn: "Mobilisation (delivery to site)",
        labelAr: "التعبئة والنقل إلى الموقع",
        quantity: 1,
        unitRateHalalas: t.mobilisationHalalas,
        totalHalalas: t.mobilisationHalalas,
        isTaxable: true,
      });
    }
    if (t.demobilisationHalalas > ZERO) {
      transportLines.push({
        kind: "transport",
        code: "demobilisation",
        labelEn: "Demobilisation (collection from site)",
        labelAr: "الإرجاع من الموقع",
        quantity: 1,
        unitRateHalalas: t.demobilisationHalalas,
        totalHalalas: t.demobilisationHalalas,
        isTaxable: true,
      });
    }
    if (t.requiresLowBed && t.lowBedSurchargeHalalas > ZERO) {
      transportLines.push({
        kind: "transport",
        code: "low_bed",
        labelEn: "Low-bed trailer surcharge",
        labelAr: "رسوم مقطورة منخفضة",
        quantity: 1,
        unitRateHalalas: t.lowBedSurchargeHalalas,
        totalHalalas: t.lowBedSurchargeHalalas,
        isTaxable: true,
      });
    }
    if (t.requiresEscort && t.escortSurchargeHalalas > ZERO) {
      transportLines.push({
        kind: "transport",
        code: "escort",
        labelEn: "Escort vehicle / permit surcharge",
        labelAr: "رسوم مركبة المرافقة والتصاريح",
        quantity: 1,
        unitRateHalalas: t.escortSurchargeHalalas,
        totalHalalas: t.escortSurchargeHalalas,
        isTaxable: true,
      });
    }
  }
  lines.push(...transportLines);
  const transportSubtotal = sum(transportLines.map((l) => l.totalHalalas));

  // --- 4. Discount -------------------------------------------------------
  const grossTaxable = rentalSubtotal + addonsSubtotal + transportSubtotal;
  const discount = calculateDiscount(input, grossTaxable);
  if (discount > ZERO) {
    lines.push({
      kind: "discount",
      code: input.coupon?.code ?? "discount",
      labelEn: `Discount (${input.coupon?.code ?? "promotion"})`,
      labelAr: `خصم (${input.coupon?.code ?? "عرض"})`,
      quantity: 1,
      unitRateHalalas: -discount,
      totalHalalas: -discount,
      isTaxable: true,
    });
  }

  // --- 5. VAT ------------------------------------------------------------
  // Rounded ONCE, on the taxable subtotal — not per line. Rounding each of a
  // dozen lines accumulates sub-halala drift and produces an invoice that does
  // not foot against its own total.
  const taxableSubtotal = clampToZero(grossTaxable - discount);
  const vat = applyPpm(taxableSubtotal, input.vatRatePpm);

  // --- 6. Deposit --------------------------------------------------------
  // Refundable, therefore NOT revenue and NOT part of the tax base. Conflating
  // a deposit with a charge is both a tax error and the single thing most
  // likely to make a customer distrust the checkout.
  const deposit = input.depositHalalas * BigInt(quantity);
  if (deposit > ZERO) {
    lines.push({
      kind: "deposit",
      code: "security_deposit",
      labelEn: "Refundable security deposit",
      labelAr: "تأمين قابل للاسترداد",
      quantity: quantity,
      unitRateHalalas: input.depositHalalas,
      totalHalalas: deposit,
      isTaxable: false,
    });
  }

  const total = taxableSubtotal + vat + deposit;

  return {
    currency: input.currency,
    billableDays: input.billableDays,
    chargedDays,
    chosenTier: chosen.tier,
    chosenTierRateHalalas: chosen.rateHalalas,
    tiersConsidered,
    cheaperIfExtended,
    lines,
    rentalSubtotalHalalas: rentalSubtotal,
    addonsSubtotalHalalas: addonsSubtotal,
    transportSubtotalHalalas: transportSubtotal,
    discountHalalas: discount,
    taxableSubtotalHalalas: taxableSubtotal,
    vatRatePpm: input.vatRatePpm,
    vatHalalas: vat,
    depositHalalas: deposit,
    totalHalalas: total,
  };
}

/**
 * Price every tier the rental is long enough to qualify for.
 *
 * Partial periods are charged as whole periods (26 days on a monthly tier bills
 * one month, not 26/30ths) — that is how the industry quotes, and the
 * best-tier selection below is what stops it becoming an overcharge.
 */
function evaluateTiers(
  tiers: readonly RateTierInput[],
  chargedDays: number,
  quantity: number,
): TierEvaluation[] {
  return tiers.map((tier) => {
    if (chargedDays < tier.minDays) {
      return {
        tier: tier.tier,
        rateHalalas: tier.rateHalalas,
        totalHalalas: ZERO,
        eligible: false,
        ineligibleReason: `requires at least ${tier.minDays} days`,
      };
    }
    const daysPerPeriod = DAYS_PER_TIER[tier.tier];
    const periods = BigInt(Math.ceil(chargedDays / daysPerPeriod));
    return {
      tier: tier.tier,
      rateHalalas: tier.rateHalalas,
      totalHalalas: tier.rateHalalas * periods * BigInt(quantity),
      eligible: true,
    };
  });
}

/**
 * Choose the ELIGIBLE tier that costs the CUSTOMER least.
 *
 * `minDays` is a hard gate: a monthly rate that contractually requires 28 days
 * is not silently applied to a 25-day hire. Within the tiers that DO apply, the
 * cheapest always wins — billing 10 days at the daily rate when a weekly rate
 * would be cheaper is exactly the quiet overcharge that destroys B2B trust.
 *
 * Where a slightly LONGER rental would be cheaper, we surface that separately
 * via `findCheaperExtension` rather than overriding the customer's dates.
 */
function chooseBestTier(evaluations: TierEvaluation[]): TierEvaluation {
  const eligible = evaluations.filter((e) => e.eligible);
  if (eligible.length === 0) {
    throw new PricingError(
      "No rate tier applies to this rental duration.",
      "no_applicable_rate_tier",
    );
  }
  return eligible.reduce((best, current) =>
    current.totalHalalas < best.totalHalalas ? current : best,
  );
}

/**
 * Would a longer rental cost less?
 *
 * For every tier the rental is currently too short for, price it at that tier's
 * own minimum duration. If that beats what the customer is about to pay, say
 * so. A supplier that stays quiet here collects more today and loses the
 * account the first time procurement runs the numbers.
 *
 * Only the single best saving is returned — a list of near-identical options is
 * noise at the point of decision.
 */
function findCheaperExtension(
  tiers: readonly RateTierInput[],
  chargedDays: number,
  quantity: number,
  chosen: TierEvaluation,
): CheaperExtension | null {
  let best: CheaperExtension | null = null;

  for (const tier of tiers) {
    if (chargedDays >= tier.minDays) continue;

    const daysPerPeriod = DAYS_PER_TIER[tier.tier];
    const periods = BigInt(Math.ceil(tier.minDays / daysPerPeriod));
    const total = tier.rateHalalas * periods * BigInt(quantity);

    if (total >= chosen.totalHalalas) continue;

    const saving = chosen.totalHalalas - total;
    if (!best || saving > best.savingHalalas) {
      best = {
        tier: tier.tier,
        extendToDays: tier.minDays,
        totalHalalas: total,
        savingHalalas: saving,
      };
    }
  }

  return best;
}

function addonTotal(
  model: "per_day" | "flat" | "per_unit_per_day",
  rate: Halalas,
  quantity: number,
  chargedDays: number,
): Halalas {
  switch (model) {
    case "flat":
      return rate * BigInt(quantity);
    case "per_day":
      return rate * BigInt(chargedDays);
    case "per_unit_per_day":
      return rate * BigInt(quantity) * BigInt(chargedDays);
  }
}

function calculateDiscount(input: PricingInput, grossTaxable: Halalas): Halalas {
  const coupon = input.coupon;
  if (!coupon) return ZERO;
  if (grossTaxable < coupon.minSubtotalHalalas) return ZERO;

  let discount: Halalas;
  if (coupon.discountType === "percent") {
    // Basis points: 1000 bp = 10%.
    discount = applyPpm(grossTaxable, Number(coupon.value) * 100);
  } else {
    discount = coupon.value;
  }

  // Cap a percentage discount so a 10% code cannot take SAR 90,000 off a
  // mega-rental, and never let a discount exceed the charge.
  if (coupon.maxDiscountHalalas !== null) {
    discount = min(discount, coupon.maxDiscountHalalas);
  }
  return min(clampToZero(discount), grossTaxable);
}

function validate(input: PricingInput): void {
  if (!Number.isInteger(input.billableDays) || input.billableDays < 1) {
    throw new PricingError("Rental must be at least one day.", "invalid_duration");
  }
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new PricingError("Quantity must be a positive integer.", "invalid_quantity");
  }
  if (input.tiers.length === 0) {
    throw new PricingError("No rate card is configured for this equipment.", "no_rate_card");
  }
  if (input.depositHalalas < ZERO) {
    throw new PricingError("Deposit cannot be negative.", "invalid_deposit");
  }
  for (const addon of input.addons) {
    if (!Number.isInteger(addon.quantity) || addon.quantity < 1) {
      throw new PricingError(`Invalid quantity for add-on ${addon.code}.`, "invalid_addon_quantity");
    }
    if (addon.rateHalalas < ZERO) {
      throw new PricingError(`Negative rate for add-on ${addon.code}.`, "invalid_addon_rate");
    }
  }
}

/**
 * Whole days between two instants, half-open: a rental from the 14th to the
 * 15th is one billable day.
 *
 * Computed in Asia/Riyadh calendar days rather than by dividing milliseconds,
 * because a rental is quoted in days on a wall calendar, not in 24-hour
 * intervals.
 */
export function billableDaysBetween(start: Date, end: Date): number {
  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const days = Math.round((endDay - startDay) / 86_400_000);
  return Math.max(days, 1);
}

function rentalLabelEn(tier: RateTierName, days: number, quantity: number): string {
  const unit = quantity > 1 ? `${quantity} units × ` : "";
  return `Equipment rental — ${unit}${days} day${days === 1 ? "" : "s"} (${tier} rate)`;
}

function rentalLabelAr(tier: RateTierName, days: number, quantity: number): string {
  const tierAr = tier === "daily" ? "يومي" : tier === "weekly" ? "أسبوعي" : "شهري";
  const unit = quantity > 1 ? `${quantity} وحدات × ` : "";
  return `تأجير المعدة — ${unit}${days} يوم (سعر ${tierAr})`;
}
