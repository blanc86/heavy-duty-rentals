import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MachineCard } from "@/components/equipment/machine-card";
import { ContactBand, PageHeader } from "@/components/marketing/sections";
import { JsonLd } from "@/components/seo/json-ld";
import { Container } from "@/components/ui";
import { activeCategories, categoryPath, machineCount, machinePath, machinesIn } from "@/lib/catalog";
import { getDictionary } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/json-ld";
import { alternates, href } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    title: dict.meta.equipmentTitle,
    description: dict.meta.equipmentDescription,
    alternates: alternates(locale, "/equipment"),
    openGraph: { title: dict.meta.equipmentTitle, description: dict.meta.equipmentDescription },
  };
}

/**
 * Every machine, grouped by category, with a jump bar.
 *
 * No client-side filter: fourteen categories and eighteen machines fit on one
 * scrollable page, and anchor links do the job a filter widget would — with no
 * JavaScript, and with every machine present in the HTML for search engines.
 */
export default async function EquipmentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const categories = activeCategories();
  const crumbs = [
    { name: dict.common.home, path: "/" },
    { name: dict.nav.equipment, path: "/equipment" },
  ];

  return (
    <>
      <PageHeader locale={locale} dict={dict} crumbs={crumbs} title={dict.equipment.indexTitle} intro={dict.equipment.indexIntro} />

      <nav aria-label={dict.equipment.jumpTo} className="sticky top-16 z-30 border-b border-steel-200 bg-white/95 backdrop-blur lg:top-[4.5rem]">
        <Container>
          <ul className="-mx-2 flex gap-1 overflow-x-auto py-2.5 [scrollbar-width:none]">
            {categories.map((category) => (
              <li key={category.slug} className="shrink-0">
                <a
                  href={`#${category.slug}`}
                  className="inline-flex min-h-10 items-center rounded-full px-3.5 text-[0.95rem] font-semibold whitespace-nowrap text-steel-700 hover:bg-steel-100 hover:text-steel-950"
                >
                  {category.name[locale]}
                </a>
              </li>
            ))}
          </ul>
        </Container>
      </nav>

      <Container className="py-12 sm:py-16">
        {categories.map((category) => {
          const machines = machinesIn(category.slug);
          return (
            <section key={category.slug} id={category.slug} aria-labelledby={`${category.slug}-title`} className="scroll-mt-36 border-b border-steel-200 py-12 first:pt-0 last:border-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
                <h2 id={`${category.slug}-title`} className="text-h2">
                  <Link href={href(locale, categoryPath(category))} className="hover:underline underline-offset-4">
                    {category.name[locale]}
                  </Link>
                </h2>
                <p className="text-steel-600">{machineCount(machines.length, locale)}</p>
              </div>
              <p className="mt-2 max-w-2xl text-steel-700">{category.summary[locale]}</p>
              <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {machines.map((machine) => (
                  <li key={machine.slug} className="flex">
                    <MachineCard machine={machine} locale={locale} dict={dict} className="w-full" />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </Container>

      <ContactBand locale={locale} dict={dict} />

      <JsonLd
        data={[
          breadcrumbJsonLd(locale, crumbs),
          itemListJsonLd(
            locale,
            categories.flatMap((category) =>
              machinesIn(category.slug).map((machine) => ({ name: machine.name[locale], path: machinePath(machine) })),
            ),
          ),
        ]}
      />
    </>
  );
}
