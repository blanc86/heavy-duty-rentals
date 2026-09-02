import { and, asc, eq, sql as raw } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  branches,
  classDocuments,
  classSpecs,
  equipmentCategories,
  equipmentClasses,
  type FilterDefinition,
} from "@/lib/db/schema/catalog";
import type { Locale } from "@/lib/i18n/config";
import type { Halalas } from "@/lib/money";

/**
 * Catalog reads.
 *
 * Read-mostly and heavily used by SEO pages, so every query here returns
 * exactly the columns the view needs — no `select *`. A column that is not
 * needed by a view is a column that cannot leak from it.
 */

export interface CategorySummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  iconKey: string | null;
  classCount: number;
}

export interface ClassSummary {
  id: string;
  slug: string;
  name: string;
  manufacturer: string;
  model: string;
  categorySlug: string;
  categoryName: string;
  capacityKg: number | null;
  fromDailyRateHalalas: Halalas | null;
  instantBookable: boolean;
  operatorIncluded: boolean;
  fuelPolicy: "wet" | "dry";
  minRentalDays: number;
  depositHalalas: Halalas;
  primaryImageKey: string | null;
  primaryImageAlt: string | null;
  totalUnits: number;
  isDemoData: boolean;
}

function localized(locale: Locale, en: string, ar: string) {
  return raw.raw(locale === "ar" ? ar : en);
}

/**
 * Raw `db.execute` returns jsonb columns as unparsed strings (Drizzle only
 * parses them for typed `select()` queries). Normalising here means callers
 * never have to know which query style produced a row.
 */
function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return (value as T) ?? fallback;
}

export async function listCategories(locale: Locale): Promise<CategorySummary[]> {
  const rows = await db.execute<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    icon_key: string | null;
    class_count: number;
  }>(raw`
    SELECT c.id,
           c.slug,
           c.${localized(locale, "name_en", "name_ar")} AS name,
           c.${localized(locale, "description_en", "description_ar")} AS description,
           c.icon_key,
           COUNT(ec.id) FILTER (WHERE ec.is_active)::int AS class_count
    FROM equipment_category c
    LEFT JOIN equipment_class ec ON ec.category_id = c.id
    WHERE c.is_active = TRUE
    GROUP BY c.id
    ORDER BY c.sort_order ASC, c.slug ASC
  `);

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    iconKey: r.icon_key,
    classCount: Number(r.class_count),
  }));
}

export async function getCategoryBySlug(slug: string, locale: Locale) {
  const [row] = await db.execute<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    filter_schema: FilterDefinition[];
    meta_title: string | null;
    meta_description: string | null;
  }>(raw`
    SELECT id, slug,
           ${localized(locale, "name_en", "name_ar")} AS name,
           ${localized(locale, "description_en", "description_ar")} AS description,
           filter_schema,
           ${localized(locale, "meta_title_en", "meta_title_ar")} AS meta_title,
           ${localized(locale, "meta_description_en", "meta_description_ar")} AS meta_description
    FROM equipment_category
    WHERE slug = ${slug} AND is_active = TRUE
    LIMIT 1
  `);
  if (!row) return null;
  return { ...row, filter_schema: parseJsonValue<FilterDefinition[]>(row.filter_schema, []) };
}

export interface SearchParams {
  locale: Locale;
  query?: string | undefined;
  categorySlug?: string | undefined;
  branchSlug?: string | undefined;
  manufacturer?: string | undefined;
  minCapacityKg?: number | undefined;
  maxCapacityKg?: number | undefined;
  operatorAvailable?: boolean | undefined;
  sort?: "relevance" | "price_asc" | "price_desc" | "capacity" | undefined;
  page?: number;
  perPage?: number;
}

export interface SearchResult {
  items: ClassSummary[];
  total: number;
  page: number;
  perPage: number;
}

/**
 * Equipment search.
 *
 * Handles the query that actually matters — "100 ton crane riyadh" — by
 * extracting the CAPACITY and the CITY from the free text before running the
 * text search, because a buyer searching by capability is not searching by SKU
 * (docs/research.md §10).
 */
export async function searchClasses(params: SearchParams): Promise<SearchResult> {
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(48, Math.max(1, params.perPage ?? 24));
  const offset = (page - 1) * perPage;
  const locale = params.locale;

  const parsed = params.query ? parseNaturalQuery(params.query) : null;
  const textQuery = parsed?.text ?? params.query ?? null;
  const minCapacity = params.minCapacityKg ?? parsed?.minCapacityKg ?? null;
  const maxCapacity = params.maxCapacityKg ?? parsed?.maxCapacityKg ?? null;
  const branchSlug = params.branchSlug ?? parsed?.branchSlug ?? null;

  const searchVector = locale === "ar" ? raw.raw("search_vector_ar") : raw.raw("search_vector_en");
  const tsConfig = locale === "ar" ? "simple" : "english";

  const conditions = [
    raw`ec.is_active = TRUE`,
    params.categorySlug ? raw`cat.slug = ${params.categorySlug}` : raw`TRUE`,
    params.manufacturer ? raw`ec.manufacturer = ${params.manufacturer}` : raw`TRUE`,
    minCapacity !== null ? raw`ec.capacity_kg >= ${minCapacity}` : raw`TRUE`,
    maxCapacity !== null ? raw`ec.capacity_kg <= ${maxCapacity}` : raw`TRUE`,
    params.operatorAvailable ? raw`ec.requires_operator = TRUE` : raw`TRUE`,
    branchSlug
      ? raw`EXISTS (
          SELECT 1 FROM equipment_unit u
          JOIN branch b ON b.id = u.branch_id
          WHERE u.class_id = ec.id AND u.is_active = TRUE AND b.slug = ${branchSlug}
        )`
      : raw`TRUE`,
    textQuery
      ? raw`(
          ec.${searchVector} @@ websearch_to_tsquery(${tsConfig}, ${textQuery})
          OR ec.name_en ILIKE ${"%" + textQuery + "%"}
          OR ec.name_ar ILIKE ${"%" + textQuery + "%"}
          OR ec.manufacturer ILIKE ${"%" + textQuery + "%"}
          OR ec.model ILIKE ${"%" + textQuery + "%"}
        )`
      : raw`TRUE`,
  ];

  const where = conditions.reduce((acc, cond, i) => (i === 0 ? cond : raw`${acc} AND ${cond}`));

  const orderBy =
    params.sort === "price_asc"
      ? raw.raw("from_daily_rate ASC NULLS LAST")
      : params.sort === "price_desc"
        ? raw.raw("from_daily_rate DESC NULLS LAST")
        : params.sort === "capacity"
          ? raw.raw("capacity_kg DESC NULLS LAST")
          : textQuery
            ? raw.raw("relevance DESC, capacity_kg ASC")
            : raw.raw("capacity_kg ASC NULLS LAST, name ASC");

  const rows = await db.execute<{
    id: string;
    slug: string;
    name: string;
    manufacturer: string;
    model: string;
    category_slug: string;
    category_name: string;
    capacity_kg: number | null;
    from_daily_rate: string | null;
    instant_bookable: boolean;
    operator_included: boolean;
    fuel_policy: "wet" | "dry";
    min_rental_days: number;
    deposit_halalas: string;
    image_key: string | null;
    image_alt: string | null;
    total_units: number;
    is_demo_data: boolean;
    total_count: number;
  }>(raw`
    SELECT ec.id,
           ec.slug,
           ec.${localized(locale, "name_en", "name_ar")} AS name,
           ec.manufacturer,
           ec.model,
           cat.slug AS category_slug,
           cat.${localized(locale, "name_en", "name_ar")} AS category_name,
           ec.capacity_kg,
           (SELECT MIN(rt.rate_halalas)::text
              FROM rate_tier rt
              JOIN rate_card rc ON rc.id = rt.rate_card_id
             WHERE rc.class_id = ec.id AND rc.is_active = TRUE AND rt.tier = 'daily'
               AND rc.valid_from <= now() AND (rc.valid_to IS NULL OR rc.valid_to > now())
           ) AS from_daily_rate,
           ec.instant_bookable,
           ec.operator_included,
           ec.fuel_policy,
           ec.min_rental_days,
           ec.deposit_halalas::text AS deposit_halalas,
           (SELECT ci.storage_key FROM class_image ci
             WHERE ci.class_id = ec.id ORDER BY ci.is_primary DESC, ci.sort_order ASC LIMIT 1
           ) AS image_key,
           (SELECT ci.${localized(locale, "alt_en", "alt_ar")} FROM class_image ci
             WHERE ci.class_id = ec.id ORDER BY ci.is_primary DESC, ci.sort_order ASC LIMIT 1
           ) AS image_alt,
           (SELECT COUNT(*)::int FROM equipment_unit u
             WHERE u.class_id = ec.id AND u.is_active = TRUE
           ) AS total_units,
           ec.is_demo_data,
           ${textQuery ? raw`ts_rank(ec.${searchVector}, websearch_to_tsquery(${tsConfig}, ${textQuery}))` : raw`0`} AS relevance,
           COUNT(*) OVER()::int AS total_count
    FROM equipment_class ec
    JOIN equipment_category cat ON cat.id = ec.category_id
    WHERE ${where}
    ORDER BY ${orderBy}
    LIMIT ${perPage} OFFSET ${offset}
  `);

  return {
    items: rows.map(toClassSummary),
    total: rows[0] ? Number(rows[0].total_count) : 0,
    page,
    perPage,
  };
}

function toClassSummary(r: {
  id: string;
  slug: string;
  name: string;
  manufacturer: string;
  model: string;
  category_slug: string;
  category_name: string;
  capacity_kg: number | null;
  from_daily_rate: string | null;
  instant_bookable: boolean;
  operator_included: boolean;
  fuel_policy: "wet" | "dry";
  min_rental_days: number;
  deposit_halalas: string;
  image_key: string | null;
  image_alt: string | null;
  total_units: number;
  is_demo_data: boolean;
}): ClassSummary {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    manufacturer: r.manufacturer,
    model: r.model,
    categorySlug: r.category_slug,
    categoryName: r.category_name,
    capacityKg: r.capacity_kg === null ? null : Number(r.capacity_kg),
    fromDailyRateHalalas: r.from_daily_rate ? BigInt(r.from_daily_rate) : null,
    instantBookable: r.instant_bookable,
    operatorIncluded: r.operator_included,
    fuelPolicy: r.fuel_policy,
    minRentalDays: r.min_rental_days,
    depositHalalas: BigInt(r.deposit_halalas),
    primaryImageKey: r.image_key,
    primaryImageAlt: r.image_alt,
    totalUnits: Number(r.total_units),
    isDemoData: r.is_demo_data,
  };
}

/**
 * Extract structured intent from free text.
 *
 * "100 ton crane riyadh" carries a capacity, a category hint and a city. Turning
 * those into real filters BEFORE the text search is what makes the search feel
 * like it understands the domain rather than matching strings.
 */
export function parseNaturalQuery(input: string): {
  text: string | null;
  minCapacityKg: number | null;
  maxCapacityKg: number | null;
  branchSlug: string | null;
} {
  let text = input.trim();
  let minCapacityKg: number | null = null;
  let maxCapacityKg: number | null = null;
  let branchSlug: string | null = null;

  // "100 ton" / "100t" / "100 طن" -> a capacity band with 15% tolerance, so a
  // search for 100 t surfaces the 110 t that will actually do the lift.
  const tonMatch = /(\d+(?:\.\d+)?)\s*(?:ton|tonne|tons|t\b|طن)/i.exec(text);
  if (tonMatch?.[1]) {
    const tons = Number.parseFloat(tonMatch[1]);
    if (Number.isFinite(tons) && tons > 0) {
      const kg = tons * 1000;
      minCapacityKg = Math.round(kg * 0.85);
      maxCapacityKg = Math.round(kg * 1.35);
      text = text.replace(tonMatch[0], " ");
    }
  }

  const CITIES: Record<string, string> = {
    riyadh: "riyadh",
    الرياض: "riyadh",
    jeddah: "jeddah",
    جدة: "jeddah",
    dammam: "dammam",
    الدمام: "dammam",
    khobar: "khobar",
    الخبر: "khobar",
    jubail: "jubail",
    الجبيل: "jubail",
  };
  for (const [needle, slug] of Object.entries(CITIES)) {
    const pattern = new RegExp(`\\b${needle}\\b`, "i");
    if (pattern.test(text)) {
      branchSlug = slug;
      text = text.replace(pattern, " ");
      break;
    }
  }

  const cleaned = text.replace(/\s+/g, " ").trim();
  return {
    text: cleaned.length > 0 ? cleaned : null,
    minCapacityKg,
    maxCapacityKg,
    branchSlug,
  };
}

export interface ClassDetail extends ClassSummary {
  description: string | null;
  inclusions: string[];
  exclusions: string[];
  safetyNotes: string | null;
  requiresOperator: boolean;
  mobilisationBufferDays: number;
  demobilisationBufferDays: number;
  transportClass: string;
  requiresLowBed: boolean;
  requiresEscort: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  specs: { group: string | null; label: string; value: string; unit: string | null }[];
  images: {
    storageKey: string;
    alt: string;
    isPrimary: boolean;
    /** Present for free-licensed photography; CC BY/BY-SA require it shown. */
    attribution: {
      author: string | null;
      licence: string | null;
      licenceUrl: string | null;
      sourceUrl: string | null;
    } | null;
  }[];
  documents: { id: string; kind: string; title: string; sizeBytes: number }[];
  availableBranches: { slug: string; name: string; city: string; unitCount: number }[];
}

export async function getClassBySlug(slug: string, locale: Locale): Promise<ClassDetail | null> {
  const [row] = await db.execute<Parameters<typeof toClassSummary>[0] & {
    description: string | null;
    inclusions: string[];
    exclusions: string[];
    safety_notes: string | null;
    requires_operator: boolean;
    mobilisation_buffer_days: number;
    demobilisation_buffer_days: number;
    transport_class: string;
    requires_low_bed: boolean;
    requires_escort: boolean;
    meta_title: string | null;
    meta_description: string | null;
  }>(raw`
    SELECT ec.id, ec.slug,
           ec.${localized(locale, "name_en", "name_ar")} AS name,
           ec.manufacturer, ec.model,
           cat.slug AS category_slug,
           cat.${localized(locale, "name_en", "name_ar")} AS category_name,
           ec.capacity_kg,
           (SELECT MIN(rt.rate_halalas)::text FROM rate_tier rt
              JOIN rate_card rc ON rc.id = rt.rate_card_id
             WHERE rc.class_id = ec.id AND rc.is_active = TRUE AND rt.tier = 'daily'
           ) AS from_daily_rate,
           ec.instant_bookable, ec.operator_included, ec.fuel_policy,
           ec.min_rental_days, ec.deposit_halalas::text AS deposit_halalas,
           NULL::text AS image_key, NULL::text AS image_alt,
           (SELECT COUNT(*)::int FROM equipment_unit u WHERE u.class_id = ec.id AND u.is_active) AS total_units,
           ec.is_demo_data,
           ec.${localized(locale, "description_en", "description_ar")} AS description,
           ec.${localized(locale, "inclusions_en", "inclusions_ar")} AS inclusions,
           ec.${localized(locale, "exclusions_en", "exclusions_ar")} AS exclusions,
           ec.${localized(locale, "safety_notes_en", "safety_notes_ar")} AS safety_notes,
           ec.requires_operator, ec.mobilisation_buffer_days, ec.demobilisation_buffer_days,
           ec.transport_class, ec.requires_low_bed, ec.requires_escort,
           ec.${localized(locale, "meta_title_en", "meta_title_ar")} AS meta_title,
           ec.${localized(locale, "meta_description_en", "meta_description_ar")} AS meta_description
    FROM equipment_class ec
    JOIN equipment_category cat ON cat.id = ec.category_id
    WHERE ec.slug = ${slug} AND ec.is_active = TRUE
    LIMIT 1
  `);

  if (!row) return null;

  const [specs, images, documents, branchRows] = await Promise.all([
    db
      .select({
        group: locale === "ar" ? classSpecs.groupAr : classSpecs.groupEn,
        label: locale === "ar" ? classSpecs.labelAr : classSpecs.labelEn,
        value: locale === "ar" ? classSpecs.valueAr : classSpecs.valueEn,
        unit: classSpecs.unit,
      })
      .from(classSpecs)
      .where(eq(classSpecs.classId, row.id))
      .orderBy(asc(classSpecs.sortOrder)),

    // Attribution is joined in rather than fetched separately, so an image can
    // never render without the credit its licence requires.
    db.execute<{
      storage_key: string;
      alt: string;
      is_primary: boolean;
      author: string | null;
      licence: string | null;
      licence_url: string | null;
      source_url: string | null;
    }>(raw`
      SELECT ci.storage_key,
             ci.${localized(locale, "alt_en", "alt_ar")} AS alt,
             ci.is_primary,
             ia.author, ia.licence, ia.licence_url, ia.source_url
      FROM class_image ci
      LEFT JOIN image_attribution ia ON ia.storage_key = ci.storage_key
      WHERE ci.class_id = ${row.id}
      ORDER BY ci.is_primary DESC, ci.sort_order ASC
    `),

    // Only PUBLIC documents on a public page. Insurance and registration
    // certificates are `internal` and never reach an anonymous visitor.
    db
      .select({
        id: classDocuments.id,
        kind: classDocuments.kind,
        title: locale === "ar" ? classDocuments.titleAr : classDocuments.titleEn,
        sizeBytes: classDocuments.sizeBytes,
      })
      .from(classDocuments)
      .where(
        and(eq(classDocuments.classId, row.id), eq(classDocuments.visibility, "public")),
      ),

    db.execute<{ slug: string; name: string; city: string; unit_count: number }>(raw`
      SELECT b.slug,
             b.${localized(locale, "name_en", "name_ar")} AS name,
             b.${localized(locale, "city", "city_ar")} AS city,
             COUNT(u.id)::int AS unit_count
      FROM branch b
      JOIN equipment_unit u ON u.branch_id = b.id AND u.class_id = ${row.id} AND u.is_active = TRUE
      WHERE b.is_active = TRUE
      GROUP BY b.id
      ORDER BY unit_count DESC
    `),
  ]);

  return {
    ...toClassSummary(row),
    description: row.description,
    inclusions: parseJsonArray(row.inclusions),
    exclusions: parseJsonArray(row.exclusions),
    safetyNotes: row.safety_notes,
    requiresOperator: row.requires_operator,
    mobilisationBufferDays: row.mobilisation_buffer_days,
    demobilisationBufferDays: row.demobilisation_buffer_days,
    transportClass: row.transport_class,
    requiresLowBed: row.requires_low_bed,
    requiresEscort: row.requires_escort,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    specs: specs.map((s) => ({ group: s.group, label: s.label, value: s.value, unit: s.unit })),
    images: images.map((image) => ({
      storageKey: image.storage_key,
      alt: image.alt,
      isPrimary: image.is_primary,
      attribution: image.licence
        ? {
            author: image.author,
            licence: image.licence,
            licenceUrl: image.licence_url,
            sourceUrl: image.source_url,
          }
        : null,
    })),
    documents,
    availableBranches: branchRows.map((b) => ({
      slug: b.slug,
      name: b.name,
      city: b.city,
      unitCount: Number(b.unit_count),
    })),
  };
}

export async function listBranches(locale: Locale) {
  const rows = await db.execute<{
    id: string;
    slug: string;
    name: string;
    city: string;
    region: string;
    address: string;
    phone: string | null;
    latitude: string | null;
    longitude: string | null;
    unit_count: number;
  }>(raw`
    SELECT b.id, b.slug,
           b.${localized(locale, "name_en", "name_ar")} AS name,
           b.${localized(locale, "city", "city_ar")} AS city,
           b.${localized(locale, "region", "region_ar")} AS region,
           b.${localized(locale, "address_en", "address_ar")} AS address,
           b.phone, b.latitude, b.longitude,
           (SELECT COUNT(*)::int FROM equipment_unit u WHERE u.branch_id = b.id AND u.is_active) AS unit_count
    FROM branch b
    WHERE b.is_active = TRUE AND b.is_service_area = TRUE
    ORDER BY unit_count DESC, b.city ASC
  `);
  return rows.map((r) => ({ ...r, unitCount: Number(r.unit_count) }));
}

export async function getBranchBySlug(slug: string, locale: Locale) {
  const rows = await listBranches(locale);
  return rows.find((b) => b.slug === slug) ?? null;
}

/** Distinct manufacturers, for the filter panel. */
export async function listManufacturers(categorySlug?: string): Promise<string[]> {
  const rows = await db.execute<{ manufacturer: string }>(raw`
    SELECT DISTINCT ec.manufacturer
    FROM equipment_class ec
    JOIN equipment_category cat ON cat.id = ec.category_id
    WHERE ec.is_active = TRUE
      ${categorySlug ? raw`AND cat.slug = ${categorySlug}` : raw``}
    ORDER BY ec.manufacturer ASC
  `);
  return rows.map((r) => r.manufacturer);
}

export { equipmentCategories, equipmentClasses, branches };
