import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BookingLookupForm } from "@/components/booking/lookup-form";
import { Card, CardBody, Container } from "@/components/ui";
import { getFullActor } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n";
import { isLocale, localePath, type Locale } from "@/lib/i18n/config";

/**
 * "Find my booking".
 *
 * The customer-facing counterpart to a sign-in page, for a site that has no
 * customer accounts. A contractor who booked a machine gets back to it with the
 * reference on their confirmation and the email they booked with.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: getDictionary(locale).booking.lookupTitle,
    description: getDictionary(locale).booking.lookupIntro,
    // Indexable: this is a genuine destination a customer may search for.
    // It exposes nothing on its own — the form is the gate.
  };
}

export default async function BookingLookupPage({
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

  // Someone who already holds a full account has a rentals list; send them
  // there rather than asking for a reference they should not need. A guest
  // whose scoped session is still alive is NOT one, and lands on the form.
  const actor = await getFullActor();
  if (actor) redirect(localePath(locale, "/account"));

  /**
   * A reference may be prefilled from the URL — the booking detail page sends
   * an expired guest here with `?ref=`. It is only a convenience: it prefills a
   * value the visitor already had, and the email is still required, so nothing
   * is disclosed by echoing it.
   */
  const rawRef = typeof sp.ref === "string" ? sp.ref : undefined;
  const defaultReference =
    rawRef && /^[A-Za-z0-9-]{1,32}$/.test(rawRef) ? rawRef.toUpperCase() : undefined;

  return (
    <Container className="py-10 sm:py-16">
      <div className="mx-auto max-w-md">
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-steel-950">
          {dict.booking.lookupTitle}
        </h1>
        <p className="mb-6 text-sm text-steel-600">{dict.booking.lookupIntro}</p>

        <Card>
          <CardBody>
            <BookingLookupForm locale={locale} dict={dict} defaultReference={defaultReference} />
          </CardBody>
        </Card>

        <p className="mt-5 text-center text-sm text-steel-600">
          {dict.booking.lookupNoReference}{" "}
          <Link href={localePath(locale, "/contact")} className="font-medium text-steel-900 underline">
            {dict.nav.contact}
          </Link>
        </p>
      </div>
    </Container>
  );
}
