import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Card, CardBody, Container, SectionHeading } from "@/components/ui";
import { getDictionary } from "@/lib/i18n";
import { formatNumber, isLocale, localePath, type Locale } from "@/lib/i18n/config";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    title: dict.home.howItWorksTitle,
    description: dict.home.heroSubtitle,
    alternates: {
      canonical: `/${locale}/how-it-works`,
      languages: {
        en: "/en/how-it-works",
        ar: "/ar/how-it-works",
        "x-default": "/en/how-it-works",
      },
    },
  };
}

/**
 * How it works.
 *
 * Reduces uncertainty before the buyer commits attention. Every step names a
 * concrete artefact — a price breakdown, an agreement, an invoice — rather than
 * describing a feeling, because the audience is procurement, not consumers.
 */
export default async function HowItWorksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDictionary(locale);
  const isArabic = locale === "ar";

  const steps = [
    {
      title: dict.home.step1,
      body: dict.home.step1Body,
      detail: isArabic
        ? "صفِّ حسب الحمولة والمدى والموقع. كل معدة تعرض مواصفاتها وجدول أحمالها وما يشمله السعر وما لا يشمله."
        : "Filter by capacity, reach and location. Every machine shows its specifications, its load chart, and exactly what the price does and does not cover.",
    },
    {
      title: dict.home.step2,
      body: dict.home.step2Body,
      detail: isArabic
        ? "التوفر محسوب من الحجوزات الفعلية وفترات الصيانة لكل وحدة على حدة — وليس تقديراً عاماً للفئة."
        : "Availability is computed from real reservations and maintenance windows for each individual unit — not an estimate for the class.",
    },
    {
      title: dict.home.step3,
      body: dict.home.step3Body,
      detail: isArabic
        ? "يظهر الإيجار والمشغل والتعبئة والإرجاع وضريبة القيمة المضافة والتأمين كبنود منفصلة قبل الدفع. لا رسوم مفاجئة عند الحجز."
        : "Rental, operator, mobilisation, demobilisation, VAT and the refundable deposit each appear as their own line before you pay. Nothing appears for the first time at checkout.",
    },
    {
      title: dict.home.step4,
      body: dict.home.step4Body,
      detail: isArabic
        ? "تحصل على رقم حجز وعقد تأجير وفاتورة ضريبية فوراً. يمكن لإدارة المشتريات إضافة رقم أمر الشراء ومركز التكلفة ورمز المشروع."
        : "You get a booking reference, a rental agreement and a VAT invoice immediately. Procurement can attach a PO number, cost centre and project code.",
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: dict.nav.home, path: `/${locale}` },
              { name: dict.nav.howItWorks, path: `/${locale}/how-it-works` },
            ]),
          ),
        }}
      />

      <Container className="py-8 sm:py-12">
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            level={1}
            title={dict.home.howItWorksTitle}
            description={dict.home.heroSubtitle}
          />

          <ol className="space-y-4">
            {steps.map((step, index) => (
              <li key={step.title}>
                <Card>
                  <CardBody>
                    <div className="flex gap-4">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-steel-950 text-sm font-bold text-amber-400 numeric-latin">
                        {formatNumber(index + 1, locale)}
                      </span>
                      <div>
                        <h2 className="text-base font-bold text-steel-950">{step.title}</h2>
                        <p className="mt-1 text-sm text-steel-700">{step.body}</p>
                        <p className="mt-2 text-sm leading-relaxed text-steel-600">{step.detail}</p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ol>

          {/* The honest explanation of why not everything is instantly priced. */}
          <Card className="mt-8">
            <CardBody>
              <h2 className="text-base font-bold text-steel-950">
                {isArabic ? "لماذا تتطلب بعض المعدات عرض سعر؟" : "Why do some machines need a quote?"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-steel-700">
                {isArabic
                  ? "تعتمد تكلفة تعبئة ونقل الرافعات الزاحفة الكبيرة على دراسة مسار وتصاريح وأكثر من اثني عشر حمل نقل، وقد تصل إلى 20–40% من قيمة المشروع. تقديم رقم فوري لتلك التكلفة سيكون تخميناً، لذلك نوجّه هذه الفئات إلى عرض سعر منظّم — تقدّم كل البيانات عبر الإنترنت وتحصل على رد مسعّر يمكنك قبوله عبر الإنترنت."
                  : "Mobilising a large crawler crane depends on a route survey, permits and more than a dozen transport loads, and can be 20–40% of the total project cost. An instant number for that would be a guess, so those classes route to a structured quote instead — you still submit everything online, and you get a priced response you can accept online."}
              </p>
            </CardBody>
          </Card>

          <Alert tone="warning" title={dict.equipment.safetyNotice} className="mt-6">
            {dict.equipment.safetyBody}
          </Alert>

          <p className="mt-8 text-center">
            <Link
              href={localePath(locale, "/equipment")}
              className="inline-flex min-h-[3rem] items-center rounded-[--radius-control] bg-amber-500 px-6 text-base font-semibold text-steel-950 hover:bg-amber-400"
            >
              {dict.equipment.checkAvailability}
            </Link>
          </p>
        </div>
      </Container>
    </>
  );
}
