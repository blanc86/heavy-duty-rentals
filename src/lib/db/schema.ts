/**
 * Drizzle schema entry point.
 *
 * Split by domain (see src/lib/db/schema/) so no single file has to hold the
 * whole model. drizzle-kit reads this file.
 */
export * from "./schema/enums";
export * from "./schema/types";
export * from "./schema/identity";
export * from "./schema/catalog";
export * from "./schema/inventory";
export * from "./schema/pricing";
export * from "./schema/booking";
export * from "./schema/finance";
export * from "./schema/ops";
export * from "./schema/platform";
