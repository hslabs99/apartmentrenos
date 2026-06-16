import type { ProjectAreaObjectPublic } from "@/types/project-area-object";

/** Workbench blank line from SKU dropdown — free-text product/supplier, no catalog SKU matching. */
export function isManual2Line(
  line: Pick<ProjectAreaObjectPublic, "linesource">,
): boolean {
  return line.linesource === "manual2";
}
