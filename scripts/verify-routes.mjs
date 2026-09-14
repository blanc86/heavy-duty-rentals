#!/usr/bin/env node
/**
 * Crawl the running site and check everything a visitor or a search engine
 * would trip over.
 *
 *   node scripts/verify-routes.mjs            # against http://localhost:3000
 *   APP_URL=https://… node scripts/verify-routes.mjs
 *
 * Starts from sitemap.xml — the same list search engines use — and for every
 * page checks:
 *
 *   - it returns 200
 *   - one <h1>, a <title> of sensible length and a meta description
 *   - a canonical URL that is the page itself, and en / ar / x-default hreflang
 *   - <html lang> and dir match the locale
 *   - every JSON-LD block parses
 *   - every internal link and every image it references resolves
 *   - every tel:, WhatsApp and mailto link is well-formed
 *
 * Then: robots.txt, the root language redirect, a 404, and the redirects that
 * keep the old booking platform's URLs working.
 *
 * Exits non-zero on any failure, so CI can gate on it.
 */

const BASE = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const failures = [];
const fail = (where, what) => failures.push(`${where}: ${what}`);

async function get(url, init = {}) {
  return fetch(url, { redirect: "manual", ...init });
}

/** Rewrite a production URL onto the host under test, so canonical checks work locally. */
function onBase(url) {
  const u = new URL(url);
  return `${BASE}${u.pathname}${u.search}`;
}

const attr = (html, re) => [...html.matchAll(re)].map((m) => m[1]);
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

async function main() {
  console.log(`Crawling ${BASE}\n`);

  const sitemapRes = await get(`${BASE}/sitemap.xml`);
  if (sitemapRes.status !== 200) throw new Error(`sitemap.xml returned ${sitemapRes.status}`);
  const pages = attr(await sitemapRes.text(), /<loc>([^<]+)<\/loc>/g).map(decode);
  console.log(`sitemap: ${pages.length} URLs`);

  const internalLinks = new Set();
  const anchorLinks = new Set();
  const idsByPath = new Map();
  const images = new Set();
  const contactLinks = new Set();

  for (const pageUrl of pages) {
    const url = onBase(pageUrl);
    const path = new URL(pageUrl).pathname;
    const res = await get(url);
    if (res.status !== 200) {
      fail(path, `status ${res.status}`);
      continue;
    }
    const html = await res.text();
    const locale = path.split("/")[1];
    idsByPath.set(decodeURIComponent(path), new Set(attr(html, /\sid="([^"]+)"/g)));

    const h1s = html.match(/<h1[\s>]/g) ?? [];
    if (h1s.length !== 1) fail(path, `${h1s.length} <h1> elements`);

    const title = decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "");
    if (title.length < 15 || title.length > 75) fail(path, `title length ${title.length}: "${title}"`);

    const description = decode(html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "");
    if (description.length < 50 || description.length > 320) fail(path, `description length ${description.length}`);

    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    if (!canonical) fail(path, "no canonical");
    else if (decodeURIComponent(new URL(canonical).pathname) !== decodeURIComponent(path)) fail(path, `canonical points at ${canonical}`);

    for (const lang of ["en", "ar", "x-default"]) {
      if (!new RegExp(`<link rel="alternate" hrefLang="${lang}"`, "i").test(html)) fail(path, `no hreflang ${lang}`);
    }

    const htmlTag = html.match(/<html[^>]*>/)?.[0] ?? "";
    if (!htmlTag.includes(`lang="${locale}"`)) fail(path, `html lang is not ${locale}`);
    if (!htmlTag.includes(`dir="${locale === "ar" ? "rtl" : "ltr"}"`)) fail(path, "wrong dir");

    for (const block of attr(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try {
        JSON.parse(block);
      } catch {
        fail(path, "JSON-LD does not parse");
      }
    }

    for (const href of attr(html, /href="([^"]+)"/g).map(decode)) {
      if (href.startsWith("/") && !href.startsWith("/_next")) {
        internalLinks.add(href.split("#")[0]);
        if (href.includes("#")) anchorLinks.add(href);
      }
      else if (/^(tel:|mailto:|https:\/\/wa\.me)/.test(href)) contactLinks.add(href);
    }
    for (const src of attr(html, /(?:src|srcSet)="([^"]+)"/g).map(decode)) {
      for (const candidate of src.split(",")) {
        const u = candidate.trim().split(" ")[0];
        if (u.startsWith("/_next/image") || u.startsWith("/images/") || u.startsWith("/og/") || u.startsWith("/brand/")) images.add(u);
      }
    }
  }

  console.log(`internal links: ${internalLinks.size}`);
  for (const link of internalLinks) {
    const res = await get(`${BASE}${link}`);
    // A redirect is fine if it lands on a 200.
    if (res.status >= 300 && res.status < 400) {
      const next = await get(new URL(res.headers.get("location"), `${BASE}${link}`).toString());
      if (next.status !== 200) fail(link, `redirects to a ${next.status}`);
    } else if (res.status !== 200) {
      fail(link, `internal link returns ${res.status}`);
    }
  }

  // A link to /projects#some-project must land on that project, not the top of
  // the page: the id has to exist on the page it points at.
  console.log(`anchor links: ${anchorLinks.size}`);
  for (const link of anchorLinks) {
    const [target, id] = link.split("#");
    const ids = idsByPath.get(decodeURIComponent(target));
    if (ids && !ids.has(decodeURIComponent(id))) fail(link, `no element with id "${id}" on ${target}`);
  }

  // Sample every image URL the pages ask for: the optimizer can fail per size.
  console.log(`image URLs: ${images.size}`);
  for (const image of images) {
    const res = await get(`${BASE}${image}`, { headers: { Accept: "image/avif,image/webp,image/*" } });
    const type = res.headers.get("content-type") ?? "";
    if (res.status !== 200 || !type.startsWith("image/")) fail(image, `image returns ${res.status} ${type}`);
  }

  console.log(`contact links: ${contactLinks.size}`);
  for (const link of contactLinks) {
    if (link.startsWith("tel:") && !/^tel:\+\d{10,15}$/.test(link)) fail(link, "malformed tel: link");
    if (link.startsWith("https://wa.me") && !/^https:\/\/wa\.me\/\d{10,15}(\?text=[^\s]+)?$/.test(link)) fail(link, "malformed WhatsApp link");
    if (link.startsWith("mailto:") && !/^mailto:[^@\s]+@[^@\s?]+(\?.*)?$/.test(link)) fail(link, "malformed mailto: link");
  }

  // Site-level checks.
  const robots = await get(`${BASE}/robots.txt`);
  if (robots.status !== 200 || !(await robots.text()).includes("Sitemap:")) fail("/robots.txt", "missing or has no sitemap line");

  const root = await get(`${BASE}/`, { headers: { "Accept-Language": "ar-SA,ar;q=0.9" } });
  if (root.status !== 307 || !root.headers.get("location")?.endsWith("/ar")) fail("/", `Arabic browser not sent to /ar (${root.status} ${root.headers.get("location")})`);
  const rootEn = await get(`${BASE}/`, { headers: { "Accept-Language": "en-GB" } });
  if (!rootEn.headers.get("location")?.endsWith("/en")) fail("/", "English browser not sent to /en");

  for (const missing of ["/en/no-such-page", "/ar/equipment/cranes-that-do-not-exist", "/en/equipment/forklifts/all-terrain-crane-50t"]) {
    const res = await get(`${BASE}${missing}`);
    if (res.status !== 404) fail(missing, `expected 404, got ${res.status}`);
  }

  const legacy = [
    ["/en/equipment/item/excavator-20t", "/en/equipment/excavators/excavator-20t"],
    ["/ar/equipment/item/boom-lift-28m", "/ar/equipment/manlifts/boom-lift-26m"],
    ["/en/book/forklift-3t-diesel", "/en/equipment/forklifts/forklift-3t-diesel"],
    ["/en/booking/RNT-ABC123", "/en/contact"],
    ["/en/quote", "/en/contact"],
    ["/ar/login", "/ar"],
    ["/en/admin/bookings", "/en"],
    ["/en/account", "/en"],
    ["/en/locations/jubail", "/en/service-areas/jubail"],
    ["/en/legal/privacy", "/en/privacy"],
    ["/en/how-it-works", "/en"],
  ];
  for (const [from, to] of legacy) {
    const res = await get(`${BASE}${from}`);
    const location = res.headers.get("location") ?? "";
    if (res.status !== 308 || !location.endsWith(to)) fail(from, `expected 308 to ${to}, got ${res.status} ${location}`);
  }

  const headers = (await get(`${BASE}/en`)).headers;
  for (const h of ["content-security-policy", "x-content-type-options", "referrer-policy", "strict-transport-security"]) {
    if (!headers.get(h)) fail("/en", `missing ${h} header`);
  }
  if (headers.get("x-powered-by")) fail("/en", "framework advertised in X-Powered-By");

  console.log("");
  if (failures.length > 0) {
    console.log(`${failures.length} problem(s):`);
    for (const f of failures) console.log(`  FAIL  ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS  ${pages.length} pages, ${internalLinks.size} links, ${images.size} images, ${contactLinks.size} contact links, ${legacy.length} legacy redirects`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
