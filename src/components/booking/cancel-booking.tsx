"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelBookingAction } from "@/lib/booking/actions";
import { Alert, Button, Card, CardBody } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n";
import { formatNumber, type Locale } from "@/lib/i18n/config";
import { formatMoney, parseHalalas } from "@/lib/money";

/**
 * Customer cancellation.
 *
 * A platform that sells "book online without phoning anyone" has to let people
 * un-book the same way, or the promise is half true — and a machine held by a
 * booking nobody can cancel is also out of inventory until someone notices.
 *
 * The refund figure shown BEFORE confirming is computed server-side from the
 * same cancellation tiers the policy page and the rental agreement render, so
 * the customer sees the consequence of the decision while they can still change
 * their mind. A confirm step, not a one-click destructive button: this releases
 * a machine and moves money.
 */
export function CancelBooking({
  reference,
  locale,
  dict,
  hoursNotice,
  refundPercent,
  refundDueHalalas,
  currency,
}: {
  reference: string;
  locale: Locale;
  dict: Dictionary;
  hoursNotice: number;
  refundPercent: number;
  refundDueHalalas: string;
  currency: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const money = (value: string) => formatMoney(parseHalalas(value), locale, currency);

  function onCancel() {
    startTransition(async () => {
      setError(null);
      const result = await cancelBookingAction({ reference, locale });

      if (result.ok) {
        // Re-render from the server rather than patching state locally: the
        // booking's status, its event history and the machine's availability
        // all changed, and the server is the only thing that knows all three.
        router.refresh();
        return;
      }
      setError(result.error.message);
      setConfirming(false);
    });
  }

  return (
    <Card>
      <CardBody>
        <h2 className="mb-2 text-base font-bold text-steel-950">{dict.booking.cancelTitle}</h2>
        <p className="mb-4 text-sm text-steel-600">{dict.booking.cancelBody}</p>

        <dl className="mb-4 space-y-1.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-steel-600">{dict.booking.cancelNotice}</dt>
            <dd className="font-medium text-steel-900 numeric-latin">
              {formatNumber(Math.floor(hoursNotice), locale)}{" "}
              {locale === "ar" ? "ساعة" : "hours"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-steel-600">
              {dict.booking.cancelRefundDue}
              <span className="block text-xs text-steel-500 numeric-latin">
                {formatNumber(refundPercent, locale)}%
              </span>
            </dt>
            <dd className="font-medium text-steel-900 numeric-latin">
              {money(refundDueHalalas)}
            </dd>
          </div>
        </dl>

        {refundPercent === 0 && (
          <Alert tone="warning" className="mb-4">
            {dict.booking.cancelNoRefund}
          </Alert>
        )}

        {error && (
          <Alert tone="danger" className="mb-4">
            {error}
          </Alert>
        )}

        {confirming ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={onCancel}
              disabled={isPending}
              className="bg-[--color-danger] hover:bg-[--color-danger]"
            >
              {isPending ? dict.common.loading : dict.booking.cancelConfirm}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirming(false)}
              disabled={isPending}
            >
              {dict.booking.cancelKeep}
            </Button>
          </div>
        ) : (
          <Button type="button" variant="ghost" onClick={() => setConfirming(true)}>
            {dict.booking.cancelCta}
          </Button>
        )}
      </CardBody>
    </Card>
  );
}
