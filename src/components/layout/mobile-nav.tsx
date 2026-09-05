"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n/config";

/**
 * Mobile navigation drawer.
 *
 * Uses the native <dialog> element so focus trapping, Escape-to-close and the
 * inert backdrop come from the platform rather than from hand-rolled key
 * handling that usually gets one of them wrong.
 */
export function MobileNav({
  items,
  accountLabel,
  accountHref,
  openLabel,
  closeLabel,
  menuLabel,
  signOut,
}: {
  locale: Locale;
  items: { href: string; label: string }[];
  accountLabel: string;
  accountHref: string;
  openLabel: string;
  closeLabel: string;
  menuLabel: string;
  /**
   * The sign-out form, rendered on the SERVER and passed in as a slot.
   *
   * A Server Action form cannot be constructed inside a client component, and
   * this drawer must stay a client component for the <dialog> behaviour — so
   * the server hands the finished element down instead.
   */
  signOut?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={openLabel}
        aria-expanded={open}
        className="grid h-10 w-10 place-items-center rounded-[--radius-control] border border-steel-300 text-steel-800 lg:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        // Clicking the backdrop closes: the <dialog> itself is the backdrop,
        // so a click landing on it (not on the inner panel) means "outside".
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpen(false);
        }}
        className="m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-steel-950/50"
      >
        <div className="ms-auto flex h-full w-[min(20rem,85vw)] flex-col bg-white shadow-[--shadow-raised]">
          <div className="flex items-center justify-between border-b border-steel-200 px-4 py-3">
            <h2 id={titleId} className="text-sm font-semibold text-steel-900">
              {menuLabel}
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={closeLabel}
              className="grid h-9 w-9 place-items-center rounded-[--radius-control] text-steel-600 hover:bg-steel-100"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-2">
            <ul className="space-y-1">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-[--radius-control] px-3 py-3 text-sm font-medium text-steel-800 hover:bg-steel-100"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li className="pt-2">
                <Link
                  href={accountHref}
                  onClick={() => setOpen(false)}
                  className="block rounded-[--radius-control] border border-steel-300 px-3 py-3 text-center text-sm font-medium text-steel-800"
                >
                  {accountLabel}
                </Link>
              </li>
              {signOut && <li className="pt-1">{signOut}</li>}
            </ul>
          </nav>
        </div>
      </dialog>
    </>
  );
}
