import Link from "next/link";
import type { Category } from "@/content/catalog";
import { categoryPath, machinesIn } from "@/lib/catalog";
import type { Locale } from "@/lib/i18n/config";
import { href } from "@/lib/site";
import { SiteImage, machineImageKey } from "./machine-image";

/**
 * A category as a photograph with its name over it.
 *
 * Deliberately a different shape from a machine card: categories are places to
 * go, machines are things to choose, and giving them the same card would flatten
 * that hierarchy. The steel scrim only covers the lower third, so the machine
 * stays visible and the text keeps better than 7:1 contrast.
 *
 * No machine count: on a tile it adds nothing a visitor needs to choose, and
 * "1 machine" repeated across a grid reads as a thin fleet.
 */
export function CategoryTile({ category, locale }: { category: Category; locale: Locale }) {
  const lead = machinesIn(category.slug)[0];
  if (!lead) return null;

  return (
    <Link
      href={href(locale, categoryPath(category))}
      className="group relative block aspect-[4/3] overflow-hidden rounded-card bg-steel-900"
    >
      <SiteImage
        imageKey={machineImageKey(lead.slug)}
        locale={locale}
        sizes="(min-width: 1024px) 280px, (min-width: 640px) 45vw, 90vw"
        fill
        decorative
        className="transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-steel-950/95 via-steel-950/70 to-transparent px-4 pt-14 pb-4">
        <h3 className="text-[1.4rem] leading-tight text-white group-hover:underline decoration-machine-500 decoration-2 underline-offset-4">
          {category.name[locale]}
        </h3>
      </div>
    </Link>
  );
}
