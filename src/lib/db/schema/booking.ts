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
import { equipmentClasses } from "./catalog";
import {
  actorTypeEnum,
  addonPricingModelEnum,
  bookingStatusEnum,
  localeEnum,
  rateTierEnum,
  reservationStatusEnum,
} from "./enums";
import { companies, projectSites, users } from "./identity";
import { equipmentUnits } from "./inventory";
import { addonOptions, coupons } from "./pricing";
import { tstzrange } from "./types";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** The complete computed breakdown, frozen at booking time. See `pricingSnapshot`. */
export type PricingSnapshot = {
  computedAt: string;
  engineVersion: string;
  currency: string;
  billableDays: number;
  chosenTier: "daily" | "weekly" | "monthly";
  chosenTierRateHalalas: string;
  /** Every tier considered, so a disputed price can be explained later. */
  tiersConsidered: { tier: string; rateHalalas: string; totalHalalas: string }[];
  /** Recorded so we can evidence that a cheaper longer hire WAS disclosed. */
  cheaperIfExtended: {
    tier: string;
    extendToDays: number;
    totalHalalas: string;
    savingHalalas: string;
  } | null;
  lines: {
    kind: string;
    code: string;
    labelEn: string;
    labelAr: string;
    quantity: number;
    unitRateHalalas: string;
    totalHalalas: string;
    isTaxable: boolean;
  }[];
  rentalSubtotalHalalas: string;
  addonsSubtotalHalalas: string;
  transportSubtotalHalalas: string;
  discountHalalas: string;
  taxableSubtotalHalalas: string;
  vatRatePpm: number;
  vatHalalas: string;
  depositHalalas: string;
  totalHalalas: string;
};

export const bookings = pgTable(
  "booking",
  {
    id: uuid("id").primaryKey(),
    /** Customer-facing, e.g. RNT-7F3K9Q. Quoted on the phone, so it avoids I/O/0/1. */
    reference: varchar("reference", { length: 20 }).notNull(),
    status: bookingStatusEnum("status").notNull().default("draft"),

    customerUserId: uuid("customer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    /** Null for individual customers. Non-null bookings are tenant-scoped. */
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "restrict" }),
    projectSiteId: uuid("project_site_id").references(() => projectSites.id, { onDelete: "set null" }),
    supplierId: uuid("supplier_id"),

    locale: localeEnum("locale").notNull().default("en"),

    /** What the customer pays for. The occupied window is wider — see `reservations`. */
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),
    billableDays: integer("billable_days").notNull(),

    deliveryRequired: boolean("delivery_required").notNull().default(true),
    deliveryDistanceKm: integer("delivery_distance_km"),
    deliveryWindowStart: timestamp("delivery_window_start", { withTimezone: true }),
    deliveryWindowEnd: timestamp("delivery_window_end", { withTimezone: true }),
    siteContactName: varchar("site_contact_name", { length: 160 }),
    siteContactPhone: varchar("site_contact_phone", { length: 32 }),
    siteAddressLine: text("site_address_line"),
    siteCity: varchar("site_city", { length: 80 }),
    siteAccessNotes: text("site_access_notes"),

    /** Procurement artefacts. Without these the deal moves offline. */
    poNumber: varchar("po_number", { length: 80 }),
    costCentre: varchar("cost_centre", { length: 80 }),
    projectCode: varchar("project_code", { length: 80 }),

    // --- Money. All server-computed; a client-supplied total is only ever
    // compared against these, never written into them. ---
    rentalSubtotalHalalas: bigint("rental_subtotal_halalas", { mode: "bigint" }).notNull().default(sql`0`),
    addonsSubtotalHalalas: bigint("addons_subtotal_halalas", { mode: "bigint" }).notNull().default(sql`0`),
    transportSubtotalHalalas: bigint("transport_subtotal_halalas", { mode: "bigint" }).notNull().default(sql`0`),
    discountHalalas: bigint("discount_halalas", { mode: "bigint" }).notNull().default(sql`0`),
    taxableSubtotalHalalas: bigint("taxable_subtotal_halalas", { mode: "bigint" }).notNull().default(sql`0`),
    vatRatePpm: integer("vat_rate_ppm").notNull(),
    vatHalalas: bigint("vat_halalas", { mode: "bigint" }).notNull().default(sql`0`),
    /** Refundable. Outside the tax base and outside revenue. */
    depositHalalas: bigint("deposit_halalas", { mode: "bigint" }).notNull().default(sql`0`),
    totalHalalas: bigint("total_halalas", { mode: "bigint" }).notNull().default(sql`0`),
    currency: varchar("currency", { length: 3 }).notNull().default("SAR"),

    /**
     * The full computed breakdown, frozen. Rate cards change; a booking's price
     * must not drift after the customer agreed to it, and a billing dispute two
     * months later has to be answerable from the record rather than by
     * re-deriving from today's rates.
     */
    pricingSnapshot: jsonb("pricing_snapshot").$type<PricingSnapshot>(),

    couponId: uuid("coupon_id").references(() => coupons.id, { onDelete: "set null" }),

    /** Evidence of acceptance: which version, when, from where. */
    termsVersion: varchar("terms_version", { length: 20 }),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
    termsAcceptedIp: varchar("terms_accepted_ip", { length: 45 }),

    /**
     * UNIQUE. A double-clicked submit or a retried request returns the existing
     * booking instead of reserving the same crane twice.
     */
    idempotencyKey: varchar("idempotency_key", { length: 80 }),

    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
    refundHalalas: bigint("refund_halalas", { mode: "bigint" }).notNull().default(sql`0`),

    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("booking_reference_unique").on(t.reference),
    uniqueIndex("booking_idempotency_key_unique").on(t.idempotencyKey),
    index("booking_customer_idx").on(t.customerUserId, t.createdAt),
    index("booking_company_idx").on(t.companyId, t.createdAt),
    // Ops dashboard: upcoming starts, returns due, overdue.
    index("booking_status_start_idx").on(t.status, t.startDate),
    index("booking_status_end_idx").on(t.status, t.endDate),
  ],
);

export const bookingItems = pgTable(
  "booking_item",
  {
    id: uuid("id").primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => equipmentClasses.id, { onDelete: "restrict" }),
    /** The specific physical machine allocated. */
    unitId: uuid("unit_id")
      .notNull()
      .references(() => equipmentUnits.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(1),
    tier: rateTierEnum("tier").notNull(),
    unitRateHalalas: bigint("unit_rate_halalas", { mode: "bigint" }).notNull(),
    lineTotalHalalas: bigint("line_total_halalas", { mode: "bigint" }).notNull(),
  },
  (t) => [index("booking_item_booking_idx").on(t.bookingId), index("booking_item_unit_idx").on(t.unitId)],
);

/**
 * THE CONCURRENCY ARBITER.
 *
 * `period` is the OCCUPIED window: the billed dates widened by the class's
 * mobilisation and demobilisation buffers.
 *
 * The migration adds:
 *
 *   ALTER TABLE reservation ADD CONSTRAINT reservation_no_overlap
 *     EXCLUDE USING gist (unit_id WITH =, period WITH &&)
 *     WHERE (status IN ('held','confirmed','active'));
 *
 * That constraint — not application code — is what makes double-booking
 * impossible under concurrency. See docs/DATABASE.md §5.
 */
export const reservations = pgTable(
  "reservation",
  {
    id: uuid("id").primaryKey(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => equipmentUnits.id, { onDelete: "restrict" }),
    /** Null while it is a bare checkout hold with no booking yet. */
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }),
    status: reservationStatusEnum("status").notNull().default("held"),
    period: tstzrange("period").notNull(),
    billableStart: timestamp("billable_start", { withTimezone: true }).notNull(),
    billableEnd: timestamp("billable_end", { withTimezone: true }).notNull(),
    /**
     * Holds expire. Reads also filter on this, so a late sweeper can never
     * cause a stale hold to block a genuine booking — correctness does not
     * depend on a background job running on time.
     */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    heldByToken: varchar("held_by_token", { length: 64 }),
    createdAt: createdAt(),
  },
  (t) => [
    index("reservation_unit_status_idx").on(t.unitId, t.status),
    index("reservation_booking_idx").on(t.bookingId),
    index("reservation_expires_idx").on(t.expiresAt),
  ],
);

export const bookingAddons = pgTable(
  "booking_addon",
  {
    id: uuid("id").primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    addonOptionId: uuid("addon_option_id").references(() => addonOptions.id, { onDelete: "set null" }),
    /** Denormalised so the line survives the option being renamed or retired. */
    code: varchar("code", { length: 40 }).notNull(),
    labelEn: varchar("label_en", { length: 160 }).notNull(),
    labelAr: varchar("label_ar", { length: 160 }).notNull(),
    quantity: integer("quantity").notNull().default(1),
    pricingModel: addonPricingModelEnum("pricing_model").notNull(),
    unitRateHalalas: bigint("unit_rate_halalas", { mode: "bigint" }).notNull(),
    lineTotalHalalas: bigint("line_total_halalas", { mode: "bigint" }).notNull(),
    isTaxable: boolean("is_taxable").notNull().default(true),
  },
  (t) => [index("booking_addon_booking_idx").on(t.bookingId)],
);

/**
 * Append-only lifecycle history. The application exposes an insert path only;
 * UPDATE and DELETE are revoked from the app database role.
 */
export const bookingEvents = pgTable(
  "booking_event",
  {
    id: uuid("id").primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 60 }).notNull(),
    fromStatus: varchar("from_status", { length: 30 }),
    toStatus: varchar("to_status", { length: 30 }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorType: actorTypeEnum("actor_type").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("booking_event_booking_idx").on(t.bookingId, t.createdAt)],
);

/**
 * Checkout state for an in-progress or abandoned booking.
 *
 * `consentedToRecovery` gates the recovery email. Under PDPL, marketing without
 * consent is one of the violations SDAIA is actively penalising, so the gate is
 * a column the send path must read — not a policy someone is meant to remember.
 */
export const checkoutHolds = pgTable(
  "checkout_hold",
  {
    id: uuid("id").primaryKey(),
    sessionToken: varchar("session_token", { length: 64 }).notNull(),
    classId: uuid("class_id").references(() => equipmentClasses.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id").references(() => equipmentUnits.id, { onDelete: "set null" }),
    reservationId: uuid("reservation_id").references(() => reservations.id, { onDelete: "set null" }),
    configuration: jsonb("configuration").$type<Record<string, unknown>>().notNull().default({}),
    contactEmail: varchar("contact_email", { length: 320 }),
    contactPhone: varchar("contact_phone", { length: 32 }),
    consentedToRecovery: boolean("consented_to_recovery").notNull().default(false),
    recoveryEmailSentAt: timestamp("recovery_email_sent_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    convertedBookingId: uuid("converted_booking_id").references(() => bookings.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("checkout_hold_session_unique").on(t.sessionToken),
    index("checkout_hold_expires_idx").on(t.expiresAt),
  ],
);
