import type { ImageKey } from "@/content/images.generated";
import { PROJECTS, type Project } from "@/content/projects";

export function projectImageKey(slug: string): ImageKey {
  return `project/${slug}` as ImageKey;
}

/** Anchor of a project on the projects page. */
export function projectPath(project: Project): string {
  return `/projects#${project.slug}`;
}

export function projectsIn(areaSlug: string): Project[] {
  return PROJECTS.filter((project) => project.area === areaSlug);
}

/** The first three, in the order content/projects.ts lists them. */
export function featuredProjects(): Project[] {
  return PROJECTS.slice(0, 3);
}
