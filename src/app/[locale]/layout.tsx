import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { barlow, barlowCondensed, plexArabic } from "@/app/fonts";
import { ContactDock } from "@/components/layout/contact-dock";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { JsonLd } from "@/components/seo/json-ld";
import { BUSINESS } from "@/content/business";
import { getDictionary } from "@/lib/i18n";
import { LOCALE_CONFIG, LOCALES, isLocale, type Locale } from "@/lib/i18n/config";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo/json-ld";
import { SITE_URL } from "@/lib/site";

/**
 * Every page on the site is generated at build time for both languages and
 * served from the CDN. Nothing here reads cookies, headers or a database, which
 * is what keeps it static — and what makes the first byte arrive in tens of
 * milliseconds instead of waiting on a server.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1b2430",
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  const name = BUSINESS.name[locale];

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `${dict.meta.homeTitle}`, template: `%s | ${name}` },
    description: dict.meta.homeDescription,
    applicationName: name,
    openGraph: {
      type: "website",
      siteName: name,
      locale: locale === "ar" ? "ar_SA" : "en_SA",
      alternateLocale: locale === "ar" ? "en_SA" : "ar_SA",
      images: [{ url: "/og/default.jpg", width: 1200, height: 630, alt: dict.meta.tagline }],
    },
    twitter: { card: "summary_large_image", images: ["/og/default.jpg"] },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
    },
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const config = LOCALE_CONFIG[locale];

  return (
    <html
      lang={config.htmlLang}
      dir={config.dir}
      className={`${barlow.variable} ${barlowCondensed.variable} ${plexArabic.variable}`}
    >
      {/* Bottom padding on phones equals the contact bar's height, so the bar
          never sits on top of the footer or the last lines of a page. */}
      <body className="flex min-h-dvh flex-col pb-[calc(3.75rem+env(safe-area-inset-bottom))] md:pb-0">
        <a href="#main" className="skip-link">
          {dict.nav.skipToContent}
        </a>
        <SiteHeader locale={locale} dict={dict} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter locale={locale} dict={dict} />
        <ContactDock locale={locale} dict={dict} />
        <JsonLd data={[organizationJsonLd(locale), websiteJsonLd(locale)]} />
      </body>
    </html>
  );
}
