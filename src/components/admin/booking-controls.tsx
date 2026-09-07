"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  adminCancelBookingAction,
  markOnHireAction,
  markReturnedAction,
} from "@/lib/admin/booking-actions";
import type { Dictionary } from "@/lib/i18n";

/**
 * Depot controls for one booking row.
 *
 * Which control appears is driven by the booking's CURRENT status, so the
 * console never offers a transition the server would refuse. That is a
 * convenience, not the check: every action re-verifies admin permission and MFA
 * server-side, because a Server Action is reachable without ever loading the
 * page that renders its button.
 *
 * Cancelling asks twice. The other two are recoverable by their inverse; a
 * cancellation refunds money and releases the machine.
 */
export function AdminBookingControls({
  reference,
  status,
  dict,
}: {
  reference: string;
  status: string;
  dict: Dictionary;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [isPending, startTransition] = useTransition();

  function run(action: (input: unknown) => Promise<{ ok: boolean; error?: { message: string } }>) {
    startTransition(async () => {
      setError(null);
      const result = await action({ reference });
      if (result.ok) {
        setConfirmingCancel(false);
        // The row's status, the machine's availability and the event log all
        // moved. Re-render from the server rather than guessing locally.
        router.refresh();
        return;
      }
      setError(result.error?.message ?? dict.common.error);
      setConfirmingCancel(false);
    });
  }

  const button =
    "rounded-[--radius-control] border border-steel-300 px-2 py-1 text-xs font-medium text-steel-700 transition-colors hover:bg-steel-100 disabled:opacity-40";

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap gap-1">
        {status === "confirmed" && (
          <button
            type="button"
            className={button}
            disabled={isPending}
            onClick={() => run(markOnHireAction)}
          >
            {dict.admin.markOnHire}
          </button>
        )}

        {status === "active" && (
          <button
            type="button"
            className={button}
            disabled={isPending}
            onClick={() => run(markReturnedAction)}
          >
            {dict.admin.markReturned}
          </button>
        )}

        {["pending_payment", "confirmed", "active"].includes(status) &&
          (confirmingCancel ? (
            <>
              <button
                type="button"
                className="rounded-[--radius-control] border border-[--color-danger] px-2 py-1 text-xs font-medium text-[--color-danger] disabled:opacity-40"
                disabled={isPending}
                onClick={() => run(adminCancelBookingAction)}
              >
                {dict.admin.cancelConfirm}
              </button>
              <button
                type="button"
                className={button}
                disabled={isPending}
                onClick={() => setConfirmingCancel(false)}
              >
                {dict.common.cancel}
              </button>
            </>
          ) : (
            <button
              type="button"
              className={button}
              disabled={isPending}
              onClick={() => setConfirmingCancel(true)}
            >
              {dict.admin.cancelBooking}
            </button>
          ))}
      </div>

      {confirmingCancel && (
        <span className="text-2xs text-steel-500">{dict.admin.cancelRefundsInFull}</span>
      )}
      {error && <span className="text-2xs text-[--color-danger]">{error}</span>}
    </div>
  );
}
