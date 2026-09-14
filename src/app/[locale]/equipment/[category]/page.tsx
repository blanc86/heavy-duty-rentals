import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MachineCard } from "@/components/equipment/machine-card";
import { ContactBand, FaqList, PageHeader } from "@/components/marketing/sections";
import { JsonLd } from "@/components/seo/json-ld";
import { ActionLink, Container, SectionHeading, WhatsAppIcon } from "@/components/ui";
import { FAQS } from "@/content/faqs";
import { GUIDES } from "@/content/guides";
import { activeCategories, categoryPath, getCategory, machineCount, machinePath, machinesIn } from "@/lib/catalog";
import { whatsappHref } from "@/lib/contact";
import { getDictionary, t } from "@/lib/i18n";
import { LOCALES, isLocale, type Locale } from "@/lib/i18n/config";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/json-ld";
import { alternates, href } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => activeCategories().map((category) => ({ locale, category: category.slug })));
}

type Params = Promise<{ locale: string; category: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, category: slug } = await params;
  if (!isLocale(locale)) return {};
  const category = getCategory(slug);
  if (!category) return {};
  const dict = getDictionary(locale);
  const name = category.name[locale];
  const title = t(dict.meta.categoryTitle, { category: name });
  const description = t(dict.meta.categoryDescription, { category: name, summary: category.summary[locale] });
  return {
    title,
    description,
    alternates: alternates(locale, categoryPath(category)),
    openGraph: { title, description },
  };
}

export default async function CategoryPage({ params }: { params: Params }) {
  const { locale: raw, category: slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const category = getCategory(slug);
  if (!category) notFound();
  const dict = getDictionary(locale);
  const machines = machinesIn(category.slug);
  const name = category.name[locale];
  const crumbs = [
    { name: dict.common.home, path: "/" },
    { name: dict.nav.equipment, path: "/equipment" },
    { name, path: categoryPath(category) },
  ];
  const guides = GUIDES.filter((guide) => guide.categories.includes(category.slug));
  const others = activeCategories().filter((c) => c.slug !== category.slug);

  return (
    <>
      <PageHeader
        locale={locale}
        dict={dict}
        crumbs={crumbs}
        title={t(dict.equipment.categoryHeading, { category: name })}
        intro={category.intro[locale]}
      >
        <p className="mt-3 text-steel-700">
          <span className="font-semibold text-steel-900">{dict.equipment.alsoKnownAs}:</span>{" "}
          {category.alsoKnownAs[locale].join(locale === "ar" ? "، " : ", ")}
        </p>
        <div className="mt-6">
          <ActionLink variant="whatsapp" href={whatsappHref(t(dict.messages.category, { category: name }))} newTab>
            <WhatsAppIcon />
            {dict.cta.chatOnWhatsapp}
          </ActionLink>
        </div>
      </PageHeader>

      <Container className="py-14 sm:py-16">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-h2">{dict.equipment.inThisCategory}</h2>
          <p className="text-steel-600">{machineCount(machines.length, locale)}</p>
        </div>
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {machines.map((machine) => (
            <li key={machine.slug} className="flex">
              <MachineCard machine={machine} locale={locale} dict={dict} className="w-full" />
            </li>
          ))}
        </ul>

        {guides.length > 0 && (
          <div className="mt-14 rounded-card border border-steel-200 bg-steel-50 p-6">
            <h2 className="text-[1.5rem]">{dict.equipment.relatedGuide}</h2>
            <ul className="mt-3 space-y-2">
              {guides.map((guide) => (
                <li key={guide.slug.en}>
                  <Link href={href(locale, `/guides/${guide.slug[locale]}`)} className="font-semibold text-steel-900 underline underline-offset-4">
                    {guide.title[locale]}
                  </Link>
                  <p className="text-steel-600">{guide.excerpt[locale]}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Container>

      <section aria-labelledby="category-faq" className="border-t border-steel-200 py-16">
        <Container className="grid gap-10 lg:grid-cols-[1fr_2fr]">
          <SectionHeading id="category-faq" title={dict.home.faqTitle} />
          <FaqList faqs={FAQS.slice(1, 5)} locale={locale} />
        </Container>
      </section>

      <nav aria-labelledby="other-categories" className="border-t border-steel-200 bg-steel-50 py-14">
        <Container>
          <h2 id="other-categories" className="text-[1.6rem]">
            {dict.equipment.otherCategories}
          </h2>
          <ul className="mt-5 flex flex-wrap gap-2">
            {others.map((other) => (
              <li key={other.slug}>
                <Link
                  href={href(locale, categoryPath(other))}
                  className="inline-flex min-h-11 items-center rounded-full border border-steel-300 bg-white px-4 font-semibold text-steel-800 hover:border-steel-900"
                >
                  {other.name[locale]}
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </nav>

      <ContactBand
        locale={locale}
        dict={dict}
        whatsappMessage={t(dict.messages.category, { category: name })}
      />

      <JsonLd
        data={[
          breadcrumbJsonLd(locale, crumbs),
          itemListJsonLd(locale, machines.map((machine) => ({ name: machine.name[locale], path: machinePath(machine) }))),
        ]}
      />
    </>
  );
}
