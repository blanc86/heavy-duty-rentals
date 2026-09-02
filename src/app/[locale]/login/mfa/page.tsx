import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { MfaChallenge } from "@/components/auth/mfa-challenge";
import { Card, CardBody, Container } from "@/components/ui";
import { getActor, getPendingMfaSession } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n";
import { isLocale, localePath, type Locale } from "@/lib/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).auth.mfaTitle, robots: { index: false, follow: false } };
}

/**
 * The second-factor challenge.
 *
 * Reached after a correct password when the account has MFA enrolled. The
 * session cookie exists at this point but grants nothing — `getActor` returns
 * null until the challenge passes — so this page is the only thing that
 * session can currently do.
 */
export default async function MfaChallengePage({
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

  // Already fully authenticated — nothing to challenge.
  const actor = await getActor();
  if (actor) redirect(localePath(locale, "/account"));

  const pending = await getPendingMfaSession();
  // No half-authenticated session: they have not passed the password stage.
  if (!pending) redirect(localePath(locale, "/login"));

  const nextRaw = typeof sp.next === "string" ? sp.next : undefined;
  // Re-validated here as well as at issue time: this value reaches a redirect.
  const next =
    nextRaw && /^\/[a-z]{2}(\/|$)/.test(nextRaw) && !nextRaw.startsWith("//") ? nextRaw : undefined;

  return (
    <Container className="py-10 sm:py-16">
      <div className="mx-auto max-w-md">
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-steel-950">
          {dict.auth.mfaTitle}
        </h1>
        <p className="mb-6 text-sm text-steel-600">
          {locale === "ar"
            ? `تسجيل الدخول باسم ${pending.email}`
            : `Signing in as ${pending.email}`}
        </p>

        <Card>
          <CardBody>
            <MfaChallenge locale={locale} dict={dict} next={next} />
          </CardBody>
        </Card>
      </div>
    </Container>
  );
}
