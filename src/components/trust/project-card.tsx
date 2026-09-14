import Link from "next/link";
import { SiteImage } from "@/components/equipment/machine-image";
import { ClockIcon, PinIcon, cn } from "@/components/ui";
import type { Project } from "@/content/projects";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { projectImageKey, projectPath } from "@/lib/projects";
import { href } from "@/lib/site";
import { keepNumbersWithUnits } from "@/lib/text";
import { SampleBadge } from "./sample-badge";

/**
 * A completed project in a grid.
 *
 * Wider than a machine card (16:10, a site not a machine) and led by where and
 * when, because "Jubail Industrial City, 2025" is what makes a project read as
 * work that happened. The whole card opens the project on the projects page.
 */
export function ProjectCard({
  project,
  locale,
  dict,
  headingLevel = "h3",
  className,
}: {
  project: Project;
  locale: Locale;
  dict: Dictionary;
  headingLevel?: "h2" | "h3";
  className?: string;
}) {
  const Heading = headingLevel;

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-card border border-steel-200 bg-white transition-colors duration-150 hover:border-steel-400",
        className,
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-steel-100">
        <SiteImage
          imageKey={projectImageKey(project.slug)}
          locale={locale}
          sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
          fill
          decorative
          className="transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <span className="absolute start-3 top-3 rounded-plate bg-steel-950/85 px-2.5 py-1 text-sm font-semibold text-white">
          {project.type[locale]}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-steel-600">
          <span className="inline-flex items-center gap-1.5">
            <PinIcon className="h-4 w-4" />
            {project.location[locale]}
          </span>
          <span className="ltr-nums">{project.year}</span>
        </p>
        <Heading className="mt-2 text-[1.4rem] leading-tight">
          <Link
            href={href(locale, projectPath(project))}
            className="after:absolute after:inset-0 after:content-[''] group-hover:underline decoration-2 underline-offset-4"
          >
            {project.title[locale]}
          </Link>
        </Heading>
        <p className="mt-2 line-clamp-3 text-[0.95rem] text-steel-600">{keepNumbersWithUnits(project.summary[locale])}</p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-steel-800">
            <ClockIcon className="h-4 w-4" />
            {project.duration[locale]}
          </span>
          {project.sample && <SampleBadge label={dict.common.sample} />}
        </div>
      </div>
    </article>
  );
}
