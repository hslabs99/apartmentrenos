import { LOOKUP_TYPE_UOM } from "@/lib/lookup-types";

/** Lists tab: O4:Q16, headers row 5, data from row 6 (Category | Descriptor | Note). */
export const LISTS_UOM_RANGE = "O4:Q16";
export const LISTS_UOM_DATA_START_ROW_1_BASED = 6;

export type ParsedListsUomRow = {
  sheetRow: number;
  lookuptype: typeof LOOKUP_TYPE_UOM;
  lookupvalue: string;
  notes: string;
};

function cellString(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

/**
 * Parse UOM rows from a `Lists!O4:Q16` values grid.
 * Column O = category (UOM), P = descriptor (ea, LM, …), Q = note (Each, …).
 */
export function parseListsUomRows(
  values: unknown[][],
  rangeStartRow1Based = 4,
): ParsedListsUomRow[] {
  const out: ParsedListsUomRow[] = [];

  for (let i = 0; i < values.length; i++) {
    const sheetRow = rangeStartRow1Based + i;
    if (sheetRow < LISTS_UOM_DATA_START_ROW_1_BASED) continue;

    const row = values[i] ?? [];
    const category = cellString(row[0]);
    const descriptor = cellString(row[1]);
    const notes = cellString(row[2]);

    if (!descriptor) continue;
    if (descriptor.toLowerCase() === "descriptor") continue;
    if (category && category.toLowerCase() !== LOOKUP_TYPE_UOM.toLowerCase()) continue;

    out.push({
      sheetRow,
      lookuptype: LOOKUP_TYPE_UOM,
      lookupvalue: descriptor,
      notes,
    });
  }

  return out;
}
