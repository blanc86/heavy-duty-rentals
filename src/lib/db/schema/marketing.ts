import { sql } from "drizzle-orm";
import {
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
import { users } from "./identity";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/**
 * CLIENT TESTIMONIALS.
 *
 * Deliberately SEPARATE from `review`, which is tied to a completed booking on
 * this platform and is therefore self-verifying. A testimonial is a reference
 * the business supplies from work done before (or outside) the platform — it
 * cannot be verified by us, so it is stored, labelled and moderated
 * differently rather than being quietly mixed in with verified reviews.
 *
 * `consentObtained` exists because publishing a named client's endorsement
 * without their permission is both a commercial and a PDPL problem. The
 * publishing query requires it, so a testimonial cannot go live on someone
 * forgetting to ask.
 */
export const testimonials = pgTable(
  "testimonial",
  {
    id: uuid("id").primaryKey(),
    quoteEn: text("quote_en").notNull(),
    quoteAr: text("quote_ar").notNull(),

    authorName: varchar("author_name", { length: 160 }),
    authorRoleEn: varchar("author_role_en", { length: 160 }),
    authorRoleAr: varchar("author_role_ar", { length: 160 }),
    /** Null when the client has not agreed to be named publicly. */
    companyName: varchar("company_name", { length: 240 }),
    /** Free text: sector, city, or the job the quote refers to. */
    contextEn: varchar("context_en", { length: 240 }),
    contextAr: varchar("context_ar", { length: 240 }),

    /**
     * Written evidence that the client agreed to publication. Required before
     * a testimonial can be published — see `listPublishedTestimonials`.
     */
    consentObtained: boolean("consent_obtained").notNull().default(false),
    consentNote: varchar("consent_note", { length: 400 }),

    sortOrder: integer("sort_order").notNull().default(0),
    isPublished: boolean("is_published").notNull().default(false),
    isDemoData: boolean("is_demo_data").notNull().default(false),

    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("testimonial_published_idx").on(t.isPublished, t.sortOrder)],
);

/**
 * COMPLETED PROJECTS.
 *
 * Reference work, which for this audience is the strongest trust signal there
 * is: a procurement manager wants to know you have done a lift like theirs
 * before. Same consent constraint as testimonials — a named client cannot be
 * published without permission.
 */
export const projects = pgTable(
  "project",
  {
    id: uuid("id").primaryKey(),
    slug: varchar("slug", { length: 160 }).notNull(),

    titleEn: varchar("title_en", { length: 240 }).notNull(),
    titleAr: varchar("title_ar", { length: 240 }).notNull(),
    summaryEn: text("summary_en"),
    summaryAr: text("summary_ar"),

    /** Null when the client is referenced only by sector. */
    clientName: varchar("client_name", { length: 240 }),
    sectorEn: varchar("sector_en", { length: 120 }),
    sectorAr: varchar("sector_ar", { length: 120 }),
    city: varchar("city", { length: 80 }),
    cityAr: varchar("city_ar", { length: 80 }),
    year: integer("year"),
    durationDays: integer("duration_days"),

    /** Equipment classes used, for internal linking back to the catalog. */
    equipmentUsed: jsonb("equipment_used").$type<string[]>().notNull().default([]),
    /** Headline figures, e.g. heaviest lift, number of machines. */
    metrics: jsonb("metrics")
      .$type<{ labelEn: string; labelAr: string; value: string }[]>()
      .notNull()
      .default([]),

    imageKey: varchar("image_key", { length: 200 }),

    consentObtained: boolean("consent_obtained").notNull().default(false),
    consentNote: varchar("consent_note", { length: 400 }),

    sortOrder: integer("sort_order").notNull().default(0),
    isPublished: boolean("is_published").notNull().default(false),
    isDemoData: boolean("is_demo_data").notNull().default(false),

    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("project_slug_unique").on(t.slug),
    index("project_published_idx").on(t.isPublished, t.sortOrder),
  ],
);

/**
 * BUSINESS CREDENTIALS.
 *
 * Certifications, memberships and accreditations. Every row carries an
 * `verifiedAt` and an optional reference number, because an unverifiable
 * credential badge on a page aimed at Aramco-tier procurement is worse than no
 * badge — they check.
 */
export const credentials = pgTable(
  "credential",
  {
    id: uuid("id").primaryKey(),
    nameEn: varchar("name_en", { length: 200 }).notNull(),
    nameAr: varchar("name_ar", { length: 200 }).notNull(),
    issuerEn: varchar("issuer_en", { length: 200 }),
    issuerAr: varchar("issuer_ar", { length: 200 }),
    referenceNumber: varchar("reference_number", { length: 120 }),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    /** Null means unverified — such a credential is not published. */
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    documentKey: varchar("document_key", { length: 200 }),
    sortOrder: integer("sort_order").notNull().default(0),
    isPublished: boolean("is_published").notNull().default(false),
    isDemoData: boolean("is_demo_data").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("credential_published_idx").on(t.isPublished, t.sortOrder)],
);

/**
 * Image attribution.
 *
 * Free-licensed photography (Creative Commons and similar) is usable
 * commercially but almost always REQUIRES attribution, and often a link to the
 * licence. Storing the author, licence and source alongside the image is what
 * makes that obligation survive contact with a redesign — the alternative is a
 * credit line in a template that someone deletes.
 *
 * Rows with a null `licence` are the business's own photography and need none.
 */
export const imageAttributions = pgTable(
  "image_attribution",
  {
    id: uuid("id").primaryKey(),
    storageKey: varchar("storage_key", { length: 200 }).notNull(),
    author: varchar("author", { length: 240 }),
    licence: varchar("licence", { length: 80 }),
    licenceUrl: varchar("licence_url", { length: 500 }),
    sourceUrl: varchar("source_url", { length: 500 }),
    title: varchar("title", { length: 400 }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("image_attribution_key_unique").on(t.storageKey)],
);

export { sql };
