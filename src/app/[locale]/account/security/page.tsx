import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChangePassword } from "@/components/auth/change-password";
import { MfaSetup } from "@/components/auth/mfa-setup";
import { Card, CardBody, Container, SectionHeading } from "@/components/ui";
import { getFullActor } from "@/lib/auth/session";
import { getMfaStatus } from "@/lib/auth/mfa-actions";
import { getDictionary } from "@/lib/i18n";
import { formatDate, isLocale, localePath, type Locale } from "@/lib/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).account.security, robots: { index: false, follow: false } };
}

export default async function SecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDictionary(locale);
  const isArabic = locale === "ar";

  const actor = await getFullActor();
  if (!actor) {
    redirect(
      localePath(locale, `/login?next=${encodeURIComponent(`/${locale}/account/security`)}`),
    );
  }

  const mfa = await getMfaStatus();

  return (
    <Container className="py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <nav aria-label={dict.a11y.breadcrumb} className="mb-4 text-sm">
          <Link href={localePath(locale, "/account")} className="text-steel-600 hover:underline">
            ← {dict.account.title}
          </Link>
        </nav>

        <SectionHeading
          level={1}
          title={dict.account.security}
          description={
            isArabic
              ? "إدارة كيفية إثبات هويتك عند تسجيل الدخول."
              : "Manage how you prove who you are when you sign in."
          }
        />

        <MfaSetup
          locale={locale}
          dict={dict}
          enrolled={mfa.enrolled}
          recoveryCodesRemaining={mfa.recoveryCodesRemaining}
        />

        {mfa.enrolled && mfa.confirmedAt && (
          <p className="mt-3 text-xs text-steel-500">
            {isArabic ? "تم التفعيل في" : "Enabled on"}{" "}
            <span className="numeric-latin">{formatDate(mfa.confirmedAt, locale)}</span>
          </p>
        )}

        <div className="mt-6">
          <ChangePassword dict={dict} />
        </div>

        <Card className="mt-6">
          <CardBody>
            <h2 className="text-base font-bold text-steel-950">
              {isArabic ? "الحساب" : "Account"}
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-steel-600">{dict.auth.email}</dt>
                <dd className="font-medium text-steel-900">{actor.email}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-steel-600">{dict.auth.fullName}</dt>
                <dd className="font-medium text-steel-900">{actor.fullName}</dd>
              </div>
              {actor.isPlatformAdmin && (
                <div className="flex justify-between gap-4">
                  <dt className="text-steel-600">{dict.nav.admin}</dt>
                  <dd className="font-medium text-steel-900">
                    {isArabic ? "حساب إدارة المنصة" : "Platform administrator"}
                  </dd>
                </div>
              )}
            </dl>
          </CardBody>
        </Card>
      </div>
    </Container>
  );
}
