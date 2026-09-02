import Link from "next/link";
import { Badge, Card, CardBody, Container, DemoBadge, SectionHeading } from "@/components/ui";
import type { Credential, OperationalProof, ProjectSummary, Testimonial } from "@/lib/marketing/repository";
import type { Dictionary } from "@/lib/i18n";
import { formatNumber, localePath, type Locale } from "@/lib/i18n/config";

/**
 * Below-the-fold trust sections.
 *
 * These sit UNDER the search widget deliberately. The highest-value visitor
 * arrives from a search engine already knowing what they want, and the fastest
 * thing you can do for them is get out of the way. But a SAR 98,000 crane hire
 * from a supplier they have not used before also has to answer "why you?" —
 * and that answer belongs below the fold, where it costs a returning customer
 * nothing.
 */

// ---------------------------------------------------------------------------
// Operational proof — counted, not claimed
// ---------------------------------------------------------------------------

export function OperationalProofBar({
  proof,
  locale,
}: {
  proof: OperationalProof;
  locale: Locale;
}) {
  const isArabic = locale === "ar";

  // Every figure here is COUNTED from the database. Deliberately absent:
  // "years in business", "customers served", "safety record" — claims we
  // cannot verify and would just be repeating.
  const stats = [
    {
      value: formatNumber(proof.totalUnits, locale),
      label: isArabic ? "وحدة في الأسطول" : "machines in the fleet",
    },
    {
      value: formatNumber(proof.equipmentClasses, locale),
      label: isArabic ? "طرازاً متاحاً" : "models available",
    },
    {
      value: formatNumber(proof.serviceCities, locale),
      label: isArabic ? "مدن بها مستودعات" : "cities with depots",
    },
    {
      value: isArabic ? "عربي / English" : "AR / EN",
      label: isArabic ? "المنصة بلغتين" : "fully bilingual",
    },
  ];

  return (
    <section className="border-y border-steel-200 bg-white">
      <Container className="py-8">
        <ul className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {stats.map((stat) => (
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
  );
}

// ---------------------------------------------------------------------------
// Why us — the differentiators that are structurally true
// ---------------------------------------------------------------------------

export function WhyUsSection({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const isArabic = locale === "ar";

  // Each of these is a claim the SITE ITSELF demonstrates. A visitor can click
  // through and verify every one in under a minute, which is why they are
  // worth stating.
  const points = isArabic
    ? [
        {
          title: "التوفر الفعلي، لا تقدير تقريبي",
          body: "كل معدة وحدة حقيقية برقم تسلسلي وجدول توفر خاص بها. عندما نقول إن رافعة متاحة يوم الرابع عشر، فهذا محسوب من الحجوزات وفترات الصيانة الفعلية — ولا يمكن حجز الوحدة نفسها مرتين.",
          proofHref: "/equipment",
          proofLabel: "تحقق من التوفر",
        },
        {
          title: "السعر كاملاً قبل الدفع",
          body: "الإيجار والمشغل والتعبئة والإرجاع ورسوم المقطورة المنخفضة وضريبة القيمة المضافة والتأمين — كل بند على حدة. لا شيء يظهر لأول مرة عند الدفع.",
          proofHref: "/how-it-works",
          proofLabel: "كيف يعمل التسعير",
        },
        {
          title: "نقول ما لا نستطيع تسعيره",
          body: "تعتمد تعبئة الرافعات الزاحفة الكبيرة على دراسة مسار وتصاريح، وقد تصل إلى 20–40% من قيمة المشروع. لا نخمّن رقماً — نوجّهك إلى عرض سعر منظّم ونرد بسعر مفصّل.",
          proofHref: "/quote",
          proofLabel: "اطلب عرض سعر",
        },
        {
          title: "مستندات المشتريات فوراً",
          body: "رقم أمر الشراء ومركز التكلفة ورمز المشروع عند الحجز، وعقد تأجير وفاتورة ضريبية فور التأكيد. لا حاجة لمتابعة أحد.",
          proofHref: "/faq",
          proofLabel: "الأسئلة الشائعة",
        },
      ]
    : [
        {
          title: "Real availability, not an estimate",
          body: "Every machine is an actual serialised unit with its own calendar. When we say a crane is free on the 14th, that is computed from real reservations and maintenance windows — and the same unit cannot be booked twice.",
          proofHref: "/equipment",
          proofLabel: "Check availability",
        },
        {
          title: "The whole price, before you pay",
          body: "Rental, operator, mobilisation, demobilisation, low-bed surcharge, VAT and the refundable deposit — each as its own line. Nothing appears for the first time at checkout.",
          proofHref: "/how-it-works",
          proofLabel: "How pricing works",
        },
        {
          title: "We say when we cannot price it",
          body: "Mobilising a large crawler depends on a route survey and permits, and can be 20–40% of the job. We do not guess a number — those classes route to a structured quote and come back itemised.",
          proofHref: "/quote",
          proofLabel: "Request a quote",
        },
        {
          title: "Procurement paperwork immediately",
          body: "PO number, cost centre and project code at booking; a rental agreement and VAT invoice the moment it is confirmed. Nobody has to be chased.",
          proofHref: "/faq",
          proofLabel: "Common questions",
        },
      ];

  return (
    <Container className="py-10 sm:py-14">
      <SectionHeading
        title={isArabic ? "لماذا نحن" : "Why rent from us"}
        description={
          isArabic
            ? "كل نقطة هنا يمكنك التحقق منها بنفسك في أقل من دقيقة."
            : "Every claim here is one you can verify yourself in under a minute."
        }
      />

      <ul className="grid gap-4 sm:grid-cols-2">
        {points.map((point) => (
          <li key={point.title}>
            <Card className="h-full">
              <CardBody>
                <h3 className="text-base font-bold text-steel-950">{point.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-steel-700">{point.body}</p>
                <Link
                  href={localePath(locale, point.proofHref)}
                  className="mt-3 inline-block text-sm font-medium text-steel-800 underline underline-offset-2 hover:text-steel-950"
                >
                  {point.proofLabel} →
                </Link>
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-steel-500">{dict.equipment.safetyBody}</p>
    </Container>
  );
}

// ---------------------------------------------------------------------------
// Testimonials
// ---------------------------------------------------------------------------

export function TestimonialsSection({
  testimonials: items,
  locale,
  dict,
}: {
  testimonials: Testimonial[];
  locale: Locale;
  dict: Dictionary;
}) {
  if (items.length === 0) return null;
  const isArabic = locale === "ar";
  const anyDemo = items.some((item) => item.isDemoData);

  return (
    <section className="border-y border-steel-200 bg-white">
      <Container className="py-10 sm:py-14">
        <SectionHeading
          title={isArabic ? "ماذا يقول العملاء" : "What customers say"}
          action={
            anyDemo ? <DemoBadge label={dict.common.demoData} /> : undefined
          }
        />

        <ul className="grid gap-4 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.id}>
              <figure className="flex h-full flex-col rounded-[--radius-card] border border-steel-200 bg-steel-50 p-5">
                <svg
                  viewBox="0 0 24 24"
                  className="mb-3 h-6 w-6 shrink-0 text-amber-500"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M9.5 5C6.5 5 4 7.5 4 10.5c0 2.8 2.1 5 4.8 5 .3 0 .6 0 .9-.1-.6 1.9-2.3 3.3-4.3 3.6v2c4.4-.4 7.8-4.1 7.8-8.6V10.5C13.2 7.5 12 5 9.5 5zm10 0C16.5 5 14 7.5 14 10.5c0 2.8 2.1 5 4.8 5 .3 0 .6 0 .9-.1-.6 1.9-2.3 3.3-4.3 3.6v2c4.4-.4 7.8-4.1 7.8-8.6V10.5C23.2 7.5 22 5 19.5 5z" />
                </svg>

                <blockquote className="flex-1 text-sm leading-relaxed text-steel-800">
                  {item.quote}
                </blockquote>

                <figcaption className="mt-4 border-t border-steel-200 pt-3 text-sm">
                  {item.authorName && (
                    <span className="block font-semibold text-steel-950">{item.authorName}</span>
                  )}
                  <span className="block text-steel-600">
                    {[item.authorRole, item.companyName].filter(Boolean).join(" · ")}
                  </span>
                  {item.context && (
                    <span className="block text-xs text-steel-500">{item.context}</span>
                  )}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>

        {/*
          Stated plainly. These are business-supplied references, not verified
          platform reviews — the two are different things and the site does not
          blur them. Reviews tied to a completed booking are labelled
          "verified rental" wherever they appear.
        */}
        <p className="mt-4 text-xs text-steel-500">
          {isArabic
            ? "مراجع مقدَّمة من الشركة. التقييمات الموثقة المرتبطة بتأجير مكتمل عبر المنصة تُعرض بشكل منفصل وتحمل شارة «تأجير موثّق»."
            : "Business-supplied references. Verified reviews tied to a completed rental on this platform are shown separately and carry a “verified rental” badge."}
        </p>
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Completed projects
// ---------------------------------------------------------------------------

export function ProjectsSection({
  projects: items,
  locale,
  dict,
  heading,
}: {
  projects: ProjectSummary[];
  locale: Locale;
  dict: Dictionary;
  heading?: string;
}) {
  if (items.length === 0) return null;
  const isArabic = locale === "ar";
  const anyDemo = items.some((item) => item.isDemoData);

  return (
    <Container className="py-10 sm:py-14">
      <SectionHeading
        title={heading ?? (isArabic ? "أعمال منجزة" : "Completed work")}
        description={
          isArabic
            ? "ما يريد مدير المشتريات معرفته هو ما إذا كنا قد نفّذنا عملاً مشابهاً لعمله من قبل."
            : "What a procurement manager actually wants to know is whether we have done a job like theirs before."
        }
        action={anyDemo ? <DemoBadge label={dict.common.demoData} /> : undefined}
      />

      <ul className="grid gap-4 lg:grid-cols-3">
        {items.map((project) => (
          <li key={project.id}>
            <Card className="flex h-full flex-col">
              <CardBody className="flex flex-1 flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  {project.sector && <Badge tone="neutral">{project.sector}</Badge>}
                  {project.city && (
                    <span className="text-xs text-steel-500">{project.city}</span>
                  )}
                  {project.year && (
                    <span className="text-xs text-steel-500 numeric-latin">
                      {formatNumber(project.year, locale)}
                    </span>
                  )}
                </div>

                <h3 className="mt-2 text-base font-bold leading-snug text-steel-950">
                  {project.title}
                </h3>

                {project.clientName && (
                  <p className="mt-0.5 text-sm text-steel-600">{project.clientName}</p>
                )}

                {project.summary && (
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-steel-700">
                    {project.summary}
                  </p>
                )}

                {project.metrics.length > 0 && (
                  <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-steel-200 pt-3">
                    {project.metrics.map((metric) => (
                      <div key={metric.labelEn}>
                        <dt className="text-2xs uppercase tracking-wide text-steel-500">
                          {isArabic ? metric.labelAr : metric.labelEn}
                        </dt>
                        <dd className="text-sm font-semibold text-steel-950 numeric-latin">
                          {metric.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}

                {/* Internal links back into the catalog: a reader who sees a
                    job like theirs can go straight to that machine. */}
                {project.equipmentUsed.length > 0 && (
                  <p className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-xs text-steel-500">
                    {isArabic ? "المعدات:" : "Equipment:"}
                    {project.equipmentUsed.map((slug) => (
                      <Link
                        key={slug}
                        href={localePath(locale, `/equipment/item/${slug}`)}
                        className="underline underline-offset-2 hover:text-steel-800"
                      >
                        {slug.replace(/-/g, " ")}
                      </Link>
                    ))}
                  </p>
                )}
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>
    </Container>
  );
}

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

export function CredentialsSection({
  credentials: items,
  locale,
}: {
  credentials: Credential[];
  locale: Locale;
}) {
  const isArabic = locale === "ar";

  // Nothing verified yet, so nothing is claimed. Saying so is more credible to
  // a procurement audience than a row of unverifiable badges — they check.
  if (items.length === 0) {
    return (
      <Container className="pb-10 sm:pb-14">
        <Card className="border-dashed">
          <CardBody>
            <h2 className="text-sm font-semibold text-steel-950">
              {isArabic ? "الشهادات والاعتمادات" : "Certifications and accreditations"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-steel-600">
              {isArabic
                ? "لم تُضَف بعد أي شهادات إلى هذا الموقع. لا تُدرج هنا سوى الشهادات الحقيقية التي يمكن التحقق منها — لأن فرق المشتريات تتحقق فعلاً."
                : "No certifications have been added to this site yet. Only genuine, verifiable credentials are listed here — because procurement teams actually check."}
            </p>
          </CardBody>
        </Card>
      </Container>
    );
  }

  return (
    <Container className="pb-10 sm:pb-14">
      <SectionHeading
        title={isArabic ? "الشهادات والاعتمادات" : "Certifications and accreditations"}
        level={2}
      />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((credential) => (
          <li key={credential.id}>
            <Card className="h-full">
              <CardBody className="py-4">
                <p className="text-sm font-semibold text-steel-950">{credential.name}</p>
                {credential.issuer && (
                  <p className="mt-0.5 text-xs text-steel-600">{credential.issuer}</p>
                )}
                {credential.referenceNumber && (
                  <p className="mt-1 text-xs text-steel-500 numeric-latin">
                    {credential.referenceNumber}
                  </p>
                )}
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>
    </Container>
  );
}
