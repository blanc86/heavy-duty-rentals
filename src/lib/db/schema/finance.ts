import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { bookings } from "./booking";
import {
  invoiceStatusEnum,
  invoiceTypeEnum,
  paymentKindEnum,
  paymentMethodEnum,
  paymentStatusEnum,
} from "./enums";
import { users } from "./identity";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/**
 * A payment attempt against a booking.
 *
 * NOTE WHAT IS ABSENT: there is no column that could hold a PAN, a CVV, an
 * expiry date or a raw provider token. `last4` and `method` are display
 * metadata the PSP returns. The schema itself makes storing card data
 * impossible, which is a stronger guarantee than a policy saying we do not.
 */
export const payments = pgTable(
  "payment",
  {
    id: uuid("id").primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),

    /**
     * Rental charge and deposit are never the same row and never the same
     * provider intent. Conflating a refundable hold with a charge is both a
     * tax error and the thing that makes customers distrust a checkout.
     */
    kind: paymentKindEnum("kind").notNull(),

    provider: varchar("provider", { length: 40 }).notNull(),
    providerIntentId: varchar("provider_intent_id", { length: 200 }),
    providerChargeId: varchar("provider_charge_id", { length: 200 }),

    status: paymentStatusEnum("status").notNull().default("created"),
    amountHalalas: bigint("amount_halalas", { mode: "bigint" }).notNull(),
    /** For deposits: how much of the authorization was actually taken. */
    capturedHalalas: bigint("captured_halalas", { mode: "bigint" }).notNull().default(sql`0`),
    refundedHalalas: bigint("refunded_halalas", { mode: "bigint" }).notNull().default(sql`0`),
    currency: varchar("currency", { length: 3 }).notNull().default("SAR"),

    method: paymentMethodEnum("method"),
    /** Display only, returned by the PSP. Never used for anything but showing the customer which card. */
    last4: varchar("last4", { length: 4 }),
    cardBrandLabel: varchar("card_brand_label", { length: 40 }),

    failureCode: varchar("failure_code", { length: 80 }),
    failureMessage: varchar("failure_message", { length: 400 }),

    /** Prevents a retried request from creating a second charge. */
    idempotencyKey: varchar("idempotency_key", { length: 80 }).notNull(),

    authorizedAt: timestamp("authorized_at", { withTimezone: true }),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("payment_idempotency_key_unique").on(t.idempotencyKey),
    index("payment_booking_idx").on(t.bookingId),
    index("payment_provider_intent_idx").on(t.providerIntentId),
    index("payment_status_idx").on(t.status, t.createdAt),
  ],
);

/**
 * Every webhook the platform has seen.
 *
 * The UNIQUE index on providerEventId is the replay defence: a replayed event
 * violates the constraint and is discarded rather than crediting a payment
 * twice. Rejecting replays in application code alone would not survive two app
 * instances processing the same retry concurrently.
 */
export const paymentWebhookEvents = pgTable(
  "payment_webhook_event",
  {
    id: uuid("id").primaryKey(),
    provider: varchar("provider", { length: 40 }).notNull(),
    providerEventId: varchar("provider_event_id", { length: 200 }).notNull(),
    eventType: varchar("event_type", { length: 80 }).notNull(),
    /** False means we stored it for forensics but changed nothing. */
    signatureVerified: boolean("signature_verified").notNull(),
    payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
    relatedPaymentId: uuid("related_payment_id").references(() => payments.id, { onDelete: "set null" }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    processingResult: varchar("processing_result", { length: 200 }),
    receivedAt: createdAt(),
  },
  (t) => [
    uniqueIndex("payment_webhook_event_unique").on(t.provider, t.providerEventId),
    index("payment_webhook_received_idx").on(t.receivedAt),
  ],
);

export const refunds = pgTable(
  "refund",
  {
    id: uuid("id").primaryKey(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "restrict" }),
    amountHalalas: bigint("amount_halalas", { mode: "bigint" }).notNull(),
    reason: varchar("reason", { length: 240 }).notNull(),
    providerRefundId: varchar("provider_refund_id", { length: 200 }),
    status: varchar("status", { length: 30 }).notNull().default("pending"),
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id, { onDelete: "set null" }),
    /** Above a configured threshold a second admin must approve. */
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    idempotencyKey: varchar("idempotency_key", { length: 80 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("refund_idempotency_key_unique").on(t.idempotencyKey),
    index("refund_payment_idx").on(t.paymentId),
  ],
);

/**
 * Seller and buyer identity are SNAPSHOTTED onto the invoice rather than
 * joined. A company changing its billing address must not retroactively alter
 * an already-issued tax invoice.
 */
export const invoices = pgTable(
  "invoice",
  {
    id: uuid("id").primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    /** From a database sequence, so numbering is gapless and non-reusable. */
    invoiceNumber: varchar("invoice_number", { length: 40 }).notNull(),
    type: invoiceTypeEnum("type").notNull().default("tax_invoice"),
    status: invoiceStatusEnum("status").notNull().default("draft"),

    sellerName: varchar("seller_name", { length: 240 }).notNull(),
    sellerVatNumber: varchar("seller_vat_number", { length: 20 }),
    sellerCrNumber: varchar("seller_cr_number", { length: 20 }),
    sellerAddress: text("seller_address"),

    buyerName: varchar("buyer_name", { length: 240 }).notNull(),
    buyerVatNumber: varchar("buyer_vat_number", { length: 20 }),
    buyerCrNumber: varchar("buyer_cr_number", { length: 20 }),
    buyerAddress: text("buyer_address"),

    subtotalHalalas: bigint("subtotal_halalas", { mode: "bigint" }).notNull(),
    vatRatePpm: integer("vat_rate_ppm").notNull(),
    vatHalalas: bigint("vat_halalas", { mode: "bigint" }).notNull(),
    totalHalalas: bigint("total_halalas", { mode: "bigint" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("SAR"),

    issuedAt: timestamp("issued_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),

    /**
     * ZATCA Phase 2 fields. NULL until a real Fatoora integration is
     * configured; while they are null the rendered invoice carries a visible
     * "not ZATCA-cleared" notice. We do not fake clearance
     * (docs/research.md §6).
     */
    previousInvoiceHash: varchar("previous_invoice_hash", { length: 128 }),
    zatcaUuid: varchar("zatca_uuid", { length: 64 }),
    zatcaClearanceStatus: varchar("zatca_clearance_status", { length: 40 }),
    zatcaQrPayload: text("zatca_qr_payload"),

    pdfStorageKey: varchar("pdf_storage_key", { length: 200 }),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("invoice_number_unique").on(t.invoiceNumber),
    index("invoice_booking_idx").on(t.bookingId),
    index("invoice_status_idx").on(t.status, t.issuedAt),
  ],
);

export const invoiceLines = pgTable(
  "invoice_line",
  {
    id: uuid("id").primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    descriptionEn: varchar("description_en", { length: 400 }).notNull(),
    descriptionAr: varchar("description_ar", { length: 400 }).notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPriceHalalas: bigint("unit_price_halalas", { mode: "bigint" }).notNull(),
    lineSubtotalHalalas: bigint("line_subtotal_halalas", { mode: "bigint" }).notNull(),
    vatRatePpm: integer("vat_rate_ppm").notNull(),
    vatHalalas: bigint("vat_halalas", { mode: "bigint" }).notNull(),
    lineTotalHalalas: bigint("line_total_halalas", { mode: "bigint" }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("invoice_line_invoice_idx").on(t.invoiceId, t.sortOrder)],
);

export const rentalAgreements = pgTable(
  "rental_agreement",
  {
    id: uuid("id").primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    termsVersion: varchar("terms_version", { length: 20 }).notNull(),
    /** Hash of the exact rendered agreement, so what was accepted is provable. */
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    storageKey: varchar("storage_key", { length: 200 }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id, { onDelete: "set null" }),
    acceptedIp: varchar("accepted_ip", { length: 45 }),
    acceptedUserAgent: varchar("accepted_user_agent", { length: 512 }),
    /**
     * Reserved for a compliant e-signature provider. We record acceptance; we
     * do NOT claim this constitutes a legally binding electronic signature.
     */
    signatureProvider: varchar("signature_provider", { length: 40 }),
    signatureReference: varchar("signature_reference", { length: 200 }),
    createdAt: createdAt(),
  },
  (t) => [index("rental_agreement_booking_idx").on(t.bookingId)],
);

/** Company credit ledger — the enterprise payment path that bypasses the PSP. */
export const creditTransactions = pgTable(
  "credit_transaction",
  {
    id: uuid("id").primaryKey(),
    companyId: uuid("company_id").notNull(),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    /** Positive consumes credit, negative restores it. */
    amountHalalas: bigint("amount_halalas", { mode: "bigint" }).notNull(),
    balanceAfterHalalas: bigint("balance_after_halalas", { mode: "bigint" }).notNull(),
    reason: varchar("reason", { length: 200 }).notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("credit_transaction_company_idx").on(t.companyId, t.createdAt)],
);
