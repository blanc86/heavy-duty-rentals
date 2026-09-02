"use client";

import { useState, useTransition } from "react";
import { verifyMfaChallenge } from "@/lib/auth/mfa-actions";
import { Alert, Button, Hint, Input, Label } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

/**
 * The MFA challenge at login.
 *
 * Reached with a session cookie that grants nothing: `getActor` returns null
 * until this succeeds, so a stolen password cannot browse the account while
 * sitting on this screen.
 *
 * Accepts a TOTP code or a recovery code in the same field — the server tries
 * TOTP first, then recovery. Making the user choose which kind they are typing
 * is friction with no security benefit.
 */
export function MfaChallenge({
  locale,
  dict,
  next,
}: {
  locale: Locale;
  dict: Dictionary;
  next?: string | undefined;
}) {
  const isArabic = locale === "ar";
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "");

    startTransition(async () => {
      setError(null);
      const result = await verifyMfaChallenge({ code, locale });

      if (!result.ok) {
        setError(result.error.message);
        // A dead challenge means the session is gone; send them back to sign in
        // rather than leaving them on a form that can never succeed.
        if (result.error.code === "no_challenge") {
          setTimeout(() => {
            window.location.href = `/${locale}/login`;
          }, 1500);
        }
        return;
      }

      // `next` was validated as a same-origin relative path when it was issued
      // by the login action, and is re-checked here before use.
      const safeNext =
        next && /^\/[a-z]{2}(\/|$)/.test(next) && !next.startsWith("//") ? next : result.redirectTo;
      window.location.href = safeNext;
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <Alert tone="danger">{error}</Alert>}

      <div>
        <Label htmlFor="mfa-challenge-code" required>
          {dict.auth.mfaCode}
        </Label>
        <Input
          id="mfa-challenge-code"
          name="code"
          inputMode="text"
          autoComplete="one-time-code"
          maxLength={20}
          required
          autoFocus
          dir="ltr"
          className="numeric-latin text-center text-lg tracking-[0.3em]"
        />
        <Hint>
          {isArabic
            ? "أدخل الرمز المكوّن من 6 أرقام من تطبيق المصادقة، أو أحد رموز الاسترداد."
            : "Enter the 6-digit code from your authenticator app, or one of your recovery codes."}
        </Hint>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? dict.common.loading : dict.auth.mfaVerify}
      </Button>

      <p className="text-center text-sm">
        <a href={`/${locale}/login`} className="text-steel-600 underline underline-offset-2">
          {isArabic ? "استخدام حساب آخر" : "Use a different account"}
        </a>
      </p>
    </form>
  );
}
