import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { Alert, Card, CardBody, Container } from "@/components/ui";
import { getActor } from "@/lib/auth/session";
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
    title: getDictionary(locale).auth.signIn,
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

  const actor = await getActor();
  if (actor) redirect(localePath(locale, "/account"));

  const next = typeof sp.next === "string" ? sp.next : undefined;
  const registered = sp.registered === "1";

  return (
    <Container className="py-10 sm:py-16">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-steel-950">{dict.auth.signIn}</h1>

        {registered && (
          <Alert tone="info" className="mb-4">
            {dict.auth.checkEmail}
          </Alert>
        )}

        <Card>
          <CardBody>
            <AuthForm mode="login" locale={locale} dict={dict} redirectTo={next} />
          </CardBody>
        </Card>

        <p className="mt-5 text-center text-sm text-steel-600">
          {dict.auth.noAccount}{" "}
          <Link href={localePath(locale, "/register")} className="font-medium text-steel-900 underline">
            {dict.auth.signUp}
          </Link>
        </p>
      </div>
    </Container>
  );
}
