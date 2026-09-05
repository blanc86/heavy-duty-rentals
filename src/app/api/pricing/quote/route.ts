import { NextResponse } from "next/server";
import { z } from "zod";
import { countAvailableUnits, occupiedPeriod } from "@/lib/availability";
import { quote } from "@/lib/pricing/repository";
import { guard, toClientError } from "@/lib/server/guard";
import { serializeHalalas } from "@/lib/money";

/**
 * Live price quote.
 *
 * The browser calls this while the customer configures a rental, and DISPLAYS
 * the result. It never computes a price itself, and the figure returned here
 * is re-derived from the database again at booking commit and compared — so a
 * tampered response is worthless to an attacker.
 *
 * Rate limited because it is the only unauthenticated endpoint that does real
 * database work per call.
 */
const schema = z
  .object({
    classId: z.uuid(),
    branchId: z.uuid().optional(),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    quantity: z.number().int().min(1).max(10).default(1),
    addons: z
      .array(z.object({ code: z.string().max(40), quantity: z.number().int().min(1).max(10) }))
      .max(10)
      .default([]),
    deliveryRequired: z.boolean().default(true),
    deliveryDistanceKm: z.number().int().min(0).max(3000).optional(),
    couponCode: z.string().max(40).optional(),
  })
  .strict();

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "invalid_json", message: "Malformed request." } }, { status: 400 });
  }

  try {
    const result = await guard(
      body,
      { schema, rateLimit: { name: "priceQuote" } },
      async ({ input }) => {
        const startDate = new Date(`${input.startDate}T00:00:00.000Z`);
        const endDate = new Date(`${input.endDate}T00:00:00.000Z`);

        if (endDate <= startDate) {
          return { error: { code: "invalid_dates", message: "The end date must be after the start date." } };
        }

        const { result: pricing, classInfo } = await quote({
          classId: input.classId,
          branchId: input.branchId,
          startDate,
          endDate,
          quantity: input.quantity,
          addons: input.addons,
          deliveryRequired: input.deliveryRequired,
          deliveryDistanceKm: input.deliveryDistanceKm,
          couponCode: input.couponCode,
        });

        // Availability is resolved with the class's own buffers, so the number
        // shown is the number of machines that could genuinely take this job —
        // not the number that merely have no booking on those exact dates.
        const period = occupiedPeriod(
          startDate,
          endDate,
          classInfo.mobilisationBufferDays,
          classInfo.demobilisationBufferDays,
        );
        const availableUnits = await countAvailableUnits({
          classId: input.classId,
          period,
          branchId: input.branchId,
        });

        return {
          availableUnits,
          instantBookable: classInfo.instantBookable,
          minRentalDays: classInfo.minRentalDays,
          pricing: {
            currency: pricing.currency,
            billableDays: pricing.billableDays,
            chargedDays: pricing.chargedDays,
            chosenTier: pricing.chosenTier,
            // Surfaced so the customer is told when a LONGER hire costs less.
            // Staying quiet here would be a quiet overcharge.
            cheaperIfExtended: pricing.cheaperIfExtended
              ? {
                  tier: pricing.cheaperIfExtended.tier,
                  extendToDays: pricing.cheaperIfExtended.extendToDays,
                  total: serializeHalalas(pricing.cheaperIfExtended.totalHalalas),
                  saving: serializeHalalas(pricing.cheaperIfExtended.savingHalalas),
                }
              : null,
            lines: pricing.lines.map((line) => ({
              kind: line.kind,
              code: line.code,
              label: line.labelEn,
              labelAr: line.labelAr,
              quantity: line.quantity,
              total: serializeHalalas(line.totalHalalas),
              isTaxable: line.isTaxable,
            })),
            taxableSubtotal: serializeHalalas(pricing.taxableSubtotalHalalas),
            discount: serializeHalalas(pricing.discountHalalas),
            vatRatePpm: pricing.vatRatePpm,
            vat: serializeHalalas(pricing.vatHalalas),
            deposit: serializeHalalas(pricing.depositHalalas),
            chargedNow: serializeHalalas(pricing.chargedNowHalalas),
            total: serializeHalalas(pricing.totalHalalas),
          },
        };
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    const clientError = toClientError(error);
    const status =
      clientError.code === "rate_limited"
        ? 429
        : clientError.code === "validation_failed"
          ? 422
          : clientError.code === "internal_error"
            ? 500
            : 400;
    return NextResponse.json({ error: clientError }, { status });
  }
}
