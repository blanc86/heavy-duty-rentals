"use client";

import Link from "next/link";
import { useCallback, useSyncExternalStore } from "react";
import type { Dictionary } from "@/lib/i18n";
import { localePath, formatNumber, type Locale } from "@/lib/i18n/config";

/**
 * Compare selection — PRD C5.
 *
 * The selection is per-browser and disposable, so it lives in localStorage
 * rather than on the server: it is a scratchpad someone builds while browsing,
 * not something worth a database row or a round trip per click.
 *
 * The comparison itself is a URL (`/compare?items=…`), so once it is built it
 * can be pasted to a procurement manager and still work. localStorage holds
 * only the act of choosing.
 *
 * `useSyncExternalStore` rather than `useState` because two components read the
 * same selection — the toggle on every card, and the tray — and they must agree
 * without threading state through a server-rendered listing between them.
 */

const KEY = "hdr_compare";
const MAX = 4;

const listeners = new Set<() => void>();

/** Cached so `getSnapshot` returns a stable reference between real changes. */
let snapshot: string[] = [];
let snapshotRaw: string | null = null;

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw !== snapshotRaw) {
      snapshotRaw = raw;
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      snapshot = Array.isArray(parsed)
        ? parsed.filter((s): s is string => typeof s === "string").slice(0, MAX)
        : [];
    }
    return snapshot;
  } catch {
    // Private mode, blocked site data, or corrupt JSON. An empty selection is
    // the correct fallback: the feature degrades to "not selected", never to a
    // broken page.
    return snapshot;
  }
}

function write(next: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next.slice(0, MAX)));
  } catch {
    /* selection simply will not persist */
  }
  // Update the cache directly too, so the change is visible even when the write
  // above failed.
  snapshotRaw = null;
  snapshot = next.slice(0, MAX);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changing the selection should update this one.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** Empty on the server: nothing is selected until the browser says otherwise. */
const serverSnapshot: string[] = [];

function useSelection() {
  return useSyncExternalStore(subscribe, read, () => serverSnapshot);
}

export function CompareToggle({ slug, dict }: { slug: string; dict: Dictionary }) {
  const selection = useSelection();
  const selected = selection.includes(slug);
  const full = selection.length >= MAX && !selected;

  const toggle = useCallback(() => {
    const current = read();
    write(
      current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug].slice(0, MAX),
    );
  }, [slug]);

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={full}
      aria-pressed={selected}
      className={`rounded-[--radius-control] border px-2.5 py-1.5 text-xs font-medium transition-colors ${
        selected
          ? "border-amber-600 bg-amber-50 text-amber-800"
          : "border-steel-300 text-steel-700 hover:bg-steel-100 disabled:cursor-not-allowed disabled:opacity-40"
      }`}
      title={full ? dict.equipment.compareMax : undefined}
    >
      {selected ? dict.equipment.removeFromCompare : dict.equipment.addToCompare}
    </button>
  );
}

/**
 * The floating bar. Rendered on listing pages; hides itself when fewer than two
 * machines are selected, because comparing one thing is not a comparison.
 */
export function CompareTray({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const selection = useSelection();
  if (selection.length < 2) return null;

  const href = localePath(
    locale,
    `/compare?items=${selection.map(encodeURIComponent).join(",")}`,
  );

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center p-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-[--radius-control] border border-steel-300 bg-white px-4 py-2.5 shadow-[--shadow-raised]">
        <span className="text-sm text-steel-700 numeric-latin">
          {formatNumber(selection.length, locale)}
        </span>
        <Link
          href={href}
          className="rounded-[--radius-control] bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700"
        >
          {dict.equipment.compareTitle}
        </Link>
        <button
          type="button"
          onClick={() => write([])}
          className="text-sm text-steel-600 underline"
        >
          {dict.common.clear}
        </button>
      </div>
    </div>
  );
}
