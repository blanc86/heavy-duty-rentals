import Link from "next/link";
import { MACHINES, type Machine } from "@/content/catalog";
import { machinePath, plateFor } from "@/lib/catalog";
import type { Locale } from "@/lib/i18n/config";
import { href } from "@/lib/site";
import { Thumbnail, machineImageKey } from "./machine-image";

/**
 * The fleet, passing by.
 *
 * The site's one piece of ambient motion: every machine, moving slowly along
 * the foot of the hero like plant on a flatbed. It answers the first question a
 * visitor has — "do they have what I need?" — before they scroll, and every
 * item in it is a link to that machine.
 *
 * Performance: CSS transform only (see .fleet-track in globals.css), so it runs
 * on the compositor with no JavaScript. Thumbnails are fixed-size and
 * lazy-loaded, so the strip adds nothing to the hero's Largest Contentful Paint.
 *
 * Accessibility: the second copy of the list exists only to make the loop
 * seamless, so it is aria-hidden and inert — a screen reader or keyboard user
 * meets each machine once. Hovering or focusing pauses the motion, and a
 * reduced-motion preference replaces it with a scrollable row.
 */
export function FleetStrip({ locale, label }: { locale: Locale; label: string }) {
  return (
    <section aria-label={label} className="fleet-strip py-5">
      <div className="fleet-track">
        <FleetList machines={MACHINES} locale={locale} />
        <FleetList machines={MACHINES} locale={locale} duplicate />
      </div>
    </section>
  );
}

function FleetList({ machines, locale, duplicate = false }: { machines: Machine[]; locale: Locale; duplicate?: boolean }) {
  return (
    <ul
      className={duplicate ? "fleet-duplicate flex" : "flex"}
      {...(duplicate ? { "aria-hidden": true, inert: true } : {})}
    >
      {machines.map((machine) => {
        const plate = plateFor(machine, locale);
        return (
          <li key={machine.slug} className="w-64 shrink-0 px-2 sm:w-72">
            <Link
              href={href(locale, machinePath(machine))}
              tabIndex={duplicate ? -1 : undefined}
              className="group flex items-center gap-3 rounded-card bg-white/95 p-2 pe-3 text-steel-900 ring-1 ring-white/20 backdrop-blur hover:bg-white"
            >
              <span className="relative block h-14 w-[4.7rem] shrink-0 overflow-hidden rounded-[6px] bg-steel-200">
                <Thumbnail imageKey={machineImageKey(machine.slug)} width={80} height={60} />
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2 text-[0.95rem] leading-tight font-semibold group-hover:underline underline-offset-2">
                  {machine.name[locale]}
                </span>
                {plate && (
                  <span className="mt-0.5 block text-sm text-steel-600">
                    <span className="ltr-nums font-semibold text-steel-900">{plate.value}</span> {plate.label}
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
