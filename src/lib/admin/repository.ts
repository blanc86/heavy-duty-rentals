import { sql as raw } from "drizzle-orm";
import { db, parseTimestamp, parseTimestampOrNull } from "@/lib/db";
import type { Locale } from "@/lib/i18n/config";
import type { Halalas } from "@/lib/money";

/**
 * Admin / operations reads.
 *
 * Every function here is only ever reached through a `guard` that requires
 * `isPlatformAdmin` plus the specific `admin:*` permission — platform admin is
 * a separate axis from company roles, so no customer can arrive here.
 *
 * The queries answer the questions that actually run a rental business:
 * what is out, what is coming back, what has not been paid for, and which
 * assets are earning.
 */

export interface OpsDashboard {
  revenue: {
    last30DaysHalalas: Halalas;
    previous30DaysHalalas: Halalas;
    pendingHalalas: Halalas;
  };
  bookings: {
    last30Days: number;
    active: number;
    upcoming: number;
    pendingPayment: number;
    overdue: number;
    returnsDueNext7Days: number;
  };
  fleet: {
    totalUnits: number;
    availableUnits: number;
    onHireUnits: number;
    maintenanceUnits: number;
    /** rented time / rentable time over the last 30 days, as a percentage. */
    utilizationPercent: number;
  };
  failedPayments: number;
}

export async function getOpsDashboard(): Promise<OpsDashboard> {
  const [row] = await db.execute<{
    revenue_30: string;
    revenue_prev_30: string;
    revenue_pending: string;
    bookings_30: number;
    active_bookings: number;
    upcoming_bookings: number;
    pending_payment: number;
    overdue: number;
    returns_due: number;
    total_units: number;
    available_units: number;
    on_hire_units: number;
    maintenance_units: number;
    failed_payments: number;
  }>(raw`
    SELECT
      -- Revenue counts only money that is actually confirmed, never a
      -- pending_payment booking that may never complete.
      COALESCE((SELECT SUM(taxable_subtotal_halalas + vat_halalas) FROM booking
        WHERE status IN ('confirmed','active','completed')
          AND created_at >= now() - interval '30 days'), 0)::text AS revenue_30,
      COALESCE((SELECT SUM(taxable_subtotal_halalas + vat_halalas) FROM booking
        WHERE status IN ('confirmed','active','completed')
          AND created_at >= now() - interval '60 days'
          AND created_at <  now() - interval '30 days'), 0)::text AS revenue_prev_30,
      COALESCE((SELECT SUM(taxable_subtotal_halalas + vat_halalas) FROM booking
        WHERE status = 'pending_payment'), 0)::text AS revenue_pending,

      (SELECT COUNT(*) FROM booking WHERE created_at >= now() - interval '30 days')::int AS bookings_30,
      (SELECT COUNT(*) FROM booking WHERE status = 'active')::int AS active_bookings,
      (SELECT COUNT(*) FROM booking WHERE status = 'confirmed' AND start_date > now())::int AS upcoming_bookings,
      (SELECT COUNT(*) FROM booking WHERE status = 'pending_payment')::int AS pending_payment,
      -- Overdue: the rental end date has passed but the booking has not been
      -- closed out. This is the number that costs the business money.
      (SELECT COUNT(*) FROM booking WHERE status IN ('confirmed','active') AND end_date < now())::int AS overdue,
      (SELECT COUNT(*) FROM booking WHERE status IN ('confirmed','active')
        AND end_date BETWEEN now() AND now() + interval '7 days')::int AS returns_due,

      (SELECT COUNT(*) FROM equipment_unit WHERE is_active)::int AS total_units,
      (SELECT COUNT(*) FROM equipment_unit u WHERE u.is_active AND u.status = 'available'
        AND NOT EXISTS (
          SELECT 1 FROM reservation r WHERE r.unit_id = u.id
            AND r.status IN ('held','confirmed','active')
            AND (r.expires_at IS NULL OR r.expires_at > now())
            AND r.period @> now()
        ))::int AS available_units,
      (SELECT COUNT(DISTINCT r.unit_id) FROM reservation r
        WHERE r.status IN ('confirmed','active') AND r.period @> now())::int AS on_hire_units,
      (SELECT COUNT(*) FROM equipment_unit WHERE is_active
        AND status IN ('maintenance','inspection','out_of_service'))::int AS maintenance_units,

      (SELECT COUNT(*) FROM payment WHERE status = 'failed'
        AND created_at >= now() - interval '30 days')::int AS failed_payments
  `);

  const totalUnits = Number(row?.total_units ?? 0);
  const onHire = Number(row?.on_hire_units ?? 0);

  return {
    revenue: {
      last30DaysHalalas: BigInt(row?.revenue_30 ?? "0"),
      previous30DaysHalalas: BigInt(row?.revenue_prev_30 ?? "0"),
      pendingHalalas: BigInt(row?.revenue_pending ?? "0"),
    },
    bookings: {
      last30Days: Number(row?.bookings_30 ?? 0),
      active: Number(row?.active_bookings ?? 0),
      upcoming: Number(row?.upcoming_bookings ?? 0),
      pendingPayment: Number(row?.pending_payment ?? 0),
      overdue: Number(row?.overdue ?? 0),
      returnsDueNext7Days: Number(row?.returns_due ?? 0),
    },
    fleet: {
      totalUnits,
      availableUnits: Number(row?.available_units ?? 0),
      onHireUnits: onHire,
      maintenanceUnits: Number(row?.maintenance_units ?? 0),
      utilizationPercent: totalUnits === 0 ? 0 : Math.round((onHire / totalUnits) * 100),
    },
    failedPayments: Number(row?.failed_payments ?? 0),
  };
}

export interface UtilizationRow {
  classId: string;
  className: string;
  categoryName: string;
  totalUnits: number;
  rentedDays: number;
  availableDays: number;
  utilizationPercent: number;
  revenueHalalas: Halalas;
}

/**
 * Utilization = rented time / rentable time.
 *
 * The business's actual P&L driver: it decides which classes to buy more of
 * and which are sitting in the yard earning nothing. Maintenance windows are
 * subtracted from rentable time — a machine that was in the workshop was never
 * available to rent, so counting it against utilization would misattribute a
 * maintenance problem as a demand problem.
 */
export async function getUtilizationByClass(
  locale: Locale,
  windowDays = 30,
): Promise<UtilizationRow[]> {
  const rows = await db.execute<{
    class_id: string;
    class_name: string;
    category_name: string;
    total_units: number;
    rented_days: number;
    available_days: number;
    revenue: string;
  }>(raw`
    WITH window_bounds AS (
      SELECT now() - (${windowDays} || ' days')::interval AS start_at, now() AS end_at
    ),
    unit_counts AS (
      SELECT ec.id AS class_id, COUNT(u.id)::int AS total_units
      FROM equipment_class ec
      LEFT JOIN equipment_unit u ON u.class_id = ec.id AND u.is_active
      WHERE ec.is_active
      GROUP BY ec.id
    ),
    rented AS (
      SELECT bi.class_id,
             SUM(EXTRACT(EPOCH FROM (
               LEAST(r.period_end, wb.end_at) - GREATEST(r.period_start, wb.start_at)
             )) / 86400.0) AS rented_days
      FROM (
        SELECT unit_id, booking_id, lower(period) AS period_start, upper(period) AS period_end
        FROM reservation
        WHERE status IN ('confirmed','active')
      ) r
      JOIN booking_item bi ON bi.booking_id = r.booking_id
      CROSS JOIN window_bounds wb
      WHERE r.period_start < wb.end_at AND r.period_end > wb.start_at
      GROUP BY bi.class_id
    ),
    blacked_out AS (
      SELECT u.class_id,
             SUM(EXTRACT(EPOCH FROM (
               LEAST(upper(ub.period), wb.end_at) - GREATEST(lower(ub.period), wb.start_at)
             )) / 86400.0) AS blackout_days
      FROM unit_blackout ub
      JOIN equipment_unit u ON u.id = ub.unit_id
      CROSS JOIN window_bounds wb
      WHERE lower(ub.period) < wb.end_at AND upper(ub.period) > wb.start_at
      GROUP BY u.class_id
    ),
    revenue AS (
      SELECT bi.class_id,
             SUM(b.taxable_subtotal_halalas + b.vat_halalas) AS revenue
      FROM booking b
      JOIN booking_item bi ON bi.booking_id = b.id
      CROSS JOIN window_bounds wb
      WHERE b.status IN ('confirmed','active','completed') AND b.created_at >= wb.start_at
      GROUP BY bi.class_id
    )
    SELECT ec.id AS class_id,
           ec.${raw.raw(locale === "ar" ? "name_ar" : "name_en")} AS class_name,
           cat.${raw.raw(locale === "ar" ? "name_ar" : "name_en")} AS category_name,
           COALESCE(uc.total_units, 0) AS total_units,
           COALESCE(ROUND(rt.rented_days)::int, 0) AS rented_days,
           GREATEST(
             COALESCE(uc.total_units, 0) * ${windowDays} - COALESCE(ROUND(bo.blackout_days)::int, 0),
             0
           ) AS available_days,
           COALESCE(rv.revenue, 0)::text AS revenue
    FROM equipment_class ec
    JOIN equipment_category cat ON cat.id = ec.category_id
    LEFT JOIN unit_counts uc ON uc.class_id = ec.id
    LEFT JOIN rented rt ON rt.class_id = ec.id
    LEFT JOIN blacked_out bo ON bo.class_id = ec.id
    LEFT JOIN revenue rv ON rv.class_id = ec.id
    WHERE ec.is_active
    ORDER BY COALESCE(rv.revenue, 0) DESC, ec.name_en ASC
  `);

  return rows.map((r) => {
    const rentedDays = Number(r.rented_days);
    const availableDays = Number(r.available_days);
    return {
      classId: r.class_id,
      className: r.class_name,
      categoryName: r.category_name,
      totalUnits: Number(r.total_units),
      rentedDays,
      availableDays,
      utilizationPercent:
        availableDays === 0 ? 0 : Math.min(100, Math.round((rentedDays / availableDays) * 100)),
      revenueHalalas: BigInt(r.revenue),
    };
  });
}

export interface AdminBookingRow {
  id: string;
  reference: string;
  status: string;
  customerName: string;
  companyName: string | null;
  className: string;
  assetCode: string | null;
  startDate: Date;
  endDate: Date;
  siteCity: string | null;
  /**
   * subtotal + VAT: what the card was charged and what the tax invoice shows.
   * This is the figure that reconciles against the revenue tile; `totalHalalas`
   * does not, because it includes a deposit that is never collected online.
   */
  chargedNowHalalas: Halalas;
  depositHalalas: Halalas;
  totalHalalas: Halalas;
  currency: string;
  paymentStatus: string | null;
  createdAt: Date;
}

export async function listAdminBookings(params: {
  locale: Locale;
  status?: string | undefined;
  search?: string | undefined;
  limit?: number;
}): Promise<AdminBookingRow[]> {
  const { locale, status, search, limit = 100 } = params;

  const rows = await db.execute<{
    id: string;
    reference: string;
    status: string;
    customer_name: string;
    company_name: string | null;
    class_name: string | null;
    asset_code: string | null;
    // Strings, not Dates: raw `db.execute` bypasses the driver's type parsers.
    start_date: string;
    end_date: string;
    site_city: string | null;
    charged_now_halalas: string;
    deposit_halalas: string;
    total_halalas: string;
    currency: string;
    payment_status: string | null;
    created_at: string;
  }>(raw`
    SELECT b.id, b.reference, b.status,
           u.full_name AS customer_name,
           c.name_en   AS company_name,
           ec.${raw.raw(locale === "ar" ? "name_ar" : "name_en")} AS class_name,
           eu.asset_code,
           b.start_date, b.end_date, b.site_city,
           (b.taxable_subtotal_halalas + b.vat_halalas)::text AS charged_now_halalas,
           b.deposit_halalas::text AS deposit_halalas,
           b.total_halalas::text AS total_halalas, b.currency,
           (SELECT p.status FROM payment p
             WHERE p.booking_id = b.id AND p.kind = 'rental_charge'
             ORDER BY p.created_at DESC LIMIT 1) AS payment_status,
           b.created_at
    FROM booking b
    JOIN "user" u ON u.id = b.customer_user_id
    LEFT JOIN company c ON c.id = b.company_id
    LEFT JOIN booking_item bi ON bi.booking_id = b.id
    LEFT JOIN equipment_class ec ON ec.id = bi.class_id
    LEFT JOIN equipment_unit eu ON eu.id = bi.unit_id
    WHERE TRUE
      ${status ? raw`AND b.status = ${status}::booking_status` : raw``}
      ${
        search
          ? raw`AND (b.reference ILIKE ${"%" + search + "%"}
                  OR u.full_name ILIKE ${"%" + search + "%"}
                  OR c.name_en ILIKE ${"%" + search + "%"})`
          : raw``
      }
    ORDER BY b.created_at DESC
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    status: r.status,
    customerName: r.customer_name,
    companyName: r.company_name,
    className: r.class_name ?? "—",
    assetCode: r.asset_code,
    startDate: parseTimestamp(r.start_date),
    endDate: parseTimestamp(r.end_date),
    siteCity: r.site_city,
    chargedNowHalalas: BigInt(r.charged_now_halalas),
    depositHalalas: BigInt(r.deposit_halalas),
    totalHalalas: BigInt(r.total_halalas),
    currency: r.currency,
    paymentStatus: r.payment_status,
    createdAt: parseTimestamp(r.created_at),
  }));
}

export interface AdminUnitRow {
  id: string;
  assetCode: string;
  serialNumber: string | null;
  className: string;
  branchCity: string;
  status: string;
  engineHours: number;
  yearOfManufacture: number | null;
  nextInspectionDueAt: Date | null;
  currentBookingReference: string | null;
}

export async function listAdminUnits(params: {
  locale: Locale;
  status?: string | undefined;
  branchSlug?: string | undefined;
  limit?: number;
}): Promise<AdminUnitRow[]> {
  const { locale, status, branchSlug, limit = 200 } = params;

  const rows = await db.execute<{
    id: string;
    asset_code: string;
    serial_number: string | null;
    class_name: string;
    branch_city: string;
    status: string;
    engine_hours: number;
    year_of_manufacture: number | null;
    next_inspection_due_at: string | null;
    current_booking_reference: string | null;
  }>(raw`
    SELECT u.id, u.asset_code, u.serial_number,
           ec.${raw.raw(locale === "ar" ? "name_ar" : "name_en")} AS class_name,
           b.${raw.raw(locale === "ar" ? "city_ar" : "city")} AS branch_city,
           u.status, u.engine_hours, u.year_of_manufacture, u.next_inspection_due_at,
           (SELECT bk.reference FROM reservation r
              JOIN booking bk ON bk.id = r.booking_id
             WHERE r.unit_id = u.id AND r.status IN ('confirmed','active')
               AND r.period @> now()
             LIMIT 1) AS current_booking_reference
    FROM equipment_unit u
    JOIN equipment_class ec ON ec.id = u.class_id
    JOIN branch b ON b.id = u.branch_id
    WHERE u.is_active
      ${status ? raw`AND u.status = ${status}::unit_status` : raw``}
      ${branchSlug ? raw`AND b.slug = ${branchSlug}` : raw``}
    ORDER BY u.asset_code ASC
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    id: r.id,
    assetCode: r.asset_code,
    serialNumber: r.serial_number,
    className: r.class_name,
    branchCity: r.branch_city,
    status: r.status,
    engineHours: Number(r.engine_hours),
    yearOfManufacture: r.year_of_manufacture,
    nextInspectionDueAt: parseTimestampOrNull(r.next_inspection_due_at),
    currentBookingReference: r.current_booking_reference,
  }));
}

/** Recent audit entries for the security view. */
export async function listAuditEntries(limit = 100) {
  const rows = await db.execute<{
    id: string;
    occurred_at: string;
    action: string;
    outcome: string;
    actor_type: string;
    actor_name: string | null;
    actor_ip: string | null;
    resource_type: string | null;
    resource_id: string | null;
  }>(raw`
    SELECT a.id, a.occurred_at, a.action, a.outcome, a.actor_type,
           u.full_name AS actor_name, a.actor_ip, a.resource_type, a.resource_id
    FROM audit_log a
    LEFT JOIN "user" u ON u.id = a.actor_user_id
    ORDER BY a.occurred_at DESC
    LIMIT ${limit}
  `);
  return rows;
}

export interface AdminQuoteRow {
  id: string;
  reference: string;
  status: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  companyName: string | null;
  className: string | null;
  descriptionRaw: string | null;
  siteCity: string | null;
  startDate: Date | null;
  endDate: Date | null;
  liftDetails: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Quote requests, newest first.
 *
 * The public form tells the customer "we will come back with an itemised
 * quote". Until this existed there was no screen anywhere that showed a
 * submitted request, so that promise had nowhere to be kept: rows landed in the
 * database and no one saw them.
 *
 * Read-only on purpose. Pricing a 600-tonne lift is not a form-fill — it needs
 * a route survey and a lifting engineer — so this surfaces the request and the
 * contact details rather than pretending a quote can be issued from a table.
 * The response workflow is still to build (docs/FINAL_REVIEW.md §9).
 */
export async function listAdminQuotes(params: {
  locale: Locale;
  status?: string | undefined;
  limit?: number;
}): Promise<AdminQuoteRow[]> {
  const { locale, status, limit = 100 } = params;

  const rows = await db.execute<{
    id: string;
    reference: string;
    status: string;
    contact_name: string;
    contact_email: string;
    contact_phone: string;
    company_name: string | null;
    class_name: string | null;
    description_raw: string | null;
    site_city: string | null;
    // Strings, not Dates: raw `db.execute` bypasses the driver's type parsers.
    start_date: string | null;
    end_date: string | null;
    lift_details: unknown;
    created_at: string;
  }>(raw`
    SELECT q.id, q.reference, q.status,
           q.contact_name, q.contact_email, q.contact_phone,
           COALESCE(c.name_en, q.company_name_raw) AS company_name,
           qi.class_name,
           qi.description_raw,
           q.site_city,
           q.start_date, q.end_date, q.lift_details, q.created_at
    FROM quote q
    LEFT JOIN company c ON c.id = q.company_id
    -- The requested machine lives on the FIRST quote_item, not on the quote:
    -- a request can name several. A LATERAL keeps that to one row per quote
    -- instead of multiplying the list by its own line items.
    LEFT JOIN LATERAL (
      SELECT ec.${raw.raw(locale === "ar" ? "name_ar" : "name_en")} AS class_name,
             qi.description_raw
      FROM quote_item qi
      LEFT JOIN equipment_class ec ON ec.id = qi.class_id
      WHERE qi.quote_id = q.id
      ORDER BY qi.sort_order
      LIMIT 1
    ) qi ON TRUE
    WHERE TRUE
      ${status ? raw`AND q.status = ${status}::quote_status` : raw``}
    ORDER BY q.created_at DESC
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    status: r.status,
    contactName: r.contact_name,
    contactEmail: r.contact_email,
    contactPhone: r.contact_phone,
    companyName: r.company_name,
    className: r.class_name,
    descriptionRaw: r.description_raw,
    siteCity: r.site_city,
    startDate: parseTimestampOrNull(r.start_date),
    endDate: parseTimestampOrNull(r.end_date),
    liftDetails:
      typeof r.lift_details === "string"
        ? (JSON.parse(r.lift_details) as Record<string, unknown>)
        : ((r.lift_details ?? {}) as Record<string, unknown>),
    createdAt: parseTimestamp(r.created_at),
  }));
}
