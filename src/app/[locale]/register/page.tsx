import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { Card, CardBody, Container } from "@/components/ui";
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
  return { title: getDictionary(locale).auth.signUp, robots: { index: false, follow: false } };
}

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDictionary(locale);

  const actor = await getActor();
  if (actor) redirect(localePath(locale, "/account"));

  return (
    <Container className="py-10 sm:py-16">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-steel-950">{dict.auth.signUp}</h1>

        <Card>
          <CardBody>
            <AuthForm mode="register" locale={locale} dict={dict} />
          </CardBody>
        </Card>

        <p className="mt-5 text-center text-sm text-steel-600">
          {dict.auth.haveAccount}{" "}
          <Link href={localePath(locale, "/login")} className="font-medium text-steel-900 underline">
            {dict.auth.signIn}
          </Link>
        </p>
      </div>
    </Container>
  );
}
