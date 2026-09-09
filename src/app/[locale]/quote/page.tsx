import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuoteRequestForm } from "@/components/booking/quote-request-form";
import { Alert, Card, CardBody, Container, SectionHeading } from "@/components/ui";
import { getFullActor } from "@/lib/auth/session";
import { getClassBySlug, listBranches, searchClasses } from "@/lib/catalog/repository";
import { getDictionary } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: getDictionary(locale).equipment.requestQuote,
    // A form page, not a landing page.
    robots: { index: false, follow: true },
  };
}

/**
 * Structured quote request.
 *
 * The honest alternative to either faking an instant price on a 600 t crawler
 * or making every customer phone. The request is submitted online, carries the
 * structured lift details operations actually need to price it, and returns a
 * priced response the customer can accept online.
 *
 * The key difference from a generic "contact us" form: the fields are the ones
 * that determine a price, so the first reply can be a quote rather than a
 * request for more information.
 */
export default async function QuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: rawLocale } = await params;
  const sp = await searchParams;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDictionary(locale);
  const isArabic = locale === "ar";

  const classSlug = typeof sp.class === "string" ? sp.class : undefined;
  const [preselected, branches, quoteOnlyClasses, actor] = await Promise.all([
    classSlug ? getClassBySlug(classSlug, locale) : Promise.resolve(null),
    listBranches(locale),
    searchClasses({ locale, perPage: 48 }),
    getFullActor(),
  ]);

  return (
    <Container className="py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <SectionHeading
          level={1}
          title={dict.equipment.requestQuote}
          description={
            isArabic
              ? "أخبرنا بتفاصيل العمل وسنعود إليك بعرض سعر مفصّل يمكنك قبوله عبر الإنترنت."
              : "Tell us about the job and we will come back with an itemised quote you can accept online."
          }
        />

        {preselected && !preselected.instantBookable && (
          <Alert tone="info" className="mb-6" title={preselected.name}>
            {dict.equipment.quoteOnlyReason}
          </Alert>
        )}

        <Card>
          <CardBody>
            <QuoteRequestForm
              locale={locale}
              dict={dict}
              branches={branches.map((b) => ({ id: b.id, city: b.city }))}
              classes={quoteOnlyClasses.items.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))}
              preselectedClassId={preselected?.id}
              defaultName={actor?.fullName}
              defaultEmail={actor?.email}
              startDate={typeof sp.start === "string" ? sp.start : undefined}
              endDate={typeof sp.end === "string" ? sp.end : undefined}
            />
          </CardBody>
        </Card>

        <Alert tone="warning" title={dict.equipment.safetyNotice} className="mt-6">
          {dict.equipment.safetyBody}
        </Alert>
      </div>
    </Container>
  );
}
