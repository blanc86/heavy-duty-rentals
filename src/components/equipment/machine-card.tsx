import Link from "next/link";
import type { Machine } from "@/content/catalog";
import { formattedSpecs } from "@/content/specs";
import { WhatsAppIcon, cn } from "@/components/ui";
import { getCategory, machinePath, plateFor } from "@/lib/catalog";
import { whatsappHref } from "@/lib/contact";
import { t, type Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { href } from "@/lib/site";
import { SiteImage, machineImageKey } from "./machine-image";
import { RatingPlate } from "./rating-plate";

/**
 * A machine in a grid.
 *
 * The whole card opens the machine's page (a stretched link on the title, so
 * there is one link rather than a card-shaped one wrapping a button). The one
 * action on the card itself is WhatsApp, prefilled with the machine's name —
 * the shortest path from "that's the one" to a conversation. The yellow quote
 * button lives on the machine page, so a grid of twelve cards is not a wall of
 * yellow competing with itself.
 */
export function MachineCard({
  machine,
  locale,
  dict,
  headingLevel = "h3",
  sizes = "(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw",
  className,
}: {
  machine: Machine;
  locale: Locale;
  dict: Dictionary;
  headingLevel?: "h2" | "h3";
  sizes?: string;
  className?: string;
}) {
  const Heading = headingLevel;
  const plate = plateFor(machine, locale);
  const category = getCategory(machine.category);
  // Two supporting specs beside the plate, skipping the one the plate shows.
  const extras = formattedSpecs(machine, locale)
    .filter((spec) => spec.key !== category?.plateSpec)
    .slice(0, 2);

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-card border border-steel-200 bg-white transition-colors duration-150 hover:border-steel-400",
        className,
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-steel-100">
        <SiteImage imageKey={machineImageKey(machine.slug)} locale={locale} sizes={sizes} fill />
        {plate && (
          <div className="absolute start-3 bottom-3">
            <RatingPlate plate={plate} />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        {category && <p className="text-sm font-semibold text-steel-600">{category.name[locale]}</p>}
        <Heading className="mt-1 text-[1.45rem] leading-tight">
          <Link
            href={href(locale, machinePath(machine))}
            className="after:absolute after:inset-0 after:content-[''] group-hover:underline decoration-2 underline-offset-4"
          >
            {machine.name[locale]}
          </Link>
        </Heading>

        {extras.length > 0 && (
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[0.95rem]">
            {extras.map((spec) => (
              <div key={spec.key}>
                <dt className="text-steel-600">{spec.label}</dt>
                <dd className="font-semibold text-steel-900 ltr-nums [unicode-bidi:plaintext]">{spec.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <p className="mt-3 text-[0.95rem] text-steel-600">
          {machine.operator === "included" ? dict.equipment.operatorIncluded : dict.equipment.operatorOptional}
        </p>

        <div className="relative z-10 mt-auto pt-5">
          <a
            href={whatsappHref(t(dict.messages.machine, { machine: machine.name[locale] }))}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-control border border-whatsapp-600 px-4 font-semibold text-whatsapp-700 hover:bg-whatsapp-600 hover:text-white"
          >
            <WhatsAppIcon className="h-[1.1rem] w-[1.1rem]" />
            {dict.cta.enquireNow}
          </a>
        </div>
      </div>
    </article>
  );
}
