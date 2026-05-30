/** `Cascading Restrictions` tab: A1:C50 — Level, Style, Colour. */
export const CASCADES_SHEET_RANGE = "A1:C50";

export type ParsedCascadeRow = {
  sheetRow: number;
  level: string;
  style: string;
  colour: string;
};

function cellString(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function normalizeHeaderLabel(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function isColourHeader(label: string): boolean {
  return label === "colour" || label === "color";
}

function isHeaderRow(row: unknown[]): boolean {
  const a = normalizeHeaderLabel(cellString(row[0]));
  const b = normalizeHeaderLabel(cellString(row[1]));
  const c = normalizeHeaderLabel(cellString(row[2]));
  return a === "level" && b === "style" && isColourHeader(c);
}

function buildRowKey(level: string, style: string, colour: string): string {
  return [level, style, colour].map((p) => p.trim().toLowerCase()).join("\x1e");
}

/**
 * Parse cascade rows from `Cascading Restrictions!A1:C50`.
 * Skips title rows until a Level / Style / Colour header row is found.
 */
export function parseCascadingRestrictionsRows(
  values: unknown[][],
  rangeStartRow1Based = 1,
): { headerRow1Based: number; rows: ParsedCascadeRow[] } {
  let headerIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (isHeaderRow(values[i] ?? [])) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex < 0) {
    return { headerRow1Based: 0, rows: [] };
  }

  const headerRow1Based = rangeStartRow1Based + headerIndex;
  const out: ParsedCascadeRow[] = [];
  const seen = new Set<string>();

  for (let i = headerIndex + 1; i < values.length; i++) {
    const sheetRow = rangeStartRow1Based + i;
    const row = values[i] ?? [];
    const level = cellString(row[0]);
    const style = cellString(row[1]);
    const colour = cellString(row[2]);

    if (!level && !style && !colour) continue;

    if (!level || !style || !colour) continue;

    const key = buildRowKey(level, style, colour);
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ sheetRow, level, style, colour });
  }

  return { headerRow1Based, rows: out };
}
