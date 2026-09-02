import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert, Container, SectionHeading } from "@/components/ui";
import { getDictionary } from "@/lib/i18n";
import { formatNumber, isLocale, type Locale } from "@/lib/i18n/config";
import { getBusinessSettings } from "@/lib/settings";

/**
 * Legal / policy pages.
 *
 * These are OPERATIONAL DRAFTS, not legal advice, and every one of them says so
 * at the top. The Saudi e-commerce framework requires return, refund and
 * delivery terms to be published and reachable before an order completes, so
 * the pages must exist and be linked from checkout — but the wording must be
 * reviewed by Saudi counsel before launch. Shipping confident-sounding legal
 * text nobody qualified has read would be worse than shipping an honest draft.
 *
 * The cancellation tiers are rendered from SETTINGS, so what the customer reads
 * here is always what the booking flow actually applies.
 */
const DOCS = ["terms", "rental-terms", "privacy", "cancellation", "cookies", "refund"] as const;
type Doc = (typeof DOCS)[number];

function isDoc(value: string): value is Doc {
  return (DOCS as readonly string[]).includes(value);
}

function titleFor(doc: Doc, locale: Locale): string {
  const en: Record<Doc, string> = {
    terms: "Terms of Service",
    "rental-terms": "Rental Terms",
    privacy: "Privacy Policy",
    cancellation: "Cancellation Policy",
    cookies: "Cookie Policy",
    refund: "Refund Policy",
  };
  const ar: Record<Doc, string> = {
    terms: "شروط الاستخدام",
    "rental-terms": "شروط التأجير",
    privacy: "سياسة الخصوصية",
    cancellation: "سياسة الإلغاء",
    cookies: "سياسة ملفات الارتباط",
    refund: "سياسة الاسترداد",
  };
  return locale === "ar" ? ar[doc] : en[doc];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; doc: string }>;
}): Promise<Metadata> {
  const { locale, doc } = await params;
  if (!isLocale(locale) || !isDoc(doc)) return {};
  return {
    title: titleFor(doc, locale),
    alternates: {
      canonical: `/${locale}/legal/${doc}`,
      languages: {
        en: `/en/legal/${doc}`,
        ar: `/ar/legal/${doc}`,
        "x-default": `/en/legal/${doc}`,
      },
    },
  };
}

export function generateStaticParams() {
  return DOCS.map((doc) => ({ doc }));
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string; doc: string }>;
}) {
  const { locale: rawLocale, doc } = await params;
  if (!isLocale(rawLocale) || !isDoc(doc)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDictionary(locale);
  const isArabic = locale === "ar";
  const business = await getBusinessSettings();

  const sections = buildSections(doc, locale, business);

  return (
    <Container className="py-8 sm:py-12">
      <article className="mx-auto max-w-3xl">
        <SectionHeading level={1} title={titleFor(doc, locale)} />

        {/* Honest status. Better a visible draft than confident-sounding text
            no qualified person has reviewed. */}
        <Alert
          tone="warning"
          title={isArabic ? "مسودة للمراجعة" : "Draft — pending legal review"}
        >
          {isArabic
            ? "هذه صياغة تشغيلية أولية تعكس كيفية عمل النظام فعلياً. يجب مراجعتها واعتمادها من مستشار قانوني سعودي مؤهل قبل الإطلاق. لا تُعد هذه الصفحة استشارة قانونية."
            : "This is an operational draft describing how the system actually behaves. It must be reviewed and approved by qualified Saudi counsel before launch. It is not legal advice."}
        </Alert>

        <div className="mt-8 space-y-6">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-bold text-steel-950">{section.title}</h2>
              {section.paragraphs.map((paragraph, index) => (
                <p key={index} className="mt-2 text-sm leading-relaxed text-steel-700">
                  {paragraph}
                </p>
              ))}
              {section.list && (
                <ul className="mt-2 space-y-1.5 ps-5 [list-style:disc]">
                  {section.list.map((item) => (
                    <li key={item} className="text-sm leading-relaxed text-steel-700">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {doc === "cancellation" && (
          <section className="mt-8">
            <h2 className="mb-2 text-lg font-bold text-steel-950">
              {isArabic ? "جدول الاسترداد" : "Refund schedule"}
            </h2>
            {/* Rendered from settings, so this always matches what the booking
                flow actually applies. */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-steel-300">
                  <th scope="col" className="py-2 text-start font-semibold text-steel-700">
                    {isArabic ? "الإشعار المسبق" : "Notice given"}
                  </th>
                  <th scope="col" className="py-2 text-end font-semibold text-steel-700">
                    {isArabic ? "نسبة الاسترداد" : "Refund"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...business.cancellationTiers]
                  .sort((a, b) => b.minHoursNotice - a.minHoursNotice)
                  .map((tier) => (
                    <tr key={tier.minHoursNotice} className="border-b border-steel-200">
                      <td className="py-2 text-steel-800">
                        {tier.minHoursNotice === 0
                          ? isArabic
                            ? "أقل من 24 ساعة"
                            : "Less than 24 hours"
                          : isArabic
                            ? `${formatNumber(tier.minHoursNotice / 24, locale)} يوم أو أكثر`
                            : `${formatNumber(tier.minHoursNotice / 24, locale)} days or more`}
                      </td>
                      <td className="py-2 text-end font-medium text-steel-950 numeric-latin">
                        {formatNumber(tier.refundPercent, locale)}%
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-steel-500">
              {isArabic
                ? "لا يُعد التأمين القابل للاسترداد جزءاً من هذا الجدول؛ فهو يُعاد بالكامل بعد فحص الإرجاع، بعد خصم أي أضرار متفق عليها."
                : "The refundable deposit is not part of this schedule; it is returned in full after the return inspection, less any agreed damage."}
            </p>
          </section>
        )}

        <p className="mt-10 text-xs text-steel-500">
          {isArabic ? "آخر تحديث للإصدار" : "Terms version"}{" "}
          <span className="numeric-latin">{business.termsVersion}</span> ·{" "}
          {isArabic ? business.companyNameAr : business.companyNameEn} ·{" "}
          {dict.footer.crNumber} <span className="numeric-latin">{business.crNumber}</span>
        </p>
      </article>
    </Container>
  );
}

interface Section {
  title: string;
  paragraphs: string[];
  list?: string[];
}

function buildSections(
  doc: Doc,
  locale: Locale,
  business: Awaited<ReturnType<typeof getBusinessSettings>>,
): Section[] {
  const isArabic = locale === "ar";
  const company = isArabic ? business.companyNameAr : business.companyNameEn;

  if (doc === "privacy") {
    return isArabic
      ? [
          {
            title: "البيانات التي نجمعها",
            paragraphs: [
              "نجمع الحد الأدنى اللازم لتنفيذ التأجير: الاسم والبريد الإلكتروني ورقم الجوال وعنوان الموقع وبيانات جهة الاتصال في الموقع، وبيانات الشركة والرقم الضريبي للحسابات المؤسسية.",
              "لا نطلب رقم الهوية الوطنية أو الإقامة عند الحجز. التحقق من الهوية إجراء تشغيلي يتم عند تسليم المعدة، وليس حقلاً في نموذج الدفع.",
            ],
          },
          {
            title: "بيانات الدفع",
            paragraphs: [
              "لا نرى بيانات بطاقتك ولا نخزّنها. تتم معالجة المدفوعات عبر مزود خدمات دفع مرخّص من البنك المركزي السعودي. نحتفظ فقط بآخر أربعة أرقام ونوع البطاقة لعرضها لك.",
            ],
          },
          {
            title: "التسويق",
            paragraphs: [
              "لا نرسل رسائل تسويقية إلا بموافقة صريحة ومنفصلة عن قبول الشروط. يمكنك سحب الموافقة في أي وقت. الرسائل التشغيلية المتعلقة بحجز قائم ليست رسائل تسويقية.",
            ],
          },
          {
            title: "الاحتفاظ بالبيانات",
            paragraphs: [
              "نحتفظ بسجلات الحجوزات والفواتير للمدة التي تتطلبها الأنظمة التجارية والضريبية، وبسجلات التدقيق لأغراض أمنية، ونحذف الجلسات والحجوزات غير المكتملة بعد فترات محددة.",
            ],
          },
          {
            title: "حقوقك",
            paragraphs: [
              "بموجب نظام حماية البيانات الشخصية السعودي، لك حقوق تشمل الوصول إلى بياناتك وتصحيحها وطلب حذفها. يُرجى التواصل عبر بريد الشركة الموضح أدناه.",
              "ملاحظة: لم تُبنَ بعد واجهة ذاتية لتصدير أو حذف البيانات؛ تُعالج الطلبات حالياً يدوياً.",
            ],
          },
        ]
      : [
          {
            title: "What we collect",
            paragraphs: [
              "We collect the minimum needed to fulfil a rental: name, email, phone, site address and site contact details, plus company details and VAT number for business accounts.",
              "We do NOT ask for a national ID or Iqama number at booking. Identity verification is an operational step at machine handover, not a checkout field.",
            ],
          },
          {
            title: "Payment data",
            paragraphs: [
              "We never see or store your card details. Payments are processed by a SAMA-licensed payment service provider. We retain only the last four digits and the card type so we can show you which card was used.",
            ],
          },
          {
            title: "Marketing",
            paragraphs: [
              "We send marketing messages only with explicit consent, given separately from accepting terms. You can withdraw consent at any time. Operational messages about an existing booking are not marketing.",
            ],
          },
          {
            title: "Retention",
            paragraphs: [
              "Booking and invoice records are retained for the period required by commercial and tax rules, audit logs are retained for security investigation, and sessions and abandoned checkouts are purged after defined periods.",
            ],
          },
          {
            title: "Your rights",
            paragraphs: [
              "Under the Saudi Personal Data Protection Law you have rights including access, correction and deletion. Please contact us at the address below.",
              "Note: a self-service data export/deletion interface has not been built yet; requests are currently handled manually.",
            ],
          },
        ];
  }

  if (doc === "cancellation" || doc === "refund") {
    return isArabic
      ? [
          {
            title: "كيف يعمل الإلغاء",
            paragraphs: [
              "يعتمد الاسترداد على مدة الإشعار المسبق قبل تاريخ بدء الإيجار، وفق الجدول أدناه. تُحرَّر المعدة فوراً عند الإلغاء وتصبح متاحة لعملاء آخرين.",
            ],
          },
          {
            title: "التأمين",
            paragraphs: [
              "التأمين ليس جزءاً من رسوم الإلغاء. يُعاد بالكامل بعد فحص الإرجاع، مع خصم أي أضرار أو ملحقات مفقودة أو نقص وقود متفق عليه.",
            ],
          },
          {
            title: "ملاحظة نظامية",
            paragraphs: [
              "توجد في المملكة قواعد لحماية المستهلك تتعلق بحق الإرجاع في المشتريات عبر الإنترنت. ينطبق تطبيقها على خدمات التأجير بشكل مختلف عن السلع، ويجب تأكيد ذلك مع مستشار قانوني. لا يزعم هذا الموقع تفسيراً نظامياً.",
            ],
          },
        ]
      : [
          {
            title: "How cancellation works",
            paragraphs: [
              "The refund depends on how much notice is given before the rental start date, per the schedule below. Cancelling releases the machine immediately, making it available to other customers.",
            ],
          },
          {
            title: "The deposit",
            paragraphs: [
              "The deposit is not part of the cancellation charge. It is returned in full after the return inspection, less any agreed damage, missing accessories or fuel shortfall.",
            ],
          },
          {
            title: "Regulatory note",
            paragraphs: [
              "Saudi consumer protection rules include return rights for online purchases. How those apply to rental SERVICES differs from goods and must be confirmed with legal counsel. This site does not assert a legal interpretation.",
            ],
          },
        ];
  }

  if (doc === "cookies") {
    return isArabic
      ? [
          {
            title: "ما نستخدمه",
            paragraphs: [
              "نستخدم ملف ارتباط واحد ضروري للجلسة لإبقائك مسجّل الدخول، وملف ارتباط لتفضيل اللغة. كلاهما ضروري لعمل الموقع.",
              "لا نستخدم ملفات ارتباط إعلانية أو تتبّعاً عبر المواقع.",
            ],
          },
        ]
      : [
          {
            title: "What we use",
            paragraphs: [
              "We use one essential session cookie to keep you signed in, and one cookie to remember your language preference. Both are necessary for the site to function.",
              "We do not use advertising cookies or cross-site tracking.",
            ],
          },
        ];
  }

  // terms / rental-terms
  return isArabic
    ? [
        {
          title: "الأطراف",
          paragraphs: [
            `تُبرم اتفاقية التأجير بين ${company} (المؤجر) والعميل المسجّل (المستأجر).`,
          ],
        },
        {
          title: "ما يشمله السعر",
          paragraphs: [
            "تُدرج البنود المشمولة وغير المشمولة صراحةً في صفحة كل معدة وفي تفاصيل السعر قبل الدفع. البنود التي لا تظهر هناك غير مشمولة.",
          ],
        },
        {
          title: "المسؤوليات",
          paragraphs: [
            "يتحمل المستأجر تجهيز الموقع وتقييم تحمل التربة وخطة الرفع والتصاريح والمدخل الآمن. راجع صفحة السلامة للتفاصيل الكاملة.",
          ],
        },
        {
          title: "الأضرار",
          paragraphs: [
            "يتحمل المستأجر الأضرار التي تتجاوز الاستهلاك الطبيعي. تُوثَّق حالة المعدة بالصور عند التسليم وعند الإرجاع.",
          ],
        },
      ]
    : [
        {
          title: "Parties",
          paragraphs: [
            `The rental agreement is between ${company} (the lessor) and the registered customer (the lessee).`,
          ],
        },
        {
          title: "What the price covers",
          paragraphs: [
            "Inclusions and exclusions are stated explicitly on each equipment page and in the price breakdown shown before payment. Anything not listed there is not included.",
          ],
        },
        {
          title: "Responsibilities",
          paragraphs: [
            "The lessee is responsible for site preparation, ground bearing assessment, the lift plan, permits and safe access. See the Safety page for the full split of responsibilities.",
          ],
        },
        {
          title: "Damage",
          paragraphs: [
            "The lessee is responsible for damage beyond fair wear and tear. Equipment condition is documented with photographs at handover and on return.",
          ],
        },
      ];
}
