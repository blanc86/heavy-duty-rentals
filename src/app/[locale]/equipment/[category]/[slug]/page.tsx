import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MachineCard } from "@/components/equipment/machine-card";
import { SiteImage, machineImageKey } from "@/components/equipment/machine-image";
import { RatingPlate } from "@/components/equipment/rating-plate";
import { SpecTable } from "@/components/equipment/spec-table";
import { Breadcrumbs, ContactBand } from "@/components/marketing/sections";
import { JsonLd } from "@/components/seo/json-ld";
import {
  ActionLink,
  ButtonLink,
  CheckIcon,
  Container,
  MinusIcon,
  PhoneIcon,
  WhatsAppIcon,
} from "@/components/ui";
import { BUSINESS } from "@/content/business";
import { MACHINES } from "@/content/catalog";
import { GUIDES } from "@/content/guides";
import { IMAGES } from "@/content/images.generated";
import { formattedSpecs } from "@/content/specs";
import {
  categoryPath,
  getCategory,
  getMachine,
  isCraneCategory,
  machinePath,
  machinesIn,
  plateFor,
} from "@/lib/catalog";
import { telHref, whatsappHref } from "@/lib/contact";
import { getDictionary, t } from "@/lib/i18n";
import { LOCALES, isLocale, type Locale } from "@/lib/i18n/config";
import { breadcrumbJsonLd, machineServiceJsonLd } from "@/lib/seo/json-ld";
import { alternates, href } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    MACHINES.map((machine) => ({ locale, category: machine.category, slug: machine.slug })),
  );
}

type Params = Promise<{ locale: string; category: string; slug: string }>;

/** A machine is only found under its own category; any other pairing 404s. */
function resolve(categorySlug: string, slug: string) {
  const machine = getMachine(slug);
  if (!machine || machine.category !== categorySlug) return null;
  const category = getCategory(machine.category);
  return category ? { machine, category } : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, category, slug } = await params;
  if (!isLocale(locale)) return {};
  const found = resolve(category, slug);
  if (!found) return {};
  const dict = getDictionary(locale);
  const { machine } = found;
  const name = machine.name[locale];
  const specs = formattedSpecs(machine, locale)
    .slice(0, 3)
    .map((spec) => `${spec.label} ${spec.value}`)
    .join(locale === "ar" ? "، " : ", ");
  const title = t(dict.meta.machineTitle, { machine: name });
  const description = t(dict.meta.machineDescription, {
    machine: name,
    specs,
    operator: machine.operator === "included" ? dict.equipment.operatorIncluded : dict.equipment.operatorOptional,
  });
  const image = IMAGES[machineImageKey(machine.slug)].src;
  return {
    title,
    description,
    alternates: alternates(locale, machinePath(machine)),
    openGraph: { title, description, images: [{ url: image, width: 1600, height: 1200, alt: name }] },
    twitter: { images: [image] },
  };
}

export default async function MachinePage({ params }: { params: Params }) {
  const { locale: raw, category: categorySlug, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const found = resolve(categorySlug, slug);
  if (!found) notFound();
  const { machine, category } = found;
  const dict = getDictionary(locale);

  const name = machine.name[locale];
  const plate = plateFor(machine, locale);
  const specs = formattedSpecs(machine, locale);
  const whatsappMessage = t(dict.messages.machine, { machine: name });
  const path = machinePath(machine);
  const siblings = machinesIn(category.slug).filter((m) => m.slug !== machine.slug);
  const guide = GUIDES.find((g) => g.categories.includes(category.slug));
  const crumbs = [
    { name: dict.common.home, path: "/" },
    { name: dict.nav.equipment, path: "/equipment" },
    { name: category.name[locale], path: categoryPath(category) },
    { name, path },
  ];

  return (
    <>
      <Container className="pt-8 sm:pt-10">
        <Breadcrumbs locale={locale} dict={dict} crumbs={crumbs} />
      </Container>

      {/* SUMMARY -------------------------------------------------------------
          Everything needed to decide and act sits in the first screen on a
          laptop: the photo, the defining number, what is included about the
          operator, and all three ways to ask for a quote. */}
      <Container className="grid gap-8 pt-6 pb-14 lg:grid-cols-[1.15fr_1fr] lg:gap-12 lg:pb-20">
        <div className="relative overflow-hidden rounded-card bg-steel-100 lg:sticky lg:top-28 lg:self-start">
          <SiteImage
            imageKey={machineImageKey(machine.slug)}
            locale={locale}
            sizes="(min-width: 1200px) 640px, (min-width: 1024px) 55vw, 100vw"
            preload
            className="aspect-[4/3] h-auto w-full"
          />
        </div>

        <div>
          <p className="font-semibold text-steel-600">
            <Link href={href(locale, categoryPath(category))} className="hover:underline underline-offset-4">
              {category.name[locale]}
            </Link>
          </p>
          <h1 className="mt-2 text-h1">{name}</h1>

          <div className="mt-5 flex flex-wrap items-end gap-4">
            {plate && <RatingPlate plate={plate} size="lg" />}
            <p className="text-steel-700">
              <span className="block text-sm text-steel-600">{dict.equipment.typicalModel}</span>
              <span className="font-semibold text-steel-900">
                <bdi>
                  {machine.typicalModel.manufacturer} {machine.typicalModel.model}
                </bdi>
              </span>{" "}
              <span className="text-steel-600">{dict.equipment.orEquivalent}</span>
            </p>
          </div>

          <p className="mt-6 text-lg text-steel-700">{machine.description[locale]}</p>

          <p className="mt-4 flex items-start gap-2.5 font-semibold text-steel-900">
            <CheckIcon className="mt-1 h-[1.1rem] w-[1.1rem] text-whatsapp-600" />
            {machine.operator === "included" ? dict.equipment.operatorIncluded : dict.equipment.operatorOptional}
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <ButtonLink
              href={`${href(locale, "/contact")}?equipment=${machine.slug}#quote`}
              className="min-h-14 text-[1.05rem] sm:col-span-2"
            >
              {dict.cta.rentThis}
            </ButtonLink>
            <ActionLink variant="whatsapp" href={whatsappHref(whatsappMessage)} newTab className="min-h-14">
              <WhatsAppIcon />
              {dict.cta.chatOnWhatsapp}
            </ActionLink>
            <ActionLink variant="outline" href={telHref()} className="min-h-14">
              <PhoneIcon />
              <span className="ltr-nums">{BUSINESS.phone.display}</span>
            </ActionLink>
          </div>

          <div className="mt-8 rounded-card border border-steel-200 bg-steel-50 p-5">
            <h2 className="text-[1.3rem]">{t(dict.equipment.quoteTitle, { machine: name })}</h2>
            <p className="mt-1 text-steel-700">{dict.equipment.quoteBody}</p>
            <ul className="mt-3 space-y-1.5">
              {dict.equipment.quoteChecklist.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckIcon className="mt-1 h-4 w-4 text-steel-700" />
                  <span className="text-steel-800">{item}</span>
                </li>
              ))}
              {isCraneCategory(category.slug) && (
                <li className="flex items-start gap-2">
                  <CheckIcon className="mt-1 h-4 w-4 text-steel-700" />
                  <span className="text-steel-800">{dict.equipment.craneChecklist}</span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </Container>

      {/* DETAIL ---------------------------------------------------------------- */}
      <section aria-labelledby="specs" className="border-t border-steel-200 bg-steel-50 py-14 sm:py-16">
        <Container className="grid gap-12 lg:grid-cols-2">
          <div>
            <h2 id="specs" className="text-h2">
              {dict.equipment.specifications}
            </h2>
            <div className="mt-6 bg-white px-5">
              <SpecTable specs={specs} />
            </div>
            <p className="mt-4 text-sm text-steel-600">{dict.equipment.specsDisclaimer}</p>
          </div>

          <div className="grid content-start gap-10">
            <div>
              <h2 className="text-h2">{dict.equipment.included}</h2>
              <ul className="mt-5 space-y-2.5">
                {machine.included[locale].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckIcon className="mt-1 h-5 w-5 text-whatsapp-600" />
                    <span className="text-steel-800">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            {machine.notIncluded[locale].length > 0 && (
              <div>
                <h2 className="text-[1.6rem]">{dict.equipment.notIncluded}</h2>
                <ul className="mt-4 space-y-2.5">
                  {machine.notIncluded[locale].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <MinusIcon className="mt-1 h-5 w-5 text-steel-500" />
                      <span className="text-steel-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {guide && (
              <p className="rounded-card border border-steel-200 bg-white p-5">
                <span className="block text-sm font-semibold text-steel-600">{dict.equipment.relatedGuide}</span>
                <Link
                  href={href(locale, `/guides/${guide.slug[locale]}`)}
                  className="mt-1 inline-block font-display text-[1.35rem] font-bold text-steel-900 underline underline-offset-4"
                >
                  {guide.title[locale]}
                </Link>
              </p>
            )}
          </div>
        </Container>
      </section>

      {siblings.length > 0 && (
        <section aria-labelledby="siblings" className="py-14 sm:py-16">
          <Container>
            <h2 id="siblings" className="text-h2">
              {t(dict.equipment.otherInCategory, { category: category.name[locale] })}
            </h2>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {siblings.map((sibling) => (
                <li key={sibling.slug} className="flex">
                  <MachineCard machine={sibling} locale={locale} dict={dict} className="w-full" />
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      <ContactBand
        locale={locale}
        dict={dict}
        title={t(dict.equipment.quoteTitle, { machine: name })}
        whatsappMessage={whatsappMessage}
      />

      <JsonLd data={[breadcrumbJsonLd(locale, crumbs), machineServiceJsonLd(locale, machine, path)]} />
    </>
  );
}
