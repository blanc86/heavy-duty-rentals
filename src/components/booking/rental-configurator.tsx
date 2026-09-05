"use client";

import { useEffect, useId, useMemo, useState, useTransition } from "react";
import type { Dictionary } from "@/lib/i18n";
import { formatNumber, localePath, toISODate, type Locale } from "@/lib/i18n/config";
import { formatMoney, parseHalalas } from "@/lib/money";

/**
 * The rental configurator.
 *
 * The one genuinely interactive surface on an equipment page: it re-prices as
 * the customer changes dates, add-ons and transport.
 *
 * Every price on screen comes from the SERVER. This component holds no rates
 * and performs no arithmetic on money — it renders what the pricing endpoint
 * returned. That is what makes browser-side price tampering pointless: there
 * is nothing here to tamper with, and the server recomputes at commit anyway.
 */

interface PriceLine {
  kind: string;
  code: string;
  label: string;
  labelAr: string;
  quantity: number;
  total: string;
  isTaxable: boolean;
}

interface QuoteResponse {
  availableUnits: number;
  instantBookable: boolean;
  minRentalDays: number;
  pricing: {
    currency: string;
    billableDays: number;
    chargedDays: number;
    chosenTier: string;
    cheaperIfExtended: {
      tier: string;
      extendToDays: number;
      total: string;
      saving: string;
    } | null;
    lines: PriceLine[];
    taxableSubtotal: string;
    discount: string;
    vatRatePpm: number;
    vat: string;
    deposit: string;
    chargedNow: string;
    total: string;
  };
}

export interface AddonOption {
  code: string;
  name: string;
  description: string | null;
  pricingModel: "per_day" | "flat" | "per_unit_per_day";
  maxQuantity: number;
}

export function RentalConfigurator({
  locale,
  dict,
  classId,
  classSlug,
  instantBookable,
  minRentalDays,
  branches,
  addons,
  initialStart,
  initialEnd,
}: {
  locale: Locale;
  dict: Dictionary;
  classId: string;
  classSlug: string;
  instantBookable: boolean;
  minRentalDays: number;
  branches: { id: string; slug: string; city: string }[];
  addons: AddonOption[];
  initialStart?: string | undefined;
  initialEnd?: string | undefined;
}) {
  const idPrefix = useId();

  const defaults = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() + 3);
    const end = new Date(start);
    end.setDate(end.getDate() + Math.max(minRentalDays, 7));
    return { start: toISODate(start), end: toISODate(end) };
  }, [minRentalDays]);

  const [startDate, setStartDate] = useState(initialStart ?? defaults.start);
  const [endDate, setEndDate] = useState(initialEnd ?? defaults.end);
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [deliveryRequired, setDeliveryRequired] = useState(true);
  const [distanceKm, setDistanceKm] = useState(40);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({});
  const [couponCode, setCouponCode] = useState("");

  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!startDate || !endDate || endDate <= startDate) {
      setError(dict.booking.datesUnavailable);
      setQuote(null);
      return;
    }

    const controller = new AbortController();
    // Debounced: a customer dragging a number input should not fire a request
    // per keystroke.
    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          const response = await fetch("/api/pricing/quote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              classId,
              branchId: branchId || undefined,
              startDate,
              endDate,
              quantity: 1,
              addons: Object.entries(selectedAddons)
                .filter(([, qty]) => qty > 0)
                .map(([code, quantity]) => ({ code, quantity })),
              deliveryRequired,
              deliveryDistanceKm: deliveryRequired ? distanceKm : undefined,
              couponCode: couponCode.trim() || undefined,
            }),
          });

          const data = await response.json();
          if (!response.ok || data.error) {
            setError(data.error?.message ?? dict.common.error);
            setQuote(null);
            return;
          }
          setError(null);
          setQuote(data);
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") return;
          setError(dict.common.error);
          setQuote(null);
        }
      });
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    classId, startDate, endDate, branchId, deliveryRequired, distanceKm,
    selectedAddons, couponCode, dict,
  ]);

  const bookingHref = useMemo(() => {
    const params = new URLSearchParams({ start: startDate, end: endDate });
    if (branchId) params.set("branch", branchId);
    params.set("delivery", deliveryRequired ? "1" : "0");
    if (deliveryRequired) params.set("km", String(distanceKm));
    const addonParam = Object.entries(selectedAddons)
      .filter(([, qty]) => qty > 0)
      .map(([code, qty]) => `${code}:${qty}`)
      .join(",");
    if (addonParam) params.set("addons", addonParam);
    if (couponCode.trim()) params.set("coupon", couponCode.trim());
    return `${localePath(locale, `/book/${classSlug}`)}?${params.toString()}`;
  }, [locale, classSlug, startDate, endDate, branchId, deliveryRequired, distanceKm, selectedAddons, couponCode]);

  const money = (value: string) => formatMoney(parseHalalas(value), locale, quote?.pricing.currency);
  const available = quote ? quote.availableUnits > 0 : false;

  return (
    <div className="rounded-[--radius-card] border border-steel-200 bg-white shadow-[--shadow-card]">
      <div className="border-b border-steel-200 px-4 py-3 sm:px-5">
        <h2 className="text-base font-bold text-steel-950">
          {instantBookable ? dict.equipment.getInstantPrice : dict.equipment.requestQuote}
        </h2>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {/* --- Dates --- */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor={`${idPrefix}-start`}
              className="mb-1.5 block text-sm font-medium text-steel-800"
            >
              {dict.booking.startDate}
            </label>
            <input
              id={`${idPrefix}-start`}
              type="date"
              value={startDate}
              min={toISODate(new Date())}
              onChange={(e) => setStartDate(e.target.value)}
              className="numeric-latin min-h-[2.75rem] w-full rounded-[--radius-control] border border-steel-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/20"
            />
          </div>
          <div>
            <label
              htmlFor={`${idPrefix}-end`}
              className="mb-1.5 block text-sm font-medium text-steel-800"
            >
              {dict.booking.endDate}
            </label>
            <input
              id={`${idPrefix}-end`}
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="numeric-latin min-h-[2.75rem] w-full rounded-[--radius-control] border border-steel-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/20"
            />
          </div>
        </div>

        {/* --- Availability. The conversion event. --- */}
        <div
          // aria-live so a screen-reader user hears availability change without
          // having to hunt for it after every date edit.
          aria-live="polite"
          className={`rounded-[--radius-control] border px-3 py-2.5 text-sm font-medium ${
            isPending
              ? "border-steel-200 bg-steel-50 text-steel-600"
              : available
                ? "border-[--color-available]/25 bg-[--color-available-bg] text-[--color-available]"
                : "border-[--color-danger]/25 bg-[--color-danger-bg] text-[--color-danger]"
          }`}
        >
          {isPending
            ? dict.common.loading
            : quote
              ? available
                ? quote.availableUnits === 1
                  ? dict.equipment.oneUnitAvailable
                  : dict.equipment.unitsAvailable.replace(
                      "{count}",
                      formatNumber(quote.availableUnits, locale),
                    )
                : dict.equipment.noUnitsAvailable
              : (error ?? dict.common.loading)}
        </div>

        {/* --- Branch --- */}
        {branches.length > 0 && (
          <div>
            <label
              htmlFor={`${idPrefix}-branch`}
              className="mb-1.5 block text-sm font-medium text-steel-800"
            >
              {dict.filters.location}
            </label>
            <select
              id={`${idPrefix}-branch`}
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="min-h-[2.75rem] w-full rounded-[--radius-control] border border-steel-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/20"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.city}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* --- Transport --- */}
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-steel-800">
            {dict.booking.delivery}
          </legend>
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 text-sm text-steel-700">
              <input
                type="radio"
                name={`${idPrefix}-delivery`}
                checked={deliveryRequired}
                onChange={() => setDeliveryRequired(true)}
                className="h-4 w-4 text-amber-600 focus:ring-amber-600/30"
              />
              {dict.booking.deliveryRequired}
            </label>
            <label className="flex items-center gap-2.5 text-sm text-steel-700">
              <input
                type="radio"
                name={`${idPrefix}-delivery`}
                checked={!deliveryRequired}
                onChange={() => setDeliveryRequired(false)}
                className="h-4 w-4 text-amber-600 focus:ring-amber-600/30"
              />
              {dict.booking.selfCollect}
            </label>
          </div>

          {deliveryRequired && (
            <div className="mt-3">
              <label
                htmlFor={`${idPrefix}-km`}
                className="mb-1.5 block text-sm text-steel-700"
              >
                {dict.booking.deliveryDistance}:{" "}
                <span className="font-semibold numeric-latin">
                  {formatNumber(distanceKm, locale)} km
                </span>
              </label>
              <input
                id={`${idPrefix}-km`}
                type="range"
                min={5}
                max={900}
                step={5}
                value={distanceKm}
                onChange={(e) => setDistanceKm(Number(e.target.value))}
                className="w-full accent-amber-600"
              />
            </div>
          )}
        </fieldset>

        {/* --- Add-ons --- */}
        {addons.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-steel-800">
              {dict.booking.addons}
            </legend>
            <div className="space-y-2">
              {addons.map((addon) => {
                const selected = (selectedAddons[addon.code] ?? 0) > 0;
                return (
                  <label
                    key={addon.code}
                    className="flex items-start gap-2.5 rounded-[--radius-control] border border-steel-200 p-2.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(e) =>
                        setSelectedAddons((prev) => ({
                          ...prev,
                          [addon.code]: e.target.checked ? 1 : 0,
                        }))
                      }
                      className="mt-0.5 h-4 w-4 rounded border-steel-300 text-amber-600 focus:ring-amber-600/30"
                    />
                    <span>
                      <span className="block font-medium text-steel-900">{addon.name}</span>
                      {addon.description && (
                        <span className="block text-xs text-steel-500">{addon.description}</span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {/* --- Price breakdown -------------------------------------------
            Every line itemised BEFORE payment. Saudi e-commerce rules require
            the total including VAT and delivery to be shown with no surprises
            at checkout, and it is also the single biggest trust lever in a
            market where nobody publishes a price at all.
        ------------------------------------------------------------------ */}
        {quote && (
          <div className="rounded-[--radius-control] border border-steel-200 bg-steel-50 p-3">
            <h3 className="mb-2 text-sm font-semibold text-steel-900">
              {dict.booking.priceBreakdown}
            </h3>
            <dl className="space-y-1.5 text-sm">
              {quote.pricing.lines
                .filter((line) => line.kind !== "deposit")
                .map((line) => (
                  <div key={`${line.kind}-${line.code}`} className="flex justify-between gap-3">
                    <dt className="text-steel-600">{locale === "ar" ? line.labelAr : line.label}</dt>
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

              {/* The charge, alone. The deposit follows BELOW it because it is
                  NOT a charge — it is refundable, carries no VAT, and is not
                  taken today. Conflating the two is the thing that makes
                  buyers distrust a total. */}
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
          </div>
        )}

        {/*
          Told, not hidden.

          When a slightly longer hire would cost LESS, the customer hears about
          it — with a one-tap way to take it. Collecting the higher figure today
          and letting procurement discover it later is how a supplier loses an
          account permanently.
        */}
        {quote?.pricing.cheaperIfExtended && (
          <div className="rounded-[--radius-control] border border-[--color-info]/25 bg-[--color-info-bg] p-3 text-sm">
            <p className="font-medium text-steel-900">
              {locale === "ar"
                ? `تمديد الإيجار إلى ${formatNumber(quote.pricing.cheaperIfExtended.extendToDays, locale)} يوماً يوفّر ${money(quote.pricing.cheaperIfExtended.saving)}`
                : `Extending to ${formatNumber(quote.pricing.cheaperIfExtended.extendToDays, locale)} days would save ${money(quote.pricing.cheaperIfExtended.saving)}`}
            </p>
            <p className="mt-0.5 text-xs text-steel-600">
              {locale === "ar"
                ? "لأن المدة الأطول تصل إلى شريحة سعرية أرخص."
                : "The longer duration reaches a cheaper rate tier."}
            </p>
            <button
              type="button"
              onClick={() => {
                const extended = new Date(`${startDate}T00:00:00.000Z`);
                extended.setUTCDate(
                  extended.getUTCDate() + quote.pricing.cheaperIfExtended!.extendToDays,
                );
                setEndDate(toISODate(extended));
              }}
              className="mt-2 min-h-[2.25rem] rounded-[--radius-control] border border-steel-300 bg-white px-3 text-sm font-medium text-steel-800 hover:bg-steel-50"
            >
              {locale === "ar" ? "تطبيق المدة الأطول" : "Use the longer duration"}
            </button>
          </div>
        )}

        {error && !quote && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        {/* --- Coupon --- */}
        <div>
          <label
            htmlFor={`${idPrefix}-coupon`}
            className="mb-1.5 block text-sm font-medium text-steel-800"
          >
            {locale === "ar" ? "رمز الخصم" : "Promotion code"}{" "}
            <span className="font-normal text-steel-500">({dict.common.optional})</span>
          </label>
          <input
            id={`${idPrefix}-coupon`}
            type="text"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            autoComplete="off"
            className="min-h-[2.75rem] w-full rounded-[--radius-control] border border-steel-300 px-3 py-2 text-sm uppercase focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/20"
          />
        </div>

        {/* --- CTA --- */}
        {instantBookable ? (
          <a
            href={available ? bookingHref : undefined}
            aria-disabled={!available}
            className={`inline-flex min-h-[3rem] w-full items-center justify-center rounded-[--radius-control] px-6 text-base font-semibold transition-colors ${
              available
                ? "bg-amber-500 text-steel-950 hover:bg-amber-400"
                : "cursor-not-allowed bg-steel-200 text-steel-500"
            }`}
          >
            {available ? dict.equipment.bookNow : dict.equipment.unavailable}
          </a>
        ) : (
          <a
            href={`${localePath(locale, "/quote")}?class=${classSlug}&start=${startDate}&end=${endDate}`}
            className="inline-flex min-h-[3rem] w-full items-center justify-center rounded-[--radius-control] bg-steel-900 px-6 text-base font-semibold text-white transition-colors hover:bg-steel-800"
          >
            {dict.equipment.requestQuote}
          </a>
        )}

        <p className="text-center text-xs text-steel-500">{dict.booking.paymentSecure}</p>
      </div>
    </div>
  );
}
