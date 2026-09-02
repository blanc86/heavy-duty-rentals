import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert, Card, CardBody, Container, SectionHeading } from "@/components/ui";
import { getDictionary } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
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
    title: dict.nav.safety,
    description:
      locale === "ar"
        ? "مسؤوليات السلامة في تأجير المعدات الثقيلة: من يقرر ماذا، وما الذي يجب أن يؤكده مهندس مؤهل."
        : "Safety responsibilities in heavy equipment rental: who decides what, and what a qualified engineer must confirm.",
    alternates: {
      canonical: `/${locale}/safety`,
      languages: { en: "/en/safety", ar: "/ar/safety", "x-default": "/en/safety" },
    },
  };
}

/**
 * Safety.
 *
 * Written as a statement of RESPONSIBILITIES, not as a marketing claim.
 *
 * The brief is explicit that nothing here may imply the platform certifies a
 * lift as safe, and that is also simply true: an availability calendar and a
 * load chart are not an engineering determination. This page draws that line
 * clearly rather than letting silence imply otherwise. It contains no invented
 * certifications, safety record or statistics.
 */
export default async function SafetyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDictionary(locale);
  const isArabic = locale === "ar";

  const ours = isArabic
    ? [
        "توريد معدات مصانة وفق جدول صيانة موثّق لكل وحدة على حدة.",
        "الاحتفاظ بسجلات الفحص لكل معدة، وإتاحة شهادة الفحص من طرف ثالث عند التسليم.",
        "إخراج أي معدة من الخدمة تلقائياً عند جدولة صيانتها، بحيث لا يمكن حجزها.",
        "توفير مشغلين مؤهلين ومرخصين عند تضمين المشغل في الإيجار.",
        "توثيق حالة المعدة بالصور عند التسليم وعند الإرجاع.",
      ]
    : [
        "Supplying equipment maintained against a documented schedule, tracked per individual unit.",
        "Keeping inspection records for every machine, with the third-party inspection certificate available at handover.",
        "Automatically removing a machine from sale the moment maintenance is scheduled, so it cannot be booked.",
        "Providing qualified, licensed operators where an operator is included in the rental.",
        "Documenting equipment condition with photographs at handover and on return.",
      ];

  const yours = isArabic
    ? [
        "إعداد خطة رفع وبيان طريقة من قِبل شخص مؤهل.",
        "تقييم تحمل التربة وتجهيز أرضية مناسبة للدعامات أو الجنازير.",
        "التأكد من مدى ملاءمة المعدة لعملية الرفع المحددة عبر مهندس رفع مؤهل.",
        "الحصول على التصاريح وترتيب إغلاق الطرق والمرافقة عند اللزوم.",
        "توفير مدخل آمن للموقع للمعدة ومركبات النقل.",
        "تحديد الخدمات تحت الأرض والأسلاك العلوية قبل التجهيز.",
      ]
    : [
        "Preparing a lift plan and method statement by a competent person.",
        "Assessing ground bearing capacity and preparing suitable ground for outriggers or tracks.",
        "Confirming equipment suitability for the specific lift with a qualified lifting engineer.",
        "Obtaining permits and arranging road closures or escorts where required.",
        "Providing safe site access for the machine and its transport vehicles.",
        "Identifying underground services and overhead lines before set-up.",
      ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: dict.nav.home, path: `/${locale}` },
              { name: dict.nav.safety, path: `/${locale}/safety` },
            ]),
          ),
        }}
      />

      <Container className="py-8 sm:py-12">
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            level={1}
            title={dict.nav.safety}
            description={
              isArabic
                ? "الرفع الثقيل عمل تُحدَّد فيه المسؤوليات بوضوح. هذه صفحتنا التي تحددها."
                : "Heavy lifting is work where responsibilities have to be unambiguous. This page states them."
            }
          />

          {/* The single most important statement on the site. */}
          <Alert tone="danger" title={dict.equipment.safetyNotice}>
            {dict.equipment.safetyBody}
          </Alert>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Card>
              <CardBody>
                <h2 className="text-base font-bold text-steel-950">
                  {isArabic ? "ما نتحمله نحن" : "What we are responsible for"}
                </h2>
                <ul className="mt-3 space-y-2">
                  {ours.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-steel-700">
                      <span aria-hidden="true" className="text-[--color-available]">
                        •
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h2 className="text-base font-bold text-steel-950">
                  {isArabic ? "ما يتحمله العميل" : "What the customer is responsible for"}
                </h2>
                <ul className="mt-3 space-y-2">
                  {yours.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-steel-700">
                      <span aria-hidden="true" className="text-steel-400">
                        •
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>

          <Card className="mt-6">
            <CardBody>
              <h2 className="text-base font-bold text-steel-950">
                {isArabic
                  ? "ما لا يفعله هذا الموقع"
                  : "What this website does not do"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-steel-700">
                {isArabic
                  ? "يعرض هذا الموقع المواصفات وجداول الأحمال والتوفر والأسعار. وهو لا يقرر ما إذا كانت معدة معينة مناسبة لعملية رفع معينة، ولا يمكنه ذلك: فهذا القرار يعتمد على وزن الحمل ونصف القطر والارتفاع وظروف الأرض والرياح والعوائق — وهي أمور لا يمكن تقييمها إلا من قِبل شخص مؤهل عاين الموقع. أي أداة إلكترونية تدّعي غير ذلك تقدّم تخميناً في مسألة تتعلق بالسلامة."
                  : "This site publishes specifications, load charts, availability and prices. It does not — and cannot — decide whether a given machine is suitable for a given lift: that depends on load weight, radius, height, ground conditions, wind and obstructions, which can only be assessed by a competent person who has seen the site. Any online tool claiming otherwise is guessing about a safety-critical question."}
              </p>
            </CardBody>
          </Card>

          {/* No fabricated certifications, statistics or safety records. */}
          <Card className="mt-6 border-dashed">
            <CardBody>
              <h2 className="text-sm font-semibold text-steel-950">
                {isArabic ? "الشهادات والاعتمادات" : "Certifications and accreditations"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-steel-600">
                {isArabic
                  ? "لم تُضَف بعد أي شهادات أو اعتمادات إلى هذا الموقع. تُدرج هنا فقط الشهادات الحقيقية التي تقدمها الشركة ويمكن التحقق منها."
                  : "No certifications or accreditations have been added to this site yet. Only genuine, verifiable credentials supplied by the business will be listed here."}
              </p>
            </CardBody>
          </Card>
        </div>
      </Container>
    </>
  );
}
