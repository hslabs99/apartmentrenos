import type { ProjectAreaPublic } from "@/types/project-area";

/**
 * Order project areas like Setup → Areas: template `sortOrder`, then `areaid` for ties
 * and legacy rows missing `sortOrder`.
 */
export function compareProjectAreasDisplayOrder(
  a: ProjectAreaPublic,
  b: ProjectAreaPublic,
): number {
  const ao = a.sortOrder;
  const bo = b.sortOrder;
  const aHas = typeof ao === "number" && Number.isFinite(ao);
  const bHas = typeof bo === "number" && Number.isFinite(bo);
  if (aHas && bHas && ao !== bo) return ao - bo;
  if (aHas && !bHas) return -1;
  if (!aHas && bHas) return 1;
  const byAreaid = a.areaid - b.areaid;
  if (byAreaid !== 0) return byAreaid;
  return a.id.localeCompare(b.id);
}
