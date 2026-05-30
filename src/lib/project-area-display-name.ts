import type { AreaPublic } from "@/types/area";
import type { ProjectAreaPublic } from "@/types/project-area";

/** User-facing label: custom name if set, otherwise the Setup → Areas template name. */
export function projectAreaHeading(pa: ProjectAreaPublic, areas: AreaPublic[]): string {
  const custom = pa.displayName?.trim();
  if (custom) return custom;
  const area = areas.find((a) => a.areaid === pa.areaid);
  return area ? area.areaname : `Area #${pa.areaid}`;
}
