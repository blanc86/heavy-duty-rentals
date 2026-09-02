import { customType } from "drizzle-orm/pg-core";

/**
 * PostgreSQL `tstzrange`.
 *
 * Drizzle has no first-class range type, but range types are load-bearing here:
 * the no-double-booking guarantee is a GiST exclusion constraint over a
 * `tstzrange` (see docs/DATABASE.md §5). So we map it explicitly rather than
 * degrade to two timestamp columns, which could not be constrained.
 *
 * We always use the half-open form `[start, end)`. A reservation ending at
 * 08:00 and one starting at 08:00 must NOT be considered overlapping.
 */
export type TstzRange = { start: Date; end: Date };

export const tstzrange = customType<{
  data: TstzRange;
  driverData: string;
}>({
  dataType() {
    return "tstzrange";
  },
  toDriver(value: TstzRange): string {
    return `[${value.start.toISOString()},${value.end.toISOString()})`;
  },
  fromDriver(value: string): TstzRange {
    // Postgres renders ranges as: ["2026-03-14 00:00:00+00","2026-03-28 00:00:00+00")
    const match = /^[[(]"?([^",]+)"?,"?([^",)]+)"?[\])]$/.exec(value);
    if (!match?.[1] || !match[2]) {
      throw new Error(`Unparseable tstzrange from database: ${value}`);
    }
    return { start: new Date(match[1]), end: new Date(match[2]) };
  },
});

/**
 * Money is ALWAYS integer halalas (1 SAR = 100 halalas), never a float.
 *
 * `bigint` with `mode: "bigint"` keeps it exact end to end. Floating point on
 * an invoice is a correctness and tax defect, not a rounding nuisance.
 */
export type Halalas = bigint;
