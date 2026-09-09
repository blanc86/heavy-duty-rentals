import { and, eq, isNull, or, sql as raw } from "drizzle-orm";
import { db } from "@/lib/db";
import { equipmentClasses } from "@/lib/db/schema/catalog";
import { addonOptions, coupons, rateCards, rateTiers, transportRates } from "@/lib/db/schema/pricing";
import { env } from "@/lib/env";
import type { Halalas } from "@/lib/money";
import { calculatePrice, billableDaysBetween, PRICING_ENGINE_VERSION } from "./engine";
import {
  PricingError,
  type AddonSelectionInput,
  type CouponInput,
  type PricingResult,
  type RateTierInput,
} from "./types";

/**
 * Loads pricing inputs from the database and runs the pure engine.
 *
 * The separation matters: `engine.ts` has no I/O and is exhaustively testable;
 * this module has I/O and no arithmetic. Anything a customer's browser sends
 * is used only to SELECT rows here — never as a value in the calculation.
 */

export interface QuoteRequest {
  classId: string;
  branchId?: string | undefined;
  startDate: Date;
  endDate: Date;
  quantity: number;
  /** Add-on codes and quantities. Rates are looked up, never accepted from the client. */
  addons: { code: string; quantity: number }[];
  deliveryRequired: boolean;
  deliveryDistanceKm?: number | undefined;
  couponCode?: string | undefined;
}

export interface QuoteOutcome {
  result: PricingResult;
  classInfo: {
    id: string;
    slug: string;
    nameEn: string;
    nameAr: string;
    minRentalDays: number;
    instantBookable: boolean;
    depositHalalas: Halalas;
    mobilisationBufferDays: number;
    demobilisationBufferDays: number;
    transportClass: string;
    requiresLowBed: boolean;
    requiresEscort: boolean;
    fuelPolicy: "wet" | "dry";
    capacityKg: number | null;
  };
}

/**
 * Produce a full priced quote.
 *
 * Called both for the live price shown while configuring AND again at booking
 * commit. The second call is what makes browser-side price tampering
 * ineffective: the total the client claims is compared against a value it had
 * no part in producing.
 */
export async function quote(request: QuoteRequest): Promise<QuoteOutcome> {
  const [cls] = await db
    .select({
      id: equipmentClasses.id,
      slug: equipmentClasses.slug,
      nameEn: equipmentClasses.nameEn,
      nameAr: equipmentClasses.nameAr,
      minRentalDays: equipmentClasses.minRentalDays,
      instantBookable: equipmentClasses.instantBookable,
      depositHalalas: equipmentClasses.depositHalalas,
      mobilisationBufferDays: equipmentClasses.mobilisationBufferDays,
      demobilisationBufferDays: equipmentClasses.demobilisationBufferDays,
      transportClass: equipmentClasses.transportClass,
      requiresLowBed: equipmentClasses.requiresLowBed,
      requiresEscort: equipmentClasses.requiresEscort,
      fuelPolicy: equipmentClasses.fuelPolicy,
      capacityKg: equipmentClasses.capacityKg,
      isActive: equipmentClasses.isActive,
    })
    .from(equipmentClasses)
    .where(eq(equipmentClasses.id, request.classId))
    .limit(1);

  if (!cls || !cls.isActive) {
    throw new PricingError("That equipment is not available.", "class_not_found");
  }

  const billableDays = billableDaysBetween(request.startDate, request.endDate);

  /**
   * Resolve a servicing branch when the caller did not name one.
   *
   * Transport rates are per-branch, so a missing branch previously meant
   * transport priced at zero — a silent underquote on a job where mobilisation
   * can be the largest line. We resolve the branch that actually stocks this
   * class instead, and `loadTransport` refuses to price rather than returning
   * zero if none can be found.
   */
  const branchId = request.branchId ?? (await resolveDefaultBranch(request.classId));

  const tiers = await loadRateTiers(request.classId, branchId);
  const addons = await loadAddonSelections(request.classId, request.addons);
  const transport = await loadTransport({
    branchId,
    transportClass: cls.transportClass,
    distanceKm: request.deliveryDistanceKm ?? 0,
    required: request.deliveryRequired,
    requiresLowBed: cls.requiresLowBed,
    requiresEscort: cls.requiresEscort,
  });
  const coupon = request.couponCode ? await loadCoupon(request.couponCode) : null;

  const result = calculatePrice({
    currency: env.CURRENCY,
    billableDays,
    minRentalDays: cls.minRentalDays,
    tiers,
    addons,
    transport,
    coupon,
    depositHalalas: cls.depositHalalas,
    vatRatePpm: env.VAT_RATE_PPM,
    quantity: request.quantity,
  });

  return { result, classInfo: cls };
}

/** The branch holding the most units of this class — the likely servicing depot. */
async function resolveDefaultBranch(classId: string): Promise<string | undefined> {
  const rows = await db.execute<{ branch_id: string }>(raw`
    SELECT u.branch_id
    FROM equipment_unit u
    JOIN branch b ON b.id = u.branch_id
    WHERE u.class_id = ${classId} AND u.is_active = TRUE AND b.is_active = TRUE
    GROUP BY u.branch_id
    ORDER BY COUNT(*) DESC
    LIMIT 1
  `);
  return rows[0]?.branch_id;
}

async function loadRateTiers(
  classId: string,
  branchId: string | undefined,
): Promise<RateTierInput[]> {
  // A branch-specific card wins over the global one; otherwise the global card
  // applies. Ordering by branchId NULLS LAST puts the specific card first.
  const rows = await db
    .select({
      tier: rateTiers.tier,
      minDays: rateTiers.minDays,
      rateHalalas: rateTiers.rateHalalas,
      branchId: rateCards.branchId,
    })
    .from(rateTiers)
    .innerJoin(rateCards, eq(rateCards.id, rateTiers.rateCardId))
    .where(
      and(
        eq(rateCards.classId, classId),
        eq(rateCards.isActive, true),
        branchId
          ? or(eq(rateCards.branchId, branchId), isNull(rateCards.branchId))
          : isNull(rateCards.branchId),
        raw`${rateCards.validFrom} <= now()`,
        or(isNull(rateCards.validTo), raw`${rateCards.validTo} > now()`),
      ),
    );

  if (rows.length === 0) {
    throw new PricingError("No rate card is configured for this equipment.", "no_rate_card");
  }

  // Keep one tier per name, preferring the branch-specific rate.
  const byTier = new Map<string, RateTierInput>();
  for (const row of rows) {
    const existing = byTier.get(row.tier);
    if (!existing || row.branchId !== null) {
      byTier.set(row.tier, {
        tier: row.tier,
        minDays: row.minDays,
        rateHalalas: row.rateHalalas,
      });
    }
  }

  return [...byTier.values()];
}

async function loadAddonSelections(
  classId: string,
  requested: { code: string; quantity: number }[],
): Promise<AddonSelectionInput[]> {
  if (requested.length === 0) return [];

  const available = await db
    .select()
    .from(addonOptions)
    .where(
      and(
        eq(addonOptions.isActive, true),
        or(eq(addonOptions.classId, classId), isNull(addonOptions.classId)),
      ),
    );

  const byCode = new Map(available.map((a) => [a.code, a]));
  const selections: AddonSelectionInput[] = [];

  for (const request of requested) {
    const option = byCode.get(request.code);
    // An unknown code is a tampering attempt or a stale client. Either way it
    // must fail loudly rather than being silently priced at zero.
    if (!option) {
      throw new PricingError(`Unknown add-on: ${request.code}`, "unknown_addon");
    }
    if (request.quantity > option.maxQuantity) {
      throw new PricingError(
        `At most ${option.maxQuantity} of "${option.nameEn}" can be added.`,
        "addon_quantity_exceeded",
      );
    }
    selections.push({
      code: option.code,
      labelEn: option.nameEn,
      labelAr: option.nameAr,
      pricingModel: option.pricingModel,
      rateHalalas: option.rateHalalas,
      quantity: request.quantity,
      isTaxable: option.isTaxable,
    });
  }

  return selections;
}

async function loadTransport(params: {
  branchId: string | undefined;
  transportClass: string;
  distanceKm: number;
  required: boolean;
  requiresLowBed: boolean;
  requiresEscort: boolean;
}) {
  const empty = {
    required: false,
    mobilisationHalalas: 0n,
    demobilisationHalalas: 0n,
    lowBedSurchargeHalalas: 0n,
    escortSurchargeHalalas: 0n,
    requiresLowBed: params.requiresLowBed,
    requiresEscort: params.requiresEscort,
  };

  if (!params.required) return empty;

  // Delivery was requested but we cannot determine a servicing depot. Pricing
  // transport at zero here would understate the total on exactly the jobs where
  // transport matters most, so we refuse and route the customer to a quote.
  if (!params.branchId) {
    throw new PricingError(
      "We could not determine a servicing depot for delivery. Please select a location or request a quote.",
      "no_servicing_branch",
    );
  }

  const [rate] = await db
    .select()
    .from(transportRates)
    .where(
      and(
        eq(transportRates.branchId, params.branchId),
        eq(transportRates.transportClass, params.transportClass),
        eq(transportRates.isActive, true),
        raw`${transportRates.distanceBandKmFrom} <= ${params.distanceKm}`,
        or(
          isNull(transportRates.distanceBandKmTo),
          raw`${transportRates.distanceBandKmTo} >= ${params.distanceKm}`,
        ),
      ),
    )
    .orderBy(raw`${transportRates.distanceBandKmFrom} DESC`)
    .limit(1);

  if (!rate) {
    // No band covers this distance. Refusing to price is the honest outcome —
    // quoting zero transport on a 900 km haul would be a serious underquote.
    throw new PricingError(
      "We cannot price transport to that distance automatically. Please request a quote.",
      "transport_out_of_range",
    );
  }

  return {
    required: true,
    mobilisationHalalas: rate.mobilisationHalalas,
    demobilisationHalalas: rate.demobilisationHalalas,
    lowBedSurchargeHalalas: rate.lowBedSurchargeHalalas,
    escortSurchargeHalalas: rate.escortSurchargeHalalas,
    requiresLowBed: params.requiresLowBed,
    requiresEscort: params.requiresEscort,
  };
}

/**
 * Coupon validation is entirely server-side: existence, active flag, validity
 * window and redemption cap. The database CHECK on redemption_count is the
 * backstop against a concurrent race past the cap.
 */
async function loadCoupon(code: string): Promise<CouponInput | null> {
  const [row] = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.code, code.trim().toUpperCase()), eq(coupons.isActive, true)))
    .limit(1);

  if (!row) throw new PricingError("That promotion code is not valid.", "invalid_coupon");

  const now = new Date();
  if (row.validFrom > now || row.validTo < now) {
    throw new PricingError("That promotion code has expired.", "expired_coupon");
  }
  if (row.maxRedemptions !== null && row.redemptionCount >= row.maxRedemptions) {
    throw new PricingError("That promotion code has been fully redeemed.", "coupon_exhausted");
  }

  return {
    code: row.code,
    discountType: row.discountType,
    value: row.value,
    minSubtotalHalalas: row.minSubtotalHalalas,
    maxDiscountHalalas: row.maxDiscountHalalas,
  };
}

/** Serialise a pricing result for storage in booking.pricingSnapshot. */
export function toPricingSnapshot(result: PricingResult) {
  return {
    computedAt: new Date().toISOString(),
    engineVersion: PRICING_ENGINE_VERSION,
    currency: result.currency,
    billableDays: result.billableDays,
    chosenTier: result.chosenTier,
    chosenTierRateHalalas: result.chosenTierRateHalalas.toString(),
    cheaperIfExtended: result.cheaperIfExtended
      ? {
          tier: result.cheaperIfExtended.tier,
          extendToDays: result.cheaperIfExtended.extendToDays,
          totalHalalas: result.cheaperIfExtended.totalHalalas.toString(),
          savingHalalas: result.cheaperIfExtended.savingHalalas.toString(),
        }
      : null,
    tiersConsidered: result.tiersConsidered.map((t) => ({
      tier: t.tier,
      rateHalalas: t.rateHalalas.toString(),
      totalHalalas: t.totalHalalas.toString(),
    })),
    lines: result.lines.map((l) => ({
      kind: l.kind,
      code: l.code,
      labelEn: l.labelEn,
      labelAr: l.labelAr,
      quantity: l.quantity,
      unitRateHalalas: l.unitRateHalalas.toString(),
      totalHalalas: l.totalHalalas.toString(),
      isTaxable: l.isTaxable,
    })),
    rentalSubtotalHalalas: result.rentalSubtotalHalalas.toString(),
    addonsSubtotalHalalas: result.addonsSubtotalHalalas.toString(),
    transportSubtotalHalalas: result.transportSubtotalHalalas.toString(),
    discountHalalas: result.discountHalalas.toString(),
    taxableSubtotalHalalas: result.taxableSubtotalHalalas.toString(),
    vatRatePpm: result.vatRatePpm,
    vatHalalas: result.vatHalalas.toString(),
    depositHalalas: result.depositHalalas.toString(),
    totalHalalas: result.totalHalalas.toString(),
  };
}
