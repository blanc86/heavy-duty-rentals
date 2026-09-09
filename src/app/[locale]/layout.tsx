import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getFullActor } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { getDictionary } from "@/lib/i18n";
import { LOCALE_CONFIG, LOCALES, isLocale, type Locale } from "@/lib/i18n/config";
import { getBusinessSettings } from "@/lib/settings";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const dict = getDictionary(locale);
  const business = await getBusinessSettings();
  const name = locale === "ar" ? business.companyNameAr : business.companyNameEn;

  return {
    metadataBase: new URL(env.APP_URL),
    title: {
      default: `${name} — ${dict.meta.tagline}`,
      template: `%s | ${name}`,
    },
    description: dict.meta.tagline,
    // Both locales are declared as alternates on every page, plus x-default,
    // so Google can serve the right language for an Arabic query — which every
    // competitor currently forfeits (docs/research.md §10).
    alternates: {
      languages: {
        en: "/en",
        ar: "/ar",
        "x-default": "/en",
      },
    },
    openGraph: {
      type: "website",
      siteName: name,
      locale: locale === "ar" ? "ar_SA" : "en_SA",
      alternateLocale: locale === "ar" ? "en_SA" : "ar_SA",
    },
    twitter: { card: "summary_large_image" },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
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
  const [actor, business, requestHeaders] = await Promise.all([
    getFullActor(),
    getBusinessSettings(),
    headers(),
  ]);

  const pathname = requestHeaders.get("x-pathname") ?? `/${locale}`;
  // Only the language switch uses this — never the canonical/hreflang tags.
  const search = requestHeaders.get("x-search") ?? "";

  return (
    // `lang` and `dir` are set here, on the server, in the first bytes of HTML.
    // Setting them client-side would flash an LTR layout at Arabic users and
    // give assistive technology the wrong language for the initial parse.
    <html lang={config.htmlLang} dir={config.dir} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="skip-link">
          {dict.nav.skipToContent}
        </a>

        {env.DEMO_MODE && (
          <div className="bg-steel-900 px-4 py-1.5 text-center text-2xs text-steel-200 sm:text-xs">
            {locale === "ar"
              ? "بيئة تجريبية — جميع المعدات والأسعار بيانات توضيحية فقط، ولا تتم أي عمليات دفع حقيقية."
              : "Demo environment — all equipment and prices are illustrative sample data. No real payments are processed."}
          </div>
        )}

        <SiteHeader locale={locale} dict={dict} actor={actor} pathname={pathname} search={search} />

        <main id="main" className="flex-1">
          {children}
        </main>

        <SiteFooter locale={locale} dict={dict} business={business} />
      </body>
    </html>
  );
}
