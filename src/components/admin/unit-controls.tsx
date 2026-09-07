"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addUnitBlackoutAction, setUnitStatusAction } from "@/lib/admin/inventory-actions";
import type { Dictionary } from "@/lib/i18n";
import { toISODate } from "@/lib/i18n/config";

/**
 * Depot controls for one machine.
 *
 * Two things an operator needs the moment something goes wrong: take the
 * machine off the market, or block a window for a service or an inspection.
 *
 * Whatever comes back listing bookings this collides with is shown and LEFT on
 * screen. It is not a toast: an operator who has just grounded a crane with
 * three bookings behind it needs that list to stay put while they work through
 * it, and nothing here cancels those bookings automatically — releasing a
 * customer's machine is a decision with money and a phone call attached.
 */
export function AdminUnitControls({
  unitId,
  status,
  dict,
}: {
  unitId: string;
  status: string;
  dict: Dictionary;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [collisions, setCollisions] = useState<
    { reference: string; startDate: string; status: string }[] | null
  >(null);
  const [blackoutOpen, setBlackoutOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const today = toISODate(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [reason, setReason] = useState<"maintenance" | "inspection" | "transport" | "other">(
    "maintenance",
  );

  function handle(promise: Promise<{ ok: boolean; affectedBookings?: typeof collisions; error?: { message: string } }>) {
    startTransition(async () => {
      setError(null);
      const result = await promise;
      if (result.ok) {
        setCollisions(result.affectedBookings ?? []);
        setBlackoutOpen(false);
        router.refresh();
        return;
      }
      setError(result.error?.message ?? dict.common.error);
    });
  }

  const control =
    "rounded-[--radius-control] border border-steel-300 bg-white px-2 py-1 text-xs text-steel-800";

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="sr-only" htmlFor={`status-${unitId}`}>
          {dict.common.status}
        </label>
        <select
          id={`status-${unitId}`}
          className={control}
          value={status}
          disabled={isPending}
          onChange={(e) => handle(setUnitStatusAction({ unitId, status: e.target.value }))}
        >
          {/* Only the statuses a person sets by hand. `reserved`, `rented` and
              `in_transit` are derived from bookings; offering them here would
              let the fleet's state and its bookings disagree. */}
          <option value="available">{dict.admin.statusAvailable}</option>
          <option value="maintenance">{dict.admin.statusMaintenance}</option>
          <option value="inspection">{dict.admin.statusInspection}</option>
          <option value="out_of_service">{dict.admin.statusOutOfService}</option>
        </select>

        <button
          type="button"
          className={`${control} font-medium hover:bg-steel-100 disabled:opacity-40`}
          disabled={isPending}
          onClick={() => setBlackoutOpen((open) => !open)}
        >
          {dict.admin.blockDates}
        </button>
      </div>

      {blackoutOpen && (
        <div className="flex flex-wrap items-end gap-1.5 rounded-[--radius-control] border border-steel-200 bg-steel-50 p-2">
          <label className="flex flex-col gap-0.5 text-2xs text-steel-600">
            {dict.booking.startDate}
            <input
              type="date"
              className={control}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-0.5 text-2xs text-steel-600">
            {dict.booking.endDate}
            <input
              type="date"
              className={control}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-0.5 text-2xs text-steel-600">
            {dict.admin.reason}
            <select
              className={control}
              value={reason}
              onChange={(e) => setReason(e.target.value as typeof reason)}
            >
              <option value="maintenance">{dict.admin.statusMaintenance}</option>
              <option value="inspection">{dict.admin.statusInspection}</option>
              <option value="transport">{dict.admin.reasonTransport}</option>
              <option value="other">{dict.admin.reasonOther}</option>
            </select>
          </label>
          <button
            type="button"
            className="rounded-[--radius-control] bg-steel-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
            disabled={isPending}
            onClick={() =>
              handle(
                addUnitBlackoutAction({ unitId, reason, startDate: from, endDate: to }),
              )
            }
          >
            {dict.common.save}
          </button>
        </div>
      )}

      {collisions !== null && collisions.length > 0 && (
        <div className="rounded-[--radius-control] border border-[--color-warning] bg-[--color-warning-bg] p-2 text-2xs text-steel-800">
          <p className="font-semibold">{dict.admin.collidingBookings}</p>
          <ul className="mt-0.5 space-y-0.5">
            {collisions.map((c) => (
              <li key={c.reference} className="numeric-latin">
                {c.reference} · {c.startDate} · {c.status.replace(/_/g, " ")}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-steel-600">{dict.admin.collidingBookingsHelp}</p>
        </div>
      )}

      {collisions !== null && collisions.length === 0 && (
        <span className="text-2xs text-steel-500">{dict.admin.noCollidingBookings}</span>
      )}

      {error && <span className="text-2xs text-[--color-danger]">{error}</span>}
    </div>
  );
}
