/** Lists tab: J4:M16, headers row 5, data from row 6 (Category | Class | Descriptor | Note). */
export const LISTS_COLOUR_RANGE = "J4:M16";
export const LISTS_COLOUR_DATA_START_ROW_1_BASED = 6;
export const LISTS_COLOUR_CATEGORY = "Colour";

export type ParsedListsColourRow = {
  sheetRow: number;
  category: string;
  colourClass: string;
  descriptor: string;
  notes: string;
};

function cellString(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

/**
 * Parse Colour rows from a `Lists!J4:M16` values grid.
 * J = category, K = class, L = descriptor, M = note.
 */
export function parseListsColourRows(
  values: unknown[][],
  rangeStartRow1Based = 4,
): ParsedListsColourRow[] {
  const out: ParsedListsColourRow[] = [];

  for (let i = 0; i < values.length; i++) {
    const sheetRow = rangeStartRow1Based + i;
    if (sheetRow < LISTS_COLOUR_DATA_START_ROW_1_BASED) continue;

    const row = values[i] ?? [];
    const category = cellString(row[0]) || LISTS_COLOUR_CATEGORY;
    const colourClass = cellString(row[1]);
    const descriptor = cellString(row[2]);
    const notes = cellString(row[3]);

    if (!descriptor) continue;
    if (descriptor.toLowerCase() === "descriptor") continue;
    if (colourClass.toLowerCase() === "class") continue;
    if (
      category &&
      category.toLowerCase() !== LISTS_COLOUR_CATEGORY.toLowerCase()
    ) {
      continue;
    }

    out.push({
      sheetRow,
      category: LISTS_COLOUR_CATEGORY,
      colourClass,
      descriptor,
      notes,
    });
  }

  return out;
}
