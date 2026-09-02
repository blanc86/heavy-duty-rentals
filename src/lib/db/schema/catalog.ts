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
import { documentKindEnum, documentVisibilityEnum, fuelPolicyEnum } from "./enums";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/**
 * Filter definition stored per category. Adding "boom length" to cranes is a
 * data change made in the admin console, not a deploy. This is what makes
 * filters category-aware without a switch statement per category in the UI.
 */
export type FilterDefinition = {
  key: string;
  labelEn: string;
  labelAr: string;
  type: "range" | "select" | "boolean";
  unit?: string;
  /** For `select`. */
  options?: { value: string; labelEn: string; labelAr: string }[];
  /** For `range`, in the stored unit. */
  min?: number;
  max?: number;
  step?: number;
  sortOrder: number;
};

export const equipmentCategories = pgTable(
  "equipment_category",
  {
    id: uuid("id").primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull(),
    nameEn: varchar("name_en", { length: 160 }).notNull(),
    nameAr: varchar("name_ar", { length: 160 }).notNull(),
    descriptionEn: text("description_en"),
    descriptionAr: text("description_ar"),
    /** Drives the dynamic filter panel. See FilterDefinition above. */
    filterSchema: jsonb("filter_schema").$type<FilterDefinition[]>().notNull().default([]),
    iconKey: varchar("icon_key", { length: 40 }),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    metaTitleEn: varchar("meta_title_en", { length: 200 }),
    metaTitleAr: varchar("meta_title_ar", { length: 200 }),
    metaDescriptionEn: varchar("meta_description_en", { length: 320 }),
    metaDescriptionAr: varchar("meta_description_ar", { length: 320 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("equipment_category_slug_unique").on(t.slug), index("equipment_category_active_idx").on(t.isActive, t.sortOrder)],
);

/**
 * The rentable MODEL — "Liebherr LTM 1100-4.2". Not a physical machine.
 * Physical machines are `equipmentUnits`. Keeping these separate is what makes
 * an availability engine possible at all (docs/DATABASE.md §3.4).
 */
export const equipmentClasses = pgTable(
  "equipment_class",
  {
    id: uuid("id").primaryKey(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => equipmentCategories.id, { onDelete: "restrict" }),
    slug: varchar("slug", { length: 120 }).notNull(),
    nameEn: varchar("name_en", { length: 200 }).notNull(),
    nameAr: varchar("name_ar", { length: 200 }).notNull(),
    manufacturer: varchar("manufacturer", { length: 120 }).notNull(),
    model: varchar("model", { length: 120 }).notNull(),
    descriptionEn: text("description_en"),
    descriptionAr: text("description_ar"),

    /**
     * Filterable attributes, validated against the category's filterSchema.
     * Presentation specs live in `classSpecs` — this is for querying only.
     */
    specs: jsonb("specs").$type<Record<string, string | number | boolean>>().notNull().default({}),

    /**
     * Promoted out of `specs` into a real indexed column: capacity is the most
     * searched and filtered attribute in this business ("100 ton crane") and
     * anchors its own landing pages. jsonb range filtering would not index well.
     */
    capacityKg: bigint("capacity_kg", { mode: "number" }),

    minRentalDays: integer("min_rental_days").notNull().default(1),

    /**
     * A crane returning at 18:00 is not available at 08:00 the next morning.
     * These buffers widen the OCCUPIED window beyond the BILLED window so
     * operations are never handed a physically impossible schedule.
     */
    mobilisationBufferDays: integer("mobilisation_buffer_days").notNull().default(0),
    demobilisationBufferDays: integer("demobilisation_buffer_days").notNull().default(0),

    /** Refundable. Not revenue, not taxed. */
    depositHalalas: bigint("deposit_halalas", { mode: "bigint" }).notNull().default(sql`0`),

    requiresOperator: boolean("requires_operator").notNull().default(false),
    operatorIncluded: boolean("operator_included").notNull().default(false),
    /** "wet" = fuel included, "dry" = customer fuels. The #1 source of quote disputes. */
    fuelPolicy: fuelPolicyEnum("fuel_policy").notNull().default("dry"),

    /** Drives transport pricing bands. */
    transportClass: varchar("transport_class", { length: 40 }).notNull().default("standard"),
    requiresLowBed: boolean("requires_low_bed").notNull().default(false),
    requiresEscort: boolean("requires_escort").notNull().default(false),

    /**
     * False routes the class to the quote flow instead of instant checkout.
     * Set for classes whose mobilisation cannot be honestly priced without a
     * route survey (docs/research.md §4). This is the alternative to either
     * faking a price or forcing everyone to phone.
     */
    instantBookable: boolean("instant_bookable").notNull().default(true),

    /** What the customer gets and does not get. Shown verbatim on the page. */
    inclusionsEn: jsonb("inclusions_en").$type<string[]>().notNull().default([]),
    inclusionsAr: jsonb("inclusions_ar").$type<string[]>().notNull().default([]),
    exclusionsEn: jsonb("exclusions_en").$type<string[]>().notNull().default([]),
    exclusionsAr: jsonb("exclusions_ar").$type<string[]>().notNull().default([]),

    safetyNotesEn: text("safety_notes_en"),
    safetyNotesAr: text("safety_notes_ar"),

    metaTitleEn: varchar("meta_title_en", { length: 200 }),
    metaTitleAr: varchar("meta_title_ar", { length: 200 }),
    metaDescriptionEn: varchar("meta_description_en", { length: 320 }),
    metaDescriptionAr: varchar("meta_description_ar", { length: 320 }),

    /** Marks records created by the demo seed so the UI can say so honestly. */
    isDemoData: boolean("is_demo_data").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("equipment_class_slug_unique").on(t.slug),
    index("equipment_class_category_idx").on(t.categoryId, t.isActive),
    index("equipment_class_capacity_idx").on(t.capacityKg),
    index("equipment_class_manufacturer_idx").on(t.manufacturer),
  ],
);

/** Ordered, localised spec rows for display. Separate from `specs` jsonb, which is for filtering. */
export const classSpecs = pgTable(
  "class_spec",
  {
    id: uuid("id").primaryKey(),
    classId: uuid("class_id")
      .notNull()
      .references(() => equipmentClasses.id, { onDelete: "cascade" }),
    groupEn: varchar("group_en", { length: 80 }),
    groupAr: varchar("group_ar", { length: 80 }),
    labelEn: varchar("label_en", { length: 120 }).notNull(),
    labelAr: varchar("label_ar", { length: 120 }).notNull(),
    valueEn: varchar("value_en", { length: 200 }).notNull(),
    valueAr: varchar("value_ar", { length: 200 }).notNull(),
    unit: varchar("unit", { length: 24 }),
    /** Included in the side-by-side comparison table. */
    isComparable: boolean("is_comparable").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("class_spec_class_idx").on(t.classId, t.sortOrder)],
);

export const classImages = pgTable(
  "class_image",
  {
    id: uuid("id").primaryKey(),
    classId: uuid("class_id")
      .notNull()
      .references(() => equipmentClasses.id, { onDelete: "cascade" }),
    storageKey: varchar("storage_key", { length: 200 }).notNull(),
    altEn: varchar("alt_en", { length: 240 }).notNull(),
    altAr: varchar("alt_ar", { length: 240 }).notNull(),
    width: integer("width"),
    height: integer("height"),
    isPrimary: boolean("is_primary").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("class_image_class_idx").on(t.classId, t.sortOrder)],
);

export const classDocuments = pgTable(
  "class_document",
  {
    id: uuid("id").primaryKey(),
    classId: uuid("class_id")
      .notNull()
      .references(() => equipmentClasses.id, { onDelete: "cascade" }),
    kind: documentKindEnum("kind").notNull(),
    /**
     * Checked server-side on every read. A load chart is public because it
     * sells the machine; an insurance certificate is not.
     */
    visibility: documentVisibilityEnum("visibility").notNull().default("internal"),
    titleEn: varchar("title_en", { length: 200 }).notNull(),
    titleAr: varchar("title_ar", { length: 200 }).notNull(),
    storageKey: varchar("storage_key", { length: 200 }).notNull(),
    mimeType: varchar("mime_type", { length: 120 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("class_document_class_idx").on(t.classId, t.visibility)],
);

/**
 * A physical branch. `isServiceArea` gates location SEO pages — a location page
 * cannot exist for a city with no branch. That is the code-level guard against
 * mass-generated doorway pages.
 */
export const branches = pgTable(
  "branch",
  {
    id: uuid("id").primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull(),
    nameEn: varchar("name_en", { length: 160 }).notNull(),
    nameAr: varchar("name_ar", { length: 160 }).notNull(),
    city: varchar("city", { length: 80 }).notNull(),
    cityAr: varchar("city_ar", { length: 80 }).notNull(),
    region: varchar("region", { length: 80 }).notNull(),
    regionAr: varchar("region_ar", { length: 80 }).notNull(),
    addressEn: text("address_en").notNull(),
    addressAr: text("address_ar").notNull(),
    latitude: varchar("latitude", { length: 32 }),
    longitude: varchar("longitude", { length: 32 }),
    phone: varchar("phone", { length: 32 }),
    email: varchar("email", { length: 320 }),
    workingHours: jsonb("working_hours").$type<Record<string, string>>().notNull().default({}),
    isServiceArea: boolean("is_service_area").notNull().default(true),
    isDemoData: boolean("is_demo_data").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("branch_slug_unique").on(t.slug),
    index("branch_city_idx").on(t.city),
    index("branch_service_area_idx").on(t.isServiceArea, t.isActive),
  ],
);
