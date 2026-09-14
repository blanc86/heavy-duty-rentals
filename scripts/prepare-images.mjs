#!/usr/bin/env node
/**
 * Build every image on the site from its licensed source.
 *
 * Reads src/content/images.json — which records, for each image, where it came
 * from, who made it and under what licence — and produces:
 *
 *   public/images/<key>.jpg           cropped, resized, compressed
 *   public/og/default.jpg             1200×630 social sharing image
 *   src/content/images.generated.ts   dimensions, blur placeholders, credits
 *
 * Why a script rather than committed originals: the originals are several MB
 * each, and the manifest is the thing worth reviewing. Anyone can re-run this
 * and get the same files, which is also how an image is swapped — change its
 * entry, run `npm run images:prepare`.
 *
 * Consistency is the point of cropping here rather than in CSS. Every equipment
 * photo leaves this script at exactly 4:3 and 1600×1200, framed by sharp's
 * attention strategy (which finds the salient subject — the machine) unless the
 * manifest pins a position. That is what stops a grid of cards looking like a
 * collage of other people's snapshots.
 *
 * Downloads are cached in .image-cache/ (gitignored).
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = path.join(root, ".image-cache");
const PUBLIC = path.join(root, "public");

// Wikimedia rate-limits anonymous clients hard unless the User-Agent names the
// project and a way to reach it (https://meta.wikimedia.org/wiki/User-Agent_policy).
const USER_AGENT =
  "HeavyDutyRentalsImageBuild/1.0 (https://github.com/blanc86/heavy-duty-rentals; licensed image preparation)";

const SIZES = {
  equipment: { width: 1600, height: 1200, quality: 80 },
  hero: { width: 2400, height: 1350, quality: 76 },
  banner: { width: 2000, height: 1125, quality: 76 },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function download(entry) {
  const file = path.join(CACHE, `${entry.key.replace(/\//g, "__")}.src`);
  if (existsSync(file)) return file;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(entry.download, { headers: { "User-Agent": USER_AGENT }, redirect: "follow" });
    if (response.status === 429) {
      await sleep(5000 * attempt);
      continue;
    }
    if (!response.ok) throw new Error(`${entry.key}: download failed with ${response.status}`);
    await writeFile(file, Buffer.from(await response.arrayBuffer()));
    return file;
  }
  throw new Error(`${entry.key}: still rate limited after retries`);
}

/**
 * A blurred copy of one region, with soft edges so it fades into the photo
 * instead of sitting on it as a visible rectangle.
 */
async function blurredPatch(frame, region) {
  const { width, height } = region;
  const feather = Math.max(4, Math.round(Math.min(width, height) / 4));
  const mask = await sharp(
    Buffer.from(
      `<svg width="${width}" height="${height}"><rect x="${feather}" y="${feather}" width="${width - 2 * feather}" height="${height - 2 * feather}" rx="${feather}" fill="#fff"/></svg>`,
    ),
  )
    .blur(feather / 2)
    .extractChannel(0)
    .raw()
    .toBuffer();
  // Two steps on purpose: within one sharp pipeline removeAlpha runs after
  // joinChannel and silently drops the mask again.
  const blurred = await sharp(frame).extract(region).removeAlpha().blur(14).toBuffer();
  const input = await sharp(blurred)
    .joinChannel(mask, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
  return { input, left: region.left, top: region.top };
}

function cropPosition(position) {
  if (position === "attention") return sharp.strategy.attention;
  if (position === "entropy") return sharp.strategy.entropy;
  return position ?? "centre";
}

async function main() {
  const manifest = JSON.parse(await readFile(path.join(root, "src/content/images.json"), "utf8"));
  await mkdir(CACHE, { recursive: true });

  const generated = {};
  for (const entry of manifest) {
    const size = SIZES[entry.kind];
    if (!size) throw new Error(`${entry.key}: unknown kind ${entry.kind}`);

    const source = await download(entry);
    const meta = await sharp(source).metadata();
    if ((meta.width ?? 0) < size.width * 0.6) {
      // Upscaling past ~1.6x turns a photo soft; say so rather than ship it.
      console.warn(`  WARN ${entry.key}: source is only ${meta.width}px wide for a ${size.width}px output`);
    }


    let pipeline = sharp(source).rotate(); // honour EXIF orientation before cropping
    if (entry.extract) {
      // A hand-picked region, as fractions of the source, for photos where the
      // automatic crop frames sky or ground instead of the machine.
      const { left, top, width, height } = entry.extract;
      const w = meta.width ?? 0;
      const h = meta.height ?? 0;
      pipeline = pipeline.extract({
        left: Math.round(left * w),
        top: Math.round(top * h),
        width: Math.min(Math.round(width * w), w - Math.round(left * w)),
        height: Math.min(Math.round(height * h), h - Math.round(top * h)),
      });
    }
    pipeline = pipeline
      .resize(size.width, size.height, { fit: "cover", position: cropPosition(entry.position) })
      .modulate({ saturation: 0.94 }); // pull mismatched sources towards one grade
    if (entry.redact?.length) {
      // Another business's phone number or web address painted on a machine.
      // On a site whose whole job is "call us", a legible third-party number is
      // a wrong number waiting to be dialled, so it is blurred out. Regions are
      // in pixels of the finished frame, so they must be re-checked if the
      // image's size or crop position changes.
      const frame = await pipeline.png().toBuffer();
      const patches = await Promise.all(entry.redact.map((region) => blurredPatch(frame, region)));
      pipeline = sharp(frame).composite(patches);
    }
    pipeline = pipeline.jpeg({ quality: size.quality, mozjpeg: true, progressive: true });
    const { data: output, info } = await pipeline.toBuffer({ resolveWithObject: true });

    // The file name carries a hash of its content. Images are served with a
    // year-long immutable cache, so replacing a photo under the same name would
    // leave browsers and the image CDN showing the old one for a year; a new
    // hash is a new URL. Older versions of the same image are removed.
    const hash = createHash("sha256").update(output).digest("hex").slice(0, 10);
    const outRel = `/images/${entry.key}.${hash}.jpg`;
    const outAbs = path.join(PUBLIC, outRel);
    await mkdir(path.dirname(outAbs), { recursive: true });
    const base = path.basename(entry.key);
    for (const existing of await readdir(path.dirname(outAbs))) {
      if (existing.startsWith(`${base}.`) && existing.endsWith(".jpg") && existing !== path.basename(outAbs)) {
        await rm(path.join(path.dirname(outAbs), existing));
      }
    }
    await writeFile(outAbs, output);

    const blur = await sharp(output).resize(16).jpeg({ quality: 45 }).toBuffer();

    generated[entry.key] = {
      src: outRel,
      width: info.width,
      height: info.height,
      blurDataURL: `data:image/jpeg;base64,${blur.toString("base64")}`,
      alt: entry.alt,
      credit: {
        author: entry.author,
        authorUrl: entry.authorUrl ?? null,
        source: entry.source,
        sourceUrl: entry.sourceUrl,
        license: entry.license,
        licenseUrl: entry.licenseUrl,
      },
    };
    console.log(`  ${entry.key.padEnd(40)} ${info.width}x${info.height}  ${Math.round(info.size / 1024)} KB`);
  }

  // An image removed from the manifest must not stay published: its file would
  // still be served, and a photo dropped for a licensing or branding reason
  // would remain one URL away.
  const kept = new Set(Object.values(generated).map((image) => path.join(PUBLIC, image.src)));
  for (const dir of new Set([...kept].map((file) => path.dirname(file)))) {
    for (const existing of await readdir(dir)) {
      const file = path.join(dir, existing);
      if (existing.endsWith(".jpg") && !kept.has(file)) {
        await rm(file);
        console.log(`  removed ${path.relative(PUBLIC, file)} (no longer in the manifest)`);
      }
    }
  }

  await buildOgImage(generated["hero/excavator-golden-hour"]);

  const ts = [
    "/**",
    " * GENERATED by scripts/prepare-images.mjs from src/content/images.json.",
    " * Do not edit by hand: change the manifest and run `npm run images:prepare`.",
    " */",
    "",
    'import type { Localized } from "./catalog";',
    "",
    "export interface ImageCredit {",
    "  author: string;",
    "  authorUrl: string | null;",
    "  source: string;",
    "  sourceUrl: string;",
    "  license: string;",
    "  licenseUrl: string;",
    "}",
    "",
    "export interface SiteImage {",
    "  src: string;",
    "  width: number;",
    "  height: number;",
    "  blurDataURL: string;",
    "  alt: Localized;",
    "  credit: ImageCredit;",
    "}",
    "",
    `export const IMAGES = ${JSON.stringify(generated, null, 2)} as const satisfies Record<string, SiteImage>;`,
    "",
    "export type ImageKey = keyof typeof IMAGES;",
    "",
  ].join("\n");
  await writeFile(path.join(root, "src/content/images.generated.ts"), ts);
  console.log(`\nwrote ${Object.keys(generated).length} images and src/content/images.generated.ts`);
}

/**
 * The image shown when a page is shared on WhatsApp, LinkedIn or X. Built from
 * the hero photograph with a steel gradient and the company name, because a
 * bare photo of an excavator says nothing about who is renting it.
 */
async function buildOgImage(hero) {
  const width = 1200;
  const height = 630;
  const overlay = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#121920" stop-opacity="0.94"/>
          <stop offset="0.55" stop-color="#1b2430" stop-opacity="0.72"/>
          <stop offset="1" stop-color="#1b2430" stop-opacity="0.05"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <rect x="72" y="92" width="64" height="10" fill="#f4b000"/>
      <text x="72" y="190" font-family="Arial Narrow, Arial, sans-serif" font-weight="700" font-size="72" fill="#ffffff">Heavy equipment</text>
      <text x="72" y="270" font-family="Arial Narrow, Arial, sans-serif" font-weight="700" font-size="72" fill="#ffffff">rental in Saudi Arabia</text>
      <text x="72" y="340" font-family="Arial, sans-serif" font-size="30" fill="#c3cad3">Cranes, excavators, forklifts, manlifts and generators</text>
      <text x="72" y="540" font-family="Arial, sans-serif" font-weight="700" font-size="34" fill="#ffffff">Heavy Duty Rentals</text>
    </svg>`);
  await mkdir(path.join(PUBLIC, "og"), { recursive: true });
  await sharp(path.join(PUBLIC, hero.src))
    .resize(width, height, { fit: "cover", position: "centre" })
    .composite([{ input: overlay }])
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(path.join(PUBLIC, "og", "default.jpg"));
  console.log("  og/default.jpg                           1200x630");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
