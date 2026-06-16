import type { ProjectAreaObjectPublic } from "@/types/project-area-object";

/** Sentinel value for workbench SKU dropdown “Add empty row…” option. */
export const SCOPE_LINE_SKU_ADD_BLANK_VALUE = "__wb_add_blank_line__";

type LineOrderFields = Pick<
  ProjectAreaObjectPublic,
  "id" | "objectid" | "lineSortOrder" | "dateadded"
>;

/** Display order for lines within one project area instance. */
export function compareProjectAreaLineOrder(
  a: LineOrderFields,
  b: LineOrderFields,
): number {
  const aSort = a.lineSortOrder;
  const bSort = b.lineSortOrder;
  const aHas = typeof aSort === "number" && Number.isFinite(aSort);
  const bHas = typeof bSort === "number" && Number.isFinite(bSort);
  if (aHas && bHas) return aSort - bSort;
  if (aHas !== bHas) return aHas ? -1 : 1;
  if (a.objectid !== b.objectid) return a.objectid - b.objectid;
  const ad = a.dateadded ?? "";
  const bd = b.dateadded ?? "";
  if (ad !== bd) return ad.localeCompare(bd);
  return a.id.localeCompare(b.id);
}

export function sortProjectAreaLines<T extends LineOrderFields>(lines: T[]): T[] {
  return [...lines].sort(compareProjectAreaLineOrder);
}

type LineWithInsertAnchor = LineOrderFields & {
  insertedAfterLineId?: string | null;
};

/** Workbench table: anchor row, then rows inserted below it, then bundled children. */
export function workbenchFlatDisplayLines<T extends LineWithInsertAnchor>(
  topLevel: T[],
): Array<{ line: T; renderBundledAfter: boolean }> {
  const out: Array<{ line: T; renderBundledAfter: boolean }> = [];
  for (const row of topLevel) {
    if (row.insertedAfterLineId?.trim()) continue;
    out.push({ line: row, renderBundledAfter: true });
    for (const inserted of topLevel) {
      if (inserted.insertedAfterLineId?.trim() === row.id) {
        out.push({ line: inserted, renderBundledAfter: false });
      }
    }
  }
  return out;
}
