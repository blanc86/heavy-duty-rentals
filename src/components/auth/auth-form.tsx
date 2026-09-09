"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { loginAction, type ActionResult } from "@/lib/auth/actions";
import { Alert, Button, FieldError, Input, Label } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

/**
 * Sign-in form — for people who run the business, not for customers.
 *
 * Customers have no accounts and no passwords; they reach a booking with its
 * reference and the email it was booked with. This form exists for the owner,
 * the depot staff, and business accounts with procurement terms.
 *
 * All validation, rate limiting and authentication happen in the Server Action.
 * The client does no security work — it collects input and renders whatever the
 * server decided. Any check here would be a UX nicety, never a control.
 */
export function AuthForm({
  locale,
  dict,
  redirectTo,
}: {
  locale: Locale;
  dict: Dictionary;
  redirectTo?: string | undefined;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  const issues = result && !result.ok ? (result.error.issues ?? []) : [];
  const issueFor = (path: string) => issues.find((i) => i.path === path)?.message;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const response = await loginAction({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        locale,
        ...(redirectTo ? { redirectTo } : {}),
      });

      setResult(response);
      if (response.ok && response.redirectTo) {
        router.push(response.redirectTo);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {result && !result.ok && <Alert tone="danger">{result.error.message}</Alert>}

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

      <div>
        <Label htmlFor="password" required>
          {dict.auth.password}
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(issueFor("password"))}
        />
        <FieldError>{issueFor("password")}</FieldError>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? dict.common.loading : dict.auth.signInCta}
      </Button>
    </form>
  );
}
