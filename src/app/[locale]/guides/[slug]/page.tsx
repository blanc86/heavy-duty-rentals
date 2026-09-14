import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MachineCard } from "@/components/equipment/machine-card";
import { ContactBand, PageHeader } from "@/components/marketing/sections";
import { JsonLd } from "@/components/seo/json-ld";
import { Container } from "@/components/ui";
import { GUIDES, type Guide } from "@/content/guides";
import { machinesIn } from "@/lib/catalog";
import { getDictionary, t } from "@/lib/i18n";
import { LOCALES, formatDate, isLocale, type Locale } from "@/lib/i18n/config";
import { renderMarkdown } from "@/lib/markdown";
import { decodeSlugParam } from "@/lib/routing";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { alternates } from "@/lib/site";

export const dynamicParams = false;

/**
 * Guide slugs are translated, so each locale generates only its own slugs:
 * /ar/guides/<arabic-slug>, never /ar/guides/<english-slug>.
 */
export function generateStaticParams() {
  return LOCALES.flatMap((locale) => GUIDES.map((guide) => ({ locale, slug: guide.slug[locale] })));
}

type Params = Promise<{ locale: string; slug: string }>;

function findGuide(locale: Locale, rawSlug: string): Guide | undefined {
  // Next hands dynamic segments over percent-encoded; Arabic slugs need decoding.
  const slug = decodeSlugParam(rawSlug);
  return GUIDES.find((guide) => guide.slug[locale] === slug);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const guide = findGuide(locale, slug);
  if (!guide) return {};
  return {
    title: guide.title[locale],
    description: guide.excerpt[locale],
    alternates: alternates(locale, { en: `/guides/${guide.slug.en}`, ar: `/guides/${guide.slug.ar}` }),
    openGraph: { type: "article", title: guide.title[locale], description: guide.excerpt[locale], modifiedTime: guide.updated },
  };
}

export default async function GuidePage({ params }: { params: Params }) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const guide = findGuide(locale, slug);
  if (!guide) notFound();
  const dict = getDictionary(locale);
  const path = `/guides/${guide.slug[locale]}`;
  const crumbs = [
    { name: dict.common.home, path: "/" },
    { name: dict.nav.guides, path: "/guides" },
    { name: guide.title[locale], path },
  ];
  const machines = guide.categories.flatMap((category) => machinesIn(category)).slice(0, 3);

  return (
    <>
      <PageHeader locale={locale} dict={dict} crumbs={crumbs} title={guide.title[locale]} intro={guide.excerpt[locale]}>
        <p className="mt-4 text-sm text-steel-600">
          {t(dict.guides.updated, { date: formatDate(new Date(`${guide.updated}T00:00:00Z`), locale) })}
        </p>
      </PageHeader>

      <Container className="py-12 sm:py-16">
        {/* The renderer escapes before it emits, so guide text can never inject markup. */}
        <article className="prose-body text-[1.1rem]" dangerouslySetInnerHTML={{ __html: renderMarkdown(guide.body[locale]) }} />
      </Container>

      {machines.length > 0 && (
        <section aria-labelledby="guide-equipment" className="border-t border-steel-200 bg-steel-50 py-14 sm:py-16">
          <Container>
            <h2 id="guide-equipment" className="text-h2">
              {dict.guides.equipmentTitle}
            </h2>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {machines.map((machine) => (
                <li key={machine.slug} className="flex">
                  <MachineCard machine={machine} locale={locale} dict={dict} className="w-full" />
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      <ContactBand locale={locale} dict={dict} />
      <JsonLd data={[breadcrumbJsonLd(locale, crumbs), articleJsonLd(locale, guide, path)]} />
    </>
  );
}
