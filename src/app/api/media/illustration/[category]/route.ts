import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { equipmentCategories } from "@/lib/db/schema/catalog";
import { renderEquipmentIllustration } from "@/lib/media/equipment-illustration";

/**
 * Equipment illustrations.
 *
 * Generated SVG, one per equipment category. See
 * `src/lib/media/equipment-illustration.ts` for why these are drawn rather
 * than photographed.
 *
 * The category slug is looked up in the database rather than trusted, so an
 * arbitrary path segment cannot reach the renderer.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ category: string }> },
) {
  const { category } = await params;
  const url = new URL(request.url);
  const tone = url.searchParams.get("tone") === "dark" ? "dark" : "light";
  // The caption is baked into the SVG, so the locale has to reach the renderer
  // — otherwise an Arabic page shows an English label inside the artwork.
  const locale = url.searchParams.get("locale") === "ar" ? "ar" : "en";

  // Only a real, active category renders. Anything else is a 404 rather than
  // a generic drawing, so a broken link is visible instead of silently papered
  // over with plausible-looking art.
  const [row] = await db
    .select({
      slug: equipmentCategories.slug,
      nameEn: equipmentCategories.nameEn,
      nameAr: equipmentCategories.nameAr,
    })
    .from(equipmentCategories)
    .where(eq(equipmentCategories.slug, category))
    .limit(1);

  if (!row) return new NextResponse(null, { status: 404 });

  const label = locale === "ar" ? row.nameAr : row.nameEn;
  const svg = renderEquipmentIllustration(row.slug, label, tone);

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Deterministic output for a given category, so it caches hard.
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      // The caption varies by locale, so caches must key on the query string.
      Vary: "Accept-Language",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
