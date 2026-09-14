import { CATEGORIES, MACHINES, type Category, type Machine } from "@/content/catalog";
import { formatSpecValue, SPEC_DEFINITIONS } from "@/content/specs";
import type { Locale } from "@/lib/i18n/config";

/**
 * Read access to the catalogue, and the few derived facts every page needs.
 * Pages never index into CATEGORIES or MACHINES directly, so an ordering or
 * lookup rule is written once.
 */

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function getMachine(slug: string): Machine | undefined {
  return MACHINES.find((m) => m.slug === slug);
}

export function machinesIn(categorySlug: string): Machine[] {
  return MACHINES.filter((m) => m.category === categorySlug);
}

/** Categories that actually contain a machine — an empty category never renders. */
export function activeCategories(): Category[] {
  return CATEGORIES.filter((c) => machinesIn(c.slug).length > 0);
}

export function machinePath(machine: Machine): string {
  return `/equipment/${machine.category}/${machine.slug}`;
}

export function categoryPath(category: Category | string): string {
  return `/equipment/${typeof category === "string" ? category : category.slug}`;
}

/**
 * A spread across the range for the home page: the first machine of each of
 * six contrasting categories, so the section shows breadth rather than three
 * sizes of crane.
 */
const FEATURED_CATEGORIES = [
  "mobile-cranes",
  "excavators",
  "forklifts",
  "manlifts",
  "generators",
  "low-bed-trailers",
];

export function featuredMachines(): Machine[] {
  return FEATURED_CATEGORIES.map((slug) => machinesIn(slug)[0]).filter(
    (m): m is Machine => m !== undefined,
  );
}

export interface Plate {
  value: string;
  label: string;
}

/** The rating-plate figure for a machine: the one number it is chosen by. */
export function plateFor(machine: Machine, locale: Locale): Plate | null {
  const category = getCategory(machine.category);
  if (!category) return null;
  const raw = machine.specs[category.plateSpec];
  if (raw === undefined) return null;
  return {
    value: formatSpecValue(category.plateSpec, raw, locale),
    label: SPEC_DEFINITIONS[category.plateSpec].label[locale],
  };
}

/** "3 machines" / "3 معدات", with Arabic's dual and plural forms. */
export function machineCount(count: number, locale: Locale): string {
  if (locale === "en") return count === 1 ? "1 machine" : `${count} machines`;
  if (count === 1) return "معدة واحدة";
  if (count === 2) return "معدتان";
  if (count >= 3 && count <= 10) return `${count} معدات`;
  return `${count} معدة`;
}

/** Whether a category is lifting work, where radius and height decide the machine. */
export function isCraneCategory(slug: string): boolean {
  return slug === "mobile-cranes" || slug === "crawler-cranes" || slug === "boom-trucks";
}
