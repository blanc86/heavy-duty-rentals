import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { Alert, Card, CardBody, Container } from "@/components/ui";
import { getFullActor } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n";
import { isLocale, localePath, type Locale } from "@/lib/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: getDictionary(locale).auth.staffSignIn,
    // An authentication page has no business in a search index.
    robots: { index: false, follow: false },
  };
}

export default async function LoginPage({
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

  const actor = await getFullActor();
  if (actor) redirect(localePath(locale, "/account"));

  const next = typeof sp.next === "string" ? sp.next : undefined;

  return (
    <Container className="py-10 sm:py-16">
      <div className="mx-auto max-w-md">
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-steel-950">
          {dict.auth.staffSignIn}
        </h1>
        <p className="mb-6 text-sm text-steel-600">{dict.auth.staffSignInIntro}</p>

        <Card>
          <CardBody>
            <AuthForm locale={locale} dict={dict} redirectTo={next} />
          </CardBody>
        </Card>

        {/* The likeliest wrong turn: a customer looking for their rental. Say
            so plainly rather than leaving them hunting for a password they
            were never given. */}
        <Alert tone="info" className="mt-5">
          {dict.auth.customersNoAccount}{" "}
          <Link href={localePath(locale, "/booking")} className="font-medium text-steel-900 underline">
            {dict.booking.lookupTitle}
          </Link>
        </Alert>
      </div>
    </Container>
  );
}
