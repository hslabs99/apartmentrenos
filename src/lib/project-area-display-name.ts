import type { AreaPublic } from "@/types/area";
import type { ProjectAreaPublic } from "@/types/project-area";

/** Setup → Areas template name for this project area (never the nickname). */
export function projectAreaTemplateName(pa: ProjectAreaPublic, areas: AreaPublic[]): string {
  const area = areas.find((a) => a.areaid === pa.areaid);
  return area ? area.areaname : `Area #${pa.areaid}`;
}

/** Optional user nickname only (display); empty when unset. Not used as a key. */
export function projectAreaNickname(pa: ProjectAreaPublic): string {
  return pa.displayName?.trim() ?? "";
}

/**
 * User-facing label: template area name, with optional nickname in parentheses
 * (e.g. "Bathroom (Master)" / "Bathroom (En-suite)").
 */
export function projectAreaHeading(pa: ProjectAreaPublic, areas: AreaPublic[]): string {
  const template = projectAreaTemplateName(pa, areas);
  const nick = projectAreaNickname(pa);
  return nick ? `${template} (${nick})` : template;
}
