import { describe, expect, it } from "vitest";
import { keepNumbersWithUnits } from "@/lib/text";
import sitemap from "@/app/sitemap";
import { BUSINESS, SERVICE_AREAS } from "@/content/business";
import { MACHINES } from "@/content/catalog";
import { GUIDES } from "@/content/guides";
import { activeCategories, machinePath } from "@/lib/catalog";
import { mailtoHref, telHref, whatsappHref } from "@/lib/contact";
import { alternates, href, SITE_URL } from "@/lib/site";
import { machineServiceJsonLd, organizationJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";

/**
 * CONTACT LINKS AND SEARCH SIGNALS.
 *
 * The contact links are the whole point of the site: every CTA ends in one.
 * A malformed WhatsApp link does not error — it opens WhatsApp on an "invalid
 * number" screen — so the formats are pinned here.
 */

describe("contact links", () => {
  it("builds tel: links in E.164", () => {
    expect(telHref("966 50 123 4567")).toBe("tel:+966501234567");
    expect(telHref()).toMatch(/^tel:\+\d{10,15}$/);
  });

  it("builds wa.me links with digits only — WhatsApp rejects +, spaces or leading zeros", () => {
    expect(whatsappHref(undefined, "+966 50 123 4567")).toBe("https://wa.me/966501234567");
    expect(whatsappHref()).toMatch(/^https:\/\/wa\.me\/\d{10,15}$/);
  });

  it("prefills a WhatsApp message, encoded, including line breaks and Arabic", () => {
    const link = whatsappHref("Hello, 50 t crane\nSite: Jubail & Dammam\nمرحبا", "966501234567");
    const url = new URL(link);
    expect(url.hostname).toBe("wa.me");
    expect(url.searchParams.get("text")).toBe("Hello, 50 t crane\nSite: Jubail & Dammam\nمرحبا");
    expect(link).not.toContain(" ");
  });

  it("encodes mailto spaces as %20, not +, which several mail clients print literally", () => {
    const link = mailtoHref({ subject: "Quote request", body: "Line one\nLine two" }, "sales@example.com");
    expect(link).toBe("mailto:sales@example.com?subject=Quote%20request&body=Line%20one%0ALine%20two");
    expect(link).not.toContain("+");
  });
});

describe("URLs", () => {
  it("prefixes every path with its locale", () => {
    expect(href("en")).toBe("/en");
    expect(href("ar", "/equipment")).toBe("/ar/equipment");
    expect(href("en", "equipment")).toBe("/en/equipment");
  });

  it("declares canonical, both hreflang alternates and x-default as absolute URLs", () => {
    const a = alternates("ar", "/contact");
    expect(a.canonical).toBe(`${SITE_URL}/ar/contact`);
    expect(a.languages).toEqual({
      en: `${SITE_URL}/en/contact`,
      ar: `${SITE_URL}/ar/contact`,
      "x-default": `${SITE_URL}/en/contact`,
    });
  });

  it("pairs translated guide slugs across languages", () => {
    const guide = GUIDES[0]!;
    const a = alternates("en", { en: `/guides/${guide.slug.en}`, ar: `/guides/${guide.slug.ar}` });
    expect(a.languages.ar).toContain(guide.slug.ar);
    expect(a.canonical).toContain(guide.slug.en);
  });
});

describe("sitemap", () => {
  const entries = sitemap();
  const urls = new Set(entries.map((e) => e.url));

  it("lists every machine, category and service area in both languages", () => {
    for (const locale of ["en", "ar"] as const) {
      for (const machine of MACHINES) expect(urls).toContain(`${SITE_URL}/${locale}${machinePath(machine)}`);
      for (const category of activeCategories()) expect(urls).toContain(`${SITE_URL}/${locale}/equipment/${category.slug}`);
      for (const area of SERVICE_AREAS) expect(urls).toContain(`${SITE_URL}/${locale}/service-areas/${area.slug}`);
    }
  });

  it("contains no duplicates and only ASCII URLs", () => {
    expect(urls.size).toBe(entries.length);
    for (const url of urls) expect(url).toMatch(/^[\x21-\x7e]+$/);
  });

  it("gives every entry both language alternates", () => {
    for (const entry of entries) {
      expect(entry.alternates?.languages).toHaveProperty("en");
      expect(entry.alternates?.languages).toHaveProperty("ar");
    }
  });

  it("does not list removed booking, account or admin routes", () => {
    for (const url of urls) expect(url).not.toMatch(/\/(book|booking|account|admin|login|quote|register)(\/|$)/);
  });
});

describe("structured data", () => {
  it("never publishes placeholder contact details to search engines", () => {
    const json = serializeJsonLd(organizationJsonLd("en"));
    expect(json).not.toContain(BUSINESS.phone.digits);
    expect(json).not.toContain(BUSINESS.email);
    expect(json).not.toContain("telephone");
  });

  it("is an Organization until a real address exists", () => {
    expect(organizationJsonLd("en")["@type"]).toBe(BUSINESS.address ? "LocalBusiness" : "Organization");
  });

  it("describes machines as a rental Service, with no invented offer or price", () => {
    const machine = MACHINES[0]!;
    const data = machineServiceJsonLd("en", machine, machinePath(machine));
    expect(data["@type"]).toBe("Service");
    expect(data).not.toHaveProperty("offers");
    expect(JSON.stringify(data)).not.toMatch(/price/i);
  });

  it("escapes < so no string can close its script tag", () => {
    expect(serializeJsonLd({ name: "</script><script>alert(1)</script>" })).not.toContain("</script>");
  });
});

describe("text", () => {
  it("keeps figures with their units, in both scripts", () => {
    expect(keepNumbersWithUnits("a 100 t crane over 3.2 km")).toBe("a 100 t crane over 3.2 km");
    expect(keepNumbersWithUnits("رافعة بحمولة 300 طن")).toBe("رافعة بحمولة 300 طن");
    expect(keepNumbersWithUnits("between 20 30")).toBe("between 20 30");
  });
});
