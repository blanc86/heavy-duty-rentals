import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteImage } from "@/components/equipment/machine-image";
import { ContactBand, PageHeader } from "@/components/marketing/sections";
import { JsonLd } from "@/components/seo/json-ld";
import { SampleBadge } from "@/components/trust/sample-badge";
import { CheckIcon, Container, cn } from "@/components/ui";
import { SERVICE_AREAS } from "@/content/business";
import { PROJECTS } from "@/content/projects";
import { getMachine, machinePath } from "@/lib/catalog";
import { getDictionary } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { projectImageKey } from "@/lib/projects";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { alternates, href } from "@/lib/site";
import { keepNumbersWithUnits } from "@/lib/text";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    title: dict.meta.projectsTitle,
    description: dict.meta.projectsDescription,
    alternates: alternates(locale, "/projects"),
    openGraph: { title: dict.meta.projectsTitle, description: dict.meta.projectsDescription },
  };
}

/**
 * COMPLETED PROJECTS.
 *
 * One page with every project in full, rather than a page per project: each is
 * a few paragraphs and some figures, and a buyer comparing suppliers reads down
 * a list faster than they click through one. Cards elsewhere link to a project
 * by its anchor here.
 *
 * Each project shows who it was for (by sector), where, when, how long, what
 * was supplied, the machines — linked to their pages — and the figures that
 * matter on that kind of job. No structured data: projects are not a schema.org
 * type a search engine does anything with, and samples must not be marked up.
 */
export default async function ProjectsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const p = dict.projects;
  const crumbs = [
    { name: dict.common.home, path: "/" },
    { name: dict.nav.projects, path: "/projects" },
  ];

  return (
    <>
      <PageHeader locale={locale} dict={dict} crumbs={crumbs} title={p.title} intro={p.intro} />

      <Container>
        <ol className="divide-y divide-steel-200">
          {PROJECTS.map((project, index) => {
            const area = SERVICE_AREAS.find((a) => a.slug === project.area);
            const machines = project.equipment.map((slug) => getMachine(slug)).filter((machine) => machine !== undefined);
            return (
              <li key={project.slug}>
                <article
                  id={project.slug}
                  aria-labelledby={`${project.slug}-title`}
                  className="grid scroll-mt-24 gap-8 py-14 sm:py-16 lg:grid-cols-2 lg:gap-12"
                >
                  <div className={cn("lg:sticky lg:top-28 lg:self-start", index % 2 === 1 && "lg:order-2")}>
                    <div className="relative aspect-[16/10] overflow-hidden rounded-card bg-steel-100">
                      <SiteImage
                        imageKey={projectImageKey(project.slug)}
                        locale={locale}
                        sizes="(min-width: 1200px) 560px, (min-width: 1024px) 46vw, 100vw"
                        fill
                        {...(index === 0 ? { eager: true } : {})}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-plate bg-steel-900 px-2.5 py-1 text-sm font-semibold text-white">{project.type[locale]}</span>
                      {project.sample && <SampleBadge label={dict.common.sample} />}
                    </div>
                    <h2 id={`${project.slug}-title`} className="mt-4 text-h2">
                      {project.title[locale]}
                    </h2>
                    <p className="mt-4 text-lg text-steel-700">{keepNumbersWithUnits(project.summary[locale])}</p>

                    <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-steel-200 py-5 text-[0.95rem]">
                      <div>
                        <dt className="text-steel-600">{p.client}</dt>
                        <dd className="mt-0.5 font-semibold text-steel-900">{project.client[locale]}</dd>
                      </div>
                      <div>
                        <dt className="text-steel-600">{p.location}</dt>
                        <dd className="mt-0.5 font-semibold text-steel-900">
                          {area ? (
                            <Link href={href(locale, `/service-areas/${area.slug}`)} className="underline decoration-steel-300 underline-offset-4 hover:decoration-steel-900">
                              {project.location[locale]}
                            </Link>
                          ) : (
                            project.location[locale]
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-steel-600">{p.completed}</dt>
                        <dd className="mt-0.5 font-semibold text-steel-900 ltr-nums">{project.year}</dd>
                      </div>
                      <div>
                        <dt className="text-steel-600">{p.duration}</dt>
                        <dd className="mt-0.5 font-semibold text-steel-900">{project.duration[locale]}</dd>
                      </div>
                    </dl>

                    <h3 className="sr-only">{p.facts}</h3>
                    <ul className="mt-6 flex flex-wrap gap-3">
                      {project.facts.map((fact) => (
                        <li key={fact.label.en} className="plate plate-dark">
                          <span className={cn("plate-value", /^[\d.,]/.test(fact.value[locale]) ? "" : "plate-value-words")}>{fact.value[locale]}</span>
                          <span className="plate-label">{fact.label[locale]}</span>
                        </li>
                      ))}
                    </ul>

                    <h3 className="mt-8 text-[1.35rem]">{p.scope}</h3>
                    <ul className="mt-3 space-y-2.5">
                      {project.scope[locale].map((line) => (
                        <li key={line} className="flex items-start gap-3">
                          <CheckIcon className="mt-1 h-5 w-5 text-steel-900" />
                          <span className="text-steel-800">{keepNumbersWithUnits(line)}</span>
                        </li>
                      ))}
                    </ul>

                    <h3 className="mt-8 text-[1.35rem]">{p.equipment}</h3>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {machines.map((machine) => (
                        <li key={machine.slug}>
                          <Link
                            href={href(locale, machinePath(machine))}
                            className="inline-flex min-h-11 items-center rounded-control border border-steel-300 bg-white px-3.5 font-semibold text-steel-800 hover:border-steel-900"
                          >
                            {machine.name[locale]}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      </Container>

      <ContactBand locale={locale} dict={dict} title={p.ctaTitle} body={p.ctaBody} />
      <JsonLd data={breadcrumbJsonLd(locale, crumbs)} />
    </>
  );
}
