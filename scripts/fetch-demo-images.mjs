#!/usr/bin/env node
/**
 * Fetch DEMO equipment photography from Wikimedia Commons.
 *
 * These are real photographs under Creative Commons licences that permit
 * commercial use. That is the difference between this and pulling images out
 * of a search engine: every file here has a named author, a stated licence and
 * a source URL, all of which are recorded in `image_attribution` and RENDERED
 * on the page.
 *
 * CC BY and CC BY-SA both REQUIRE attribution. Storing it in the database
 * rather than hardcoding a credit line means the obligation survives a
 * redesign — a template credit is the kind of thing that gets deleted.
 *
 * These remain DEMO images of other people's machines. They are flagged as
 * demo data and should be replaced with the business's own photography, which
 * needs no attribution and actually shows the fleet being rented.
 *
 * Usage:  node scripts/fetch-demo-images.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const here = path.dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(path.join(here, "..", ".env"));
} catch {
  /* environment may be injected */
}

const OUT_DIR = path.join(here, "..", "public", "demo-equipment");
const sql = postgres(process.env.DATABASE_URL, { max: 2, onnotice: () => {} });

function uuidv7() {
  const bytes = randomBytes(16);
  const ms = BigInt(Date.now());
  for (let i = 0; i < 6; i += 1) bytes[i] = Number((ms >> BigInt(40 - i * 8)) & 0xffn);
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = bytes.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * One search per equipment class slug.
 *
 * Searches are deliberately specific: a vague query returns a museum piece or
 * a scale model, and a toy crane on a rental page reads as carelessness.
 */
const TARGETS = [
  { slug: "all-terrain-crane-50t", query: 'Liebherr LTM mobile crane', altEn: "All-terrain mobile crane set up on outriggers", altAr: "رافعة جميع التضاريس مجهزة على الدعامات" },
  { slug: "all-terrain-crane-100t", query: 'Liebherr LTM 1100 crane', altEn: "Four-axle all-terrain crane with telescopic boom raised", altAr: "رافعة جميع التضاريس بأربعة محاور بذراع تلسكوبي مرفوع" },
  { slug: "all-terrain-crane-200t", query: 'Grove GMK mobile crane', altEn: "Five-axle heavy class all-terrain crane", altAr: "رافعة جميع التضاريس من الفئة الثقيلة بخمسة محاور" },
  { slug: "crawler-crane-300t", query: 'crawler crane lattice boom', altEn: "Lattice-boom crawler crane on tracks", altAr: "رافعة زاحفة بذراع شبكي على جنازير" },
  { slug: "boom-truck-15t", query: 'knuckle boom loader crane truck', altEn: "Truck-mounted knuckle boom crane", altAr: "رافعة ذات ذراع مفصلي مركبة على شاحنة" },
  { slug: "forklift-3t-diesel", query: ["forklift truck warehouse", "Gabelstapler", "fork lift truck"], altEn: "Diesel counterbalance forklift", altAr: "رافعة شوكية ديزل متوازنة" },
  { slug: "forklift-16t-diesel", query: ["heavy forklift Hyster", "container handler forklift", "Schwerlaststapler"], altEn: "Heavy industrial forklift", altAr: "رافعة شوكية صناعية ثقيلة" },
  { slug: "telehandler-17m", query: 'JCB telehandler telescopic', altEn: "Telescopic handler with boom extended", altAr: "رافعة تلسكوبية بذراع ممتد" },
  { slug: "excavator-20t", query: 'Caterpillar 320 excavator', altEn: "20 tonne tracked excavator", altAr: "حفار مجنزر 20 طن" },
  { slug: "excavator-36t", query: 'Komatsu PC360 excavator', altEn: "Large tracked excavator", altAr: "حفار مجنزر كبير" },
  { slug: "wheel-loader-3m3", query: ["wheel loader Radlader", "front end loader construction", "Caterpillar wheel loader"], altEn: "Wheel loader with bucket raised", altAr: "لودر بعجل بدلو مرفوع" },
  { slug: "backhoe-loader", query: 'JCB 3CX backhoe loader', altEn: "Backhoe loader on a site", altAr: "حفار لودر في موقع عمل" },
  { slug: "boom-lift-28m", query: 'Genie articulating boom lift', altEn: "Articulating boom lift with platform raised", altAr: "رافعة أفراد مفصلية بمنصة مرفوعة" },
  { slug: "scissor-lift-12m", query: 'JLG scissor lift', altEn: "Electric scissor lift platform", altAr: "منصة رافعة مقصية كهربائية" },
  { slug: "generator-500kva", query: 'diesel generator set canopy', altEn: "Silenced diesel generator set", altAr: "مولد ديزل صامت" },
  { slug: "air-compressor-375cfm", query: 'Atlas Copco portable air compressor', altEn: "Towable diesel air compressor", altAr: "ضاغط هواء ديزل قابل للسحب" },
  { slug: "dewatering-pump-6in", query: 'diesel dewatering pump', altEn: "Diesel-driven dewatering pump", altAr: "مضخة نزح مياه تعمل بالديزل" },
  { slug: "low-bed-trailer-60t", query: 'lowboy low loader trailer heavy haulage', altEn: "Low-bed trailer carrying tracked plant", altAr: "مقطورة منخفضة تنقل معدات مجنزرة" },
];

/** Licences that permit commercial use. Anything else is skipped. */
const ACCEPTABLE = [
  /^CC BY(-SA)? [\d.]+/i,
  /^CC0/i,
  /^Public domain/i,
  /^CC BY(-SA)? [\d.]+ [a-z]{2}$/i,
];

function isAcceptableLicence(licence) {
  if (!licence) return false;
  return ACCEPTABLE.some((re) => re.test(licence));
}

function stripHtml(value) {
  return (value ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

/** Commons attribution blocks can run to paragraphs; the column is bounded. */
function truncate(value, max) {
  const text = (value ?? "").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Commons rate-limits bursts of anonymous API calls and simply returns nothing
 * rather than an error, which looks identical to "no match". Pacing the
 * requests and retrying is the difference between 4 images and 18.
 */
async function searchCommons(query, attempt = 0) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrsearch", query);
  url.searchParams.set("gsrlimit", "8");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|extmetadata|mime|size");
  url.searchParams.set("iiurlwidth", "1400");

  const response = await fetch(url, {
    headers: { "User-Agent": "HeavyDutyRentals-DemoSeed/1.0 (development seed script)" },
  });

  if (!response.ok) {
    if (attempt < 3) {
      await sleep(1500 * (attempt + 1));
      return searchCommons(query, attempt + 1);
    }
    return [];
  }

  const json = await response.json();
  const pages = json.query?.pages ?? {};

  // An empty result under load is usually throttling, not absence.
  if (Object.keys(pages).length === 0 && attempt < 3) {
    await sleep(1500 * (attempt + 1));
    return searchCommons(query, attempt + 1);
  }

  return Object.values(pages)
    .map((page) => {
      const info = page.imageinfo?.[0];
      if (!info) return null;
      const meta = info.extmetadata ?? {};
      return {
        title: page.title.replace(/^File:/, ""),
        url: info.thumburl ?? info.url,
        mime: info.mime,
        width: info.thumbwidth ?? info.width,
        licence: stripHtml(meta.LicenseShortName?.value),
        author: stripHtml(meta.Artist?.value),
        licenceUrl: meta.LicenseUrl?.value ?? null,
        descriptionUrl: info.descriptionurl,
      };
    })
    .filter(
      (candidate) =>
        candidate &&
        // JPEG/PNG only: an SVG diagram or a TIFF is not a photograph of a machine.
        /^image\/(jpeg|png)$/.test(candidate.mime ?? "") &&
        (candidate.width ?? 0) >= 800 &&
        isAcceptableLicence(candidate.licence),
    );
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  let stored = 0;
  let skipped = 0;

  for (const target of TARGETS) {
    // A single query is brittle — Commons indexing varies by term and
    // language. Try alternatives before giving up on a category.
    const queries = Array.isArray(target.query) ? target.query : [target.query];
    let pick;
    for (const query of queries) {
      const candidates = await searchCommons(query);
      if (candidates.length > 0) {
        pick = candidates[0];
        break;
      }
      await sleep(600);
    }

    if (!pick) {
      console.log(`  skip   ${target.slug} — no acceptably licensed match`);
      skipped += 1;
      continue;
    }

    const [cls] = await sql`
      SELECT id FROM equipment_class WHERE slug = ${target.slug} LIMIT 1
    `;
    if (!cls) {
      console.log(`  skip   ${target.slug} — class not in database`);
      skipped += 1;
      continue;
    }

    const extension = pick.mime === "image/png" ? "png" : "jpg";
    const storageKey = `demo-equipment/${target.slug}.${extension}`;
    const filePath = path.join(OUT_DIR, `${target.slug}.${extension}`);

    const imageResponse = await fetch(pick.url, {
      headers: { "User-Agent": "HeavyDutyRentals-DemoSeed/1.0 (development seed script)" },
    });
    if (!imageResponse.ok) {
      console.log(`  skip   ${target.slug} — download failed (${imageResponse.status})`);
      skipped += 1;
      continue;
    }

    await writeFile(filePath, Buffer.from(await imageResponse.arrayBuffer()));

    // Replace any previous demo image for this class so re-running is safe.
    await sql`DELETE FROM class_image WHERE class_id = ${cls.id}`;
    await sql`
      INSERT INTO class_image (id, class_id, storage_key, alt_en, alt_ar, is_primary, sort_order)
      VALUES (${uuidv7()}, ${cls.id}, ${storageKey}, ${target.altEn}, ${target.altAr}, TRUE, 0)
    `;

    // The attribution is the whole point: CC BY / CC BY-SA require it, and
    // storing it here means it renders next to the image rather than living in
    // a template someone later deletes.
    await sql`
      INSERT INTO image_attribution (id, storage_key, author, licence, licence_url, source_url, title)
      VALUES (${uuidv7()}, ${storageKey}, ${truncate(pick.author, 240) || "Unknown"},
              ${truncate(pick.licence, 80)}, ${truncate(pick.licenceUrl, 500)},
              ${truncate(pick.descriptionUrl, 500)}, ${truncate(pick.title, 400)})
      ON CONFLICT (storage_key) DO UPDATE SET
        author = EXCLUDED.author, licence = EXCLUDED.licence,
        licence_url = EXCLUDED.licence_url, source_url = EXCLUDED.source_url,
        title = EXCLUDED.title
    `;

    console.log(
      `  ok     ${target.slug.padEnd(26)} ${pick.licence.padEnd(14)} ${truncate(pick.author, 40)}`,
    );
    stored += 1;
    // Be a good API citizen between categories.
    await sleep(800);
  }

  console.log(`\n${stored} images stored, ${skipped} skipped.`);
  console.log("All are DEMO photographs of other companies' machines, under free licences,");
  console.log("with attribution recorded and rendered. Replace with the real fleet's own");
  console.log("photography before launch — it needs no attribution and shows what is rented.");
}

main()
  .then(() => sql.end())
  .catch(async (error) => {
    console.error(error);
    await sql.end();
    process.exit(1);
  });
