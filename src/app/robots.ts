import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * robots.txt
 *
 * Everything public is crawlable: every page on this site exists to be found.
 * There is nothing private left to hide — no accounts, checkout or admin.
 *
 * AI search crawlers are allowed on purpose. A buyer asking an assistant "who
 * rents cranes in Jubail" should be able to find this site cited.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
