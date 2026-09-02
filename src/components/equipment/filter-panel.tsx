import { Input, Label, Select } from "@/components/ui";
import type { FilterDefinition } from "@/lib/db/schema/catalog";
import type { Dictionary } from "@/lib/i18n";
import { localePath, type Locale } from "@/lib/i18n/config";

/**
 * Category-aware filter panel.
 *
 * The controls come from the CATEGORY's `filterSchema` in the database, so a
 * crane offers capacity/boom/radius and a forklift offers capacity/mast/fuel —
 * without a switch statement per category, and without ever showing a filter
 * that is meaningless for what the buyer is looking at.
 *
 * A plain GET form: no JavaScript, and the resulting URL is shareable and
 * crawlable. That matters because filtered listings are real landing pages.
 */
export function FilterPanel({
  locale,
  dict,
  filters,
  manufacturers,
  branches,
  current,
  categorySlug,
}: {
  locale: Locale;
  dict: Dictionary;
  filters: FilterDefinition[];
  manufacturers: string[];
  branches: { slug: string; city: string }[];
  current: Record<string, string | undefined>;
  categorySlug?: string | undefined;
}) {
  const action = categorySlug
    ? localePath(locale, `/equipment/${categorySlug}`)
    : localePath(locale, "/equipment");

  // Only capacity is wired to a real indexed column, so it is the only range
  // filter offered here. Exposing controls that silently do nothing would be
  // worse than offering fewer.
  const capacityFilter = filters.find((f) => f.key === "capacityKg");

  return (
    <form action={action} method="get" className="space-y-5">
      {/* Preserve the active date range across filter changes — losing the
          dates would silently drop the availability context. */}
      {current.start && <input type="hidden" name="start" value={current.start} />}
      {current.end && <input type="hidden" name="end" value={current.end} />}
      {current.q && <input type="hidden" name="q" value={current.q} />}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-steel-900">
          {dict.filters.location}
        </legend>
        <Select name="branch" defaultValue={current.branch ?? ""} aria-label={dict.filters.location}>
          <option value="">{dict.common.all}</option>
          {branches.map((branch) => (
            <option key={branch.slug} value={branch.slug}>
              {branch.city}
            </option>
          ))}
        </Select>
      </fieldset>

      {manufacturers.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-steel-900">
            {dict.filters.manufacturer}
          </legend>
          <Select
            name="manufacturer"
            defaultValue={current.manufacturer ?? ""}
            aria-label={dict.filters.manufacturer}
          >
            <option value="">{dict.common.all}</option>
            {manufacturers.map((manufacturer) => (
              <option key={manufacturer} value={manufacturer}>
                {manufacturer}
              </option>
            ))}
          </Select>
        </fieldset>
      )}

      {capacityFilter && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-steel-900">
            {locale === "ar" ? capacityFilter.labelAr : capacityFilter.labelEn}
            {capacityFilter.unit ? ` (${capacityFilter.unit})` : ""}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="filter-min-capacity" className="text-xs">
                {dict.common.from}
              </Label>
              <Input
                id="filter-min-capacity"
                name="minCapacity"
                type="number"
                inputMode="numeric"
                min={0}
                step={capacityFilter.step ?? 1}
                defaultValue={current.minCapacity ?? ""}
                className="numeric-latin"
              />
            </div>
            <div>
              <Label htmlFor="filter-max-capacity" className="text-xs">
                {dict.common.to}
              </Label>
              <Input
                id="filter-max-capacity"
                name="maxCapacity"
                type="number"
                inputMode="numeric"
                min={0}
                step={capacityFilter.step ?? 1}
                defaultValue={current.maxCapacity ?? ""}
                className="numeric-latin"
              />
            </div>
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-steel-900">
          {dict.filters.availability}
        </legend>
        <label className="flex items-start gap-2.5 text-sm text-steel-700">
          <input
            type="checkbox"
            name="operator"
            value="1"
            defaultChecked={current.operator === "1"}
            className="mt-0.5 h-4 w-4 rounded border-steel-300 text-amber-600 focus:ring-amber-600/30"
          />
          {dict.filters.operatorIncluded}
        </label>
      </fieldset>

      <div className="flex gap-2">
        <button
          type="submit"
          className="min-h-[2.75rem] flex-1 rounded-[--radius-control] bg-steel-900 px-4 text-sm font-semibold text-white hover:bg-steel-800"
        >
          {dict.common.apply}
        </button>
        <a
          href={action}
          className="inline-flex min-h-[2.75rem] items-center rounded-[--radius-control] border border-steel-300 px-4 text-sm font-medium text-steel-700 hover:bg-steel-100"
        >
          {dict.filters.resetFilters}
        </a>
      </div>
    </form>
  );
}
