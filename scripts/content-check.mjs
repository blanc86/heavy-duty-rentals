#!/usr/bin/env node
/**
 * What does the business still need to supply?
 *
 *   npm run content:check
 *
 * Reads PLACEHOLDER_FIELDS from src/content/business.ts and prints each item
 * with what it controls on the site. Informational: exits 0, because a demo
 * deployment with placeholders is legitimate. Launching with them is not.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(path.join(root, "src/content/business.ts"), "utf8");
const block = source.match(/PLACEHOLDER_FIELDS[^=]*=\s*\[([\s\S]*?)\];/)?.[1] ?? "";
const fields = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

const WHAT = {
  phone: "Phone number — every Call button, the header, footer, contact page and mobile bar",
  whatsapp: "WhatsApp number — every WhatsApp button and the floating chat button",
  email: "Email address — footer, contact page and the quote form's email option",
  address: "Office or yard address — contact page, and switches structured data to LocalBusiness",
  mapsUrl: "Google Maps link — the Get directions link on the contact page",
  hours: "Business hours — contact page",
  legalName: "Registered company name — footer and legal pages",
  crNumber: "Commercial registration number — footer and About page (a trust signal in KSA)",
  vatNumber: "VAT number — footer and About page",
  foundedYear: "Year operations began — About page, only if the business wants it shown",
  fleet: "Confirm the machine list in src/content/catalog.ts matches what is actually rented",
  serviceAreas: "Confirm the cities in SERVICE_AREAS are ones the business delivers to",
  testimonials: "Customer quotes or client logos, with written permission to publish",
  photos: "Photographs of the business's own machines, to replace the illustrative ones",
  domain: "The real domain — set NEXT_PUBLIC_SITE_URL so canonicals and the sitemap use it",
};

if (fields.length === 0) {
  console.log("No placeholders remain. Ready for launch content-wise.");
} else {
  console.log(`${fields.length} item(s) still needed from the business:\n`);
  for (const field of fields) console.log(`  - ${WHAT[field] ?? field}`);
  console.log("\nEdit src/content/business.ts, then remove each field from PLACEHOLDER_FIELDS.");
}
