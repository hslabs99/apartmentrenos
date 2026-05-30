import {
  BLIND_WIDTH_MM_VALUES,
  blindWidthFieldName,
  isSupportedBlindWidthMm,
} from "@/lib/google/blinds-width-columns";
import type { DataBlindPublic } from "@/types/data-blind-public";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";

export function uniqueBlindDropValues(rows: DataBlindPublic[]): number[] {
  const set = new Set<number>();
  for (const row of rows) {
    if (Number.isFinite(row.dropMm)) set.add(row.dropMm);
  }
  return [...set].sort((a, b) => a - b);
}

export function uniqueBlindWidthValues(rows: DataBlindPublic[]): number[] {
  const set = new Set<number>();
  for (const row of rows) {
    for (const w of BLIND_WIDTH_MM_VALUES) {
      const key = blindWidthFieldName(w);
      if (row.prices[key] != null && Number.isFinite(row.prices[key])) set.add(w);
    }
  }
  return set.size > 0
    ? [...set].sort((a, b) => a - b)
    : [...BLIND_WIDTH_MM_VALUES];
}

/** Types with a price at the given drop × width cell. */
export function blindTypesForDropWidth(
  rows: DataBlindPublic[],
  dropMm: number,
  widthMm: number,
): string[] {
  if (!isSupportedBlindWidthMm(widthMm)) return [];
  const field = blindWidthFieldName(widthMm);
  const types = new Set<string>();
  for (const row of rows) {
    if (row.dropMm !== dropMm) continue;
    const price = row.prices[field];
    if (price != null && Number.isFinite(price)) types.add(row.type);
  }
  return [...types].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function blindUnitPriceForSelection(
  rows: DataBlindPublic[],
  blindType: string,
  dropMm: number,
  widthMm: number,
): number | null {
  if (!blindType.trim() || !isSupportedBlindWidthMm(widthMm)) return null;
  const field = blindWidthFieldName(widthMm);
  for (const row of rows) {
    if (row.type !== blindType || row.dropMm !== dropMm) continue;
    const price = row.prices[field];
    if (price != null && Number.isFinite(price)) return price;
  }
  return null;
}

export function isBlindsSystemLine(row: ProjectAreaObjectPublic): boolean {
  return row.systemObjectKind === "blinds";
}

export function blindsSelectionComplete(row: ProjectAreaObjectPublic): boolean {
  return (
    isBlindsSystemLine(row) &&
    Boolean(row.blindType?.trim()) &&
    row.blindDropMm != null &&
    row.blindWidthMm != null
  );
}

export function blindsSummaryLabel(row: ProjectAreaObjectPublic): string {
  const type = row.blindType?.trim() || "—";
  const drop = row.blindDropMm != null ? `${row.blindDropMm}` : "—";
  const width = row.blindWidthMm != null ? `${row.blindWidthMm}` : "—";
  const colour = row.blindColour?.trim() || "—";
  return `${type} · Drop ${drop} · W ${width} · ${colour}`;
}

export function blindsSkuDisplayLabel(row: ProjectAreaObjectPublic): string {
  if (!blindsSelectionComplete(row)) return "Select drop, width, style…";
  return blindsSummaryLabel(row);
}
