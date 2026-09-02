import { Input, Label, Select } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n";
import { localePath, toISODate, type Locale } from "@/lib/i18n/config";

/**
 * The hero search form.
 *
 * A plain <form method="GET"> — no JavaScript. It submits to the equipment
 * listing with the criteria as query parameters, which means:
 *   - it works before hydration, on the slowest connection on a site
 *   - the result is a shareable, crawlable, bookmarkable URL
 *   - a procurement manager can paste the link into an email
 *
 * The reference site's homepage leads with corporate positioning and makes the
 * buyer dig for the fleet. This leads with the question they actually came
 * with: what, where, when.
 */
export function HeroSearch({
  locale,
  dict,
  branches,
}: {
  locale: Locale;
  dict: Dictionary;
  branches: { slug: string; city: string }[];
}) {
  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setDate(defaultStart.getDate() + 3);
  const defaultEnd = new Date(defaultStart);
  defaultEnd.setDate(defaultEnd.getDate() + 7);

  return (
    <form
      action={localePath(locale, "/equipment")}
      method="get"
      className="rounded-[--radius-card] border border-steel-200 bg-white p-4 shadow-[--shadow-raised] sm:p-5"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <Label htmlFor="hero-q">{dict.home.searchEquipment}</Label>
          <Input
            id="hero-q"
            name="q"
            type="search"
            placeholder={dict.home.searchEquipmentPlaceholder}
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>

        <div>
          <Label htmlFor="hero-branch">{dict.home.searchLocation}</Label>
          <Select id="hero-branch" name="branch" defaultValue="">
            <option value="">{dict.common.all}</option>
            {branches.map((branch) => (
              <option key={branch.slug} value={branch.slug}>
                {branch.city}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="hero-start">{dict.home.searchStart}</Label>
          <Input
            id="hero-start"
            name="start"
            type="date"
            defaultValue={toISODate(defaultStart)}
            min={toISODate(today)}
            className="numeric-latin"
          />
        </div>

        <div>
          <Label htmlFor="hero-end">{dict.home.searchEnd}</Label>
          <Input
            id="hero-end"
            name="end"
            type="date"
            defaultValue={toISODate(defaultEnd)}
            min={toISODate(today)}
            className="numeric-latin"
          />
        </div>
      </div>

      <button
        type="submit"
        className="mt-4 inline-flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-[--radius-control] bg-amber-500 px-6 text-base font-semibold text-steel-950 transition-colors hover:bg-amber-400 sm:w-auto"
      >
        {dict.home.searchCta}
        <svg
          viewBox="0 0 24 24"
          className="flip-in-rtl h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
        >
          <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </form>
  );
}
