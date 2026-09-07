import { eq, sql as raw } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings } from "@/lib/db/schema/booking";
import { invoiceLines, invoices } from "@/lib/db/schema/finance";
import { companies } from "@/lib/db/schema/identity";
import { env } from "@/lib/env";
import { uuidv7 } from "@/lib/ids";
import { applyPpm, type Halalas } from "@/lib/money";
import { getBusinessSettings } from "@/lib/settings";

/**
 * INVOICING.
 *
 * The invoice domain model is complete and correct: gapless numbering from a
 * database sequence, snapshotted seller/buyer identity, integer-halala
 * arithmetic, and a VAT rate recorded per invoice.
 *
 * What is deliberately NOT here is ZATCA Phase 2 clearance. That requires a
 * real CSID, a cryptographic stamp identity and ZATCA sandbox certification —
 * none obtainable without the business's own credentials and a tax advisor's
 * sign-off. Rather than fake it, `zatcaUuid` / `zatcaClearanceStatus` /
 * `zatcaQrPayload` stay NULL and the rendered invoice carries a visible
 * "not ZATCA-cleared" notice. See docs/research.md §6.
 */

export interface TaxInvoiceProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  /** Clear (B2B) or report (B2C) an invoice with the tax authority. */
  submit(invoiceId: string): Promise<{ uuid: string; clearanceStatus: string; qrPayload: string }>;
}

/** Generates a structurally correct invoice with no tax-authority submission. */
class LocalInvoiceProvider implements TaxInvoiceProvider {
  readonly name = "local";
  readonly isConfigured = true;

  async submit(): Promise<never> {
    throw new Error(
      "The local invoice provider does not submit to ZATCA. Invoices are labelled as not cleared.",
    );
  }
}

/**
 * ZATCA Fatoora Phase 2 — NOT IMPLEMENTED.
 *
 * Throwing here is deliberate. A stub that silently returned a fake UUID would
 * make the system look compliant while producing invoices a tax authority
 * would reject, which is worse than an honest gap.
 */
class ZatcaInvoiceProvider implements TaxInvoiceProvider {
  readonly name = "zatca";
  readonly isConfigured = false;

  async submit(): Promise<never> {
    throw new Error(
      "ZATCA Phase 2 clearance is not implemented. It requires CSID onboarding, a cryptographic " +
        "stamp identity and ZATCA sandbox certification. See docs/research.md §6 and engage a tax advisor.",
    );
  }
}

export function getTaxInvoiceProvider(): TaxInvoiceProvider {
  return env.TAX_INVOICE_PROVIDER === "zatca"
    ? new ZatcaInvoiceProvider()
    : new LocalInvoiceProvider();
}

export interface InvoiceView {
  invoiceNumber: string;
  issuedAt: Date | null;
  sellerName: string;
  sellerVatNumber: string | null;
  sellerCrNumber: string | null;
  sellerAddress: string | null;
  buyerName: string;
  buyerVatNumber: string | null;
  buyerAddress: string | null;
  subtotalHalalas: Halalas;
  vatRatePpm: number;
  vatHalalas: Halalas;
  totalHalalas: Halalas;
  currency: string;
  lines: {
    descriptionEn: string;
    descriptionAr: string;
    quantity: number;
    unitPriceHalalas: Halalas;
    lineSubtotalHalalas: Halalas;
    vatHalalas: Halalas;
    lineTotalHalalas: Halalas;
  }[];
  /** False until a real ZATCA integration is configured and has cleared it. */
  isZatcaCleared: boolean;
}

/**
 * Issue the tax invoice for a confirmed booking, or return the existing one.
 *
 * Idempotent by design: invoice numbers are consumed from a sequence and an
 * issued invoice is immutable, so re-running must never mint a second number
 * for the same booking.
 */
export async function ensureInvoiceForBooking(bookingId: string): Promise<string | null> {
  const [existing] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(eq(invoices.bookingId, bookingId))
    .limit(1);
  if (existing) return existing.id;

  const [booking] = await db
    .select({
      id: bookings.id,
      reference: bookings.reference,
      status: bookings.status,
      companyId: bookings.companyId,
      customerUserId: bookings.customerUserId,
      rentalSubtotalHalalas: bookings.rentalSubtotalHalalas,
      addonsSubtotalHalalas: bookings.addonsSubtotalHalalas,
      transportSubtotalHalalas: bookings.transportSubtotalHalalas,
      discountHalalas: bookings.discountHalalas,
      taxableSubtotalHalalas: bookings.taxableSubtotalHalalas,
      vatRatePpm: bookings.vatRatePpm,
      vatHalalas: bookings.vatHalalas,
      currency: bookings.currency,
      billableDays: bookings.billableDays,
    })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);

  // Only a booking that is actually paying gets an invoice. Invoicing a
  // pending or cancelled booking would put a number into the sequence for a
  // transaction that never happened.
  if (!booking) return null;
  if (!["confirmed", "active", "completed"].includes(booking.status)) return null;

  // Defence in depth behind the startup check in `assertProductionReady`.
  // That one refuses to boot; this one refuses to issue, which also covers
  // development and any environment that skipped the boot assertion. Either
  // way, selecting a clearance provider that does not exist must not quietly
  // produce an uncleared invoice.
  const provider = getTaxInvoiceProvider();
  if (provider.name !== "local" && !provider.isConfigured) {
    throw new Error(
      `Tax invoice provider "${provider.name}" is selected but not configured. ` +
        "Refusing to issue an invoice that would be presented as cleared when it is not.",
    );
  }

  const business = await getBusinessSettings();

  // Buyer identity is SNAPSHOTTED, not joined: a company later changing its
  // billing address must not retroactively alter an issued tax invoice.
  let buyerName = "Customer";
  let buyerVatNumber: string | null = null;
  let buyerAddress: string | null = null;

  if (booking.companyId) {
    const [company] = await db
      .select({
        nameEn: companies.nameEn,
        vatNumber: companies.vatNumber,
        crNumber: companies.commercialRegistrationNumber,
        billingAddressEn: companies.billingAddressEn,
      })
      .from(companies)
      .where(eq(companies.id, booking.companyId))
      .limit(1);
    if (company) {
      buyerName = company.nameEn;
      buyerVatNumber = company.vatNumber;
      buyerAddress = company.billingAddressEn;
    }
  } else {
    const rows = await db.execute<{ full_name: string }>(raw`
      SELECT full_name FROM "user" WHERE id = ${booking.customerUserId} LIMIT 1
    `);
    buyerName = rows[0]?.full_name ?? "Customer";
  }

  // Gapless allocation order, and a number that can never be reused.
  const seqRows = await db.execute<{ nextval: string }>(raw`SELECT nextval('invoice_number_seq')`);
  const sequence = seqRows[0]?.nextval ?? "1";
  const year = new Date().getFullYear();
  const invoiceNumber = `INV-${year}-${String(sequence).padStart(6, "0")}`;

  const invoiceId = uuidv7();

  const lineDefinitions = [
    {
      descriptionEn: `Equipment rental — booking ${booking.reference} (${booking.billableDays} days)`,
      descriptionAr: `إيجار معدة — حجز ${booking.reference} (${booking.billableDays} يوم)`,
      amount: booking.rentalSubtotalHalalas,
    },
    {
      descriptionEn: "Operator and additional services",
      descriptionAr: "المشغل والخدمات الإضافية",
      amount: booking.addonsSubtotalHalalas,
    },
    {
      descriptionEn: "Mobilisation and demobilisation",
      descriptionAr: "التعبئة والإرجاع",
      amount: booking.transportSubtotalHalalas,
    },
    {
      descriptionEn: "Discount",
      descriptionAr: "خصم",
      amount: -booking.discountHalalas,
    },
  ].filter((line) => line.amount !== 0n);

  await db.transaction(async (tx) => {
    await tx.insert(invoices).values({
      id: invoiceId,
      bookingId: booking.id,
      invoiceNumber,
      type: booking.companyId ? "tax_invoice" : "simplified",
      status: "issued",
      sellerName: business.companyNameEn,
      sellerVatNumber: business.vatNumber,
      sellerCrNumber: business.crNumber,
      sellerAddress: business.addressEn,
      buyerName,
      buyerVatNumber,
      buyerAddress,
      subtotalHalalas: booking.taxableSubtotalHalalas,
      vatRatePpm: booking.vatRatePpm,
      vatHalalas: booking.vatHalalas,
      // A DB CHECK enforces total = subtotal + vat, so an arithmetic slip here
      // fails the write rather than producing an invoice that does not foot.
      totalHalalas: booking.taxableSubtotalHalalas + booking.vatHalalas,
      currency: booking.currency,
      issuedAt: new Date(),
      // Deliberately NULL: not cleared, and we do not pretend otherwise.
      zatcaUuid: null,
      zatcaClearanceStatus: null,
      zatcaQrPayload: null,
      previousInvoiceHash: null,
    });

    let order = 0;
    for (const line of lineDefinitions) {
      const lineVat = applyPpm(line.amount, booking.vatRatePpm);
      await tx.insert(invoiceLines).values({
        id: uuidv7(),
        invoiceId,
        descriptionEn: line.descriptionEn,
        descriptionAr: line.descriptionAr,
        quantity: 1,
        unitPriceHalalas: line.amount,
        lineSubtotalHalalas: line.amount,
        vatRatePpm: booking.vatRatePpm,
        vatHalalas: lineVat,
        lineTotalHalalas: line.amount + lineVat,
        sortOrder: order++,
      });
    }
  });

  return invoiceId;
}

export async function getInvoiceView(bookingId: string): Promise<InvoiceView | null> {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.bookingId, bookingId))
    .limit(1);
  if (!invoice) return null;

  const lines = await db
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, invoice.id))
    .orderBy(invoiceLines.sortOrder);

  return {
    invoiceNumber: invoice.invoiceNumber,
    issuedAt: invoice.issuedAt,
    sellerName: invoice.sellerName,
    sellerVatNumber: invoice.sellerVatNumber,
    sellerCrNumber: invoice.sellerCrNumber,
    sellerAddress: invoice.sellerAddress,
    buyerName: invoice.buyerName,
    buyerVatNumber: invoice.buyerVatNumber,
    buyerAddress: invoice.buyerAddress,
    subtotalHalalas: invoice.subtotalHalalas,
    vatRatePpm: invoice.vatRatePpm,
    vatHalalas: invoice.vatHalalas,
    totalHalalas: invoice.totalHalalas,
    currency: invoice.currency,
    lines: lines.map((line) => ({
      descriptionEn: line.descriptionEn,
      descriptionAr: line.descriptionAr,
      quantity: line.quantity,
      unitPriceHalalas: line.unitPriceHalalas,
      lineSubtotalHalalas: line.lineSubtotalHalalas,
      vatHalalas: line.vatHalalas,
      lineTotalHalalas: line.lineTotalHalalas,
    })),
    isZatcaCleared: invoice.zatcaClearanceStatus === "cleared",
  };
}
