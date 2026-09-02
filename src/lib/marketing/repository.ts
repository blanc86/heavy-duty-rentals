import { and, asc, eq, sql as raw } from "drizzle-orm";
import { db } from "@/lib/db";
import { credentials, projects, testimonials } from "@/lib/db/schema/marketing";
import type { Locale } from "@/lib/i18n/config";

/**
 * Trust-signal reads.
 *
 * Every query here filters on BOTH `isPublished` and the consent/verification
 * flag, even though the database already enforces that pairing with a CHECK
 * constraint. The redundancy is deliberate: if a future migration ever relaxes
 * the constraint, the read path still refuses to publish an unconsented
 * client name or an unverified certification.
 */

export interface Testimonial {
  id: string;
  quote: string;
  authorName: string | null;
  authorRole: string | null;
  companyName: string | null;
  context: string | null;
  isDemoData: boolean;
}

export async function listPublishedTestimonials(
  locale: Locale,
  limit = 6,
): Promise<Testimonial[]> {
  const rows = await db
    .select({
      id: testimonials.id,
      quote: locale === "ar" ? testimonials.quoteAr : testimonials.quoteEn,
      authorName: testimonials.authorName,
      authorRole: locale === "ar" ? testimonials.authorRoleAr : testimonials.authorRoleEn,
      companyName: testimonials.companyName,
      context: locale === "ar" ? testimonials.contextAr : testimonials.contextEn,
      isDemoData: testimonials.isDemoData,
    })
    .from(testimonials)
    .where(
      and(eq(testimonials.isPublished, true), eq(testimonials.consentObtained, true)),
    )
    .orderBy(asc(testimonials.sortOrder))
    .limit(limit);

  return rows;
}

export interface ProjectSummary {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  clientName: string | null;
  sector: string | null;
  city: string | null;
  year: number | null;
  durationDays: number | null;
  equipmentUsed: string[];
  metrics: { labelEn: string; labelAr: string; value: string }[];
  imageKey: string | null;
  isDemoData: boolean;
}

export async function listPublishedProjects(locale: Locale, limit = 6): Promise<ProjectSummary[]> {
  const rows = await db
    .select({
      id: projects.id,
      slug: projects.slug,
      title: locale === "ar" ? projects.titleAr : projects.titleEn,
      summary: locale === "ar" ? projects.summaryAr : projects.summaryEn,
      clientName: projects.clientName,
      sector: locale === "ar" ? projects.sectorAr : projects.sectorEn,
      city: locale === "ar" ? projects.cityAr : projects.city,
      year: projects.year,
      durationDays: projects.durationDays,
      equipmentUsed: projects.equipmentUsed,
      metrics: projects.metrics,
      imageKey: projects.imageKey,
      isDemoData: projects.isDemoData,
    })
    .from(projects)
    .where(and(eq(projects.isPublished, true), eq(projects.consentObtained, true)))
    .orderBy(asc(projects.sortOrder))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    equipmentUsed: Array.isArray(row.equipmentUsed) ? row.equipmentUsed : [],
    metrics: Array.isArray(row.metrics) ? row.metrics : [],
  }));
}

export interface Credential {
  id: string;
  name: string;
  issuer: string | null;
  referenceNumber: string | null;
  validUntil: Date | null;
}

/**
 * Published credentials only.
 *
 * An unverified certification badge on a page read by Aramco-tier procurement
 * is worse than no badge: they check, and a claim that does not stand up costs
 * the relationship rather than just the deal.
 */
export async function listPublishedCredentials(locale: Locale): Promise<Credential[]> {
  const rows = await db
    .select({
      id: credentials.id,
      name: locale === "ar" ? credentials.nameAr : credentials.nameEn,
      issuer: locale === "ar" ? credentials.issuerAr : credentials.issuerEn,
      referenceNumber: credentials.referenceNumber,
      validUntil: credentials.validUntil,
      verifiedAt: credentials.verifiedAt,
    })
    .from(credentials)
    .where(eq(credentials.isPublished, true))
    .orderBy(asc(credentials.sortOrder));

  // Belt and braces: never surface one that lost its verification.
  return rows
    .filter((row) => row.verifiedAt !== null)
    .map(({ verifiedAt: _verifiedAt, ...rest }) => rest);
}

export interface OperationalProof {
  totalUnits: number;
  serviceCities: number;
  equipmentClasses: number;
  /** Completed rentals on the platform — 0 until real bookings exist. */
  completedRentals: number;
}

/**
 * Numbers the platform can actually prove from its own data.
 *
 * Deliberately NOT "years in business" or "customers served", which we have no
 * way to verify and would simply be repeating a claim. Fleet size, depot count
 * and completed rentals are all counted from the database, so they cannot
 * drift away from the truth.
 */
export async function getOperationalProof(): Promise<OperationalProof> {
  const [row] = await db.execute<{
    total_units: number;
    service_cities: number;
    equipment_classes: number;
    completed_rentals: number;
  }>(raw`
    SELECT
      (SELECT COUNT(*) FROM equipment_unit WHERE is_active)::int AS total_units,
      (SELECT COUNT(DISTINCT city) FROM branch
        WHERE is_active AND is_service_area)::int AS service_cities,
      (SELECT COUNT(*) FROM equipment_class WHERE is_active)::int AS equipment_classes,
      (SELECT COUNT(*) FROM booking WHERE status = 'completed')::int AS completed_rentals
  `);

  return {
    totalUnits: Number(row?.total_units ?? 0),
    serviceCities: Number(row?.service_cities ?? 0),
    equipmentClasses: Number(row?.equipment_classes ?? 0),
    completedRentals: Number(row?.completed_rentals ?? 0),
  };
}
