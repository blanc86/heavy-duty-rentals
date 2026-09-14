import { describe, expect, it } from "vitest";
import { BUSINESS, PLACEHOLDER_FIELDS, SERVICE_AREAS } from "@/content/business";
import { CATEGORIES, MACHINES } from "@/content/catalog";
import { FAQS } from "@/content/faqs";
import { GUIDES } from "@/content/guides";
import { IMAGES } from "@/content/images.generated";
import manifest from "@/content/images.json";
import { formattedSpecs, formatSpecValue, SPEC_DEFINITIONS } from "@/content/specs";
import { activeCategories, featuredMachines, machineCount, plateFor } from "@/lib/catalog";
import { ar } from "@/lib/i18n/dictionaries/ar";
import { en } from "@/lib/i18n/dictionaries/en";

/**
 * CONTENT INTEGRITY.
 *
 * The site is generated from content files, so a mistake in them is a broken
 * page rather than a failed request: a machine with no image renders a grey
 * box, a missing Arabic string renders a blank, a category nobody links to is
 * a page nobody finds. These tests are what stands between an edit to a
 * content file and a live page with a hole in it.
 */

describe("equipment catalogue", () => {
  it("gives every machine a real category", () => {
    const slugs = new Set(CATEGORIES.map((c) => c.slug));
    for (const machine of MACHINES) expect(slugs, machine.slug).toContain(machine.category);
  });

  it("uses unique, URL-safe slugs", () => {
    const all = [...MACHINES.map((m) => m.slug), ...CATEGORIES.map((c) => c.slug)];
    expect(new Set(all).size).toBe(all.length);
    for (const slug of all) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("has no empty category", () => {
    expect(activeCategories()).toHaveLength(CATEGORIES.length);
  });

  it("gives every machine a photograph with alt text in both languages", () => {
    for (const machine of MACHINES) {
      const image = IMAGES[`equipment/${machine.slug}` as keyof typeof IMAGES];
      expect(image, `no image for ${machine.slug}`).toBeDefined();
      expect(image.alt.en.length, machine.slug).toBeGreaterThan(15);
      expect(image.alt.ar.length, machine.slug).toBeGreaterThan(10);
      expect(image.width / image.height).toBeCloseTo(4 / 3, 2);
    }
  });

  it("describes every machine in both languages", () => {
    for (const machine of MACHINES) {
      expect(machine.name.en.length, machine.slug).toBeGreaterThan(3);
      expect(machine.name.ar, machine.slug).toMatch(/[؀-ۿ]/);
      expect(machine.description.en.length, machine.slug).toBeGreaterThan(60);
      expect(machine.description.ar, machine.slug).toMatch(/[؀-ۿ]/);
      expect(machine.included.en.length, machine.slug).toBe(machine.included.ar.length);
      expect(machine.notIncluded.en.length, machine.slug).toBe(machine.notIncluded.ar.length);
    }
  });

  it("gives every machine at least three specifications and a rating plate", () => {
    for (const machine of MACHINES) {
      expect(formattedSpecs(machine, "en").length, machine.slug).toBeGreaterThanOrEqual(3);
      expect(plateFor(machine, "en"), `no plate for ${machine.slug}`).not.toBeNull();
    }
  });

  it("only uses specification keys it knows how to label", () => {
    for (const machine of MACHINES) {
      for (const key of Object.keys(machine.specs)) expect(SPEC_DEFINITIONS, `${machine.slug}.${key}`).toHaveProperty(key);
    }
  });

  it("features one machine from each of six different categories", () => {
    const featured = featuredMachines();
    expect(featured).toHaveLength(6);
    expect(new Set(featured.map((m) => m.category)).size).toBe(6);
  });
});

describe("specification formatting", () => {
  it("prints masses in tonnes from 1000 kg and in kilograms below", () => {
    expect(formatSpecValue("capacityKg", 50000, "en")).toBe("50 t");
    expect(formatSpecValue("operatingWeightKg", 20200, "en")).toBe("20.2 t");
    expect(formatSpecValue("capacityKg", 227, "en")).toBe("227 kg");
  });

  it("keeps Latin digits and units in Arabic, as on the machine's plate", () => {
    expect(formatSpecValue("capacityKg", 50000, "ar")).toBe("50 t");
    expect(formatSpecValue("workingHeightM", 26.4, "ar")).toMatch(/^26[.٫]4 m$/);
  });

  it("translates enumerated values", () => {
    expect(formatSpecValue("fuelType", "electric", "en")).toBe("Electric");
    expect(formatSpecValue("fuelType", "electric", "ar")).toBe("كهربائي");
  });

  it("uses Arabic dual and plural forms for machine counts", () => {
    expect(machineCount(1, "ar")).toBe("معدة واحدة");
    expect(machineCount(2, "ar")).toBe("معدتان");
    expect(machineCount(3, "ar")).toBe("3 معدات");
    expect(machineCount(11, "ar")).toBe("11 معدة");
    expect(machineCount(1, "en")).toBe("1 machine");
  });
});

describe("images", () => {
  it("credits every image with an author, licence and source", () => {
    for (const [key, image] of Object.entries(IMAGES)) {
      expect(image.credit.author, key).toBeTruthy();
      expect(image.credit.license, key).toBeTruthy();
      expect(image.credit.licenseUrl, key).toMatch(/^https:\/\//);
      expect(image.credit.sourceUrl, key).toMatch(/^https:\/\//);
    }
  });

  it("uses only licences that allow commercial use", () => {
    for (const entry of manifest) {
      expect(entry.license, entry.key).toMatch(/^(Unsplash License|CC0 1\.0|CC BY(-SA)? [234]\.0|Public domain)$/);
    }
  });

  it("serves content-hashed files, so a replaced photo gets a new URL", () => {
    for (const [key, image] of Object.entries(IMAGES)) expect(image.src, key).toMatch(/\.[0-9a-f]{10}\.jpg$/);
  });

  it("has a generated entry for every manifest entry, and nothing else", () => {
    expect(Object.keys(IMAGES).sort()).toEqual(manifest.map((m) => m.key).sort());
  });
});

describe("guides, FAQs and service areas", () => {
  it("translates guide slugs and keeps them unique per language", () => {
    for (const locale of ["en", "ar"] as const) {
      const slugs = GUIDES.map((g) => g.slug[locale]);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
    for (const guide of GUIDES) expect(guide.slug.ar).toMatch(/[؀-ۿ]/);
  });

  it("links every guide to categories that exist", () => {
    const slugs = new Set(CATEGORIES.map((c) => c.slug));
    for (const guide of GUIDES) for (const category of guide.categories) expect(slugs).toContain(category);
  });

  it("no longer describes online booking anywhere in guide text", () => {
    for (const guide of GUIDES) {
      const text = guide.body.en.toLowerCase();
      for (const phrase of ["instantly priced", "instant price", "book online", "before you pay", "checkout"]) {
        expect(text, `${guide.slug.en}: "${phrase}"`).not.toContain(phrase);
      }
    }
  });

  it("answers every FAQ in both languages", () => {
    for (const faq of FAQS) {
      expect(faq.answer.en.length).toBeGreaterThan(40);
      expect(faq.answer.ar).toMatch(/[؀-ۿ]/);
    }
  });

  it("gives every service area its own planning advice", () => {
    // Blank out every city name first, so a note copied from another city with
    // only the name changed counts as a duplicate — that is thin content to a
    // search engine and no help to a buyer.
    const names = SERVICE_AREAS.flatMap((area) => [area.city.en, area.city.ar]);
    const withoutNames = (note: string) => names.reduce((text, name) => text.split(name).join("CITY"), note);
    for (const locale of ["en", "ar"] as const) {
      const notes = SERVICE_AREAS.map((area) => withoutNames(area.planning[locale]));
      expect(new Set(notes).size, locale).toBe(notes.length);
      for (const note of notes) expect(note.length, locale).toBeGreaterThan(locale === "en" ? 120 : 80);
    }
  });
});

describe("copy discipline", () => {
  /** Walk a dictionary and collect every string in it. */
  const strings = (value: unknown): string[] =>
    typeof value === "string" ? [value] : Array.isArray(value) ? value.flatMap(strings) : value && typeof value === "object" ? Object.values(value).flatMap(strings) : [];

  it("makes no response-time, price or ranking promises", () => {
    const text = strings(en).join(" \n ").toLowerCase();
    for (const banned of ["within 24 hours", "within an hour", "straight away", "cheapest", "lowest price", "best price", "#1", "number one", "most often requested", "guarantee"]) {
      expect(text, banned).not.toContain(banned);
    }
  });

  it("has the same shape in Arabic as in English", () => {
    const shape = (value: unknown): unknown =>
      typeof value === "string" ? "s" : Array.isArray(value) ? value.map(shape) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)])) : value;
    expect(shape(ar)).toEqual(shape(en));
  });

  it("writes Arabic strings in Arabic", () => {
    // Allow strings that are legitimately Latin: the language-switch label.
    const untranslated = strings(ar).filter((s) => s.length > 12 && !/[؀-ۿ]/.test(s));
    expect(untranslated).toEqual([]);
  });
});

describe("placeholders", () => {
  it("keeps placeholder numbers visibly fake, so no visitor dials a guess", () => {
    if (PLACEHOLDER_FIELDS.includes("phone")) expect(BUSINESS.phone.display).toContain("X");
    if (PLACEHOLDER_FIELDS.includes("email")) expect(BUSINESS.email).toMatch(/@example\.(com|org|net)$/);
  });
});
