"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { lookupBookingAction } from "@/lib/booking/actions";
import { Alert, Button, FieldError, Hint, Input, Label } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

/**
 * "Find my booking" — the customer's way back in.
 *
 * This replaces a customer login. There is no password because there is no
 * account: the reference and the email it was booked with are together the
 * credential, and the server mints a session that can see that one booking.
 *
 * The form never reports WHICH half was wrong. The action returns one message
 * for both cases; this component only renders what it is given, so there is
 * nothing here that could leak the distinction even by accident.
 */
export function BookingLookupForm({
  locale,
  dict,
  defaultReference,
}: {
  locale: Locale;
  dict: Dictionary;
  defaultReference?: string | undefined;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<{ path: string; message: string }[]>([]);

  const issueFor = (path: string) => issues.find((i) => i.path === path)?.message;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      setError(null);
      setIssues([]);

      const result = await lookupBookingAction({
        reference: String(formData.get("reference") ?? ""),
        email: String(formData.get("email") ?? ""),
        locale,
      });

      if (result.ok) {
        router.push(result.redirectTo);
        router.refresh();
        return;
      }

      setError(result.error.message);
      setIssues(result.error.issues ?? []);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <Alert tone="danger">{error}</Alert>}

      <div>
        <Label htmlFor="reference" required>
          {dict.booking.reference}
        </Label>
        <Input
          id="reference"
          name="reference"
          dir="ltr"
          autoComplete="off"
          spellCheck={false}
          defaultValue={defaultReference ?? ""}
          placeholder="RNT-XXXXXX"
          required
          aria-invalid={Boolean(issueFor("reference"))}
        />
        <Hint>{dict.booking.lookupReferenceHelp}</Hint>
        <FieldError>{issueFor("reference")}</FieldError>
      </div>

      <div>
        <Label htmlFor="email" required>
          {dict.auth.email}
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          dir="ltr"
          autoComplete="email"
          required
          aria-invalid={Boolean(issueFor("email"))}
        />
        <FieldError>{issueFor("email")}</FieldError>
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? dict.common.loading : dict.booking.lookupSubmit}
      </Button>
    </form>
  );
}
