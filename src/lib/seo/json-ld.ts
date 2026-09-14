import { BUSINESS, PLACEHOLDER_FIELDS, SERVICE_AREAS } from "@/content/business";
import type { Machine } from "@/content/catalog";
import type { Faq } from "@/content/faqs";
import type { Guide } from "@/content/guides";
import { IMAGES } from "@/content/images.generated";
import { formattedSpecs } from "@/content/specs";
import type { Locale } from "@/lib/i18n/config";
import { absoluteUrl, SITE_URL } from "@/lib/site";

/**
 * Structured data (schema.org JSON-LD).
 *
 * Two rules:
 *
 * 1. Nothing here that the page does not also say. Google treats markup that
 *    disagrees with visible content as spam, and a buyer who reads a phone
 *    number in a search result must find the same one on the page.
 *
 * 2. No placeholder ever reaches a search engine. Contact details still marked
 *    as placeholders in content/business.ts are left OUT of the markup rather
 *    than published into Google's index, where a wrong number outlives the fix
 *    by weeks. The business entity is an Organization until a real address
 *    exists, because LocalBusiness requires one.
 */

const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

const isPlaceholder = (field: (typeof PLACEHOLDER_FIELDS)[number]) => PLACEHOLDER_FIELDS.includes(field);

type JsonLd = Record<string, unknown>;

export function organizationJsonLd(locale: Locale): JsonLd {
  const hasAddress = BUSINESS.address !== null && !isPlaceholder("address");

  return {
    "@context": "https://schema.org",
    "@type": hasAddress ? "LocalBusiness" : "Organization",
    "@id": ORG_ID,
    name: BUSINESS.name[locale],
    alternateName: BUSINESS.name[locale === "en" ? "ar" : "en"],
    ...(BUSINESS.legalName && !isPlaceholder("legalName") ? { legalName: BUSINESS.legalName } : {}),
    url: absoluteUrl(locale),
    logo: `${SITE_URL}/icon.svg`,
    image: `${SITE_URL}/og/default.jpg`,
    description:
      locale === "ar"
        ? "تأجير المعدات الثقيلة لمواقع البناء والمصانع في السعودية."
        : "Heavy equipment rental for construction and industrial sites in Saudi Arabia.",
    areaServed: SERVICE_AREAS.map((area) => ({
      "@type": "City",
      name: area.city[locale],
      containedInPlace: { "@type": "Country", name: locale === "ar" ? "السعودية" : "Saudi Arabia" },
    })),
    knowsLanguage: ["ar", "en"],
    ...(!isPlaceholder("phone") ? { telephone: `+${BUSINESS.phone.digits}` } : {}),
    ...(!isPlaceholder("email") ? { email: BUSINESS.email } : {}),
    ...(!isPlaceholder("phone")
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            telephone: `+${BUSINESS.phone.digits}`,
            contactType: "sales",
            availableLanguage: ["Arabic", "English"],
            areaServed: "SA",
          },
        }
      : {}),
    ...(hasAddress && BUSINESS.address
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: BUSINESS.address[locale],
            addressCountry: "SA",
          },
        }
      : {}),
    ...(BUSINESS.vatNumber && !isPlaceholder("vatNumber") ? { vatID: BUSINESS.vatNumber } : {}),
    ...(BUSINESS.foundedYear && !isPlaceholder("foundedYear") ? { foundingDate: String(BUSINESS.foundedYear) } : {}),
  };
}

export function websiteJsonLd(locale: Locale): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: absoluteUrl(locale),
    name: BUSINESS.name[locale],
    inLanguage: locale === "ar" ? "ar-SA" : "en-SA",
    publisher: { "@id": ORG_ID },
  };
}

export function breadcrumbJsonLd(locale: Locale, crumbs: { name: string; path: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(locale, crumb.path),
    })),
  };
}

/**
 * A machine page describes a rental SERVICE, not a product for sale — there is
 * no price and nothing to buy online, and Product markup without an offer is
 * both inaccurate and ineligible for rich results. Specifications go in as
 * additionalProperty so the numbers are machine-readable.
 */
export function machineServiceJsonLd(locale: Locale, machine: Machine, path: string): JsonLd {
  const image = IMAGES[`equipment/${machine.slug}` as keyof typeof IMAGES];
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${absoluteUrl(locale, path)}#service`,
    serviceType: locale === "ar" ? "تأجير معدات ثقيلة" : "Heavy equipment rental",
    name: locale === "ar" ? `تأجير ${machine.name.ar}` : `${machine.name.en} rental`,
    description: machine.description[locale],
    url: absoluteUrl(locale, path),
    ...(image ? { image: `${SITE_URL}${image.src}` } : {}),
    provider: { "@id": ORG_ID },
    areaServed: SERVICE_AREAS.map((area) => ({ "@type": "City", name: area.city[locale] })),
    additionalProperty: formattedSpecs(machine, locale).map((spec) => ({
      "@type": "PropertyValue",
      name: spec.label,
      value: spec.value,
    })),
  };
}

export function itemListJsonLd(locale: Locale, items: { name: string; path: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: absoluteUrl(locale, item.path),
    })),
  };
}

export function faqJsonLd(locale: Locale, faqs: Faq[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question[locale],
      acceptedAnswer: { "@type": "Answer", text: faq.answer[locale] },
    })),
  };
}

export function articleJsonLd(locale: Locale, guide: Guide, path: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title[locale],
    description: guide.excerpt[locale],
    inLanguage: locale === "ar" ? "ar-SA" : "en-SA",
    dateModified: guide.updated,
    datePublished: guide.updated,
    url: absoluteUrl(locale, path),
    mainEntityOfPage: absoluteUrl(locale, path),
    image: `${SITE_URL}/og/default.jpg`,
    author: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
  };
}

/**
 * Serialise for a <script type="application/ld+json"> block. `<` is escaped so
 * a string containing "</script>" cannot close the tag early — content here is
 * ours, but the escape costs nothing and removes the class of bug.
 */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
