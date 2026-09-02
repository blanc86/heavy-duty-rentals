import type { MetadataRoute } from "next";
import { and, eq, sql as raw } from "drizzle-orm";
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema/platform";
import { env } from "@/lib/env";
import { LOCALES } from "@/lib/i18n/config";

/**
 * Sitemap.
 *
 * Includes only pages that genuinely exist and are worth ranking:
 *   - static marketing and content pages
 *   - one page per equipment CATEGORY
 *   - one page per equipment CLASS
 *   - one page per REAL service branch
 *   - published articles
 *
 * Deliberately EXCLUDED: filtered/paginated listings, checkout, account, admin,
 * and any class × location combination the branch does not actually stock.
 * Those are either duplicates or private, and mass-generating them is exactly
 * the doorway-page spam the brief prohibits.
 *
 * Every entry declares its `alternates.languages` pair so Google can serve the
 * Arabic page to an Arabic query — the opportunity every competitor forfeits.
 */
export const dynamic = "force-dynamic";

const STATIC_PATHS = [
  { path: "", priority: 1.0, changeFrequency: "daily" as const },
  { path: "/equipment", priority: 0.9, changeFrequency: "daily" as const },
  { path: "/locations", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/how-it-works", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/safety", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/guides", priority: 0.7, changeFrequency: "weekly" as const },
  { path: "/faq", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/about", priority: 0.5, changeFrequency: "monthly" as const },
  { path: "/contact", priority: 0.5, changeFrequency: "monthly" as const },
  { path: "/legal/terms", priority: 0.3, changeFrequency: "yearly" as const },
  { path: "/legal/rental-terms", priority: 0.3, changeFrequency: "yearly" as const },
  { path: "/legal/privacy", priority: 0.3, changeFrequency: "yearly" as const },
  { path: "/legal/cancellation", priority: 0.3, changeFrequency: "yearly" as const },
];

function alternatesFor(path: string) {
  return {
    languages: Object.fromEntries(
      LOCALES.map((locale) => [locale, new URL(`/${locale}${path}`, env.APP_URL).toString()]),
    ),
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  const now = new Date();

  for (const item of STATIC_PATHS) {
    for (const locale of LOCALES) {
      entries.push({
        url: new URL(`/${locale}${item.path}`, env.APP_URL).toString(),
        lastModified: now,
        changeFrequency: item.changeFrequency,
        priority: item.priority,
        alternates: alternatesFor(item.path),
      });
    }
  }

  try {
    const [categories, classes, branches, publishedArticles] = await Promise.all([
      db.execute<{ slug: string }>(raw`
        SELECT slug FROM equipment_category WHERE is_active = TRUE ORDER BY sort_order
      `),
      db.execute<{ slug: string; updated_at: Date }>(raw`
        SELECT slug, updated_at FROM equipment_class WHERE is_active = TRUE ORDER BY slug
      `),
      // Only real service areas. A location page cannot exist for a city with
      // no branch, so it must not appear here either.
      db.execute<{ slug: string }>(raw`
        SELECT slug FROM branch WHERE is_active = TRUE AND is_service_area = TRUE ORDER BY city
      `),
      db
        .select({
          slug: articles.slug,
          locale: articles.locale,
          updatedAt: articles.updatedAt,
        })
        .from(articles)
        .where(and(eq(articles.status, "published"))),
    ]);

    for (const category of categories) {
      for (const locale of LOCALES) {
        entries.push({
          url: new URL(`/${locale}/equipment/${category.slug}`, env.APP_URL).toString(),
          lastModified: now,
          changeFrequency: "weekly",
          priority: 0.8,
          alternates: alternatesFor(`/equipment/${category.slug}`),
        });
      }
    }

    for (const item of classes) {
      for (const locale of LOCALES) {
        entries.push({
          url: new URL(`/${locale}/equipment/item/${item.slug}`, env.APP_URL).toString(),
          lastModified: item.updated_at ?? now,
          changeFrequency: "weekly",
          priority: 0.9,
          alternates: alternatesFor(`/equipment/item/${item.slug}`),
        });
      }
    }

    for (const branch of branches) {
      for (const locale of LOCALES) {
        entries.push({
          url: new URL(`/${locale}/locations/${branch.slug}`, env.APP_URL).toString(),
          lastModified: now,
          changeFrequency: "monthly",
          priority: 0.7,
          alternates: alternatesFor(`/locations/${branch.slug}`),
        });
      }
    }

    // Articles have per-locale slugs, so each is listed on its own rather than
    // assuming a shared path.
    for (const article of publishedArticles) {
      entries.push({
        url: new URL(`/${article.locale}/guides/${article.slug}`, env.APP_URL).toString(),
        lastModified: article.updatedAt,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  } catch (error) {
    // A database hiccup must not produce a 500 for Googlebot. Serving the
    // static entries is strictly better than serving nothing.
    console.error("[sitemap] failed to load dynamic entries", error);
  }

  return entries;
}
