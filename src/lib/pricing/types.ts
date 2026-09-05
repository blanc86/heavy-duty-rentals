import type { Halalas, Ppm } from "@/lib/money";

export type RateTierName = "daily" | "weekly" | "monthly";

export type AddonPricingModel = "per_day" | "flat" | "per_unit_per_day";

export type LineKind = "rental" | "addon" | "transport" | "discount" | "deposit";

/** One tier of a rate card, as supplied to the engine. */
export interface RateTierInput {
  tier: RateTierName;
  /** Minimum rental length in days for this tier to be eligible. */
  minDays: number;
  /** Rate per period unit (day / week / month), in halalas. */
  rateHalalas: Halalas;
}

export interface AddonSelectionInput {
  code: string;
  labelEn: string;
  labelAr: string;
  pricingModel: AddonPricingModel;
  rateHalalas: Halalas;
  quantity: number;
  isTaxable: boolean;
}

export interface TransportInput {
  required: boolean;
  mobilisationHalalas: Halalas;
  demobilisationHalalas: Halalas;
  lowBedSurchargeHalalas: Halalas;
  escortSurchargeHalalas: Halalas;
  requiresLowBed: boolean;
  requiresEscort: boolean;
}

export interface CouponInput {
  code: string;
  discountType: "percent" | "fixed";
  /** Percent: basis points (1000 = 10%). Fixed: halalas. */
  value: bigint;
  minSubtotalHalalas: Halalas;
  maxDiscountHalalas: Halalas | null;
}

export interface PricingInput {
  currency: string;
  /** Inclusive of the start day, exclusive of the end day. */
  billableDays: number;
  minRentalDays: number;
  tiers: readonly RateTierInput[];
  addons: readonly AddonSelectionInput[];
  transport: TransportInput;
  coupon: CouponInput | null;
  depositHalalas: Halalas;
  vatRatePpm: Ppm;
  quantity: number;
}

export interface PricingLine {
  kind: LineKind;
  code: string;
  labelEn: string;
  labelAr: string;
  quantity: number;
  unitRateHalalas: Halalas;
  totalHalalas: Halalas;
  isTaxable: boolean;
}

/**
 * A longer rental that would cost the customer LESS.
 *
 * Arises when a duration sits just below a cheaper tier's minimum: 25 days
 * billed as 4 weeks can cost more than 28 days billed as one month. We do not
 * silently apply the cheaper tier — `minDays` is a real commercial constraint —
 * but hiding the fact would be the kind of quiet overcharge that loses B2B
 * customers permanently once they notice.
 */
export interface CheaperExtension {
  tier: RateTierName;
  extendToDays: number;
  totalHalalas: Halalas;
  savingHalalas: Halalas;
}

export interface TierEvaluation {
  tier: RateTierName;
  rateHalalas: Halalas;
  /** What the whole rental would cost on this tier. */
  totalHalalas: Halalas;
  eligible: boolean;
  ineligibleReason?: string;
}

export interface PricingResult {
  currency: string;
  billableDays: number;
  /** Days actually charged after applying the class minimum. */
  chargedDays: number;
  chosenTier: RateTierName;
  chosenTierRateHalalas: Halalas;
  /** Every tier considered, so a disputed price can be explained later. */
  tiersConsidered: TierEvaluation[];
  /** Non-null when a LONGER rental would cost less. Surfaced to the customer. */
  cheaperIfExtended: CheaperExtension | null;
  lines: PricingLine[];

  rentalSubtotalHalalas: Halalas;
  addonsSubtotalHalalas: Halalas;
  transportSubtotalHalalas: Halalas;
  discountHalalas: Halalas;
  taxableSubtotalHalalas: Halalas;

  vatRatePpm: Ppm;
  vatHalalas: Halalas;

  /** Refundable. Outside the tax base and outside revenue. */
  depositHalalas: Halalas;

  /**
   * taxableSubtotal + VAT. The amount the CARD IS ACTUALLY CHARGED at
   * checkout, and the amount that appears on the tax invoice.
   *
   * The deposit is deliberately excluded: it is a refundable hold taken at
   * handover, not money collected today (see `startPayment`). Presenting the
   * deposit as due now would overstate the checkout charge by the deposit.
   */
  chargedNowHalalas: Halalas;

  /**
   * taxableSubtotal + VAT + deposit. The customer's TOTAL EXPOSURE across the
   * hire, not a single payment. Never label this "due now".
   */
  totalHalalas: Halalas;
}

export class PricingError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "PricingError";
  }
}
