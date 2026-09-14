import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteImage } from "@/components/equipment/machine-image";
import { PageHeader } from "@/components/marketing/sections";
import { Container } from "@/components/ui";
import { IMAGES, type ImageKey } from "@/content/images.generated";
import { getDictionary, t } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { alternates } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    title: dict.meta.creditsTitle,
    description: dict.meta.creditsDescription,
    alternates: alternates(locale, "/image-credits"),
    // Useful to people and required by the licences, but not a search landing page.
    robots: { index: false, follow: true },
  };
}

/**
 * Image credits.
 *
 * Creative Commons BY and BY-SA licences REQUIRE attribution: the author, the
 * licence, a link to it, and a note that the image was changed. Unsplash and
 * CC0 images do not require it but are credited anyway. Generated from the same
 * manifest that produced the images, so a credit cannot drift from its image.
 */
export default async function ImageCreditsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const crumbs = [
    { name: dict.common.home, path: "/" },
    { name: dict.credits.title, path: "/image-credits" },
  ];

  return (
    <>
      <PageHeader locale={locale} dict={dict} crumbs={crumbs} title={dict.credits.title} intro={dict.credits.intro} />
      <Container className="py-12 sm:py-16">
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(IMAGES) as ImageKey[]).map((key) => {
            const image = IMAGES[key];
            const { credit } = image;
            return (
              <li key={key} className="overflow-hidden rounded-card border border-steel-200">
                <div className="relative aspect-[4/3] bg-steel-100">
                  <SiteImage imageKey={key} locale={locale} sizes="(min-width: 1024px) 380px, 50vw" fill />
                </div>
                <div className="p-4 text-sm">
                  <p className="font-semibold text-steel-900">{image.alt[locale]}</p>
                  <p className="mt-2 text-steel-700">
                    {credit.authorUrl ? (
                      <a href={credit.authorUrl} rel="noopener noreferrer" target="_blank" className="underline underline-offset-2">
                        {t(dict.credits.by, { author: credit.author })}
                      </a>
                    ) : (
                      t(dict.credits.by, { author: credit.author })
                    )}
                  </p>
                  <p className="text-steel-700">
                    {dict.credits.licence}:{" "}
                    <a href={credit.licenseUrl} rel="noopener noreferrer license" target="_blank" className="underline underline-offset-2">
                      {credit.license}
                    </a>
                  </p>
                  <p className="text-steel-700">
                    {dict.credits.source}:{" "}
                    <a href={credit.sourceUrl} rel="noopener noreferrer" target="_blank" className="underline underline-offset-2">
                      {credit.source}
                    </a>
                  </p>
                  <p className="mt-1 text-steel-600">{dict.credits.changes}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Container>
    </>
  );
}
