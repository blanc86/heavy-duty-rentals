"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createBookingAction } from "@/lib/booking/actions";
import { Alert, Button, Card, CardBody, FieldError, Hint, Input, Label, Textarea } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n";
import { formatNumber, localePath, type Locale } from "@/lib/i18n/config";
import { formatMoney, parseHalalas } from "@/lib/money";

/**
 * Checkout.
 *
 * Steps are progressive disclosure, not separate pages: a site engineer on a
 * phone should never lose entered data to a navigation, and a single form means
 * one submission and one idempotency key.
 *
 * The price shown here is fetched from the server and re-fetched whenever an
 * input that affects it changes. At submit, the server recomputes everything
 * again and rejects a mismatch — so this component never has to be trusted.
 */

interface PriceLine {
  kind: string;
  code: string;
  label: string;
  labelAr: string;
  total: string;
}

interface Quote {
  availableUnits: number;
  pricing: {
    currency: string;
    billableDays: number;
    chosenTier: string;
    lines: PriceLine[];
    taxableSubtotal: string;
    vatRatePpm: number;
    vat: string;
    deposit: string;
    /** Subtotal + VAT. What the card is charged; excludes the deposit. */
    chargedNow: string;
    /** Charge + deposit. Total exposure, never presented as "due now". */
    total: string;
  };
}

export interface CheckoutConfig {
  classId: string;
  classSlug: string;
  className: string;
  branchId?: string | undefined;
  startDate: string;
  endDate: string;
  deliveryRequired: boolean;
  deliveryDistanceKm: number;
  addons: { code: string; quantity: number }[];
  couponCode?: string | undefined;
}

export function CheckoutForm({
  locale,
  dict,
  config,
  idempotencyKey,
  companies,
  termsVersion,
  termsHref,
}: {
  locale: Locale;
  dict: Dictionary;
  config: CheckoutConfig;
  idempotencyKey: string;
  companies: { id: string; name: string }[];
  termsVersion: string;
  termsHref: string;
}) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [issues, setIssues] = useState<{ path: string; message: string }[]>([]);
  const [isPending, startTransition] = useTransition();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [companyId, setCompanyId] = useState<string>("");

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch("/api/pricing/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            classId: config.classId,
            branchId: config.branchId,
            startDate: config.startDate,
            endDate: config.endDate,
            quantity: 1,
            addons: config.addons,
            deliveryRequired: config.deliveryRequired,
            deliveryDistanceKm: config.deliveryRequired ? config.deliveryDistanceKm : undefined,
            couponCode: config.couponCode,
          }),
        });
        const data = await response.json();
        if (!response.ok || data.error) {
          setQuoteError(data.error?.message ?? dict.common.error);
          return;
        }
        setQuote(data);
        setQuoteError(null);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setQuoteError(dict.common.error);
      }
    })();
    return () => controller.abort();
  }, [config, dict]);

  const money = (value: string) => formatMoney(parseHalalas(value), locale, quote?.pricing.currency);
  const issueFor = (path: string) => issues.find((i) => i.path === path)?.message;

  const canSubmit = useMemo(
    () => Boolean(quote) && acceptedTerms && !isPending && (quote?.availableUnits ?? 0) > 0,
    [quote, acceptedTerms, isPending],
  );

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quote) return;

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      setSubmitError(null);
      setIssues([]);

      const result = await createBookingAction({
        classId: config.classId,
        branchId: config.branchId,
        startDate: config.startDate,
        endDate: config.endDate,
        quantity: 1,
        addons: config.addons,
        deliveryRequired: config.deliveryRequired,
        ...(config.deliveryRequired ? { deliveryDistanceKm: config.deliveryDistanceKm } : {}),
        ...(config.couponCode ? { couponCode: config.couponCode } : {}),

        siteCity: String(formData.get("siteCity") ?? ""),
        siteAddressLine: String(formData.get("siteAddressLine") ?? ""),
        siteContactName: String(formData.get("siteContactName") ?? ""),
        siteContactPhone: String(formData.get("siteContactPhone") ?? ""),
        ...(formData.get("siteAccessNotes")
          ? { siteAccessNotes: String(formData.get("siteAccessNotes")) }
          : {}),

        ...(companyId ? { companyId } : {}),
        ...(formData.get("poNumber") ? { poNumber: String(formData.get("poNumber")) } : {}),
        ...(formData.get("costCentre") ? { costCentre: String(formData.get("costCentre")) } : {}),
        ...(formData.get("projectCode") ? { projectCode: String(formData.get("projectCode")) } : {}),

        // What the customer was SHOWN. The server recomputes and compares.
        clientTotalHalalas: quote.pricing.total,

        acceptedTerms: true,
        locale,
        idempotencyKey,
      });

      if (result.ok) {
        window.location.href = result.redirectUrl;
        return;
      }

      setSubmitError(result.error.message);
      setIssues(result.error.issues ?? []);
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_22rem]" noValidate>
      <div className="space-y-6">
        {/* --- Step: site ------------------------------------------------- */}
        <Card>
          <CardBody>
            <h2 className="mb-4 text-lg font-bold text-steel-950">{dict.booking.siteDetails}</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <Label htmlFor="siteCity" required>
                  {dict.booking.siteCity}
                </Label>
                <Input id="siteCity" name="siteCity" required aria-invalid={Boolean(issueFor("siteCity"))} />
                <FieldError>{issueFor("siteCity")}</FieldError>
              </div>

              <div className="sm:col-span-1">
                <Label htmlFor="siteContactName" required>
                  {dict.booking.siteContact}
                </Label>
                <Input
                  id="siteContactName"
                  name="siteContactName"
                  autoComplete="name"
                  required
                  aria-invalid={Boolean(issueFor("siteContactName"))}
                />
                <FieldError>{issueFor("siteContactName")}</FieldError>
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="siteAddressLine" required>
                  {dict.booking.siteAddress}
                </Label>
                <Input
                  id="siteAddressLine"
                  name="siteAddressLine"
                  required
                  aria-invalid={Boolean(issueFor("siteAddressLine"))}
                />
                <FieldError>{issueFor("siteAddressLine")}</FieldError>
              </div>

              <div className="sm:col-span-1">
                <Label htmlFor="siteContactPhone" required>
                  {dict.booking.siteContactPhone}
                </Label>
                <Input
                  id="siteContactPhone"
                  name="siteContactPhone"
                  type="tel"
                  dir="ltr"
                  required
                  aria-invalid={Boolean(issueFor("siteContactPhone"))}
                />
                <FieldError>{issueFor("siteContactPhone")}</FieldError>
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="siteAccessNotes">{dict.booking.siteAccessNotes}</Label>
                <Textarea id="siteAccessNotes" name="siteAccessNotes" rows={3} />
                <Hint>{dict.booking.siteAccessNotesHelp}</Hint>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* --- Step: procurement artefacts --------------------------------
            Without a PO number, a cost centre and a VAT invoice, a procurement
            manager cannot commit company money — and the deal moves offline no
            matter how good the rest of the funnel is.
        ------------------------------------------------------------------ */}
        {companies.length > 0 && (
          <Card>
            <CardBody>
              <h2 className="mb-4 text-lg font-bold text-steel-950">{dict.booking.yourDetails}</h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="companyId">{dict.booking.accountType}</Label>
                  <select
                    id="companyId"
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    className="min-h-[2.75rem] w-full rounded-[--radius-control] border border-steel-300 bg-white px-3 py-2 text-sm focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/20"
                  >
                    <option value="">{dict.booking.individual}</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>

                {companyId && (
                  <>
                    <div>
                      <Label htmlFor="poNumber">{dict.booking.poNumber}</Label>
                      <Input id="poNumber" name="poNumber" dir="ltr" />
                    </div>
                    <div>
                      <Label htmlFor="costCentre">{dict.booking.costCentre}</Label>
                      <Input id="costCentre" name="costCentre" dir="ltr" />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="projectCode">{dict.booking.projectCode}</Label>
                      <Input id="projectCode" name="projectCode" dir="ltr" />
                    </div>
                  </>
                )}
              </div>
            </CardBody>
          </Card>
        )}

        {/* --- Step: terms ------------------------------------------------ */}
        <Card>
          <CardBody>
            <h2 className="mb-2 text-lg font-bold text-steel-950">{dict.booking.termsTitle}</h2>
            <p className="mb-4 text-sm text-steel-600">{dict.booking.termsIntro}</p>

            <label className="flex items-start gap-3 rounded-[--radius-control] border border-steel-200 p-3 text-sm text-steel-800">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-steel-300 text-amber-600 focus:ring-amber-600/30"
                required
              />
              <span>
                {dict.booking.termsAccept}{" "}
                <Link href={termsHref} target="_blank" className="font-medium underline">
                  ({dict.footer.rentalTerms} v<span className="numeric-latin">{termsVersion}</span>)
                </Link>
              </span>
            </label>
          </CardBody>
        </Card>
      </div>

      {/* --- Summary + submit. Sticky on desktop, and the submit button is
              inside the summary so price and action are never separated. --- */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardBody>
            <h2 className="mb-1 text-base font-bold text-steel-950">{dict.booking.reviewTitle}</h2>
            <p className="mb-4 text-sm text-steel-600">{config.className}</p>

            {quoteError && <Alert tone="danger">{quoteError}</Alert>}

            {quote && (
              <>
                <dl className="space-y-1.5 text-sm">
                  {quote.pricing.lines
                    .filter((line) => line.kind !== "deposit")
                    .map((line) => (
                      <div key={`${line.kind}-${line.code}`} className="flex justify-between gap-3">
                        <dt className="text-steel-600">
                          {locale === "ar" ? line.labelAr : line.label}
                        </dt>
                        <dd className="shrink-0 font-medium text-steel-900 numeric-latin">
                          {money(line.total)}
                        </dd>
                      </div>
                    ))}

                  <div className="flex justify-between gap-3 border-t border-steel-200 pt-1.5">
                    <dt className="text-steel-600">{dict.booking.subtotal}</dt>
                    <dd className="shrink-0 font-medium text-steel-900 numeric-latin">
                      {money(quote.pricing.taxableSubtotal)}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-3">
                    <dt className="text-steel-600">
                      {dict.booking.vat.replace(
                        "{rate}",
                        formatNumber(quote.pricing.vatRatePpm / 10000, locale),
                      )}
                    </dt>
                    <dd className="shrink-0 font-medium text-steel-900 numeric-latin">
                      {money(quote.pricing.vat)}
                    </dd>
                  </div>

                  {/* The charge, on its own. The deposit is deliberately BELOW
                      this line: it is not taken today, and rolling it into the
                      headline figure would overstate what the card is billed
                      and disagree with the tax invoice. */}
                  <div className="flex justify-between gap-3 border-t-2 border-steel-300 pt-2">
                    <dt className="font-bold text-steel-950">{dict.booking.chargedNow}</dt>
                    <dd className="shrink-0 text-lg font-bold text-steel-950 numeric-latin">
                      {money(quote.pricing.chargedNow)}
                    </dd>
                  </div>

                  {quote.pricing.deposit !== "0" && (
                    <>
                      <div className="flex justify-between gap-3 border-t border-dashed border-steel-300 pt-1.5">
                        <dt className="text-steel-600">
                          {dict.booking.depositLine}
                          <span className="block text-xs text-steel-500">
                            {dict.booking.depositTiming}
                          </span>
                        </dt>
                        <dd className="shrink-0 font-medium text-steel-900 numeric-latin">
                          {money(quote.pricing.deposit)}
                        </dd>
                      </div>

                      <div className="flex justify-between gap-3 pt-1.5 text-sm">
                        <dt className="text-steel-600">{dict.booking.totalCommitment}</dt>
                        <dd className="shrink-0 font-medium text-steel-900 numeric-latin">
                          {money(quote.pricing.total)}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>

                {quote.availableUnits === 0 && (
                  <Alert tone="danger" className="mt-4">
                    {dict.booking.unitTaken}
                  </Alert>
                )}
              </>
            )}

            {submitError && (
              <Alert tone="danger" className="mt-4">
                {submitError}
              </Alert>
            )}

            <Button type="submit" size="lg" className="mt-5 w-full" disabled={!canSubmit}>
              {isPending ? dict.common.loading : dict.booking.payNow}
            </Button>

            {!acceptedTerms && (
              <p className="mt-2 text-center text-xs text-steel-500">{dict.booking.termsRequired}</p>
            )}

            <p className="mt-3 text-center text-xs text-steel-500">{dict.booking.paymentSecure}</p>

            <p className="mt-3 text-center text-xs text-steel-500">
              <Link href={localePath(locale, `/equipment/item/${config.classSlug}`)} className="underline">
                {dict.common.back}
              </Link>
            </p>
          </CardBody>
        </Card>
      </aside>
    </form>
  );
}
