"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { loginAction, registerAction, type ActionResult } from "@/lib/auth/actions";
import { Alert, Button, FieldError, Hint, Input, Label } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

/**
 * Login / registration form.
 *
 * All validation, rate limiting and authentication happen in the Server Action.
 * The client does no security work — it collects input and renders whatever the
 * server decided. Any check here would be a UX nicety, never a control.
 */
export function AuthForm({
  mode,
  locale,
  dict,
  redirectTo,
}: {
  mode: "login" | "register";
  locale: Locale;
  dict: Dictionary;
  redirectTo?: string | undefined;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isCompany, setIsCompany] = useState(false);

  const issues = result && !result.ok ? (result.error.issues ?? []) : [];
  const issueFor = (path: string) => issues.find((i) => i.path === path)?.message;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const payload =
        mode === "login"
          ? {
              email: String(formData.get("email") ?? ""),
              password: String(formData.get("password") ?? ""),
              locale,
              ...(redirectTo ? { redirectTo } : {}),
            }
          : {
              fullName: String(formData.get("fullName") ?? ""),
              email: String(formData.get("email") ?? ""),
              password: String(formData.get("password") ?? ""),
              locale,
              marketingConsent: formData.get("marketingConsent") === "on",
              ...(formData.get("phone") ? { phone: String(formData.get("phone")) } : {}),
              ...(isCompany && formData.get("companyName")
                ? { companyName: String(formData.get("companyName")) }
                : {}),
            };

      const response = mode === "login" ? await loginAction(payload) : await registerAction(payload);
      setResult(response);
      if (response.ok && response.redirectTo) {
        router.push(response.redirectTo);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {result && !result.ok && (
        <Alert tone="danger">
          {result.error.message}
        </Alert>
      )}

      {mode === "register" && (
        <div>
          <Label htmlFor="fullName" required>
            {dict.auth.fullName}
          </Label>
          <Input
            id="fullName"
            name="fullName"
            autoComplete="name"
            required
            aria-invalid={Boolean(issueFor("fullName"))}
          />
          <FieldError>{issueFor("fullName")}</FieldError>
        </div>
      )}

      <div>
        <Label htmlFor="email" required>
          {dict.auth.email}
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          dir="ltr"
          aria-invalid={Boolean(issueFor("email"))}
        />
        <FieldError>{issueFor("email")}</FieldError>
      </div>

      {mode === "register" && (
        <div>
          <Label htmlFor="phone">
            {dict.auth.phone} <span className="font-normal text-steel-500">({dict.common.optional})</span>
          </Label>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" dir="ltr" />
        </div>
      )}

      <div>
        <Label htmlFor="password" required>
          {dict.auth.password}
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={mode === "register" ? 12 : undefined}
          aria-invalid={Boolean(issueFor("password"))}
        />
        {mode === "register" && <Hint>{dict.auth.passwordHelp}</Hint>}
        <FieldError>{issueFor("password")}</FieldError>
      </div>

      {mode === "register" && (
        <>
          <label className="flex items-start gap-2.5 text-sm text-steel-700">
            <input
              type="checkbox"
              checked={isCompany}
              onChange={(e) => setIsCompany(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-steel-300 text-amber-600 focus:ring-amber-600/30"
            />
            {dict.booking.company}
          </label>

          {isCompany && (
            <div>
              <Label htmlFor="companyName" required>
                {dict.booking.companyName}
              </Label>
              <Input id="companyName" name="companyName" autoComplete="organization" />
            </div>
          )}

          {/* PDPL: unbundled, unticked by default, and separate from terms.
              Consent to marketing is a distinct act from creating an account. */}
          <label className="flex items-start gap-2.5 text-sm text-steel-700">
            <input
              type="checkbox"
              name="marketingConsent"
              className="mt-0.5 h-4 w-4 rounded border-steel-300 text-amber-600 focus:ring-amber-600/30"
            />
            {dict.booking.marketingConsent}
          </label>
        </>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? dict.common.loading : mode === "login" ? dict.auth.signInCta : dict.auth.signUpCta}
      </Button>
    </form>
  );
}
