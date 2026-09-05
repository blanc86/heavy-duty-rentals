import type { Metadata } from "next";
import { cspNonce } from "@/lib/seo/nonce";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Container, SectionHeading } from "@/components/ui";
import { db } from "@/lib/db";
import { faqs } from "@/lib/db/schema/platform";
import { getDictionary } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    title: dict.nav.faq,
    description:
      locale === "ar"
        ? "إجابات على الأسئلة الشائعة حول تأجير المعدات الثقيلة: ما يشمله السعر، والتوصيل، والتأمين، والحجز المسبق."
        : "Answers to the questions that decide a rental: what is included, delivery, deposits and how far ahead to book.",
    alternates: {
      canonical: `/${locale}/faq`,
      languages: { en: "/en/faq", ar: "/ar/faq", "x-default": "/en/faq" },
    },
  };
}

/**
 * FAQ.
 *
 * Answers the questions that genuinely gate a booking — wet vs dry, what
 * transport costs, why some machines are quote-only. Emitted as FAQPage
 * structured data because the answers are real answers, not keyword filler.
 */
export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDictionary(locale);

  const published = await db
    .select({
      id: faqs.id,
      question: locale === "ar" ? faqs.questionAr : faqs.questionEn,
      answer: locale === "ar" ? faqs.answerAr : faqs.answerEn,
      sortOrder: faqs.sortOrder,
    })
    .from(faqs)
    .where(eq(faqs.isPublished, true))
    .orderBy(faqs.sortOrder);

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
            [
              faqJsonLd(published.map((f) => ({ question: f.question, answer: f.answer }))),
              breadcrumbJsonLd([
                { name: dict.nav.home, path: `/${locale}` },
                { name: dict.nav.faq, path: `/${locale}/faq` },
              ]),
            ].filter(Boolean),
          ),
        }}
      />

      <Container className="py-8 sm:py-12">
        <div className="mx-auto max-w-3xl">
          <SectionHeading level={1} title={dict.nav.faq} />

          <dl className="divide-y divide-steel-200 border-y border-steel-200">
            {published.map((faq) => (
              <div key={faq.id} className="py-5">
                <dt className="text-base font-semibold text-steel-950">{faq.question}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-steel-700">{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Container>
    </>
  );
}
