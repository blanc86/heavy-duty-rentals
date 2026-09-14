import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContactBand, PageHeader, ServiceAreaLinks } from "@/components/marketing/sections";
import { JsonLd } from "@/components/seo/json-ld";
import { Container } from "@/components/ui";
import { getDictionary } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { alternates } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    title: dict.meta.areasTitle,
    description: dict.meta.areasDescription,
    alternates: alternates(locale, "/service-areas"),
    openGraph: { title: dict.meta.areasTitle, description: dict.meta.areasDescription },
  };
}

export default async function ServiceAreasPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const crumbs = [
    { name: dict.common.home, path: "/" },
    { name: dict.nav.serviceAreas, path: "/service-areas" },
  ];

  return (
    <>
      <PageHeader locale={locale} dict={dict} crumbs={crumbs} title={dict.areas.title} intro={dict.areas.intro} />
      <Container className="py-14 sm:py-20">
        <ServiceAreaLinks locale={locale} dict={dict} />
      </Container>
      <ContactBand locale={locale} dict={dict} />
      <JsonLd data={breadcrumbJsonLd(locale, crumbs)} />
    </>
  );
}
