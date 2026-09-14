import type { MetadataRoute } from "next";
import { SERVICE_AREAS } from "@/content/business";
import { MACHINES } from "@/content/catalog";
import { GUIDES } from "@/content/guides";
import { activeCategories, categoryPath, machinePath } from "@/lib/catalog";
import { absoluteUrl } from "@/lib/site";

/**
 * sitemap.xml, generated from the same content that generates the pages, so a
 * page cannot exist without being listed or be listed without existing.
 *
 * Each URL carries its alternate-language version, which is how Google pairs
 * /en/equipment with /ar/equipment instead of treating them as duplicates.
 * The image credits page is left out: it is marked noindex.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-09-14");

  const shared = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]) =>
    (["en", "ar"] as const).map((locale) => ({
      url: absoluteUrl(locale, path),
      lastModified,
      changeFrequency,
      priority,
      alternates: { languages: { en: absoluteUrl("en", path), ar: absoluteUrl("ar", path) } },
    }));

  return [
    ...shared("/", 1, "weekly"),
    ...shared("/equipment", 0.9, "weekly"),
    ...shared("/contact", 0.9, "monthly"),
    ...activeCategories().flatMap((category) => shared(categoryPath(category), 0.8, "monthly")),
    ...MACHINES.flatMap((machine) => shared(machinePath(machine), 0.8, "monthly")),
    ...shared("/service-areas", 0.6, "monthly"),
    ...SERVICE_AREAS.flatMap((area) => shared(`/service-areas/${area.slug}`, 0.7, "monthly")),
    ...shared("/projects", 0.7, "monthly"),
    ...shared("/about", 0.6, "monthly"),
    ...shared("/faq", 0.6, "monthly"),
    ...shared("/guides", 0.5, "monthly"),
    // Arabic slugs are percent-encoded: a sitemap is XML, and its URLs must be ASCII.
    ...GUIDES.flatMap((guide) =>
      (["en", "ar"] as const).map((locale) => ({
        url: absoluteUrl(locale, `/guides/${encodeURIComponent(guide.slug[locale])}`),
        lastModified: new Date(guide.updated),
        changeFrequency: "yearly" as const,
        priority: 0.5,
        alternates: {
          languages: {
            en: absoluteUrl("en", `/guides/${guide.slug.en}`),
            ar: absoluteUrl("ar", `/guides/${encodeURIComponent(guide.slug.ar)}`),
          },
        },
      })),
    ),
    ...shared("/privacy", 0.2, "yearly"),
    ...shared("/terms", 0.2, "yearly"),
  ];
}
