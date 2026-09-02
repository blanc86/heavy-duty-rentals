import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardBody, Container, SectionHeading } from "@/components/ui";
import { listBranches } from "@/lib/catalog/repository";
import { getDictionary } from "@/lib/i18n";
import { isLocale, localePath, type Locale } from "@/lib/i18n/config";
import { getBusinessSettings } from "@/lib/settings";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: getDictionary(locale).nav.contact,
    alternates: {
      canonical: `/${locale}/contact`,
      languages: { en: "/en/contact", ar: "/ar/contact", "x-default": "/en/contact" },
    },
  };
}

/**
 * Contact.
 *
 * Deliberately leads with self-service and the direct depot numbers rather than
 * a generic form. A contact form that silently queues an email is worse than a
 * phone number for someone with a machine down on a live site — and for
 * everything else, the booking flow is faster than waiting for a reply.
 */
export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDictionary(locale);
  const isArabic = locale === "ar";

  const [business, branches] = await Promise.all([getBusinessSettings(), listBranches(locale)]);

  return (
    <Container className="py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <SectionHeading
          level={1}
          title={dict.nav.contact}
          description={
            isArabic
              ? "معظم ما تحتاجه أسرع عبر الموقع — التوفر والسعر والحجز. وإذا احتجت إلى شخص، فهذه أرقامنا."
              : "Most of what you need is faster on the site — availability, price, booking. If you need a person, here is how to reach one."
          }
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardBody>
              <h2 className="text-base font-bold text-steel-950">
                {isArabic ? "الاستفسارات العامة" : "General enquiries"}
              </h2>
              <p className="mt-2 text-sm">
                <a
                  href={`tel:${business.phone.replace(/\s/g, "")}`}
                  className="font-medium text-steel-900 underline underline-offset-2 numeric-latin"
                >
                  {business.phone}
                </a>
              </p>
              <p className="mt-1 text-sm">
                <a
                  href={`mailto:${business.email}`}
                  className="font-medium text-steel-900 underline underline-offset-2"
                >
                  {business.email}
                </a>
              </p>
            </CardBody>
          </Card>

          <Card className="border-[--color-danger]/30">
            <CardBody>
              <h2 className="text-base font-bold text-steel-950">
                {isArabic ? "طوارئ المعدات" : "Equipment emergency"}
              </h2>
              <p className="mt-1 text-sm text-steel-600">
                {isArabic
                  ? "معدة متوقفة في موقع نشط."
                  : "A machine down on a live site."}
              </p>
              <p className="mt-2 text-sm">
                <a
                  href={`tel:${business.emergencyPhone.replace(/\s/g, "")}`}
                  className="font-medium text-steel-900 underline underline-offset-2 numeric-latin"
                >
                  {business.emergencyPhone}
                </a>
              </p>
            </CardBody>
          </Card>
        </div>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold text-steel-950">{dict.nav.locations}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {branches.map((branch) => (
              <li key={branch.slug}>
                <Card>
                  <CardBody className="py-4">
                    <h3 className="font-semibold text-steel-950">
                      <Link
                        href={localePath(locale, `/locations/${branch.slug}`)}
                        className="hover:underline"
                      >
                        {branch.city}
                      </Link>
                    </h3>
                    <address className="mt-1 text-sm not-italic text-steel-600">
                      {branch.address}
                    </address>
                    {branch.phone && (
                      <p className="mt-1.5 text-sm">
                        <a
                          href={`tel:${branch.phone.replace(/\s/g, "")}`}
                          className="text-steel-800 underline underline-offset-2 numeric-latin"
                        >
                          {branch.phone}
                        </a>
                      </p>
                    )}
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8 rounded-[--radius-card] border border-steel-200 bg-white p-5">
          <h2 className="text-base font-bold text-steel-950">
            {isArabic ? "لديك حجز قائم؟" : "Already have a booking?"}
          </h2>
          <p className="mt-1.5 text-sm text-steel-700">
            {isArabic
              ? "افتح الحجز من حسابك للاطلاع على المعدة والتواريخ والمستندات وحالة الدفع — دون الحاجة لشرح كل شيء من جديد."
              : "Open it from your account to see the machine, dates, documents and payment status — so you never have to explain it from scratch."}
          </p>
          <Link
            href={localePath(locale, "/account")}
            className="mt-4 inline-flex min-h-[2.75rem] items-center rounded-[--radius-control] border border-steel-300 px-4 text-sm font-semibold text-steel-800 hover:bg-steel-100"
          >
            {dict.account.title}
          </Link>
        </section>
      </div>
    </Container>
  );
}
