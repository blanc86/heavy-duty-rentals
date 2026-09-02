"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { quoteItems, quotes } from "@/lib/db/schema/ops";
import { generateReference, uuidv7 } from "@/lib/ids";
import { writeAudit } from "@/lib/server/audit";
import { guard, toClientError } from "@/lib/server/guard";

export type QuoteActionResult =
  | { ok: true; reference: string }
  | {
      ok: false;
      error: { code: string; message: string; issues?: { path: string; message: string }[] };
    };

/**
 * Structured quote request.
 *
 * The fields are the ones that actually determine a price for heavy plant —
 * load weight, radius, height, ground conditions, duration — so operations can
 * respond with a QUOTE rather than a request for more information. That is the
 * whole difference between this and a generic contact form.
 */
const schema = z
  .object({
    contactName: z.string().min(2).max(160).trim(),
    contactEmail: z.email().max(320).transform((v) => v.trim().toLowerCase()),
    contactPhone: z.string().min(6).max(32).trim(),
    companyNameRaw: z.string().max(240).trim().optional(),

    classId: z.uuid().optional(),
    descriptionRaw: z.string().max(400).trim().optional(),
    quantity: z.number().int().min(1).max(20).default(1),

    branchId: z.uuid().optional(),
    siteCity: z.string().max(80).trim().optional(),
    siteAddressLine: z.string().max(500).trim().optional(),

    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),

    requirements: z.string().max(4000).trim().optional(),

    // Structured lift details. Optional because a customer may genuinely not
    // know them yet — that is a legitimate reason to ask for a quote.
    loadWeightKg: z.number().int().min(0).max(2_000_000).optional(),
    radiusM: z.number().min(0).max(300).optional(),
    liftHeightM: z.number().min(0).max(300).optional(),

    locale: z.enum(["en", "ar"]).default("en"),
  })
  .strict()
  // Either a catalog class or a free-text description — otherwise there is
  // nothing to price.
  .refine((data) => Boolean(data.classId ?? data.descriptionRaw), {
    message: "Select equipment or describe what you need.",
    path: ["classId"],
  });

export async function submitQuoteRequest(input: unknown): Promise<QuoteActionResult> {
  try {
    return await guard(
      input,
      {
        schema,
        rateLimit: { name: "quoteRequest" },
        audit: { action: "quote.requested", resourceType: "quote" },
      },
      async ({ input: data, actor, ip }) => {
        const quoteId = uuidv7();
        const reference = generateReference("QTE");

        await db.transaction(async (tx) => {
          await tx.insert(quotes).values({
            id: quoteId,
            reference,
            status: "requested",
            requesterUserId: actor?.userId ?? null,
            companyId: null,
            contactName: data.contactName,
            contactEmail: data.contactEmail,
            contactPhone: data.contactPhone,
            companyNameRaw: data.companyNameRaw ?? null,
            branchId: data.branchId ?? null,
            siteCity: data.siteCity ?? null,
            siteAddressLine: data.siteAddressLine ?? null,
            startDate: data.startDate ? new Date(`${data.startDate}T00:00:00.000Z`) : null,
            endDate: data.endDate ? new Date(`${data.endDate}T00:00:00.000Z`) : null,
            requirements: data.requirements ?? null,
            liftDetails: {
              ...(data.loadWeightKg !== undefined ? { loadWeightKg: data.loadWeightKg } : {}),
              ...(data.radiusM !== undefined ? { radiusM: data.radiusM } : {}),
              ...(data.liftHeightM !== undefined ? { liftHeightM: data.liftHeightM } : {}),
            },
          });

          await tx.insert(quoteItems).values({
            id: uuidv7(),
            quoteId,
            classId: data.classId ?? null,
            descriptionRaw: data.descriptionRaw ?? null,
            quantity: data.quantity,
            durationDays:
              data.startDate && data.endDate
                ? Math.max(
                    1,
                    Math.round(
                      (new Date(`${data.endDate}T00:00:00.000Z`).getTime() -
                        new Date(`${data.startDate}T00:00:00.000Z`).getTime()) /
                        86_400_000,
                    ),
                  )
                : null,
            sortOrder: 0,
          });
        });

        await writeAudit({
          action: "quote.created",
          actorUserId: actor?.userId ?? null,
          actorType: actor ? "customer" : "anonymous",
          actorIp: ip ?? null,
          resourceType: "quote",
          resourceId: quoteId,
          outcome: "success",
          metadata: { reference },
        });

        return { ok: true as const, reference };
      },
    );
  } catch (error) {
    return { ok: false, error: toClientError(error) };
  }
}
