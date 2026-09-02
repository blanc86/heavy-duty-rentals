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
import { branches, equipmentClasses } from "./catalog";
import { blackoutReasonEnum, unitStatusEnum } from "./enums";
import { users } from "./identity";
import { tstzrange } from "./types";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/**
 * A PHYSICAL MACHINE. `equipmentClasses` is "Liebherr LTM 1100";
 * this is "CRN-00127, serial 12345, currently in Dammam".
 *
 * Availability, maintenance, inspections and utilization are all properties of
 * the unit. Modelling inventory only as "a 100 ton crane" makes a real
 * availability engine impossible, which is precisely why every competitor's
 * site can only offer a contact form.
 */
export const equipmentUnits = pgTable(
  "equipment_unit",
  {
    id: uuid("id").primaryKey(),
    classId: uuid("class_id")
      .notNull()
      .references(() => equipmentClasses.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    /**
     * Reserved marketplace boundary. Defaults to the house supplier today; V2
     * adds supplier accounts and payouts without migrating the booking core.
     */
    supplierId: uuid("supplier_id"),

    /** Human-facing asset code, e.g. CRN-00127. Used on delivery notes and by yard staff. */
    assetCode: varchar("asset_code", { length: 40 }).notNull(),
    serialNumber: varchar("serial_number", { length: 80 }),
    yearOfManufacture: integer("year_of_manufacture"),
    engineHours: integer("engine_hours").notNull().default(0),

    /**
     * Operational status. Note this is NOT the source of truth for whether the
     * unit can be booked on a given date range — that is derived from
     * reservations and blackouts. Status covers the unit's present condition.
     */
    status: unitStatusEnum("status").notNull().default("available"),

    lastInspectionAt: timestamp("last_inspection_at", { withTimezone: true }),
    nextInspectionDueAt: timestamp("next_inspection_due_at", { withTimezone: true }),
    acquisitionDate: timestamp("acquisition_date", { withTimezone: true }),
    notes: text("notes"),

    /** Reserved for a future telematics integration; nothing reads it in V1. */
    telematicsDeviceId: varchar("telematics_device_id", { length: 80 }),

    isDemoData: boolean("is_demo_data").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("equipment_unit_asset_code_unique").on(t.assetCode),
    // The single most important catalog query: "which units of this class, in
    // this city, are in a bookable state?"
    index("equipment_unit_class_branch_status_idx").on(t.classId, t.branchId, t.status),
    index("equipment_unit_branch_idx").on(t.branchId),
    index("equipment_unit_inspection_due_idx").on(t.nextInspectionDueAt),
  ],
);

/**
 * A window during which a unit cannot be rented, for a reason that is not a
 * customer booking: maintenance, inspection, internal transport, withdrawal.
 *
 * Unioned into every availability query, so scheduling maintenance removes the
 * unit from sale immediately — there is no separate "bookable" flag anyone
 * could forget to flip.
 *
 * The GiST exclusion constraint (added in migration SQL) prevents a unit from
 * being double-blacked-out.
 */
export const unitBlackouts = pgTable(
  "unit_blackout",
  {
    id: uuid("id").primaryKey(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => equipmentUnits.id, { onDelete: "cascade" }),
    period: tstzrange("period").notNull(),
    reason: blackoutReasonEnum("reason").notNull(),
    notes: text("notes"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("unit_blackout_unit_idx").on(t.unitId)],
);

export const maintenanceRecords = pgTable(
  "maintenance_record",
  {
    id: uuid("id").primaryKey(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => equipmentUnits.id, { onDelete: "cascade" }),
    /** Links the service to the window it made the unit unavailable for. */
    blackoutId: uuid("blackout_id").references(() => unitBlackouts.id, { onDelete: "set null" }),
    type: varchar("type", { length: 60 }).notNull(),
    description: text("description"),
    costHalalas: bigint("cost_halalas", { mode: "bigint" }).notNull().default(sql`0`),
    performedBy: varchar("performed_by", { length: 160 }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    hoursAtService: integer("hours_at_service"),
    nextDueAt: timestamp("next_due_at", { withTimezone: true }),
    attachments: jsonb("attachments").$type<string[]>().notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => [index("maintenance_unit_idx").on(t.unitId, t.startedAt)],
);
