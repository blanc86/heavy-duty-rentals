import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { branches, equipmentClasses } from "./catalog";
import { addonPricingModelEnum, discountTypeEnum, rateTierEnum } from "./enums";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/**
 * A set of rates for a class, optionally scoped to a branch and to a validity
 * window. Rates are DATA, editable by an admin without a deploy — one of the
 * brief's explicit requirements.
 */
export const rateCards = pgTable(
  "rate_card",
  {
    id: uuid("id").primaryKey(),
    classId: uuid("class_id")
      .notNull()
      .references(() => equipmentClasses.id, { onDelete: "cascade" }),
    /** Null = applies to every branch. A branch-specific card wins over a global one. */
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "cascade" }),
    currency: varchar("currency", { length: 3 }).notNull().default("SAR"),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
    validTo: timestamp("valid_to", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("rate_card_class_idx").on(t.classId, t.isActive), index("rate_card_branch_idx").on(t.branchId)],
);

/**
 * One tier of a rate card. The engine evaluates every applicable tier and picks
 * the one producing the LOWEST total for the customer — a 25-day rental billed
 * at the daily rate when the monthly rate is cheaper is the kind of quiet
 * overcharge that destroys B2B trust.
 */
export const rateTiers = pgTable(
  "rate_tier",
  {
    id: uuid("id").primaryKey(),
    rateCardId: uuid("rate_card_id")
      .notNull()
      .references(() => rateCards.id, { onDelete: "cascade" }),
    tier: rateTierEnum("tier").notNull(),
    /** Minimum rental length in days for this tier to apply. */
    minDays: integer("min_days").notNull().default(1),
    /** Rate per period unit (per day / per week / per month) in halalas. */
    rateHalalas: bigint("rate_halalas", { mode: "bigint" }).notNull(),
  },
  (t) => [uniqueIndex("rate_tier_card_tier_unique").on(t.rateCardId, t.tier)],
);

/**
 * Priced extras. Deliberately generic rather than a hardcoded `withOperator`
 * boolean, because the industry charges separately for riggers, banksmen,
 * signalmen, slings and spreader bars — all of which are "an add-on" in the
 * same sense that an operator is.
 */
export const addonOptions = pgTable(
  "addon_option",
  {
    id: uuid("id").primaryKey(),
    /** Null = available for every class. */
    classId: uuid("class_id").references(() => equipmentClasses.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 40 }).notNull(),
    nameEn: varchar("name_en", { length: 160 }).notNull(),
    nameAr: varchar("name_ar", { length: 160 }).notNull(),
    descriptionEn: varchar("description_en", { length: 400 }),
    descriptionAr: varchar("description_ar", { length: 400 }),
    pricingModel: addonPricingModelEnum("pricing_model").notNull(),
    rateHalalas: bigint("rate_halalas", { mode: "bigint" }).notNull(),
    /** A refundable or statutory item may sit outside the VAT base. */
    isTaxable: boolean("is_taxable").notNull().default(true),
    maxQuantity: integer("max_quantity").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    index("addon_option_class_idx").on(t.classId, t.isActive),
    uniqueIndex("addon_option_class_code_unique").on(t.classId, t.code),
  ],
);

/**
 * Transport is NOT "shipping". Mobilisation and demobilisation of heavy plant
 * is a first-class cost that can reach 20-40% of a large crawler job, and it
 * scales with distance band, transport class, and whether a low-bed or an
 * escort is required. Modelling it as a flat delivery fee would misprice every
 * long-haul job (docs/research.md §4).
 */
export const transportRates = pgTable(
  "transport_rate",
  {
    id: uuid("id").primaryKey(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    transportClass: varchar("transport_class", { length: 40 }).notNull(),
    distanceBandKmFrom: integer("distance_band_km_from").notNull(),
    /** Null = open-ended upper band. */
    distanceBandKmTo: integer("distance_band_km_to"),
    mobilisationHalalas: bigint("mobilisation_halalas", { mode: "bigint" }).notNull(),
    demobilisationHalalas: bigint("demobilisation_halalas", { mode: "bigint" }).notNull(),
    lowBedSurchargeHalalas: bigint("low_bed_surcharge_halalas", { mode: "bigint" }).notNull().default(sql`0`),
    escortSurchargeHalalas: bigint("escort_surcharge_halalas", { mode: "bigint" }).notNull().default(sql`0`),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    index("transport_rate_lookup_idx").on(t.branchId, t.transportClass, t.distanceBandKmFrom),
  ],
);

export const coupons = pgTable(
  "coupon",
  {
    id: uuid("id").primaryKey(),
    code: varchar("code", { length: 40 }).notNull(),
    descriptionEn: varchar("description_en", { length: 240 }),
    descriptionAr: varchar("description_ar", { length: 240 }),
    discountType: discountTypeEnum("discount_type").notNull(),
    /** Percent: basis points (1000 = 10%). Fixed: halalas. */
    value: bigint("value", { mode: "bigint" }).notNull(),
    minSubtotalHalalas: bigint("min_subtotal_halalas", { mode: "bigint" }).notNull().default(sql`0`),
    /** Caps a percentage discount so a 10% code cannot take SAR 90,000 off a mega-rental. */
    maxDiscountHalalas: bigint("max_discount_halalas", { mode: "bigint" }),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    validTo: timestamp("valid_to", { withTimezone: true }).notNull(),
    /** A DB CHECK enforces redemptionCount <= maxRedemptions, so concurrent
     *  redemptions cannot exceed the cap even under a race. */
    maxRedemptions: integer("max_redemptions"),
    redemptionCount: integer("redemption_count").notNull().default(0),
    perCustomerLimit: integer("per_customer_limit").notNull().default(1),
    appliesToCategoryIds: jsonb("applies_to_category_ids").$type<string[]>().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("coupon_code_unique").on(t.code)],
);

/**
 * VAT as data with a validity window, not a constant in code. When the rate
 * changes, historical invoices must keep reporting the rate that applied on
 * their issue date.
 */
export const taxRates = pgTable(
  "tax_rate",
  {
    id: uuid("id").primaryKey(),
    code: varchar("code", { length: 24 }).notNull(),
    nameEn: varchar("name_en", { length: 80 }).notNull(),
    nameAr: varchar("name_ar", { length: 80 }).notNull(),
    /** Parts per million. 15% = 150000. Integer, so no float drift in tax. */
    ratePpm: integer("rate_ppm").notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    validTo: timestamp("valid_to", { withTimezone: true }),
  },
  (t) => [index("tax_rate_code_idx").on(t.code, t.validFrom)],
);
