"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CloseIcon, MenuIcon, cn } from "@/components/ui";
import type { NavItem } from "./nav-links";

/**
 * Mobile navigation.
 *
 * A full-height panel rather than a dropdown: on a phone the menu is where
 * people go to find the phone number, so the contact actions sit inside it,
 * large, beneath the links.
 *
 * Accessible as a modal: focus moves into the panel when it opens, Tab stays
 * inside it, Escape closes it, focus returns to the button, and the page
 * behind stops scrolling.
 */
export function MobileMenu({
  items,
  openLabel,
  closeLabel,
  menuLabel,
  children,
}: {
  items: NavItem[];
  openLabel: string;
  closeLabel: string;
  menuLabel: string;
  /** Contact actions rendered beneath the links. */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel?.querySelector<HTMLElement>("a, button")?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={openLabel}
        className="inline-flex h-11 w-11 items-center justify-center rounded-control text-steel-900 hover:bg-steel-100 lg:hidden"
      >
        <MenuIcon className="h-6 w-6" />
      </button>

      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-label={menuLabel}
        hidden={!open}
        className="fixed inset-0 z-50 flex flex-col bg-white lg:hidden"
      >
        <div className="flex h-16 items-center justify-end border-b border-steel-200 px-5">
          <button
            type="button"
            onClick={close}
            aria-label={closeLabel}
            className="inline-flex h-11 w-11 items-center justify-center rounded-control text-steel-900 hover:bg-steel-100"
          >
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>
        <nav aria-label={menuLabel} className="flex-1 overflow-y-auto px-5 py-4">
          <ul className="divide-y divide-steel-200">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn("flex min-h-14 items-center font-display text-2xl font-bold text-steel-900")}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-6 grid gap-3" onClick={() => setOpen(false)}>
            {children}
          </div>
        </nav>
      </div>
    </>
  );
}
