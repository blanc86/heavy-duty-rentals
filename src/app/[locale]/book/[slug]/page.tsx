import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CheckoutForm, type CheckoutConfig } from "@/components/booking/checkout-form";
import { Container } from "@/components/ui";
import { getActor } from "@/lib/auth/session";
import { getClassBySlug, listBranches } from "@/lib/catalog/repository";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema/identity";
import { getDictionary } from "@/lib/i18n";
import { isLocale, localePath, toISODate, type Locale } from "@/lib/i18n/config";
import { uuidv7 } from "@/lib/ids";
import { getBusinessSettings } from "@/lib/settings";
import { inArray } from "drizzle-orm";

type SearchParams = Record<string, string | string[] | undefined>;

function one(sp: SearchParams, key: string): string | undefined {
  const value = sp[key];
  const single = Array.isArray(value) ? value[0] : value;
  return single?.trim() || undefined;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: getDictionary(locale).booking.title,
    // Checkout is not a landing page and must never be indexed.
    robots: { index: false, follow: false },
  };
}

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale: rawLocale, slug } = await params;
  const sp = await searchParams;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDictionary(locale);

  const item = await getClassBySlug(slug, locale);
  if (!item) notFound();

  // Instant checkout is only offered for classes we can price honestly.
  // Reaching this URL directly for a quote-only class sends the customer to
  // the quote flow rather than silently pricing a guess.
  if (!item.instantBookable) {
    redirect(localePath(locale, `/quote?class=${slug}`));
  }

  /**
   * Authentication is required HERE and not earlier.
   *
   * Search, filters, availability and the full price breakdown all work
   * anonymously. An account is asked for at the point where it is justified —
   * we are about to take money and create a contract.
   */
  const actor = await getActor();
  if (!actor) {
    const next = encodeURIComponent(
      `/${locale}/book/${slug}?${new URLSearchParams(
        Object.entries(sp).flatMap(([k, v]) =>
          v === undefined ? [] : [[k, Array.isArray(v) ? (v[0] ?? "") : v]],
        ),
      ).toString()}`,
    );
    redirect(localePath(locale, `/login?next=${next}`));
  }

  // Dates come from the URL so the configuration survives the login round-trip.
  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setDate(defaultStart.getDate() + 3);
  const defaultEnd = new Date(defaultStart);
  defaultEnd.setDate(defaultEnd.getDate() + Math.max(item.minRentalDays, 7));

  const startDate = one(sp, "start") ?? toISODate(defaultStart);
  const endDate = one(sp, "end") ?? toISODate(defaultEnd);

  const branches = await listBranches(locale);
  const branchParam = one(sp, "branch");
  const branchId = branches.find((b) => b.id === branchParam)?.id;

  const addonsParam = one(sp, "addons");
  const addons = addonsParam
    ? addonsParam
        .split(",")
        .map((entry) => {
          const [code, qty] = entry.split(":");
          return code ? { code, quantity: Math.max(1, Number.parseInt(qty ?? "1", 10) || 1) } : null;
        })
        .filter((a): a is { code: string; quantity: number } => a !== null)
        .slice(0, 10)
    : [];

  // Companies the actor is genuinely a member of. Read from the SESSION, so
  // the dropdown cannot be used to reach another tenant.
  const memberCompanyIds = actor.memberships.map((m) => m.companyId);
  const memberCompanies =
    memberCompanyIds.length > 0
      ? await db
          .select({ id: companies.id, nameEn: companies.nameEn, nameAr: companies.nameAr })
          .from(companies)
          .where(inArray(companies.id, memberCompanyIds))
      : [];

  const business = await getBusinessSettings();

  const config: CheckoutConfig = {
    classId: item.id,
    classSlug: item.slug,
    className: item.name,
    branchId,
    startDate,
    endDate,
    deliveryRequired: one(sp, "delivery") !== "0",
    deliveryDistanceKm: Math.min(3000, Math.max(0, Number.parseInt(one(sp, "km") ?? "40", 10) || 40)),
    addons,
    couponCode: one(sp, "coupon"),
  };

  return (
    <Container className="py-6 sm:py-10">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-steel-950 sm:text-3xl">
        {dict.booking.title}
      </h1>

      <CheckoutForm
        locale={locale}
        dict={dict}
        config={config}
        // Generated once per page render: a double-clicked submit reuses the
        // same key and returns the original booking instead of reserving a
        // second machine.
        idempotencyKey={uuidv7()}
        companies={memberCompanies.map((c) => ({
          id: c.id,
          name: (locale === "ar" ? c.nameAr : c.nameEn) ?? c.nameEn,
        }))}
        termsVersion={business.termsVersion}
        termsHref={localePath(locale, "/legal/rental-terms")}
      />
    </Container>
  );
}
