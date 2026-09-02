"use client";

import { useState, useTransition } from "react";
import {
  beginMfaEnrolment,
  confirmMfaEnrolment,
  disableMfa,
  regenerateRecoveryCodes,
} from "@/lib/auth/mfa-actions";
import { Alert, Button, Card, CardBody, Hint, Input, Label } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n";
import { formatNumber, type Locale } from "@/lib/i18n/config";

/**
 * TOTP enrolment and management.
 *
 * The whole flow is server-driven: the secret is generated, encrypted and
 * verified on the server, and the QR arrives as pre-rendered SVG. Nothing here
 * computes or validates a code — a client-side check would be theatre, since
 * the server has to verify anyway.
 */
type Stage = "idle" | "scanning" | "recovery";

export function MfaSetup({
  locale,
  dict,
  enrolled,
  recoveryCodesRemaining,
}: {
  locale: Locale;
  dict: Dictionary;
  enrolled: boolean;
  recoveryCodesRemaining: number;
}) {
  const isArabic = locale === "ar";
  const [stage, setStage] = useState<Stage>("idle");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [secretBase32, setSecretBase32] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [showDisable, setShowDisable] = useState(false);

  function begin() {
    startTransition(async () => {
      setError(null);
      const result = await beginMfaEnrolment();
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setQrSvg(result.qrSvg);
      setSecretBase32(result.secretBase32);
      setStage("scanning");
    });
  }

  function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "");
    startTransition(async () => {
      setError(null);
      const result = await confirmMfaEnrolment({ code });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setRecoveryCodes(result.recoveryCodes);
      // The secret is no longer needed in the browser once enrolment is done.
      setQrSvg(null);
      setSecretBase32(null);
      setStage("recovery");
    });
  }

  function onDisable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    startTransition(async () => {
      setError(null);
      const result = await disableMfa({ password });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      window.location.reload();
    });
  }

  function regenerate() {
    startTransition(async () => {
      setError(null);
      const result = await regenerateRecoveryCodes();
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setRecoveryCodes(result.recoveryCodes);
      setStage("recovery");
      setNotice(
        isArabic
          ? "تم إنشاء رموز استرداد جديدة. الرموز السابقة لم تعد صالحة."
          : "New recovery codes generated. Your previous codes no longer work.",
      );
    });
  }

  // --- Recovery codes: shown exactly once --------------------------------
  if (stage === "recovery" && recoveryCodes) {
    return (
      <Card>
        <CardBody>
          <h2 className="text-lg font-bold text-steel-950">
            {isArabic ? "رموز الاسترداد" : "Recovery codes"}
          </h2>

          {notice && (
            <Alert tone="info" className="mt-3">
              {notice}
            </Alert>
          )}

          <Alert tone="warning" className="mt-3">
            {isArabic
              ? "احفظ هذه الرموز الآن في مكان آمن. لن تُعرض مرة أخرى — فهي مخزّنة مشفّرة ولا يمكننا استرجاعها. كل رمز يعمل مرة واحدة فقط."
              : "Save these now, somewhere safe. They will not be shown again — they are stored hashed and we cannot recover them. Each code works exactly once."}
          </Alert>

          <ul className="mt-4 grid grid-cols-2 gap-2 rounded-[--radius-control] border border-steel-200 bg-steel-50 p-4 sm:grid-cols-2">
            {recoveryCodes.map((code) => (
              <li
                key={code}
                className="numeric-latin select-all text-center font-mono text-sm font-medium tracking-wider text-steel-900"
              >
                {code}
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                void navigator.clipboard?.writeText(recoveryCodes.join("\n"));
              }}
            >
              {isArabic ? "نسخ الرموز" : "Copy codes"}
            </Button>
            <Button type="button" onClick={() => window.location.reload()}>
              {isArabic ? "حفظتها — تم" : "I have saved them"}
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  // --- Already enrolled ---------------------------------------------------
  if (enrolled && stage === "idle") {
    return (
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-steel-950">{dict.auth.mfaTitle}</h2>
              <p className="mt-1 text-sm text-[--color-available]">
                ✓ {isArabic ? "مُفعّل" : "Enabled"}
              </p>
            </div>
          </div>

          {error && (
            <Alert tone="danger" className="mt-3">
              {error}
            </Alert>
          )}

          <p className="mt-3 text-sm text-steel-700">
            {isArabic
              ? `لديك ${formatNumber(recoveryCodesRemaining, locale)} من رموز الاسترداد المتبقية.`
              : `You have ${formatNumber(recoveryCodesRemaining, locale)} recovery codes remaining.`}
          </p>

          {recoveryCodesRemaining <= 2 && (
            <Alert tone="warning" className="mt-3">
              {isArabic
                ? "رموز الاسترداد لديك على وشك النفاد. أنشئ مجموعة جديدة قبل أن تفقد الوصول."
                : "You are nearly out of recovery codes. Generate a new set before you lose access."}
            </Alert>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={regenerate} disabled={isPending}>
              {isArabic ? "إنشاء رموز استرداد جديدة" : "Generate new recovery codes"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowDisable((v) => !v)}
              disabled={isPending}
            >
              {isArabic ? "تعطيل التحقق بخطوتين" : "Disable two-factor"}
            </Button>
          </div>

          {showDisable && (
            <form onSubmit={onDisable} className="mt-4 rounded-[--radius-control] border border-[--color-danger]/30 bg-[--color-danger-bg] p-4">
              <p className="text-sm text-steel-800">
                {isArabic
                  ? "تعطيل التحقق بخطوتين يقلل من حماية حسابك. أدخل كلمة المرور للتأكيد."
                  : "Disabling two-factor reduces your account security. Enter your password to confirm."}
              </p>
              <div className="mt-3">
                <Label htmlFor="disable-password" required>
                  {dict.auth.password}
                </Label>
                <Input
                  id="disable-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button type="submit" variant="danger" className="mt-3" disabled={isPending}>
                {isPending ? dict.common.loading : isArabic ? "تأكيد التعطيل" : "Confirm disable"}
              </Button>
            </form>
          )}
        </CardBody>
      </Card>
    );
  }

  // --- Scanning stage -----------------------------------------------------
  if (stage === "scanning" && qrSvg) {
    return (
      <Card>
        <CardBody>
          <h2 className="text-lg font-bold text-steel-950">
            {isArabic ? "امسح رمز الاستجابة السريعة" : "Scan the QR code"}
          </h2>
          <p className="mt-1 text-sm text-steel-600">
            {isArabic
              ? "استخدم تطبيق مصادقة مثل Google Authenticator أو 1Password أو Microsoft Authenticator."
              : "Use an authenticator app such as Google Authenticator, 1Password or Microsoft Authenticator."}
          </p>

          {error && (
            <Alert tone="danger" className="mt-3">
              {error}
            </Alert>
          )}

          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            {/*
              Server-rendered SVG. The QR contains the shared secret, so it is
              generated server-side and never reconstructed in the browser.
            */}
            <div
              className="shrink-0 rounded-[--radius-control] border border-steel-200 bg-white p-3"
              // Safe: this SVG is produced server-side by the qrcode library
              // from an otpauth:// URI we generated. No user input reaches it.
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />

            <div className="w-full">
              <p className="text-sm font-medium text-steel-800">
                {isArabic ? "أو أدخل المفتاح يدوياً:" : "Or enter this key manually:"}
              </p>
              <code className="mt-1 block select-all break-all rounded border border-steel-200 bg-steel-50 p-2 font-mono text-xs text-steel-900">
                {secretBase32}
              </code>

              <form onSubmit={confirm} className="mt-4">
                <Label htmlFor="mfa-code" required>
                  {dict.auth.mfaCode}
                </Label>
                <Input
                  id="mfa-code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoFocus
                  dir="ltr"
                  className="numeric-latin text-center text-lg tracking-[0.4em]"
                />
                <Hint>{dict.auth.mfaHelp}</Hint>

                <div className="mt-3 flex gap-2">
                  <Button type="submit" disabled={isPending}>
                    {isPending ? dict.common.loading : dict.auth.mfaVerify}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setStage("idle");
                      setQrSvg(null);
                      setSecretBase32(null);
                    }}
                    disabled={isPending}
                  >
                    {dict.common.cancel}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  // --- Not enrolled -------------------------------------------------------
  return (
    <Card>
      <CardBody>
        <h2 className="text-lg font-bold text-steel-950">{dict.auth.mfaTitle}</h2>
        <p className="mt-1 text-sm text-steel-600">
          {isArabic ? "غير مُفعّل" : "Not enabled"}
        </p>

        {error && (
          <Alert tone="danger" className="mt-3">
            {error}
          </Alert>
        )}

        <p className="mt-3 text-sm leading-relaxed text-steel-700">
          {isArabic
            ? "يضيف التحقق بخطوتين رمزاً من تطبيق المصادقة إلى كلمة المرور، فلا تكفي كلمة المرور وحدها لدخول حسابك."
            : "Two-factor authentication adds a code from an authenticator app on top of your password, so a stolen password alone is not enough to reach your account."}
        </p>

        {/* Stated plainly rather than discovered on first failed action. */}
        <Alert tone="info" className="mt-3">
          {isArabic
            ? "مطلوب لحسابات الإدارة: لا يمكن تنفيذ أي إجراء إداري في بيئة الإنتاج دون تفعيله."
            : "Required for admin accounts: no admin action can be performed in production without it."}
        </Alert>

        <Button type="button" className="mt-4" onClick={begin} disabled={isPending}>
          {isPending ? dict.common.loading : isArabic ? "تفعيل التحقق بخطوتين" : "Enable two-factor"}
        </Button>
      </CardBody>
    </Card>
  );
}
