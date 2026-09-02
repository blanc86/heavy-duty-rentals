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
import { branches, equipmentClasses } from "./catalog";
import {
  deliveryDirectionEnum,
  deliveryStatusEnum,
  inspectionPhaseEnum,
  inspectionResultEnum,
  quoteStatusEnum,
  reviewStatusEnum,
} from "./enums";
import { companies, users } from "./identity";
import { equipmentUnits } from "./inventory";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/**
 * Heavy plant cannot simply be "shipped". A delivery is a dispatch job with a
 * vehicle, a route, permits and possibly an escort.
 */
export const deliveries = pgTable(
  "delivery",
  {
    id: uuid("id").primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    direction: deliveryDirectionEnum("direction").notNull(),
    status: deliveryStatusEnum("status").notNull().default("scheduled"),
    scheduledWindowStart: timestamp("scheduled_window_start", { withTimezone: true }),
    scheduledWindowEnd: timestamp("scheduled_window_end", { withTimezone: true }),
    driverUserId: uuid("driver_user_id").references(() => users.id, { onDelete: "set null" }),
    vehicleReference: varchar("vehicle_reference", { length: 80 }),
    requiresLowBed: boolean("requires_low_bed").notNull().default(false),
    requiresEscort: boolean("requires_escort").notNull().default(false),
    permitReference: varchar("permit_reference", { length: 120 }),
    actualDepartedAt: timestamp("actual_departed_at", { withTimezone: true }),
    actualArrivedAt: timestamp("actual_arrived_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    proofStorageKey: varchar("proof_storage_key", { length: 200 }),
    /** Reserved for telematics; nothing writes these in V1. */
    gpsLastLatitude: varchar("gps_last_latitude", { length: 32 }),
    gpsLastLongitude: varchar("gps_last_longitude", { length: 32 }),
    gpsLastUpdatedAt: timestamp("gps_last_updated_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("delivery_booking_idx").on(t.bookingId),
    index("delivery_status_window_idx").on(t.status, t.scheduledWindowStart),
    index("delivery_driver_idx").on(t.driverUserId),
  ],
);

/**
 * Condition of record at handover and at return. This is what settles damage
 * disputes, so it captures hours, fuel, photos and a structured checklist
 * rather than a free-text note.
 */
export const inspections = pgTable(
  "inspection",
  {
    id: uuid("id").primaryKey(),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => equipmentUnits.id, { onDelete: "restrict" }),
    phase: inspectionPhaseEnum("phase").notNull(),
    inspectorUserId: uuid("inspector_user_id").references(() => users.id, { onDelete: "set null" }),
    engineHours: integer("engine_hours"),
    fuelLevelPercent: integer("fuel_level_percent"),
    conditionRating: integer("condition_rating"),
    damageFound: boolean("damage_found").notNull().default(false),
    damageNotes: text("damage_notes"),
    missingAccessories: jsonb("missing_accessories").$type<string[]>().notNull().default([]),
    checklist: jsonb("checklist").$type<{ key: string; label: string; pass: boolean; note?: string }[]>()
      .notNull()
      .default([]),
    photoKeys: jsonb("photo_keys").$type<string[]>().notNull().default([]),
    result: inspectionResultEnum("result"),
    /** Cost charged against the deposit, if any. */
    chargeableDamageHalalas: bigint("chargeable_damage_halalas", { mode: "bigint" }).notNull().default(sql`0`),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("inspection_booking_idx").on(t.bookingId),
    index("inspection_unit_idx").on(t.unitId, t.createdAt),
  ],
);

/**
 * One review per completed rental. The UNIQUE FK to a booking is what makes
 * reviews verifiable — there is no route to create a review without a
 * completed rental, so fabricated reviews are structurally excluded rather
 * than merely discouraged.
 */
export const reviews = pgTable(
  "review",
  {
    id: uuid("id").primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => equipmentClasses.id, { onDelete: "cascade" }),
    /** DB CHECK constrains 1..5. */
    rating: integer("rating").notNull(),
    title: varchar("title", { length: 160 }),
    body: text("body"),
    status: reviewStatusEnum("status").notNull().default("pending"),
    moderatedByUserId: uuid("moderated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    moderationNote: text("moderation_note"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("review_booking_unique").on(t.bookingId),
    index("review_class_status_idx").on(t.classId, t.status),
  ],
);

/**
 * The honest alternative to either faking an instant price on a 600 t crawler
 * or forcing every customer to phone. Same discovery flow, structured request,
 * priced response the customer can accept online.
 */
export const quotes = pgTable(
  "quote",
  {
    id: uuid("id").primaryKey(),
    reference: varchar("reference", { length: 20 }).notNull(),
    status: quoteStatusEnum("status").notNull().default("requested"),
    requesterUserId: uuid("requester_user_id").references(() => users.id, { onDelete: "set null" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    contactName: varchar("contact_name", { length: 160 }).notNull(),
    contactEmail: varchar("contact_email", { length: 320 }).notNull(),
    contactPhone: varchar("contact_phone", { length: 32 }).notNull(),
    companyNameRaw: varchar("company_name_raw", { length: 240 }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    siteCity: varchar("site_city", { length: 80 }),
    siteAddressLine: text("site_address_line"),
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    requirements: text("requirements"),
    /** Structured lift details so operations can price without a phone call. */
    liftDetails: jsonb("lift_details").$type<Record<string, unknown>>().notNull().default({}),
    pricedSubtotalHalalas: bigint("priced_subtotal_halalas", { mode: "bigint" }),
    pricedVatHalalas: bigint("priced_vat_halalas", { mode: "bigint" }),
    pricedTotalHalalas: bigint("priced_total_halalas", { mode: "bigint" }),
    pricedNotes: text("priced_notes"),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    convertedBookingId: uuid("converted_booking_id").references(() => bookings.id, { onDelete: "set null" }),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("quote_reference_unique").on(t.reference),
    index("quote_status_idx").on(t.status, t.createdAt),
    index("quote_requester_idx").on(t.requesterUserId),
  ],
);

export const quoteItems = pgTable(
  "quote_item",
  {
    id: uuid("id").primaryKey(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    classId: uuid("class_id").references(() => equipmentClasses.id, { onDelete: "set null" }),
    /** Free text when the customer does not know the exact class. */
    descriptionRaw: varchar("description_raw", { length: 400 }),
    quantity: integer("quantity").notNull().default(1),
    durationDays: integer("duration_days"),
    pricedUnitRateHalalas: bigint("priced_unit_rate_halalas", { mode: "bigint" }),
    pricedLineTotalHalalas: bigint("priced_line_total_halalas", { mode: "bigint" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("quote_item_quote_idx").on(t.quoteId, t.sortOrder)],
);

export const supportTickets = pgTable(
  "support_ticket",
  {
    id: uuid("id").primaryKey(),
    reference: varchar("reference", { length: 20 }).notNull(),
    /** Ties a ticket to a rental so the customer never has to re-explain. */
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    subject: varchar("subject", { length: 240 }).notNull(),
    body: text("body").notNull(),
    category: varchar("category", { length: 60 }).notNull().default("general"),
    priority: varchar("priority", { length: 20 }).notNull().default("normal"),
    status: varchar("status", { length: 30 }).notNull().default("open"),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("support_ticket_reference_unique").on(t.reference),
    index("support_ticket_status_idx").on(t.status, t.createdAt),
    index("support_ticket_user_idx").on(t.userId),
  ],
);
