"use client";

import { useState, useTransition } from "react";
import { submitQuoteRequest, type QuoteActionResult } from "@/lib/quotes/actions";
import {
  Alert,
  Button,
  FieldError,
  Hint,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

/**
 * Quote request form.
 *
 * Asks for the numbers that actually determine a price — load weight, radius,
 * lift height, dates, site — so operations can reply with a quote instead of a
 * request for more information. That turnaround is the entire justification for
 * routing a class here rather than pricing it instantly.
 *
 * The lift-detail fields are optional: a customer who does not yet know the
 * radius has a legitimate reason to be asking for help, and refusing their
 * enquiry would defeat the purpose.
 */
export function QuoteRequestForm({
  locale,
  dict,
  branches,
  classes,
  preselectedClassId,
  defaultName,
  defaultEmail,
  startDate,
  endDate,
}: {
  locale: Locale;
  dict: Dictionary;
  branches: { id: string; city: string }[];
  classes: { id: string; name: string; slug: string }[];
  preselectedClassId?: string | undefined;
  defaultName?: string | undefined;
  defaultEmail?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
}) {
  const isArabic = locale === "ar";
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<QuoteActionResult | null>(null);

  const issues = result && !result.ok ? (result.error.issues ?? []) : [];
  const issueFor = (path: string) => issues.find((i) => i.path === path)?.message;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const numeric = (key: string) => {
      const raw = form.get(key);
      if (!raw || String(raw).trim() === "") return undefined;
      const value = Number(raw);
      return Number.isFinite(value) ? value : undefined;
    };
    const text = (key: string) => {
      const raw = form.get(key);
      const value = raw ? String(raw).trim() : "";
      return value.length > 0 ? value : undefined;
    };

    startTransition(async () => {
      const response = await submitQuoteRequest({
        contactName: String(form.get("contactName") ?? ""),
        contactEmail: String(form.get("contactEmail") ?? ""),
        contactPhone: String(form.get("contactPhone") ?? ""),
        ...(text("companyNameRaw") ? { companyNameRaw: text("companyNameRaw") } : {}),
        ...(text("classId") ? { classId: text("classId") } : {}),
        ...(text("descriptionRaw") ? { descriptionRaw: text("descriptionRaw") } : {}),
        quantity: numeric("quantity") ?? 1,
        ...(text("branchId") ? { branchId: text("branchId") } : {}),
        ...(text("siteCity") ? { siteCity: text("siteCity") } : {}),
        ...(text("siteAddressLine") ? { siteAddressLine: text("siteAddressLine") } : {}),
        ...(text("startDate") ? { startDate: text("startDate") } : {}),
        ...(text("endDate") ? { endDate: text("endDate") } : {}),
        ...(text("requirements") ? { requirements: text("requirements") } : {}),
        ...(numeric("loadWeightKg") !== undefined ? { loadWeightKg: numeric("loadWeightKg") } : {}),
        ...(numeric("radiusM") !== undefined ? { radiusM: numeric("radiusM") } : {}),
        ...(numeric("liftHeightM") !== undefined ? { liftHeightM: numeric("liftHeightM") } : {}),
        locale,
      });
      setResult(response);
      if (response.ok) event.currentTarget?.reset?.();
    });
  }

  if (result?.ok) {
    return (
      <Alert tone="available" title={isArabic ? "تم استلام طلبك" : "Request received"}>
        <p>
          {isArabic ? "رقم الطلب" : "Your reference is"}{" "}
          <strong className="numeric-latin">{result.reference}</strong>.{" "}
          {isArabic
            ? "سنعود إليك بعرض سعر مفصّل. احتفظ بهذا الرقم للرجوع إليه."
            : "We will come back with an itemised quote. Keep this reference for follow-up."}
        </p>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {result && !result.ok && <Alert tone="danger">{result.error.message}</Alert>}

      <fieldset>
        <legend className="mb-3 text-sm font-bold text-steel-950">
          {isArabic ? "بيانات التواصل" : "Contact details"}
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="contactName" required>
              {dict.auth.fullName}
            </Label>
            <Input
              id="contactName"
              name="contactName"
              defaultValue={defaultName ?? ""}
              autoComplete="name"
              required
              aria-invalid={Boolean(issueFor("contactName"))}
            />
            <FieldError>{issueFor("contactName")}</FieldError>
          </div>
          <div>
            <Label htmlFor="companyNameRaw">{dict.booking.companyName}</Label>
            <Input id="companyNameRaw" name="companyNameRaw" autoComplete="organization" />
          </div>
          <div>
            <Label htmlFor="contactEmail" required>
              {dict.auth.email}
            </Label>
            <Input
              id="contactEmail"
              name="contactEmail"
              type="email"
              dir="ltr"
              defaultValue={defaultEmail ?? ""}
              autoComplete="email"
              required
              aria-invalid={Boolean(issueFor("contactEmail"))}
            />
            <FieldError>{issueFor("contactEmail")}</FieldError>
          </div>
          <div>
            <Label htmlFor="contactPhone" required>
              {dict.auth.phone}
            </Label>
            <Input
              id="contactPhone"
              name="contactPhone"
              type="tel"
              dir="ltr"
              autoComplete="tel"
              required
              aria-invalid={Boolean(issueFor("contactPhone"))}
            />
            <FieldError>{issueFor("contactPhone")}</FieldError>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-sm font-bold text-steel-950">
          {isArabic ? "المعدة المطلوبة" : "Equipment required"}
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="classId">{dict.equipment.title}</Label>
            <Select id="classId" name="classId" defaultValue={preselectedClassId ?? ""}>
              <option value="">
                {isArabic ? "غير متأكد / سأصف الاحتياج" : "Not sure — I will describe it"}
              </option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <FieldError>{issueFor("classId")}</FieldError>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="descriptionRaw">
              {isArabic ? "وصف الاحتياج" : "Describe what you need"}
            </Label>
            <Input id="descriptionRaw" name="descriptionRaw" />
            <Hint>
              {isArabic
                ? "إن لم تكن متأكداً من الفئة، صف العمل وسنقترح المعدة المناسبة."
                : "If you are not sure of the class, describe the job and we will suggest suitable equipment."}
            </Hint>
          </div>
          <div>
            <Label htmlFor="quantity">{dict.common.quantity}</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              min={1}
              max={20}
              defaultValue={1}
              className="numeric-latin"
            />
          </div>
        </div>
      </fieldset>

      {/* The numbers that decide the price — and the reason a quote can come
          back priced rather than as another set of questions. */}
      <fieldset>
        <legend className="mb-1 text-sm font-bold text-steel-950">
          {isArabic ? "تفاصيل الرفع" : "Lift details"}
        </legend>
        <p className="mb-3 text-xs text-steel-500">
          {isArabic
            ? "اختياري، لكنها تسرّع التسعير كثيراً. تُستخدم للاسترشاد فقط ولا تُعد تحديداً هندسياً."
            : "Optional, but they let us price much faster. Used for guidance only and not an engineering determination."}
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="loadWeightKg">{isArabic ? "وزن الحمل (كجم)" : "Load weight (kg)"}</Label>
            <Input
              id="loadWeightKg"
              name="loadWeightKg"
              type="number"
              min={0}
              inputMode="numeric"
              className="numeric-latin"
            />
          </div>
          <div>
            <Label htmlFor="radiusM">{isArabic ? "نصف القطر (م)" : "Radius (m)"}</Label>
            <Input
              id="radiusM"
              name="radiusM"
              type="number"
              min={0}
              step="0.5"
              inputMode="decimal"
              className="numeric-latin"
            />
          </div>
          <div>
            <Label htmlFor="liftHeightM">{isArabic ? "ارتفاع الرفع (م)" : "Lift height (m)"}</Label>
            <Input
              id="liftHeightM"
              name="liftHeightM"
              type="number"
              min={0}
              step="0.5"
              inputMode="decimal"
              className="numeric-latin"
            />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-sm font-bold text-steel-950">
          {isArabic ? "الموقع والتواريخ" : "Site and dates"}
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="branchId">{dict.filters.location}</Label>
            <Select id="branchId" name="branchId" defaultValue="">
              <option value="">{dict.common.all}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.city}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="siteCity">{dict.booking.siteCity}</Label>
            <Input id="siteCity" name="siteCity" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="siteAddressLine">{dict.booking.siteAddress}</Label>
            <Input id="siteAddressLine" name="siteAddressLine" />
          </div>
          <div>
            <Label htmlFor="startDate">{dict.booking.startDate}</Label>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              defaultValue={startDate ?? ""}
              className="numeric-latin"
            />
          </div>
          <div>
            <Label htmlFor="endDate">{dict.booking.endDate}</Label>
            <Input
              id="endDate"
              name="endDate"
              type="date"
              defaultValue={endDate ?? ""}
              className="numeric-latin"
            />
          </div>
        </div>
      </fieldset>

      <div>
        <Label htmlFor="requirements">
          {isArabic ? "ملاحظات إضافية" : "Anything else we should know"}
        </Label>
        <Textarea id="requirements" name="requirements" rows={4} />
        <Hint>
          {isArabic
            ? "قيود الدخول، طبيعة الأرض، الأسلاك العلوية، ساعات العمل، متطلبات التصاريح."
            : "Access restrictions, ground conditions, overhead lines, working hours, permit requirements."}
        </Hint>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? dict.common.loading : dict.equipment.requestQuote}
      </Button>
    </form>
  );
}
