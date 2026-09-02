import postgres from "postgres";

/**
 * Integration-test database helper.
 *
 * Tests that need Postgres SKIP rather than fail when it is unreachable, so
 * `npm test` still gives a useful signal on a machine without Docker running.
 * CI must set `REQUIRE_DB=1`, which turns an unreachable database into a hard
 * failure — otherwise a broken CI database would silently skip the very tests
 * that protect double-booking and tenant isolation.
 */

let cached: ReturnType<typeof postgres> | null = null;
let availability: boolean | null = null;

export function testDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? "postgresql://hdr:hdr_dev_password@localhost:5433/hdr";
}

export function getSql() {
  cached ??= postgres(testDatabaseUrl(), {
    max: 5,
    connect_timeout: 5,
    onnotice: () => {},
  });
  return cached;
}

export async function isDatabaseAvailable(): Promise<boolean> {
  if (availability !== null) return availability;
  try {
    const sql = getSql();
    await sql`SELECT 1`;
    availability = true;
  } catch {
    availability = false;
    if (process.env.REQUIRE_DB === "1") {
      throw new Error(
        `REQUIRE_DB=1 but Postgres is unreachable at ${testDatabaseUrl()}. ` +
          "Integration tests must not be silently skipped in CI.",
      );
    }
  }
  return availability;
}

export async function closeSql(): Promise<void> {
  if (cached) {
    await cached.end({ timeout: 5 });
    cached = null;
    availability = null;
  }
}

/** UUID v7, mirroring src/lib/ids.ts so fixtures use realistic keys. */
export function uuidv7(): string {
  const bytes = Buffer.from(crypto.getRandomValues(new Uint8Array(16)));
  const ms = BigInt(Date.now());
  bytes[0] = Number((ms >> 40n) & 0xffn);
  bytes[1] = Number((ms >> 32n) & 0xffn);
  bytes[2] = Number((ms >> 24n) & 0xffn);
  bytes[3] = Number((ms >> 16n) & 0xffn);
  bytes[4] = Number((ms >> 8n) & 0xffn);
  bytes[5] = Number(ms & 0xffn);
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface Fixture {
  categoryId: string;
  classId: string;
  branchId: string;
  unitId: string;
  cleanup: () => Promise<void>;
}

/**
 * A minimal, self-contained fixture: one category, one class, one branch, one
 * physical unit. Created with unique slugs so parallel runs cannot collide, and
 * torn down completely afterwards.
 */
export async function createFixture(): Promise<Fixture> {
  const sql = getSql();
  const suffix = uuidv7().slice(0, 8);

  const categoryId = uuidv7();
  const classId = uuidv7();
  const branchId = uuidv7();
  const unitId = uuidv7();

  await sql`
    INSERT INTO equipment_category (id, slug, name_en, name_ar)
    VALUES (${categoryId}, ${`test-cat-${suffix}`}, 'Test Category', 'فئة اختبار')
  `;
  await sql`
    INSERT INTO equipment_class
      (id, category_id, slug, name_en, name_ar, manufacturer, model,
       capacity_kg, min_rental_days, deposit_halalas, instant_bookable, is_active)
    VALUES
      (${classId}, ${categoryId}, ${`test-class-${suffix}`}, 'Test Crane', 'رافعة اختبار',
       'TestCo', 'TC-100', 100000, 1, 100000, TRUE, TRUE)
  `;
  await sql`
    INSERT INTO branch
      (id, slug, name_en, name_ar, city, city_ar, region, region_ar, address_en, address_ar)
    VALUES
      (${branchId}, ${`test-branch-${suffix}`}, 'Test Depot', 'مستودع اختبار',
       'Riyadh', 'الرياض', 'Riyadh', 'الرياض', 'test', 'اختبار')
  `;
  await sql`
    INSERT INTO equipment_unit (id, class_id, branch_id, asset_code, status, is_active)
    VALUES (${unitId}, ${classId}, ${branchId}, ${`TST-${suffix}`}, 'available', TRUE)
  `;

  return {
    categoryId,
    classId,
    branchId,
    unitId,
    cleanup: async () => {
      await sql`DELETE FROM reservation WHERE unit_id = ${unitId}`;
      await sql`DELETE FROM unit_blackout WHERE unit_id = ${unitId}`;
      await sql`DELETE FROM equipment_unit WHERE id = ${unitId}`;
      await sql`DELETE FROM rate_tier WHERE rate_card_id IN (SELECT id FROM rate_card WHERE class_id = ${classId})`;
      await sql`DELETE FROM rate_card WHERE class_id = ${classId}`;
      await sql`DELETE FROM equipment_class WHERE id = ${classId}`;
      await sql`DELETE FROM branch WHERE id = ${branchId}`;
      await sql`DELETE FROM equipment_category WHERE id = ${categoryId}`;
    },
  };
}

/** Insert a reservation directly, returning the raw error code on failure. */
export async function tryReserve(
  unitId: string,
  from: string,
  to: string,
  status: "held" | "confirmed" | "active" | "cancelled" | "released" = "confirmed",
): Promise<{ ok: true } | { ok: false; code: string }> {
  const sql = getSql();
  try {
    await sql`
      INSERT INTO reservation (id, unit_id, status, period, billable_start, billable_end)
      VALUES (
        ${uuidv7()}, ${unitId}, ${status},
        ${`[${from},${to})`}::tstzrange,
        ${from}::timestamptz, ${to}::timestamptz
      )
    `;
    return { ok: true };
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: unknown }).code)
        : "unknown";
    return { ok: false, code };
  }
}
