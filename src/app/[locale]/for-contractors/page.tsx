import type { Metadata } from "next";
import { cspNonce } from "@/lib/seo/nonce";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HeroSearch } from "@/components/search/hero-search";
import {
  ProjectsSection,
  TestimonialsSection,
} from "@/components/marketing/trust-sections";
import { Alert, Card, CardBody, Container, SectionHeading } from "@/components/ui";
import { listBranches } from "@/lib/catalog/repository";
import { getDictionary } from "@/lib/i18n";
import { formatNumber, isLocale, localePath, type Locale } from "@/lib/i18n/config";
import {
  getOperationalProof,
  listPublishedProjects,
  listPublishedTestimonials,
} from "@/lib/marketing/repository";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const title =
    locale === "ar"
      ? "تأجير المعدات الثقيلة للمقاولين في السعودية"
      : "Heavy Equipment Rental for Contractors in Saudi Arabia";
  const description =
    locale === "ar"
      ? "توقّف عن مطاردة عروض الأسعار. تحقق من التوفر الفعلي، واطّلع على السعر كاملاً شاملاً التعبئة والنقل وضريبة القيمة المضافة، واحجز عبر الإنترنت."
      : "Stop chasing quotes. Check real availability, see the whole price including mobilisation and VAT, and book online.";

  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}/for-contractors`,
      languages: {
        en: "/en/for-contractors",
        ar: "/ar/for-contractors",
        "x-default": "/en/for-contractors",
      },
    },
    openGraph: { title, description, type: "website" },
  };
}

/**
 * PERSUASION LANDING PAGE.
 *
 * Distinct from `/` by intent, not decoration. The homepage serves someone who
 * already knows what they want and needs to get out of the way; this page
 * serves COLD traffic — paid search, LinkedIn, outbound — where the visitor has
 * never heard of us and does need convincing before they will touch a search
 * box.
 *
 * So the structure is inverted: problem first, then the argument, then the
 * proof, and the booking widget arrives only once there is a reason to use it.
 * The homepage would be worse for doing this; this page would be worse without
 * it.
 */
export default async function ForContractorsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDictionary(locale);
  const isArabic = locale === "ar";

  const [branches, proof, testimonials, projects] = await Promise.all([
    listBranches(locale),
    getOperationalProof(),
    listPublishedTestimonials(locale, 3),
    listPublishedProjects(locale, 3),
  ]);

  // The argument, stated as problem → consequence → what we changed. Leading
  // with the buyer's actual Tuesday rather than our feature list.
  const problems = isArabic
    ? [
        {
          problem: "تتصل بأربعة موردين لمعرفة من لديه رافعة 100 طن يوم الرابع عشر.",
          consequence: "يضيع نصف يوم، وتحصل على إجابتين متضاربتين، وواحد لا يرد أصلاً.",
          answer: "التواريخ معروضة على الشاشة. كل معدة وحدة فعلية لها جدول توفر خاص بها.",
        },
        {
          problem: "يصل عرض السعر بعد يومين، ولا يذكر التعبئة والنقل.",
          consequence: "تكتشف تكلفة المقطورة المنخفضة في الفاتورة، بعد أن قدّمت رقمك للعميل.",
          answer: "الإيجار والمشغل والتعبئة والإرجاع وضريبة القيمة المضافة كلها بنود منفصلة قبل الدفع.",
        },
        {
          problem: "إدارة المشتريات تحتاج رقم أمر شراء ومركز تكلفة وفاتورة ضريبية.",
          consequence: "أسبوع من متابعة رسائل البريد قبل أن يُعتمد الصرف.",
          answer: "تُدخلها عند الحجز، وتصدر الفاتورة والعقد فور التأكيد.",
        },
        {
          problem: "المعدة تصل متأخرة يوماً، والطاقم واقف في الموقع.",
          consequence: "يوم عمل ضائع لا يعوّضه أحد.",
          answer: "نحسب وقت التعبئة والنقل ضمن فترة حجز المعدة، فلا يُجدوَل موعد لا يمكن الوفاء به فعلياً.",
        },
      ]
    : [
        {
          problem: "You ring four suppliers to find out who has a 100-tonne machine free on the 14th.",
          consequence: "Half a day gone, two contradictory answers, and one who never calls back.",
          answer: "The dates are on the screen. Every machine is an actual unit with its own calendar.",
        },
        {
          problem: "The quote arrives two days later and says nothing about mobilisation.",
          consequence: "You find the low-bed charge on the invoice — after you gave your client a number.",
          answer: "Rental, operator, mobilisation, demobilisation and VAT are separate lines before you pay.",
        },
        {
          problem: "Procurement needs a PO number, a cost centre and a VAT invoice.",
          consequence: "A week of chasing an email thread before the spend is approved.",
          answer: "You enter them at booking. The invoice and agreement issue the moment it is confirmed.",
        },
        {
          problem: "The machine turns up a day late and the crew is standing on site.",
          consequence: "A lost working day that nobody reimburses.",
          answer: "Transport time is inside the machine's booked window, so a schedule that cannot physically happen never gets made.",
        },
      ];

  return (
    <>
      <script
        type="application/ld+json"
        // CSP applies to every <script>, including a ld+json data block that
        // never executes. Without the nonce the block is refused and a crawler
        // rendering under CSP never sees the structured data — silently, since
        // the markup is still present in the HTML source.
        nonce={await cspNonce()}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: dict.nav.home, path: `/${locale}` },
              {
                name: isArabic ? "للمقاولين" : "For contractors",
                path: `/${locale}/for-contractors`,
              },
            ]),
          ),
        }}
      />

      {/* ---------------------------------------------------------------
          HERO — narrative, because this visitor arrived cold.
          No search widget yet: they have no reason to use one.
      --------------------------------------------------------------- */}
      <section className="border-b border-steel-200 bg-steel-950">
        <Container className="py-14 sm:py-20">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-400">
              {isArabic ? "للمقاولين ومديري المواقع" : "For contractors and site managers"}
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
              {isArabic
                ? "توقّف عن مطاردة عروض أسعار المعدات"
                : "Stop chasing equipment quotes"}
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-steel-300">
              {isArabic
                ? "أنت لا تحتاج إلى مورّد آخر يَعِدك بمعاودة الاتصال. تحتاج إلى معرفة ما إذا كانت المعدة متاحة في تواريخك، وكم ستكلّف بالكامل، وأن تحجزها قبل أن تغادر الموقع."
                : "You do not need another supplier who promises to call you back. You need to know whether the machine is free on your dates, what it costs in full, and to book it before you leave site."}
            </p>
          </div>
        </Container>
      </section>

      {/* --------------------------------------------------------------- */}
      <Container className="py-12 sm:py-16">
        <SectionHeading
          level={2}
          title={isArabic ? "ما الذي نغيّره فعلياً" : "What actually changes"}
          description={
            isArabic
              ? "أربع مشكلات يعرفها كل من استأجر معدة ثقيلة في السعودية."
              : "Four problems anyone who has hired heavy plant in Saudi Arabia will recognise."
          }
        />

        <ul className="space-y-4">
          {problems.map((item) => (
            <li key={item.problem}>
              <Card>
                <CardBody className="grid gap-4 sm:grid-cols-[1fr_1fr] sm:gap-8">
                  <div>
                    <p className="text-sm font-semibold text-steel-950">{item.problem}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-steel-600">
                      {item.consequence}
                    </p>
                  </div>
                  <div className="border-steel-200 sm:border-s sm:ps-8">
                    <p className="text-2xs font-semibold uppercase tracking-wide text-amber-700">
                      {isArabic ? "على هذه المنصة" : "On this platform"}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-steel-800">{item.answer}</p>
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      </Container>

      {/* --------------------------------------------------------------- */}
      <section className="border-y border-steel-200 bg-white">
        <Container className="py-10">
          <ul className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {[
              {
                value: formatNumber(proof.totalUnits, locale),
                label: isArabic ? "وحدة في الأسطول" : "machines in the fleet",
              },
              {
                value: formatNumber(proof.equipmentClasses, locale),
                label: isArabic ? "طرازاً" : "models",
              },
              {
                value: formatNumber(proof.serviceCities, locale),
                label: isArabic ? "مدن بها مستودعات" : "cities with depots",
              },
              {
                value: formatNumber(15, locale) + "%",
                label: isArabic ? "ضريبة قيمة مضافة مُحتسبة" : "VAT, always itemised",
              },
            ].map((stat) => (
              <li key={stat.label}>
                <p className="text-2xl font-bold text-steel-950 numeric-latin sm:text-3xl">
                  {stat.value}
                </p>
                <p className="mt-1 text-sm text-steel-600">{stat.label}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <TestimonialsSection testimonials={testimonials} locale={locale} dict={dict} />

      <ProjectsSection
        projects={projects}
        locale={locale}
        dict={dict}
        heading={isArabic ? "أعمال شبيهة بعملك" : "Work like yours"}
      />

      {/* ---------------------------------------------------------------
          THE ASK — the search widget arrives here, once there is a reason
          to use it. On the homepage it is the first thing; here it is the
          last, and that difference is the whole point of the page.
      --------------------------------------------------------------- */}
      <section className="border-y border-steel-200 bg-steel-100">
        <Container className="py-12 sm:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-steel-950 sm:text-3xl">
              {isArabic ? "جرّبها على معدتك القادمة" : "Try it on your next machine"}
            </h2>
            <p className="mt-3 text-base text-steel-700">
              {isArabic
                ? "ابحث عن المعدة، أدخل تواريخك، واطّلع على التوفر والسعر الكامل. لا حاجة لحساب حتى تصل إلى الدفع."
                : "Find the machine, enter your dates, and see availability and the full price. No account needed until you reach checkout."}
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-4xl">
            <HeroSearch locale={locale} dict={dict} branches={branches} />
          </div>

          <p className="mt-6 text-center text-sm text-steel-600">
            {isArabic ? "معدة كبيرة أو مشروع معقد؟ " : "Larger machine or a complex job? "}
            <Link
              href={localePath(locale, "/quote")}
              className="font-medium text-steel-900 underline underline-offset-2"
            >
              {dict.equipment.requestQuote}
            </Link>
          </p>
        </Container>
      </section>

      <Container className="py-10">
        <Alert tone="warning" title={dict.equipment.safetyNotice}>
          {dict.equipment.safetyBody}
        </Alert>
      </Container>
    </>
  );
}
