import type { ProjectAreaPublic } from "@/types/project-area";
import type { ProjectPublic } from "@/types/project";

/** Room ceiling height: area override, else project default. */
export function effectiveCeilingHeightM(
  pa: ProjectAreaPublic,
  project: ProjectPublic | null,
): number | null {
  if (pa.ceilingheightm != null) return pa.ceilingheightm;
  return project?.ceilingheightm ?? null;
}

export function areaCeilingHeightUsesProjectDefault(pa: ProjectAreaPublic): boolean {
  return pa.ceilingheightm == null;
}

export function areaCeilingHeightPlaceholder(project: ProjectPublic | null): string {
  const inherited = project?.ceilingheightm;
  if (inherited != null) return String(inherited);
  return "Optional";
}

export function areaCeilingHeightInputTitle(
  pa: ProjectAreaPublic,
  project: ProjectPublic | null,
): string | undefined {
  if (!areaCeilingHeightUsesProjectDefault(pa)) return undefined;
  const inherited = project?.ceilingheightm;
  if (inherited == null) return "Enter a height or set the project default above";
  return `Using project ceiling height (${inherited} m). Enter a value to override this room (e.g. lower bathroom ceiling). Clear to revert.`;
}
