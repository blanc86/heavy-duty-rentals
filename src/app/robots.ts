import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/**
 * robots.txt
 *
 * Public catalog pages are open to crawlers because organic discovery is a
 * primary business objective. Everything transactional or personal is closed:
 * a crawler following a checkout link wastes budget on a page it cannot index,
 * and account pages contain customer PII.
 *
 * Filtered listings are disallowed by parameter rather than by path, so the
 * canonical `/equipment` page still ranks while its thousands of filter
 * permutations do not compete with it.
 */
export default function robots(): MetadataRoute.Robots {
  const disallow = [
    "/api/",
    "/*/book/",
    "/*/booking/",
    "/*/account",
    "/*/account/",
    "/*/admin",
    "/*/admin/",
    "/*/login",
    "/*/register",
    "/*/quote",
    // Filter and pagination permutations: near-duplicates of the canonical
    // listing, and an unbounded crawl surface.
    "/*?*page=",
    "/*?*sort=",
    "/*?*minCapacity=",
    "/*?*maxCapacity=",
    "/*?*manufacturer=",
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow,
      },
    ],
    sitemap: new URL("/sitemap.xml", env.APP_URL).toString(),
    host: new URL(env.APP_URL).host,
  };
}
