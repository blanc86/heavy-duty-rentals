import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert, Card, CardBody, Container, SectionHeading } from "@/components/ui";
import { listBranches } from "@/lib/catalog/repository";
import { getDictionary } from "@/lib/i18n";
import { formatNumber, isLocale, type Locale } from "@/lib/i18n/config";
import { getBusinessSettings } from "@/lib/settings";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: getDictionary(locale).nav.about,
    alternates: {
      canonical: `/${locale}/about`,
      languages: { en: "/en/about", ar: "/ar/about", "x-default": "/en/about" },
    },
  };
}

/**
 * About.
 *
 * Contains NO invented history, client list, safety record or statistics. The
 * brief is explicit that fabricated trust signals are prohibited, and they are
 * also the fastest way to lose an enterprise account that checks. What this
 * page describes instead is what is verifiably true: how the platform works.
 */
export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDictionary(locale);
  const isArabic = locale === "ar";

  const [business, branches] = await Promise.all([getBusinessSettings(), listBranches(locale)]);
  const totalUnits = branches.reduce((sum, b) => sum + b.unitCount, 0);

  return (
    <Container className="py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <SectionHeading
          level={1}
          title={isArabic ? business.companyNameAr : business.companyNameEn}
          description={dict.meta.tagline}
        />

        <p className="text-base leading-relaxed text-steel-700">
          {isArabic
            ? "نشغّل أسطولاً من المعدات الثقيلة للإيجار في المملكة العربية السعودية، ونتيحه عبر منصة يمكن من خلالها التحقق من التوفر الفعلي والاطلاع على السعر الكامل وإتمام الحجز دون مكالمة هاتفية."
            : "We operate a fleet of heavy equipment for hire in Saudi Arabia, and make it available through a platform where you can check real availability, see the full price, and complete a booking without a phone call."}
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardBody className="py-4">
              <p className="text-2xl font-bold text-steel-950 numeric-latin">
                {formatNumber(totalUnits, locale)}
              </p>
              <p className="mt-0.5 text-xs text-steel-600">
                {isArabic ? "وحدة في الأسطول" : "units in the fleet"}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="py-4">
              <p className="text-2xl font-bold text-steel-950 numeric-latin">
                {formatNumber(branches.length, locale)}
              </p>
              <p className="mt-0.5 text-xs text-steel-600">
                {isArabic ? "مستودع خدمة" : "service depots"}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="py-4">
              <p className="text-2xl font-bold text-steel-950">
                {isArabic ? "عربي / English" : "AR / EN"}
              </p>
              <p className="mt-0.5 text-xs text-steel-600">
                {isArabic ? "المنصة بالكامل بلغتين" : "fully bilingual platform"}
              </p>
            </CardBody>
          </Card>
        </div>

        <section className="mt-10">
          <h2 className="text-lg font-bold text-steel-950">
            {isArabic ? "كيف نعمل بشكل مختلف" : "How we work differently"}
          </h2>
          <ul className="mt-3 space-y-3">
            {(isArabic
              ? [
                  ["توفر فعلي", "كل معدة وحدة حقيقية برقم تسلسلي وجدول توفر خاص بها، وليس تقديراً على مستوى الفئة."],
                  ["تسعير مفصّل", "الإيجار والمشغل والنقل وضريبة القيمة المضافة والتأمين كلها بنود منفصلة قبل الدفع."],
                  ["صراحة بشأن الحدود", "عندما لا يمكن تسعير التعبئة والنقل بدقة دون دراسة مسار، نقول ذلك ونقدّم عرض سعر بدلاً من تخمين."],
                  ["مستندات فورية", "رقم حجز وعقد تأجير وفاتورة ضريبية فور التأكيد."],
                ]
              : [
                  ["Real availability", "Every machine is an actual serialised unit with its own calendar, not a class-level estimate."],
                  ["Itemised pricing", "Rental, operator, transport, VAT and the refundable deposit are all separate lines before you pay."],
                  ["Honest about limits", "Where mobilisation cannot be priced accurately without a route survey, we say so and quote it rather than guess."],
                  ["Immediate paperwork", "A booking reference, rental agreement and VAT invoice the moment a booking is confirmed."],
                ]
            ).map(([title, body]) => (
              <li key={title} className="flex gap-3">
                <span aria-hidden="true" className="mt-1 text-amber-600">
                  ▸
                </span>
                <span>
                  <span className="block font-semibold text-steel-900">{title}</span>
                  <span className="block text-sm leading-relaxed text-steel-600">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Explicit rather than silently omitted. */}
        <Alert tone="info" className="mt-10">
          {isArabic
            ? "لم تُضَف بعد معلومات الشركة الفعلية — تاريخ التأسيس والشهادات والمشاريع المرجعية — إلى هذا الموقع. لن يُدرج هنا سوى معلومات حقيقية يمكن التحقق منها."
            : "The business's real corporate details — founding date, certifications and reference projects — have not been added to this site yet. Only genuine, verifiable information will be published here."}
        </Alert>

        <section className="mt-8">
          <h2 className="text-lg font-bold text-steel-950">
            {isArabic ? "بيانات الشركة" : "Company details"}
          </h2>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-steel-500">{dict.footer.crNumber}</dt>
              <dd className="font-medium text-steel-900 numeric-latin">{business.crNumber}</dd>
            </div>
            <div>
              <dt className="text-steel-500">{dict.footer.vatNumber}</dt>
              <dd className="font-medium text-steel-900 numeric-latin">{business.vatNumber}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-steel-500">{dict.nav.contact}</dt>
              <dd className="font-medium text-steel-900">
                <a href={`mailto:${business.email}`} className="underline underline-offset-2">
                  {business.email}
                </a>
                {" · "}
                <a
                  href={`tel:${business.phone.replace(/\s/g, "")}`}
                  className="underline underline-offset-2 numeric-latin"
                >
                  {business.phone}
                </a>
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </Container>
  );
}
