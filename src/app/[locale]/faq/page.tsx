import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContactBand, FaqList, PageHeader } from "@/components/marketing/sections";
import { JsonLd } from "@/components/seo/json-ld";
import { Container } from "@/components/ui";
import { FAQS } from "@/content/faqs";
import { getDictionary } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { alternates } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    title: dict.meta.faqTitle,
    description: dict.meta.faqDescription,
    alternates: alternates(locale, "/faq"),
    openGraph: { title: dict.meta.faqTitle, description: dict.meta.faqDescription },
  };
}

/**
 * The FAQ page carries the FAQPage markup. Other pages show a few of the same
 * questions for convenience but do not repeat the markup — one canonical home
 * per question.
 */
export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const crumbs = [
    { name: dict.common.home, path: "/" },
    { name: dict.nav.faq, path: "/faq" },
  ];

  return (
    <>
      <PageHeader locale={locale} dict={dict} crumbs={crumbs} title={dict.faq.title} intro={dict.faq.intro} />
      <Container className="py-12 sm:py-16">
        <FaqList faqs={FAQS} locale={locale} className="max-w-4xl" />
      </Container>
      <ContactBand locale={locale} dict={dict} />
      <JsonLd data={[breadcrumbJsonLd(locale, crumbs), faqJsonLd(locale, FAQS)]} />
    </>
  );
}
