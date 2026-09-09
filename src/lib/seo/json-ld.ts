import { env } from "@/lib/env";
import type { Locale } from "@/lib/i18n/config";
import type { Halalas } from "@/lib/money";
import type { BusinessSettings } from "@/lib/settings";

/**
 * Structured data.
 *
 * RULE: emit only what the page ACTUALLY is, and only claims the business has
 * actually supplied. Specifically, we never emit `aggregateRating` unless real
 * published reviews exist, and we never emit certifications, awards or founding
 * dates that are placeholders. Fabricated structured data is both a Google
 * penalty risk and a lie told at machine scale.
 */

const url = (path: string) => new URL(path, env.APP_URL).toString();

export function organizationJsonLd(
  locale: Locale,
  business: BusinessSettings,
  branches: { slug: string; name: string; city: string; address: string; phone: string | null }[],
) {
  const name = locale === "ar" ? business.companyNameAr : business.companyNameEn;

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": url("/#organization"),
    name,
    url: url(`/${locale}`),
    telephone: business.phone,
    email: business.email,
    address: {
      "@type": "PostalAddress",
      addressCountry: "SA",
      streetAddress: locale === "ar" ? business.addressAr : business.addressEn,
    },
    // Branches are real rows in the database with real service areas, so
    // declaring them as departments is accurate.
    department: branches.map((branch) => ({
      "@type": "LocalBusiness",
      "@id": url(`/${locale}/locations/${branch.slug}#branch`),
      name: branch.name,
      address: {
        "@type": "PostalAddress",
        addressLocality: branch.city,
        addressCountry: "SA",
        streetAddress: branch.address,
      },
      ...(branch.phone ? { telephone: branch.phone } : {}),
    })),
    // `foundedYear` is null until the business sets it, and we omit the field
    // rather than inventing a founding date.
    ...(business.foundedYear ? { foundingDate: String(business.foundedYear) } : {}),
  };
}

export function websiteJsonLd(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": url("/#website"),
    url: url(`/${locale}`),
    inLanguage: locale === "ar" ? "ar-SA" : "en-SA",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: url(`/${locale}/equipment?q={search_term_string}`),
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Product/Offer for an equipment class.
 *
 * `price` is the genuine lowest daily rate from the rate card. When a class has
 * no published rate (quote-only), no Offer is emitted at all — an offer without
 * a price is exactly the kind of structured data that misleads.
 */
export function equipmentJsonLd(params: {
  locale: Locale;
  name: string;
  description: string | null;
  manufacturer: string;
  model: string;
  slug: string;
  imageKeys: string[];
  dailyRateHalalas: Halalas | null;
  inStock: boolean;
  reviews?: { count: number; averageRating: number } | undefined;
}) {
  const { locale } = params;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: params.name,
    ...(params.description ? { description: params.description } : {}),
    brand: { "@type": "Brand", name: params.manufacturer },
    model: params.model,
    sku: params.slug,
    image: params.imageKeys.map((key) => url(`/api/media/${key}`)),
    ...(params.dailyRateHalalas !== null
      ? {
          offers: {
            "@type": "Offer",
            url: url(`/${locale}/equipment/item/${params.slug}`),
            priceCurrency: env.CURRENCY,
            price: (Number(params.dailyRateHalalas) / 100).toFixed(2),
            priceValidUntil: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
            availability: params.inStock
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
            // Rental, not sale. Declaring the business function correctly stops
            // Google presenting a day rate as a purchase price.
            businessFunction: "https://schema.org/LeaseOut",
          },
        }
      : {}),
    // Emitted ONLY when verified reviews exist. Never fabricated.
    ...(params.reviews && params.reviews.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: params.reviews.averageRating.toFixed(1),
            reviewCount: params.reviews.count,
          },
        }
      : {}),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: url(item.path),
    })),
  };
}

export function faqJsonLd(faqs: { question: string; answer: string }[]) {
  if (faqs.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

export function articleJsonLd(params: {
  locale: Locale;
  title: string;
  description: string | null;
  slug: string;
  publishedAt: Date | null;
  updatedAt: Date;
  authorName: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: params.title,
    ...(params.description ? { description: params.description } : {}),
    inLanguage: params.locale === "ar" ? "ar-SA" : "en-SA",
    mainEntityOfPage: url(`/${params.locale}/guides/${params.slug}`),
    ...(params.publishedAt ? { datePublished: params.publishedAt.toISOString() } : {}),
    dateModified: params.updatedAt.toISOString(),
    author: { "@type": "Organization", name: params.authorName },
    publisher: { "@id": url("/#organization") },
  };
}

/**
 * LocalBusiness for a branch page.
 *
 * Emitted only for branches that genuinely serve customers — `isServiceArea`
 * gates both the page and this markup, which is what keeps location SEO
 * honest rather than a doorway-page farm.
 */
export function branchJsonLd(params: {
  locale: Locale;
  slug: string;
  name: string;
  city: string;
  region: string;
  address: string;
  phone: string | null;
  latitude: string | null;
  longitude: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": url(`/${params.locale}/locations/${params.slug}#branch`),
    name: params.name,
    address: {
      "@type": "PostalAddress",
      streetAddress: params.address,
      addressLocality: params.city,
      addressRegion: params.region,
      addressCountry: "SA",
    },
    ...(params.phone ? { telephone: params.phone } : {}),
    ...(params.latitude && params.longitude
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: params.latitude,
            longitude: params.longitude,
          },
        }
      : {}),
    parentOrganization: { "@id": url("/#organization") },
  };
}

