import { LOOKUP_TYPE_STYLE } from "@/lib/lookup-types";

/** Lists tab: F4:H16, headers row 5, data from row 6 (Category | Descriptor | Note). */
export const LISTS_STYLE_RANGE = "F4:H16";
export const LISTS_STYLE_DATA_START_ROW_1_BASED = 6;

export type ParsedListsStyleRow = {
  sheetRow: number;
  lookuptype: typeof LOOKUP_TYPE_STYLE;
  lookupvalue: string;
  notes: string;
};

function cellString(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

/**
 * Parse Style rows from a `Lists!F4:H16` values grid.
 * Column F = category (Style), G = descriptor (lookup value), H = note.
 */
export function parseListsStyleRows(
  values: unknown[][],
  rangeStartRow1Based = 4,
): ParsedListsStyleRow[] {
  const out: ParsedListsStyleRow[] = [];

  for (let i = 0; i < values.length; i++) {
    const sheetRow = rangeStartRow1Based + i;
    if (sheetRow < LISTS_STYLE_DATA_START_ROW_1_BASED) continue;

    const row = values[i] ?? [];
    const category = cellString(row[0]);
    const descriptor = cellString(row[1]);
    const notes = cellString(row[2]);

    if (!descriptor) continue;
    if (descriptor.toLowerCase() === "descriptor") continue;
    if (category && category.toLowerCase() !== LOOKUP_TYPE_STYLE.toLowerCase()) continue;

    out.push({
      sheetRow,
      lookuptype: LOOKUP_TYPE_STYLE,
      lookupvalue: descriptor,
      notes,
    });
  }

  return out;
}
